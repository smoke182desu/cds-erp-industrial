import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lead, EtapaFunil,
  ETAPAS_FUNIL, ORIGEM_LABELS,
  subscribeLeads, adicionarLead, atualizarLead,
} from '../services/leadsService';
import {
  Mensagem, buscarMensagens, enviarMensagem, enviarMidia,
} from '../services/conversasService';
import {
  PropostaDados, ItemProposta,
  proximoNumeroProposta, abrirProposta,
} from '../services/propostaService';
import { useERP } from '../contexts/ERPContext';
import { Cliente, Proposta } from '../types';
import ConversaInteligente from '../components/ConversaInteligente';
import { NovoClienteModal } from '../components/NovoClienteModal';

// ─── cores por etapa ─────────────────────────────────────────────────────────
const ETAPA_COR: Record<EtapaFunil, string> = {
  lead_novo: '#6366f1', contato_feito: '#0ea5e9', qualificado: '#f59e0b',
  proposta_enviada: '#8b5cf6', negociacao: '#ec4899',
  fechado_ganho: '#10b981', fechado_perdido: '#ef4444',
};
const ETAPA_BADGE: Record<EtapaFunil, string> = {
  lead_novo:        'bg-indigo-100 text-indigo-700',
  contato_feito:    'bg-sky-100 text-sky-700',
  qualificado:      'bg-amber-100 text-amber-700',
  proposta_enviada: 'bg-violet-100 text-violet-700',
  negociacao:       'bg-pink-100 text-pink-700',
  fechado_ganho:    'bg-emerald-100 text-emerald-700',
  fechado_perdido:  'bg-red-100 text-red-700',
};

function fmt(v?: number) {
  return v ? `R$ ${v.toLocaleString('pt-BR')}` : '';
}
function horaMsg(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── Painel de Conversa (com suporte a mídias) ───────────────────────────────
function ConversaPanel({ lead, onEtapaChange, textoInjetado, onMsgsChange }: {
  lead: Lead;
  onEtapaChange: (etapa: EtapaFunil) => void;
  textoInjetado: { v: string; n: number };
  onMsgsChange: (msgs: Mensagem[]) => void;
}) {
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const { state } = useERP();
  const clienteRelacionado = state.clientes.find((c: Cliente) => (lead.telefone && c.telefone === lead.telefone) || (lead.clienteId && c.id === lead.clienteId));
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastN = useRef(0);

  const carregar = useCallback(async () => {
    if (!lead.telefone) return;
    setLoading(true);
    try {
      const data = await buscarMensagens(lead.telefone);
      setMsgs(data);
      onMsgsChange(data);
    } finally { setLoading(false); }
  }, [lead.telefone, onMsgsChange]);

  useEffect(() => { carregar(); const id = setInterval(carregar, 8000); return () => clearInterval(id); }, [carregar]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => {
    if (textoInjetado.n > 0 && textoInjetado.n !== lastN.current) {
      lastN.current = textoInjetado.n;
      setTexto(textoInjetado.v);
    }
  }, [textoInjetado.n]);

  // Limpa preview quando arquivo muda
  useEffect(() => {
    if (arquivoSelecionado && arquivoSelecionado.type.startsWith('image/')) {
      const url = URL.createObjectURL(arquivoSelecionado);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [arquivoSelecionado]);

  const selecionarArquivo = (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      alert('Arquivo muito grande. Maximo 16MB.');
      return;
    }
    setArquivoSelecionado(file);
  };

  const cancelarArquivo = () => {
    setArquivoSelecionado(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const enviar = async () => {
    if (!lead.telefone || enviando) return;

    // Envio de midia
    if (arquivoSelecionado) {
      setEnviando(true);
      try {
        const result = await enviarMidia(lead.telefone, arquivoSelecionado, texto.trim() || undefined);
        if (!result.ok) {
          alert('Falha ao enviar midia: ' + (result.error || 'Erro'));
        }
        cancelarArquivo();
        setTexto('');
        await carregar();
      } finally { setEnviando(false); }
      return;
    }

    // Envio de texto
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await enviarMensagem(lead.telefone, texto.trim(), lead.id);
      setTexto('');
      await carregar();
    } finally { setEnviando(false); }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selecionarArquivo(file);
  };

  const etapaAtual = ETAPAS_FUNIL.find(e => e.id === lead.etapa);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {(lead.nome || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{lead.nome || 'Sem nome'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-500">{lead.telefone || 'Sem telefone'}</p>
            {clienteRelacionado && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">
                {clienteRelacionado.tipo === 'PF' ? 'Física' : clienteRelacionado.tipo === 'PJ' ? 'Jurídica' : clienteRelacionado.tipo === 'GOV' ? 'Governo' : clienteRelacionado.tipo === 'FUNC' ? 'Funcionário' : clienteRelacionado.tipo === 'FORN' ? 'Fornecedor' : clienteRelacionado.tipo === 'PES' ? 'Pessoal' : clienteRelacionado.tipo}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModalClienteOpen(true)} className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors">
            {clienteRelacionado ? '✏️ Editar Cliente' : '💾 Salvar Cliente'}
          </button>
          <span className={`text-xs px-2 py-1.5 rounded-lg font-medium ${ETAPA_BADGE[lead.etapa]}`}>
            {etapaAtual?.label}
          </span>
          <button onClick={carregar} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            🔄
          </button>
        </div>
      </div>
      {modalClienteOpen && (
        <NovoClienteModal
          onClose={() => setModalClienteOpen(false)}
          initialData={clienteRelacionado || { nome: lead.nome, telefone: lead.telefone, email: lead.email }}
        />
      )}
      <div
        className={`flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 transition-colors ${dragging ? 'bg-green-100/50 ring-2 ring-green-400 ring-inset' : ''}`}
        style={{ background: dragging ? undefined : '#e5ddd5' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-white/90 rounded-2xl px-8 py-6 shadow-lg text-center">
              <div className="text-4xl mb-2">📎</div>
              <p className="text-sm font-semibold text-green-700">Solte o arquivo aqui</p>
              <p className="text-xs text-gray-500">Imagem, video ou documento</p>
            </div>
          </div>
        )}
        {loading && <div className="text-center text-xs text-gray-500 py-8">Carregando mensagens...</div>}
        {!loading && msgs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm text-gray-600 font-medium">
              {lead.telefone ? 'Nenhuma mensagem ainda.' : 'Lead sem telefone cadastrado.'}
            </p>
            {lead.telefone && <p className="text-xs text-gray-500 mt-1">Aguardando mensagem do cliente ou envie a primeira mensagem abaixo.</p>}
          </div>
        )}
        {msgs.filter(m => m.texto?.trim() || m.mediaUrl).map(m => (
          <div key={m.id} className={`flex ${m.tipo === 'saida' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${m.tipo === 'saida' ? 'bg-[#dcf8c6] text-gray-800 rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm'}`}>
              {/* Midia inline */}
              {m.mediaUrl && m.mediaType === 'image' && (
                <img src={m.mediaUrl} alt="imagem" className="rounded-lg max-w-full max-h-64 mb-1 cursor-pointer hover:opacity-90"
                  onClick={() => window.open(m.mediaUrl, '_blank')} />
              )}
              {m.mediaUrl && m.mediaType === 'video' && (
                <video src={m.mediaUrl} controls className="rounded-lg max-w-full max-h-64 mb-1" />
              )}
              {m.mediaUrl && m.mediaType === 'audio' && (
                <audio src={m.mediaUrl} controls className="mb-1 w-full" />
              )}
              {m.mediaUrl && m.mediaType === 'document' && (
                <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1 hover:bg-gray-100 transition-colors">
                  <span className="text-2xl">📄</span>
                  <span className="text-xs text-blue-600 font-medium underline">Abrir documento</span>
                </a>
              )}
              {/* Indicador de midia sem URL (fallback texto) */}
              {!m.mediaUrl && m.texto && /^\[(image|video|audio|document)\]$/.test(m.texto) && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                  <span className="text-lg">{m.texto.includes('image') ? '🖼️' : m.texto.includes('video') ? '🎬' : m.texto.includes('audio') ? '🎵' : '📄'}</span>
                  <span className="text-xs text-gray-500 italic">Midia recebida</span>
                </div>
              )}
              {/* Texto da mensagem */}
              {m.texto && !/^\[(image|video|audio|document)\]$/.test(m.texto) && (
                <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
              )}
              <p className="text-[10px] text-gray-500 mt-1 text-right">{horaMsg(m.criadoEm)}{m.tipo === 'saida' && ' ✓✓'}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Preview de arquivo selecionado */}
      {arquivoSelecionado && (
        <div className="px-3 py-2 bg-white border-t flex items-center gap-3">
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 shadow-sm" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">{arquivoSelecionado.type.startsWith('video/') ? '🎬' : '📄'}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{arquivoSelecionado.name}</p>
            <p className="text-[10px] text-gray-400">{(arquivoSelecionado.size / 1024).toFixed(0)} KB</p>
          </div>
          <button onClick={cancelarArquivo} className="text-red-400 hover:text-red-600 text-lg flex-shrink-0" title="Cancelar">✕</button>
        </div>
      )}

      <div className="px-3 py-2 bg-gray-100 border-t">
        {!lead.telefone ? (
          <p className="text-xs text-center text-red-500 py-2">Adicione um telefone ao lead para enviar mensagens.</p>
        ) : (
          <div className="flex gap-2 items-end">
            {/* Botao de anexo */}
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => { const f = e.target.files?.[0]; if (f) selecionarArquivo(f); }} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-200 text-gray-500 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              title="Enviar arquivo, imagem ou documento">
              📎
            </button>
            <textarea rows={1} value={texto} onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={arquivoSelecionado ? "Legenda (opcional)..." : "Digite uma mensagem..."}
              className="flex-1 border-0 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              style={{ maxHeight: '100px' }} />
            <button onClick={enviar} disabled={enviando || (!texto.trim() && !arquivoSelecionado)}
              className="w-10 h-10 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
              {enviando ? '⏳' : '➤'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assistente de Vendas IA ──────────────────────────────────────────────────
const SENTIMENTO_COR: Record<string, string> = {
  Interessado:  'bg-green-100 text-green-700',
  Animado:      'bg-emerald-100 text-emerald-700',
  Neutro:       'bg-gray-100 text-gray-600',
  Hesitante:    'bg-amber-100 text-amber-700',
  Resistente:   'bg-red-100 text-red-700',
  Frio:         'bg-blue-100 text-blue-700',
  Urgente:      'bg-violet-100 text-violet-700',
};

function AssistenteVendas({ lead, msgs, onUsarSugestao, onMudarEtapa }: {
  lead: Lead;
  msgs: Mensagem[];
  onUsarSugestao: (texto: string) => void;
  onMudarEtapa: (etapa: EtapaFunil) => void;
}) {
  const [analise, setAnalise] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [totalMsgs, setTotalMsgs] = useState(0);
  const lastLeadId = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analisandoRef = useRef(false);

  const analisar = useCallback(async () => {
    if (analisandoRef.current) return;
    analisandoRef.current = true;
    setCarregando(true);
    setErro('');
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch('/api/assistente-vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: lead.telefone, nome: lead.nome, empresa: lead.empresa, etapa: lead.etapa }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json = await res.json();
      if (res.status === 429) {
        setErro('Muitas requisições. Aguarde uns segundos e clique em 🔄');
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Erro na análise');
      setAnalise(json.analise);
      setTotalMsgs(json.totalMensagens || 0);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setErro('Demorou demais. Clique em 🔄 para tentar novamente.');
      } else {
        const msg = e.message || '';
        setErro(msg.includes('429') ? 'Muitas requisições. Aguarde e tente novamente.' : msg || 'Erro ao analisar');
      }
    } finally {
      setCarregando(false);
      analisandoRef.current = false;
    }
  }, [lead.telefone, lead.nome, lead.empresa, lead.etapa]);

  useEffect(() => {
    if (lead.id !== lastLeadId.current) {
      lastLeadId.current = lead.id;
      setAnalise(null);
      setErro('');
      const t = setTimeout(() => analisar(), 1500);
      return () => clearTimeout(t);
    }
  }, [lead.id, analisar]);

  useEffect(() => {
    if (msgs.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { if (!analisandoRef.current) analisar(); }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [msgs.length, analisar]);

  useEffect(() => {
    const interval = setInterval(() => { if (!analisandoRef.current) analisar(); }, 120000);
    return () => clearInterval(interval);
  }, [analisar]);

  const etapaDetectada = analise?.etapaDetectada as EtapaFunil | undefined;
  const etapaLabel = ETAPAS_FUNIL.find(e => e.id === etapaDetectada)?.label;
  const deveAvancar = analise?.deveAvancarEtapa && etapaDetectada && etapaDetectada !== lead.etapa;

  return (
    <div className="flex flex-col h-full bg-white border-l overflow-hidden">
      <div className="px-3 py-3 border-b flex-shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">🧠 Assistente de Vendas</p>
            <p className="text-[10px] text-white/60 mt-0.5">VendaC · V4 Company · SPIN · Challenger</p>
          </div>
          <button onClick={analisar} disabled={carregando} title="Analisar agora"
            className="text-xs bg-white/20 hover:bg-white/30 active:bg-white/40 disabled:opacity-50 w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
            {carregando ? <span className="animate-spin inline-block">⏳</span> : '🔄'}
          </button>
        </div>
        {totalMsgs > 0 && !carregando && <p className="text-[10px] text-white/50 mt-1">{totalMsgs} mensagens analisadas</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {carregando && (
          <div className="text-center py-10">
            <div className="text-3xl mb-3 animate-pulse">🧠</div>
            <p className="text-xs text-gray-500">Analisando conversa...</p>
            <p className="text-[10px] text-gray-400 mt-1">Aplicando técnicas de venda</p>
          </div>
        )}
        {erro && !carregando && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium mb-2">⏳ {erro}</p>
            <button onClick={analisar} className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700">Tentar novamente</button>
          </div>
        )}
        {analise && !carregando && (
          <>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">📍 Posição no Funil</p>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {etapaDetectada && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ETAPA_BADGE[etapaDetectada] || 'bg-gray-100 text-gray-600'}`}>
                    {etapaLabel || etapaDetectada}
                  </span>
                )}
                {analise.sentimento && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENTO_COR[analise.sentimento] || 'text-gray-600 bg-gray-50'}`}>
                    {analise.sentimento}
                  </span>
                )}
              </div>
              {deveAvancar && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 mt-1">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">💡 Avance o funil</p>
                  <p className="text-xs text-amber-700 mb-2 leading-relaxed">{analise.motivoAvanco}</p>
                  <button onClick={() => { if (etapaDetectada) onMudarEtapa(etapaDetectada); }}
                    className="w-full text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold py-1.5 rounded-lg transition-colors">
                    ✓ Mover para "{etapaLabel}"
                  </button>
                </div>
              )}
              {!deveAvancar && etapaDetectada === lead.etapa && (
                <p className="text-[10px] text-indigo-600 font-medium">✓ Etapa correta no momento</p>
              )}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">📋 Parecer</p>
              <p className="text-xs text-gray-700 leading-relaxed">{analise.parecer}</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1.5">🎯 Técnica Indicada</p>
              <p className="text-xs text-violet-700 leading-relaxed font-medium">{analise.tecnicaRecomendada}</p>
            </div>
            {analise.proximoPasso && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">🚀 Próximo Passo</p>
                <p className="text-xs text-blue-700 font-semibold leading-relaxed">{analise.proximoPasso}</p>
              </div>
            )}
            {analise.sinaisPositivos?.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">✅ Sinais Positivos</p>
                <div className="flex flex-col gap-1">
                  {analise.sinaisPositivos.map((s: string, i: number) => (
                    <p key={i} className="text-xs text-emerald-700 flex items-start gap-1.5">
                      <span className="flex-shrink-0 mt-0.5 text-emerald-500">•</span>{s}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {analise.objeccoes?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1.5">⚠️ Objeções / Resistências</p>
                <div className="flex flex-col gap-1">
                  {analise.objeccoes.map((o: string, i: number) => (
                    <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                      <span className="flex-shrink-0 mt-0.5 text-red-400">•</span>{o}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {analise.sugestoes?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">💬 Respostas Sugeridas</p>
                <div className="flex flex-col gap-2">
                  {analise.sugestoes.map((s: any, i: number) => {
                    const labelMap: Record<string, { texto: string; icone: string; cor: string }> = {
                      saudacao: { texto: 'Saudação Inicial', icone: '👋', cor: 'text-green-600' },
                      cordial: { texto: 'Cordial', icone: '💬', cor: 'text-blue-600' },
                      tecnica: { texto: 'Técnico', icone: '🔧', cor: 'text-violet-600' },
                      urgencia: { texto: 'Oportunidade', icone: '⚡', cor: 'text-amber-600' },
                      curto: { texto: 'Curto', icone: '💬', cor: 'text-indigo-600' },
                    };
                    const info = labelMap[s.label] || { texto: s.label, icone: '💬', cor: 'text-indigo-600' };
                    return (
                    <button key={i} onClick={() => onUsarSugestao(s.mensagem)}
                      className={`text-left bg-white border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl p-3 transition-all group shadow-sm ${i === 0 ? 'ring-1 ring-green-300' : ''}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 group-hover:opacity-80 ${info.cor}`}>{info.icone} {info.texto}</p>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-4 group-hover:text-gray-800">{s.mensagem}</p>
                      <p className="text-[10px] text-indigo-400 mt-2 font-semibold group-hover:text-indigo-600">Clique para usar →</p>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        {!analise && !carregando && !erro && (
          <div className="text-center py-10 px-3">
            <div className="text-4xl mb-3">🧠</div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Assistente pronto</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">Analisa a conversa e sugere as melhores respostas com base em técnicas de vendas B2B.</p>
            <button onClick={analisar} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-semibold transition-colors">🔍 Analisar agora</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Painel de Detalhes do Lead ──────────────────────────────────────────────
function DetalhesPanel({ lead, onUpdate, onCriarProposta }: {
  lead: Lead;
  onUpdate: (l: Lead) => void;
  onCriarProposta: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ ...lead });

  useEffect(() => { setForm({ ...lead }); setEditando(false); }, [lead.id]);

  const salvar = async () => {
    await atualizarLead(lead.id, form);
    onUpdate({ ...lead, ...form });
    setEditando(false);
  };

  const mudarEtapa = async (etapa: EtapaFunil) => {
    await atualizarLead(lead.id, { etapa });
    onUpdate({ ...lead, etapa });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b text-center">
        <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
          {(lead.nome || '?')[0].toUpperCase()}
        </div>
        <p className="font-bold text-gray-900 text-sm">{lead.nome}</p>
        <p className="text-xs text-gray-500">{lead.empresa || ''}</p>
        {lead.valor && <p className="text-sm font-semibold text-indigo-600 mt-1">{fmt(lead.valor)}</p>}
        <span className={`mt-2 inline-block text-xs px-2 py-1 rounded-full font-medium ${ETAPA_BADGE[lead.etapa]}`}>
          {ETAPAS_FUNIL.find(e => e.id === lead.etapa)?.label}
        </span>
      </div>
      <div className="p-3 border-b">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Funil de Vendas</p>
        <div className="flex flex-col gap-1">
          {ETAPAS_FUNIL.map(etapa => (
            <button key={etapa.id} onClick={() => mudarEtapa(etapa.id)}
              className={`text-left text-xs px-3 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${lead.etapa === etapa.id ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={lead.etapa === etapa.id ? { backgroundColor: ETAPA_COR[etapa.id] } : {}}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ETAPA_COR[etapa.id] }} />
              {etapa.label}
              {lead.etapa === etapa.id && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dados</p>
          <button onClick={() => editando ? salvar() : setEditando(true)} className="text-xs text-indigo-600 font-medium hover:underline">
            {editando ? '💾 Salvar' : '✏️ Editar'}
          </button>
        </div>
        {editando ? (
          <div className="flex flex-col gap-2">
            {[['Nome','nome','text'],['Empresa','empresa','text'],['Telefone','telefone','tel'],['E-mail','email','email'],['Valor (R$)','valor','number']].map(([label, key, type]) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input type={type} value={(form as any)[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full text-xs border rounded px-2 py-1 mt-0.5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 text-xs text-gray-700">
            {lead.telefone && <div><span className="text-gray-400">📱 </span>{lead.telefone}</div>}
            {lead.email    && <div><span className="text-gray-400">✉️ </span>{lead.email}</div>}
            {lead.empresa  && <div><span className="text-gray-400">🏢 </span>{lead.empresa}</div>}
            {lead.origem   && <div><span className="text-gray-400">🔗 </span>{ORIGEM_LABELS[lead.origem]}</div>}
            {lead.criadoEm && <div><span className="text-gray-400">📅 </span>{new Date(lead.criadoEm).toLocaleDateString('pt-BR')}</div>}
          </div>
        )}
      </div>
      <div className="p-3">
        <button onClick={onCriarProposta} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors">
          📄 Criar Proposta
        </button>
        {lead.telefone && (
          <a href={`https://wa.me/${lead.telefone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
            className="mt-2 block w-full text-center bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors">
            📲 Abrir no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Item da lista de leads ────────────────────────────────────────────────
// cores avatar estilo WhatsApp
const WA_COLORS = ['#25D366','#128C7E','#075E54','#34B7F1','#00a884','#6366f1','#ec4899','#f59e0b'];
function fmtHora(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (days === 0) return hora;
    if (days === 1) return `Ontem ${hora}`;
    if (days < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }) + ` ${hora}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` ${hora}`;
  } catch { return iso; }
}
function avatarCor(nome: string) {
  return WA_COLORS[(nome || ' ').charCodeAt(0) % WA_COLORS.length];
}
function fmtTel(tel?: string): string {
  if (!tel) return '';
  const d = tel.replace(/\D/g, '');
  if (d.length >= 12) return '+' + d.slice(0,2) + ' (' + d.slice(2,4) + ') ' + d.slice(4,9) + '-' + d.slice(9);
  if (d.length === 11) return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  return tel;
}

function LeadItem({ lead, ativo, naoLido, onClick }: {
  lead: Lead & { ultimaMensagem?: string; ultimaHora?: string };
  ativo: boolean;
  naoLido: boolean;
  onClick: () => void;
}) {
  const nome = (lead.nome || lead.telefone || 'Lead').trim();
  const inicial = nome[0].toUpperCase();
  const msgBruta = lead.ultimaMensagem?.trim() || '';
  const ehMidia = /^\[?(Media|image|video|audio|document)\]?$/i.test(msgBruta);
  const temMsg = !!(msgBruta && !ehMidia);
  const preview = temMsg ? msgBruta : ehMidia ? '📷 Midia' : (lead.empresa || lead.email || 'Sem mensagens ainda');
  const hora = fmtHora(lead.ultimaHora || '');

  // bg: ativo=verde claro, naoLido=verde transparente suave, normal=branco
  const bgClass = ativo
    ? 'bg-[#d9fdd3]'
    : naoLido
      ? 'bg-[#dcf8c6]/40'
      : 'bg-white';

  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b flex gap-3 items-center hover:bg-gray-50 transition-colors ${bgClass}`}>
      {/* Avatar estilo WhatsApp - foto real ou inicial */}
      {lead.fotoUrl ? (
        <img src={lead.fotoUrl} alt={nome}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0 shadow-sm select-none"
          onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
      ) : (
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm select-none"
          style={{ backgroundColor: avatarCor(nome) }}>
          {inicial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`font-semibold text-sm truncate ${naoLido ? 'text-gray-900' : 'text-gray-700'}`}>{nome}</p>
          <span className={`text-[11px] flex-shrink-0 font-medium ${naoLido ? 'text-[#25D366] font-bold' : temMsg ? 'text-[#25D366]' : 'text-gray-400'}`}>{hora}</span>
        </div>
        {lead.telefone && (
          <p className="text-[10px] text-gray-400 truncate leading-tight">📱 {fmtTel(lead.telefone)}</p>
        )}
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className={`text-xs truncate ${naoLido ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{preview}</p>
          {(lead.totalMensagens ?? 0) > 0 && !ativo && (
            <span className="flex-shrink-0 bg-[#25D366] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {lead.totalMensagens}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Modal de Novo Lead ────────────────────────────────────────────────────
function NovoLeadModal({ onClose, onSave }: { onClose: () => void; onSave: (l: Omit<Lead,'id'|'criadoEm'>) => void }) {
  const [form, setForm] = useState({ nome: '', empresa: '', email: '', telefone: '', observacoes: '', etapa: 'lead_novo' as EtapaFunil, origem: 'manual' as const, valor: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="bg-indigo-600 text-white px-5 py-4 rounded-t-2xl"><h2 className="font-bold text-lg">+ Novo Lead</h2></div>
        <div className="p-5 flex flex-col gap-3">
          {([['nome','Nome *','text'],['empresa','Empresa','text'],['email','E-mail','email'],['telefone','Telefone','tel']] as [string,string,string][]).map(([k,label,type]) => (
            <div key={k}>
              <label className="text-xs text-gray-600 font-medium">{label}</label>
              <input type={type} value={(form as any)[k]} onChange={e => set(k, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-600 font-medium">Etapa</label>
            <select value={form.etapa} onChange={e => set('etapa', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {ETAPAS_FUNIL.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium">Valor estimado (R$)</label>
            <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => { if (!form.nome.trim()) return; onSave({ ...form, valor: parseFloat(form.valor) || undefined, etapa: form.etapa as EtapaFunil, origem: 'manual' }); }}
            className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-bold hover:bg-indigo-700">Criar Lead</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Criar Proposta ───────────────────────────────────────────────────
function PropostaModal({ lead, analisePrevia, mensagens, onClose }: {
  lead: Lead;
  analisePrevia?: any;
  mensagens?: Mensagem[];
  onClose: () => void;
}) {
  // Se recebemos uma analise ja feita pelo painel Inteligencia, pre-populamos
  const clientePrev = analisePrevia?.cliente || {};
  const initDados: Omit<PropostaDados,'itens'> = {
    empresa: clientePrev.empresa || clientePrev.razaoSocial || clientePrev.nomeFantasia || lead.empresa || lead.nome || '',
    ac: clientePrev.nome || lead.nome || '',
    telefone: clientePrev.telefone || lead.telefone || '',
    email: clientePrev.email || lead.email || '',
    cidade: [clientePrev.cidade, clientePrev.uf].filter(Boolean).join('/') || '',
    vendedor: 'Jean',
    frete: 'À combinar',
    validade: '7 dias corridos',
    pagamento: '50% de entrada e 50% na entrega',
  } as any;
  const initItens: ItemProposta[] = Array.isArray(analisePrevia?.produtos) && analisePrevia.produtos.length > 0
    ? analisePrevia.produtos.map((p: any) => ({
        nome: p.nomeCatalogo || p.nome || '',
        descricao: p.descricao || '',
        qtd: Number(p.quantidade) || 1,
        valorUnitario: Number(p.precoUnitario) || 0,
      }))
    : [{ nome: '', descricao: '', qtd: 1, valorUnitario: 0 }];

  const [dados, setDados] = useState<Omit<PropostaDados,'itens'>>(initDados);
  const [itens, setItens] = useState<ItemProposta[]>(initItens);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const [iaOk, setIaOk] = useState(!!analisePrevia);
  // atualizarCliente e adicionarPropostaDireta podem nao existir em todas versoes do contexto — lemos com fallback
  const erp = useERP() as any;
  const { state, adicionarCliente } = erp;
  const atualizarCliente = erp.atualizarCliente as ((id: string, patch: Partial<Cliente>) => void) | undefined;
  const adicionarPropostaDireta = (erp.adicionarPropostaDireta || erp.adicionarProposta) as ((p: Proposta) => void) | undefined;

  const set = (k: string, v: string) => setDados(d => ({ ...d, [k]: v }));
  const setItem = (i: number, k: keyof ItemProposta, v: string | number) =>
    setItens(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItens(p => [...p, { nome: '', descricao: '', qtd: 1, valorUnitario: 0 }]);
  const remItem = (i: number) => setItens(p => p.filter((_, idx) => idx !== i));

  const gerarComIA = async () => {
    if (!lead.telefone) { setErroIA('Este lead não tem telefone — necessário para buscar a conversa.'); return; }
    setGerandoIA(true); setErroIA(''); setIaOk(false);
    try {
      const res = await fetch('/api/proposta-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: lead.telefone, nome: lead.nome, email: lead.email, empresa: lead.empresa, mensagens: (mensagens || []).map((m: any) => ({ texto: m.texto || m.conteudo || m.body || '', tipo: m.tipo || m.direction || 'entrada', criadoEm: m.criadoEm || m.timestamp || '' })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro desconhecido');
      const p = json.proposta;
      setDados({ empresa: p.empresa || dados.empresa, ac: p.ac || '', telefone: p.telefone || dados.telefone,
        email: p.email || dados.email, cidade: p.cidade || '', vendedor: p.vendedor || 'Jean',
        frete: p.frete || 'À combinar', validade: p.validade || '7 dias corridos',
        pagamento: p.pagamento || '50% de entrada e 50% na entrega',
        prazoEntrega: p.prazoEntrega || 'A confirmar após aceite formal', intro: p.intro || '' });
      if (p.itens?.length > 0) setItens(p.itens.map((it: any) => ({ nome: it.nome || it.descricao || 'Item', descricao: it.descricao || '', qtd: Number(it.qtd || it.quantidade) || 1, valorUnitario: Number(it.valorUnitario || it.precoUnitario) || 0 })));
      setIaOk(true);
    } catch (e: any) { setErroIA(e.message || 'Erro ao chamar IA'); }
    finally { setGerandoIA(false); }
  };

  // Auto-dispara IA ao abrir o modal, APENAS se nao veio analise previa do painel Inteligencia
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!analisePrevia) gerarComIA(); }, []);

  const gerar = async () => {
    // Registra ou atualiza cliente no ERP
    const clienteExistente = state.clientes.find(
      (c: Cliente) => c.telefone === lead.telefone || (lead.email && c.email === lead.email)
    );
    const idFinal = `CLI-${Date.now()}`;
    if (clienteExistente) {
      if (atualizarCliente) {
        atualizarCliente(clienteExistente.id, {
          nome: lead.nome || clienteExistente.nome,
          email: lead.email || clienteExistente.email,
          telefone: lead.telefone || clienteExistente.telefone,
          cidade: dados.cidade || clienteExistente.cidade,
        });
      }
      // senao, mantem os dados antigos do cliente — nao bloqueia a geracao da proposta
    } else {
      const novoCliente: Cliente = {
        id: idFinal,
        nome: lead.nome || dados.empresa || 'Cliente',
        email: lead.email || dados.email || '',
        telefone: lead.telefone || dados.telefone || '',
        tipo: 'PJ',
        documento: '',
        endereco: dados.cidade || '',
        cep: '', logradouro: '', numero: '', bairro: '',
        cidade: dados.cidade || '',
        uf: '',
        funnelStage: 'Negociação',
        mensagens: [],
      };
      adicionarCliente(novoCliente);
    }
    // Salva proposta no ERP
    const total = itens.reduce((s, it) => s + (it.qtd * it.valorUnitario), 0);
    const proposta: Proposta = {
      id: `PROP-${Date.now()}`,
      clienteId: clienteExistente?.id || idFinal,
      clienteNome: lead.nome || dados.empresa || 'Cliente',
      items: itens.map((it, i) => ({
        id: `it-${i}`,
        name: it.nome || 'Item',
        descricao: it.descricao || '',
        quantidade: it.qtd,
        price: it.valorUnitario,
      })),
      total,
      status: 'Rascunho',
      data: new Date().toISOString(),
    };
    if (adicionarPropostaDireta) adicionarPropostaDireta(proposta);

    // Persiste proposta no Supabase
    let numeroBanco: number | undefined;
    try {
      const resProp = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: lead.telefone,
          nome_cliente: lead.nome || dados.empresa || 'Cliente',
          empresa: dados.empresa || lead.empresa || '',
          itens: itens.map((it, i) => ({
            nome: it.nome || 'Item',
            descricao: it.descricao || '',
            qtd: it.qtd,
            valorUnitario: it.valorUnitario,
          })),
          valor_total: total,
          status: 'enviada',
          observacoes: (dados as any).observacoes || '',
        }),
      });
      const jsonProp = await resProp.json();
      if (jsonProp.ok && jsonProp.proposta?.numero) {
        numeroBanco = jsonProp.proposta.numero;
      }
    } catch (e) {
      console.error('Falha ao salvar proposta no banco:', e);
    }

    // Abre o HTML da proposta — usa numero do banco (1000+) ou fallback
    let num = numeroBanco;
    if (!num) {
      try {
        num = await proximoNumeroProposta();
      } catch (e) {
        console.error('Falha ao obter numero sequencial (segue mesmo assim):', e);
        num = Date.now() % 10000;
      }
    }
    try {
      abrirProposta({ ...dados, numero: num, itens } as PropostaDados);
    } catch (e) {
      console.error('Erro ao abrir proposta:', e);
      alert('Não foi possível abrir a proposta: ' + (e as Error).message);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-indigo-600 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="font-bold text-lg">📄 Nova Proposta — {lead.nome}</h2>
          <button onClick={gerarComIA} disabled={gerandoIA} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            {gerandoIA ? '⏳ Analisando conversa...' : '✨ Gerar com IA'}
          </button>
        </div>
        {iaOk && <div className="mx-5 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2 rounded-lg">✅ Proposta gerada pela IA com base na conversa do WhatsApp. Revise os itens e valores antes de gerar o PDF.</div>}
        {erroIA && <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">⚠️ {erroIA}</div>}
        <div className="p-5 grid grid-cols-2 gap-3">
          {([['empresa','Empresa'],['ac','A/C (contato)'],['telefone','Telefone'],['email','E-mail'],['cidade','Cidade/UF'],['vendedor','Vendedor'],['validade','Validade'],['frete','Frete'],['prazoEntrega','Prazo de Entrega'],['pagamento','Pagamento']] as [string,string][]).map(([k, label]) => (
            <div key={k} className={k === 'pagamento' || k === 'intro' ? 'col-span-2' : ''}>
              <label className="text-xs text-gray-600 font-medium">{label}</label>
              <input value={(dados as any)[k] || ''} onChange={e => set(k, e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          ))}
          {(dados as any).intro && (
            <div className="col-span-2">
              <label className="text-xs text-gray-600 font-medium">Introdução (gerada pela IA)</label>
              <textarea value={(dados as any).intro || ''} onChange={e => set('intro', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          )}
        </div>
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-700">Itens da Proposta</p>
            <button onClick={addItem} className="text-xs text-indigo-600 font-medium hover:underline">+ Adicionar item</button>
          </div>
          <div className="text-[10px] text-gray-400 grid grid-cols-12 gap-1 mb-1 px-1">
            <span className="col-span-4">Produto / Serviço</span><span className="col-span-4">Descrição</span>
            <span className="col-span-1 text-center">Qtd</span><span className="col-span-2 text-right">R$ Unit.</span><span className="col-span-1"></span>
          </div>
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 mb-1.5 items-center">
              <input placeholder="Nome do item" value={it.nome || ''} onChange={e => setItem(i, 'nome', e.target.value)} className="col-span-4 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <input placeholder="Especificação técnica" value={it.descricao || ''} onChange={e => setItem(i, 'descricao', e.target.value)} className="col-span-4 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <input type="number" min="1" value={it.qtd} onChange={e => setItem(i, 'qtd', +e.target.value)} className="col-span-1 border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <input type="number" min="0" step="0.01" placeholder="0,00" value={it.valorUnitario || ''} onChange={e => setItem(i, 'valorUnitario', +e.target.value)} className="col-span-2 border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <button onClick={() => remItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-sm text-center" title="Remover">✕</button>
            </div>
          ))}
          <div className="flex justify-end mt-3 pr-6">
            <div className="text-sm font-bold text-indigo-700">Total: R$ {itens.reduce((s, it) => s + (it.qtd||1)*(it.valorUnitario||0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={gerar} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-bold hover:bg-indigo-700">📄 Gerar PDF</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Cadastrar Produto (capturado da conversa) ─────────────────────────
function CadastrarProdutoModal({ produto, onClose, onSalvo }: {
  produto: any;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({
    nome: produto.nome || '',
    sku: (produto.skuCatalogo || produto.nome || '').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20),
    descricao: produto.descricao || '',
    preco: String(produto.precoUnitario || 0),
    unidade: produto.unidade || 'UN',
    ncm: '',
    categoria: 'sob-medida',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.nome.trim() || !form.sku.trim()) {
      setErro('Nome e SKU são obrigatórios.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch('/api/produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          sku: form.sku,
          descricao: form.descricao,
          preco: parseFloat(form.preco) || 0,
          precoRegular: parseFloat(form.preco) || 0,
          unidade: form.unidade,
          ncm: form.ncm || undefined,
          categoria: form.categoria,
          tipo: 'sob-medida',
          origem: 'conversa-whatsapp',
          emEstoque: false,
          estoque: 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erros?.join(', ') || json.error || 'Erro ao salvar');
      setOk(true);
      setTimeout(onSalvo, 1500);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-violet-600 text-white px-5 py-4 rounded-t-2xl">
          <h2 className="font-bold text-base">📦 Cadastrar Produto</h2>
          <p className="text-xs text-white/70 mt-0.5">Capturado da conversa — vire produto do catálogo</p>
        </div>
        {ok ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-green-700">Produto cadastrado com sucesso!</p>
            <p className="text-xs text-gray-500 mt-1">Agora aparece no catálogo e na inteligência de conversa.</p>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-3">
            {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">⚠️ {erro}</div>}
            {[
              ['nome', 'Nome do produto *', 'text'],
              ['sku', 'SKU (código único) *', 'text'],
              ['descricao', 'Descrição técnica', 'text'],
              ['unidade', 'Unidade (UN, KG, M, M²...)', 'text'],
              ['preco', 'Preço (R$)', 'number'],
              ['ncm', 'NCM (8 dígitos, opcional)', 'text'],
            ].map(([k, label, type]) => (
              <div key={k}>
                <label className="text-xs text-gray-600 font-medium">{label}</label>
                <input
                  type={type}
                  value={(form as any)[k]}
                  onChange={e => set(k, e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-600 font-medium">Categoria</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="sob-medida">Sob Medida</option>
                <option value="caldeiraria">Caldeiraria</option>
                <option value="estrutura-metalica">Estrutura Metálica</option>
                <option value="pintura">Pintura / Tratamento</option>
                <option value="servico">Serviço</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 bg-violet-600 text-white rounded-xl py-2 text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
                {salvando ? '⏳ Salvando...' : '📦 Cadastrar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Página principal Leads ────────────────────────────────────────────────
export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [leadAtivo, setLeadAtivo] = useState<Lead | null>(null);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [propostaLead, setPropostaLead] = useState<Lead | null>(null);
  // Analise pre-computada pelo painel Inteligencia — evita chamar /api/proposta-ia novamente
  const [propostaAnalise, setPropostaAnalise] = useState<any>(null);
  const [msgsAtivas, setMsgsAtivas] = useState<Mensagem[]>([]);
  const [textoInjetado, setTextoInjetado] = useState({ v: '', n: 0 });
  const [tabPainel, setTabPainel] = useState<'detalhes' | 'inteligencia'>('inteligencia');
  const [produtoCadastrar, setProdutoCadastrar] = useState<any>(null);

  // Rastreia quais leads foram lidos (persiste em localStorage)
  const [lidos, setLidos] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_leads_lidos') || '{}');
    } catch { return {}; }
  });

  const marcarComoLido = useCallback((lead: Lead) => {
    const hora = lead.ultimaHora || lead.criadoEm || new Date().toISOString();
    setLidos(prev => {
      const next = { ...prev, [lead.id]: hora };
      localStorage.setItem('crm_leads_lidos', JSON.stringify(next));
      return next;
    });
  }, []);

  const ehNaoLido = useCallback((lead: Lead): boolean => {
    const ultimaHora = (lead as any).ultimaHora || lead.criadoEm;
    if (!ultimaHora) return false;
    const lido = lidos[lead.id];
    if (!lido) return true; // nunca abriu = nao lido
    return new Date(ultimaHora).getTime() > new Date(lido).getTime();
  }, [lidos]);

  useEffect(() => { return subscribeLeads(data => { setLeads(data); setLoading(false); }); }, []);
  useEffect(() => {
    if (leadAtivo) { const a = leads.find(l => l.id === leadAtivo.id); if (a) setLeadAtivo(a); }
  }, [leads]);
  useEffect(() => { setMsgsAtivas([]); setTextoInjetado({ v: '', n: 0 }); }, [leadAtivo?.id]);

  const handleAdicionarLead = async (dados: Omit<Lead,'id'|'criadoEm'>) => { await adicionarLead(dados); setNovoModalOpen(false); };
  const handleUpdateLead = (lead: Lead) => { setLeads(prev => prev.map(l => l.id === lead.id ? lead : l)); setLeadAtivo(lead); };
  const handleMudarEtapa = async (etapa: EtapaFunil) => {
    if (!leadAtivo) return;
    await atualizarLead(leadAtivo.id, { etapa });
    const atualizado = { ...leadAtivo, etapa };
    setLeadAtivo(atualizado);
    setLeads(prev => prev.map(l => l.id === leadAtivo.id ? atualizado : l));
  };

  const filtrados = leads
    .filter(l => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return [l.nome, l.email, l.telefone, l.empresa].some(v => v?.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const ha = a.ultimaHora || a.criadoEm || '';
      const hb = b.ultimaHora || b.criadoEm || '';
      return hb > ha ? 1 : hb < ha ? -1 : 0;
    });
  const totalVal = leads.filter(l => l.etapa !== 'fechado_perdido').reduce((s,l) => s+(l.valor||0), 0);
  const ganhos = leads.filter(l => l.etapa === 'fechado_ganho').length;
  const taxa = leads.length ? Math.round((ganhos/leads.length)*100) : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex items-center gap-4 px-4 py-3 bg-white border-b flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">WhatsApp CRM</h1>
          <p className="text-xs text-gray-500">Conversas em tempo real • {leads.length} leads</p>
        </div>
        <div className="flex gap-4 ml-4 text-xs">
          <div><span className="font-bold text-violet-600">{totalVal ? `R$ ${(totalVal/1000).toFixed(0)}k` : 'R$ 0'}</span><span className="text-gray-500 ml-1">pipeline</span></div>
          <div><span className="font-bold text-emerald-600">{ganhos}</span><span className="text-gray-500 ml-1">ganhos</span></div>
          <div><span className="font-bold text-indigo-600">{taxa}%</span><span className="text-gray-500 ml-1">conversão</span></div>
        </div>
        <div className="ml-auto">
          <button onClick={() => setNovoModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">+ Novo Lead</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 border-r bg-white flex flex-col overflow-hidden">
          <div className="p-2 border-b">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar lead..."
              className="w-full text-sm border rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="text-center text-xs text-gray-400 py-8">Carregando...</div>}
            {!loading && filtrados.length === 0 && (
              <div className="text-center py-12 px-4">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm text-gray-500 font-medium">Nenhum lead ainda</p>
                <p className="text-xs text-gray-400 mt-1">Quando clientes enviarem mensagens pelo WhatsApp, eles aparecerão aqui automaticamente.</p>
              </div>
            )}
            {filtrados.map(lead => (
              <LeadItem key={lead.id} lead={lead as any} ativo={leadAtivo?.id === lead.id} naoLido={ehNaoLido(lead)} onClick={() => { setLeadAtivo(lead); marcarComoLido(lead); }} />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {leadAtivo ? (
            <ConversaPanel lead={leadAtivo} onEtapaChange={handleMudarEtapa} textoInjetado={textoInjetado} onMsgsChange={setMsgsAtivas} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ background: '#e5ddd5' }}>
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">WhatsApp CRM</h2>
              <p className="text-sm text-gray-600 max-w-xs">Selecione uma conversa à esquerda para ver as mensagens e responder ao cliente.</p>
              <p className="text-xs text-gray-500 mt-3">Novas mensagens recebidas pelo WhatsApp <strong>(61) 99308-1396</strong> criam leads automaticamente.</p>
            </div>
          )}
        </div>

        {leadAtivo && (
          <div className="w-72 flex-shrink-0 border-l bg-white flex flex-col overflow-hidden">
            {/* Tabs: Inteligencia | Detalhes */}
            <div className="flex border-b flex-shrink-0">
              <button
                onClick={() => setTabPainel('inteligencia')}
                className={`flex-1 text-xs py-2 font-semibold transition-colors ${tabPainel === 'inteligencia' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                🧠 Inteligência
              </button>
              <button
                onClick={() => setTabPainel('detalhes')}
                className={`flex-1 text-xs py-2 font-semibold transition-colors ${tabPainel === 'detalhes' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                👤 Detalhes
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {tabPainel === 'detalhes' ? (
                <DetalhesPanel lead={leadAtivo} onUpdate={handleUpdateLead} onCriarProposta={() => setPropostaLead(leadAtivo)} />
              ) : (
                <ConversaInteligente
                  telefone={leadAtivo.telefone || ''}
                  leadNome={leadAtivo.nome}
                  leadEmpresa={leadAtivo.empresa}
                  onGerarProposta={(analise) => {
                    // Passa a analise ja feita pro modal — evita segunda chamada a IA
                    setPropostaAnalise(analise);
                    setPropostaLead(leadAtivo);
                  }}
                  onCadastrarProduto={(produto) => setProdutoCadastrar(produto)}
                />
              )}
            </div>
          </div>
        )}

        {leadAtivo && (
          <div className="w-72 flex-shrink-0 overflow-hidden">
            <AssistenteVendas
              lead={leadAtivo}
              msgs={msgsAtivas}
              onUsarSugestao={(texto) => setTextoInjetado(prev => ({ v: texto, n: prev.n + 1 }))}
              onMudarEtapa={handleMudarEtapa}
            />
          </div>
        )}
      </div>

      {novoModalOpen && <NovoLeadModal onClose={() => setNovoModalOpen(false)} onSave={handleAdicionarLead} />}
      {propostaLead && (
        <PropostaModal
          lead={propostaLead}
          analisePrevia={propostaAnalise}
          mensagens={msgsAtivas}
          onClose={() => { setPropostaLead(null); setPropostaAnalise(null); }}
        />
      )}
      {produtoCadastrar && (
        <CadastrarProdutoModal
          produto={produtoCadastrar}
          onClose={() => setProdutoCadastrar(null)}
          onSalvo={() => { setProdutoCadastrar(null); }}
        />
      )}
    </div>
  );
}
