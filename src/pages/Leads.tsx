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
import { searchProdutos, fmtPreco, type Produto } from '../services/produtosService';

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
const ETAPA_ORDEM: EtapaFunil[] = [
  'lead_novo',
  'contato_feito',
  'qualificado',
  'proposta_enviada',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido',
];

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

// ─── helpers de mídia ─────────────────────────────────────────────────────────
function textoSomenteMidia(texto?: string): boolean {
  const valor = String(texto || '').trim();
  return /^\[(image|video|audio|document|media|midia|imagem|sticker)\](?:\s+.*)?$/i.test(valor)
    || /^(media|midia|imagem|image|video|audio|document|sticker)$/i.test(valor);
}

function normalizarTipoMidia(valor?: string): string {
  const tipo = String(valor || '').toLowerCase().replace(/message$/, '');
  if (tipo === 'image' || tipo === 'imagem') return 'image';
  if (tipo === 'video') return 'video';
  if (tipo === 'audio') return 'audio';
  if (tipo === 'document' || tipo === 'documento') return 'document';
  if (tipo === 'sticker') return 'sticker';
  return '';
}

function mensagemTemMidiaReal(mensagem: Mensagem): boolean {
  return !!mensagem.mediaUrl || !!normalizarTipoMidia(mensagem.mediaType) || textoSomenteMidia(mensagem.texto);
}

function MidiaMensagem({ mensagem }: { mensagem: Mensagem }) {
  const { mediaUrl, mediaType, texto } = mensagem;
  const tipo = normalizarTipoMidia(mediaType) || normalizarTipoMidia(texto ? texto.replace(/[\[\]]/g, '') : '');

  if (!mediaUrl && !tipo) return null;

  if (mediaUrl && (tipo === 'image' || tipo === 'sticker')) {
    return (
      <img src={mediaUrl} alt="imagem" className="rounded-lg max-w-full max-h-64 mb-1 cursor-pointer hover:opacity-90"
        onClick={() => window.open(mediaUrl, '_blank')} />
    );
  }
  if (mediaUrl && tipo === 'video') {
    return <video src={mediaUrl} controls className="rounded-lg max-w-full max-h-64 mb-1" />;
  }
  if (mediaUrl && tipo === 'audio') {
    return <audio src={mediaUrl} controls className="mb-1 w-full" />;
  }
  if (mediaUrl && tipo === 'document') {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1 hover:bg-gray-100 transition-colors">
        <span className="text-2xl">📄</span>
        <span className="text-xs text-blue-600 font-medium underline">Abrir documento</span>
      </a>
    );
  }
  // fallback: sem URL mas texto indica mídia
  const icone = tipo.includes('image') ? '🖼️' : tipo.includes('video') ? '🎬' : tipo.includes('audio') ? '🎵' : '📎';
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1">
      <span className="text-lg">{icone}</span>
      <span className="text-xs text-gray-500 italic">Mídia recebida</span>
    </div>
  );
}

// ─── Painel de Conversa (com suporte a mídias) ───────────────────────────────
function ConversaPanel({ lead, onEtapaChange, textoInjetado, onMsgsChange, onUpdateLead }: {
  lead: Lead;
  onEtapaChange: (etapa: EtapaFunil) => void;
  textoInjetado: { v: string; n: number };
  onMsgsChange: (msgs: Mensagem[]) => void;
  onUpdateLead: (l: Lead) => void;
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
          {(clienteRelacionado?.nome || lead.nome || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{clienteRelacionado?.nome || lead.nome || 'Sem nome'}</p>
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
          onSave={async (clienteSalvo) => {
            if (lead.nome !== clienteSalvo.nome || lead.email !== clienteSalvo.email || lead.empresa !== clienteSalvo.razaoSocial) {
              const novosDados = {
                nome: clienteSalvo.nome,
                email: clienteSalvo.email || lead.email,
                empresa: clienteSalvo.razaoSocial || lead.empresa
              };
              await atualizarLead(lead.id, novosDados);
              onUpdateLead({ ...lead, ...novosDados });
            }
          }}
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
        {msgs.filter(m => m.texto?.trim() || m.mediaUrl || m.mediaType).map(m => (
          <div key={m.id} className={`flex ${m.tipo === 'saida' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${m.tipo === 'saida' ? 'bg-[#dcf8c6] text-gray-800 rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm'}`}>
              {mensagemTemMidiaReal(m) && (
                <MidiaMensagem mensagem={m} />
              )}
              {/* Midia inline */}
              {false && m.mediaUrl && m.mediaType === 'image' && (
                <img src={m.mediaUrl} alt="imagem" className="rounded-lg max-w-full max-h-64 mb-1 cursor-pointer hover:opacity-90"
                  onClick={() => window.open(m.mediaUrl, '_blank')} />
              )}
              {false && m.mediaUrl && m.mediaType === 'video' && (
                <video src={m.mediaUrl} controls className="rounded-lg max-w-full max-h-64 mb-1" />
              )}
              {false && m.mediaUrl && m.mediaType === 'audio' && (
                <audio src={m.mediaUrl} controls className="mb-1 w-full" />
              )}
              {false && m.mediaUrl && m.mediaType === 'document' && (
                <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1 hover:bg-gray-100 transition-colors">
                  <span className="text-2xl">📄</span>
                  <span className="text-xs text-blue-600 font-medium underline">Abrir documento</span>
                </a>
              )}
              {/* Indicador de midia sem URL (fallback texto) */}
              {false && !m.mediaUrl && m.texto && /^\[(image|video|audio|document)\]$/.test(m.texto) && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                  <span className="text-lg">{m.texto.includes('image') ? '🖼️' : m.texto.includes('video') ? '🎬' : m.texto.includes('audio') ? '🎵' : '📄'}</span>
                  <span className="text-xs text-gray-500 italic">Midia recebida</span>
                </div>
              )}
              {/* Texto da mensagem */}
              {m.texto && !textoSomenteMidia(m.texto) && (
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
  const [variantId, setVariantId] = useState<string>('A'); // rastreia variante A/B
  const lastLeadId = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analisandoRef = useRef(false);
  const ultimoExperimentoId = useRef<string | null>(null); // id do ultimo experimento registrado
  const etapaAutoRef = useRef<string>('');

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
        body: JSON.stringify({
          telefone: lead.telefone,
          id: lead.id,
          nome: lead.nome,
          empresa: lead.empresa,
          etapa: lead.etapa,
          mensagens: msgs.slice(-80).map((m: any) => ({
            texto: m.texto || m.conteudo || m.body || (normalizarTipoMidia(m.mediaType) ? `[${normalizarTipoMidia(m.mediaType)}]` : ''),
            tipo: m.tipo || m.direction || 'entrada',
            criadoEm: m.criadoEm || m.timestamp || m.criado_em || '',
          })),
        }),
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
      if (json.variantId) setVariantId(json.variantId);
      ultimoExperimentoId.current = null; // reset para novo ciclo
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
  }, [lead.telefone, lead.nome, lead.empresa, lead.etapa, msgs]);

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

  useEffect(() => {
    const proxima = analise?.etapaDetectada as EtapaFunil | undefined;
    const confianca = Number(analise?.confiancaFunil || analise?.confianca || 0);
    const atualIdx = ETAPA_ORDEM.indexOf(lead.etapa);
    const proxIdx = proxima ? ETAPA_ORDEM.indexOf(proxima) : -1;
    const podeAutoMover =
      !!analise?.deveAvancarEtapa &&
      !!proxima &&
      atualIdx >= 0 &&
      proxIdx >= 0 &&
      proxIdx > atualIdx &&
      confianca >= 80 &&
      proxima !== 'fechado_perdido';

    if (!podeAutoMover) return;
    const key = `${lead.id}:${lead.etapa}->${proxima}:${analise?.motivoAvanco || ''}`;
    if (etapaAutoRef.current === key) return;
    etapaAutoRef.current = key;
    onMudarEtapa(proxima);
    setAnalise((prev: any) => prev ? { ...prev, funilMovidoAutomaticamente: true } : prev);
  }, [analise, lead.id, lead.etapa, onMudarEtapa]);

  const etapaDetectada = analise?.etapaDetectada as EtapaFunil | undefined;
  const etapaLabel = ETAPAS_FUNIL.find(e => e.id === etapaDetectada)?.label;
  const deveAvancar = analise?.deveAvancarEtapa && etapaDetectada && etapaDetectada !== lead.etapa;
  const checkupAtendimento = analise?.diretorVendas?.checkupAtendimento;

  return (
    <div className="flex flex-col h-full bg-white border-l overflow-hidden">
      <div className="px-3 py-3 border-b flex-shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">🧠 Giorno Giovanna</p>
            <p className="text-[10px] text-white/60 mt-0.5">Operador de Vendas IA · SPIN · Challenger</p>
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
            {analise.funilMovidoAutomaticamente && etapaDetectada && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs text-emerald-700 font-semibold">Funil atualizado automaticamente pela leitura da conversa.</p>
              </div>
            )}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">📋 Parecer</p>
              <p className="text-xs text-gray-700 leading-relaxed">{analise.parecer}</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1.5">🎯 Técnica Indicada</p>
              <p className="text-xs text-violet-700 leading-relaxed font-medium">{analise.tecnicaRecomendada}</p>
            </div>
            {analise.diretorVendas && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bruno Bucciarati · Gerente de Vendas IA</p>
                  {analise.diretorVendas.nivelOportunidade && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                      analise.diretorVendas.nivelOportunidade === 'alto'
                        ? 'bg-emerald-100 text-emerald-700'
                        : analise.diretorVendas.nivelOportunidade === 'medio'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {analise.diretorVendas.nivelOportunidade}
                    </span>
                  )}
                </div>
                {analise.diretorVendas.produtoSugerido && (
                  <p className="text-xs font-semibold text-slate-800 mb-1">{analise.diretorVendas.produtoSugerido}</p>
                )}
                {analise.diretorVendas.recomendacaoDono && (
                  <p className="text-xs text-slate-700 leading-relaxed">{analise.diretorVendas.recomendacaoDono}</p>
                )}
                {checkupAtendimento && (
                  <div className="mt-2 rounded-lg border border-white bg-white p-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Checkup do atendimento</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        checkupAtendimento.prioridade === 'alta'
                          ? 'bg-red-100 text-red-700'
                          : checkupAtendimento.prioridade === 'media'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {checkupAtendimento.prioridade || 'baixa'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{checkupAtendimento.motivo}</p>
                    {checkupAtendimento.prazoResposta && (
                      <p className="text-[10px] text-slate-500 mt-1">Prazo: <span className="font-semibold">{checkupAtendimento.prazoResposta}</span></p>
                    )}
                    {checkupAtendimento.tarefas?.length > 0 && (
                      <div className="flex flex-col gap-1 mt-2">
                        {checkupAtendimento.tarefas.slice(0, 3).map((t: any, i: number) => (
                          <div key={i} className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1">
                            <p className="text-[11px] font-semibold text-slate-700">{t.titulo}</p>
                            <p className="text-[10px] text-slate-500">{t.prazo}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {checkupAtendimento.avaliacaoVenda && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500">Nota atendimento</span>
                        <span className="text-xs font-bold text-slate-800">{checkupAtendimento.avaliacaoVenda.nota}/100</span>
                      </div>
                    )}
                  </div>
                )}
                {analise.diretorVendas.dadosFaltantesProduto?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {analise.diretorVendas.dadosFaltantesProduto.slice(0, 4).map((d: string, i: number) => (
                      <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                        falta: {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                      coleta_dado: { texto: 'Coletar dado', icone: '📋', cor: 'text-violet-600' },
                      orcamento: { texto: 'Orçamento', icone: '🧮', cor: 'text-emerald-600' },
                      fechamento: { texto: 'Fechamento', icone: '🤝', cor: 'text-green-600' },
                      follow_up: { texto: 'Follow-up', icone: '⏱️', cor: 'text-amber-600' },
                      prazo_frete: { texto: 'Prazo/Frete', icone: '🚚', cor: 'text-blue-600' },
                      resposta_contextual: { texto: 'Contexto', icone: '💬', cor: 'text-indigo-600' },
                    };
                    const info = labelMap[s.tipoAcao] || labelMap[s.label] || { texto: s.label, icone: '💬', cor: 'text-indigo-600' };
                    return (
                    <button key={i} onClick={() => {
                      onUsarSugestao(s.mensagem);
                      // Registra uso para aprendizado do Bruno
                      fetch('/api/assistente-vendas', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          modo: 'aprendizado-uso',
                          lead_id: lead.id,
                          telefone: lead.telefone,
                          variant_id: variantId,
                          label: s.tipoAcao ? `${s.tipoAcao}:${s.label}` : s.label,
                          mensagem: s.mensagem,
                          etapa: lead.etapa,
                          tecnica: [
                            analise?.tecnicaRecomendada || '',
                            analise?.perfilCliente ? `perfil:${analise.perfilCliente}` : '',
                            s.momentoVenda ? `momento:${s.momentoVenda}` : '',
                            s.tipoAcao ? `acao:${s.tipoAcao}` : '',
                          ].filter(Boolean).join(' | '),
                        }),
                      })
                        .then(r => r.json())
                        .then(d => { if (d.experimento_id) ultimoExperimentoId.current = d.experimento_id; })
                        .catch(() => {});
                    }}
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
function minutosDesdeIso(iso?: string): number {
  const t = new Date(iso || '').getTime();
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}
function fmtCronometro(min: number): string {
  if (min <= 1) return 'agora';
  if (min < 60) return `${min}min`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.floor(min / 1440)}d`;
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

function previewMidia(texto?: string): string {
  const valor = String(texto || '').trim();
  const match = valor.match(/^\[?(image|video|audio|document|media|midia|imagem|sticker)\]?(?:\s+.*)?$/i);
  const tipo = match?.[1]?.toLowerCase();
  if (tipo === 'image' || tipo === 'imagem') return 'Foto';
  if (tipo === 'video') return 'Video';
  if (tipo === 'audio') return 'Audio';
  if (tipo === 'document') return 'Documento';
  if (tipo === 'sticker') return 'Figurinha';
  if (tipo === 'media' || tipo === 'midia') return 'Midia';
  return '';
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
  const midiaPreview = previewMidia(msgBruta);
  const temMsg = !!(msgBruta && !midiaPreview && msgBruta.toLowerCase() !== 'sem mensagens ainda');
  const preview = temMsg
    ? msgBruta
    : midiaPreview
      ? midiaPreview
      : (lead.totalMensagens ?? 0) > 0
        ? 'Abrir conversa'
        : (lead.empresa || lead.email || 'Sem mensagens ainda');
  const hora = fmtHora(lead.ultimaHora || lead.atualizadoEm || lead.criadoEm || '');
  const minutosParado = minutosDesdeIso(lead.ultimaHora || lead.atualizadoEm || lead.criadoEm);
  const clienteAguardando = lead.ultimaTipo !== 'saida' && (lead.totalMensagens ?? 0) > 0;
  const tempoClass = clienteAguardando
    ? minutosParado >= 60
      ? 'bg-red-100 text-red-700'
      : minutosParado >= 15
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-500';

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
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-semibold ${tempoClass}`} title={clienteAguardando ? 'Tempo aguardando resposta' : 'Tempo desde a ultima interacao'}>
              {fmtCronometro(minutosParado)}
            </span>
            {naoLido && !ativo && (
              <span className="flex-shrink-0 bg-[#25D366] rounded-full w-[10px] h-[10px]" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Bruno Bucciarati — Command Center ──────────────────────────────────────
function CheckupBrunoGeral({ onAbrirLead }: { onAbrirLead: (leadId: string) => void }) {
  const [checkup, setCheckup] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [expandido, setExpandido] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch('/api/assistente-vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'checkup-geral' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro no checkup');
      setCheckup(json.checkupGeral);
    } catch (e: any) {
      setErro(e.message || 'Erro no checkup');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 120000);
    return () => clearInterval(id);
  }, [carregar]);

  const ind = checkup?.indicadores || {};
  const cobrancas: any[] = Array.isArray(checkup?.cobrancas) ? checkup.cobrancas : [];
  const metas: any[] = Array.isArray(checkup?.metas) ? checkup.metas : [];
  const metasAtendimento: any[] = Array.isArray(checkup?.metasAtendimento) ? checkup.metasAtendimento : metas.slice(0, 5);
  const metasFechamento: any[] = Array.isArray(checkup?.metasFechamento) ? checkup.metasFechamento : metas.slice(5);
  const funil: any[] = Array.isArray(checkup?.distribuicaoFunil) ? checkup.distribuicaoFunil : [];
  const saude = checkup?.saudeFunil || {};
  const filaAtendimento: any[] = Array.isArray(checkup?.ordemAtendimento) ? checkup.ordemAtendimento : [];
  const atendimentos: any[] = Array.isArray(checkup?.atendimentosAvaliados) ? checkup.atendimentosAvaliados : [];
  const processos: any[] = Array.isArray(checkup?.processosQueFaltam) ? checkup.processosQueFaltam : [];
  const cronograma: any[] = Array.isArray(checkup?.cronograma) ? checkup.cronograma : [];
  const ordemProcessos: string[] = Array.isArray(checkup?.ordemProcessos) ? checkup.ordemProcessos : [];
  const insights: any[] = Array.isArray(checkup?.insightsAprendidos) ? checkup.insightsAprendidos : [];
  const maxFunil = Math.max(...funil.map((f: any) => f.total || 0), 1);

  const fmtTempo = (min: number) => {
    if (min < 60) return `${min}min`;
    if (min < 1440) return `${Math.round(min / 60)}h`;
    return `${Math.round(min / 1440)}d`;
  };

  const corKPI = (valor: number, bom: number, ruim: number, inverso = false) => {
    if (inverso) return valor <= bom ? 'from-emerald-500 to-emerald-600' : valor >= ruim ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600';
    return valor >= bom ? 'from-emerald-500 to-emerald-600' : valor <= ruim ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600';
  };

  const priorClasse = (p?: string) => {
    if (p === 'alta' || p === 'critica') return 'border-red-400/30 bg-red-500/10 text-red-200';
    if (p === 'media') return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    return 'border-slate-500/30 bg-slate-600/10 text-slate-300';
  };
  const notaClasse = (nota?: number) => {
    const n = Number(nota || 0);
    if (n >= 85) return 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20';
    if (n >= 70) return 'text-amber-300 bg-amber-500/10 border-amber-400/20';
    return 'text-red-300 bg-red-500/10 border-red-400/20';
  };
  const fmtDin = (valor?: number) => {
    const n = Number(valor || 0);
    if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
    return `R$ ${n.toLocaleString('pt-BR')}`;
  };
  const cardMeta = (meta: any, i: number) => (
    <div key={`${meta.nome || i}-${i}`}>
      <div className="flex items-center justify-between gap-1 text-[9px] mb-0.5">
        <span className="text-slate-300 font-medium truncate">{meta.nome}</span>
        <span className={`font-bold ${meta.status === 'ok' ? 'text-emerald-400' : meta.status === 'cobrar' ? 'text-red-400' : 'text-amber-400'}`}>{meta.atingido || 0}%</span>
      </div>
      <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${meta.status === 'ok' ? 'bg-emerald-500' : meta.status === 'cobrar' ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${Math.max(0, Math.min(100, meta.atingido || 0))}%` }} />
      </div>
    </div>
  );

  if (!expandido) {
    return (
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-4 py-1.5 flex items-center gap-4 cursor-pointer select-none flex-shrink-0" onClick={() => setExpandido(true)}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold">B</div>
          <span className="text-[10px] font-bold text-white/80">BRUNO</span>
        </div>
        <div className="flex gap-3 text-[10px]">
          {(ind.altaPrioridade || 0) > 0 && <span className="text-red-400 font-bold animate-pulse">{ind.altaPrioridade} urgentes</span>}
          <span className="text-slate-400">{ind.leadsAtivos || 0} ativos</span>
          <span className={(saude.notaGeral || 0) >= 70 ? 'text-emerald-400' : 'text-red-400'}>nota {saude.notaGeral || 0}/100</span>
          <span className="text-slate-400">{ind.taxaConversao || 0}% conv.</span>
          {(ind.tempoMedioEspera || 0) > 0 && <span className={(ind.tempoMedioEspera || 0) > 60 ? 'text-red-400' : 'text-emerald-400'}>{fmtTempo(ind.tempoMedioEspera || 0)} espera</span>}
        </div>
        <span className="ml-auto text-slate-500 hover:text-white text-[10px]">Expandir ▼</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 flex-shrink-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-500/20">B</div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">BRUNO BUCCIARATI</p>
            <p className="text-[10px] text-slate-400">Gerente de Vendas IA · Monitorando {ind.leadsAtivos || 0} leads</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {checkup?.resumoGerencial && <p className="text-[10px] text-slate-400 max-w-xs truncate hidden lg:block">{checkup.resumoGerencial}</p>}
          <button onClick={carregar} disabled={carregando} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center transition-all disabled:opacity-30">{carregando ? '...' : '↻'}</button>
          <button onClick={() => setExpandido(false)} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center transition-all">▲</button>
        </div>
      </div>

      {erro && <p className="mx-4 mb-2 rounded-md bg-red-500/20 border border-red-400/30 px-3 py-1.5 text-[10px] text-red-300">{erro}</p>}

      <div className="px-4 pb-2 grid grid-cols-8 gap-1.5">
        {[
          { label: 'Nota Geral', valor: `${saude.notaGeral || 0}/100`, grad: corKPI(saude.notaGeral || 0, 85, 60), sub: saude.status || 'sem leitura', pulse: (saude.notaGeral || 0) < 60 },
          { label: 'Satisfacao', valor: `${ind.indiceSatisfacao || 0}%`, grad: corKPI(ind.indiceSatisfacao || 0, 82, 55), sub: 'indice percebido', pulse: false },
          { label: 'Leads Ativos', valor: String(ind.leadsAtivos || 0), grad: 'from-indigo-500 to-indigo-600', sub: `${ind.semMovimento || 0} parados`, pulse: false },
          { label: 'Urgentes', valor: String(ind.altaPrioridade || 0), grad: corKPI(ind.altaPrioridade || 0, 0, 2, true), sub: `${ind.respostasPendentes || 0} s/ resposta`, pulse: (ind.altaPrioridade || 0) > 0 },
          { label: 'Espera Media', valor: fmtTempo(ind.tempoMedioEspera || 0), grad: corKPI(ind.tempoMedioEspera || 0, 15, 60, true), sub: `max: ${fmtTempo(ind.tempoMaximoEspera || 0)}`, pulse: false },
          { label: 'Resp. Rapida', valor: `${ind.taxaRespostaRapida ?? 100}%`, grad: corKPI(ind.taxaRespostaRapida ?? 100, 70, 40), sub: `${ind.respostasRapidas || 0} <15min`, pulse: false },
          { label: 'Conversao', valor: `${ind.taxaConversao || 0}%`, grad: corKPI(ind.taxaConversao || 0, 20, 5), sub: `${ind.ganhos || 0}W / ${ind.perdidos || 0}L`, pulse: false },
          { label: 'Propostas', valor: String(ind.propostasAbertas || 0), grad: 'from-amber-500 to-amber-600', sub: `${ind.followUps || 0} follow-ups`, pulse: false },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-md bg-white/5 border border-white/10 px-2 py-1.5 ${kpi.pulse ? 'animate-pulse' : ''}`}>
            <p className="text-[8px] uppercase tracking-wider text-slate-400 font-semibold">{kpi.label}</p>
            <p className={`text-base font-black bg-gradient-to-r ${kpi.grad} bg-clip-text text-transparent leading-tight`}>{kpi.valor}</p>
            <p className="text-[8px] text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="px-4 pb-2 grid grid-cols-12 gap-2">
        <div className="col-span-3 rounded-md bg-white/5 border border-white/10 p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Funil de Vendas</p>
          <div className="grid grid-cols-2 gap-1.5">
            {funil.map((f: any, i: number) => (
              <div key={i} className="rounded-md bg-slate-950/25 border border-white/10 px-2 py-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[8px] text-slate-300 font-semibold truncate">{f.label}</span>
                  <span className="text-base leading-none font-black text-white">{f.total || 0}</span>
                </div>
                <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, ((f.total || 0) / maxFunil) * 100)}%`, backgroundColor: f.cor }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 rounded-md bg-white/5 border border-white/10 p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Saude do Funil</p>
          <div className={`rounded-md border px-2 py-2 mb-2 ${notaClasse(saude.notaGeral)}`}>
            <div className="flex items-end justify-between gap-2">
              <span className="text-[9px] uppercase font-bold">Nota geral</span>
              <span className="text-2xl leading-none font-black">{saude.notaGeral || 0}</span>
            </div>
            <p className="text-[9px] uppercase font-semibold mt-1">{saude.status || 'sem leitura'}</p>
          </div>
          <div className="flex flex-col gap-1">
            {(saude.melhoresIndices || []).slice(0, 3).map((idx: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-1 text-[9px]">
                <span className="text-slate-300 truncate">{idx.nome}</span>
                <span className="font-bold text-emerald-300">{idx.valor}{String(idx.nome || '').includes('Nota') ? '' : '%'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-3 rounded-md bg-white/5 border border-white/10 p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Metas de Atendimento</p>
          <div className="flex flex-col gap-1 mb-2">
            {metasAtendimento.slice(0, 5).map(cardMeta)}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Metas de Fechamento</p>
          <div className="flex flex-col gap-1">
            {metasFechamento.slice(0, 4).map(cardMeta)}
          </div>
        </div>

        <div className="col-span-4 rounded-md bg-white/5 border border-white/10 p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Ordem de Atendimento</p>
          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
            {filaAtendimento.length === 0 && !carregando && <p className="text-[9px] text-emerald-400 font-medium py-1 text-center">Tudo em dia.</p>}
            {filaAtendimento.slice(0, 8).map((a: any, i: number) => (
              <button key={`${a.leadId || i}-${a.urgenciaScore}`} onClick={() => a.leadId && onAbrirLead(a.leadId)}
                className={`rounded border px-2 py-1.5 text-left transition-all hover:bg-white/5 ${priorClasse(a.prioridade)}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[9px] font-bold">{i + 1}. {a.nome || a.telefone || 'Lead'}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[8px] rounded px-1 py-0.5 border ${notaClasse(a.notaAtendimento)}`}>N {a.notaAtendimento || 0}</span>
                    <span className="text-[8px] rounded px-1 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">{fmtDin(a.valorPotencial)}</span>
                  </div>
                </div>
                <p className="text-[8px] font-semibold opacity-90 truncate">{a.chamadaBruno || a.proximaAcao}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Notas por Atendimento</p>
            <span className="text-[9px] text-slate-400">media {ind.notaMediaAtendimento || 0}/100</span>
          </div>
          <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto pr-1">
            {atendimentos.slice(0, 10).map((a: any, i: number) => (
              <button key={`${a.leadId || i}-nota`} onClick={() => a.leadId && onAbrirLead(a.leadId)}
                className={`rounded border px-2 py-1 text-left hover:bg-white/5 ${notaClasse(a.notaAtendimento)}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold truncate">{a.nome || a.telefone || 'Lead'}</span>
                  <span className="text-[10px] font-black">{a.notaAtendimento || 0}</span>
                </div>
                <p className="text-[8px] opacity-80 truncate">{a.proximaAcao}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Cobranca Progressiva</p>
            <span className="text-[9px] text-slate-400">{filaAtendimento.length || cobrancas.length} na fila</span>
          </div>
          <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
            {[...filaAtendimento, ...cobrancas].slice(0, 6).map((c: any, i: number) => (
              <button key={`${c.leadId || i}-cobranca`} onClick={() => c.leadId && onAbrirLead(c.leadId)}
                className={`rounded border px-2 py-1 text-left hover:bg-white/5 ${priorClasse(c.prioridade)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold truncate">{c.nome || c.telefone || 'Lead'}</span>
                  <span className="text-[8px] uppercase font-black rounded px-1 py-0.5 bg-white/10">{c.nivelCobranca || c.prioridade || 'fila'}</span>
                </div>
                <p className="text-[8px] opacity-90 truncate">{c.chamadaBruno || c.titulo || c.proximaAcao}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden">
        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Funil de Vendas</p>
          <div className="flex flex-col gap-1">
            {funil.filter((f: any) => f.total > 0).map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[8px] text-slate-400 w-14 truncate text-right font-medium">{f.label}</span>
                <div className="flex-1 h-3 bg-slate-700/50 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm transition-all duration-700" style={{ width: `${Math.max(8, (f.total / maxFunil) * 100)}%`, backgroundColor: f.cor }} />
                </div>
                <span className="text-[9px] text-white font-bold w-4 text-right">{f.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Metas</p>
          <div className="flex flex-col gap-1">
            {metas.map((meta: any, i: number) => (
              <div key={i}>
                <div className="flex items-center justify-between gap-1 text-[9px] mb-0.5">
                  <span className="text-slate-300 font-medium truncate">{meta.nome}</span>
                  <span className={`font-bold ${meta.status === 'ok' ? 'text-emerald-400' : meta.status === 'cobrar' ? 'text-red-400' : 'text-amber-400'}`}>{meta.atingido || 0}%</span>
                </div>
                <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${meta.status === 'ok' ? 'bg-emerald-500' : meta.status === 'cobrar' ? 'bg-red-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.max(0, Math.min(100, meta.atingido || 0))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Cobranças ({cobrancas.length})</p>
          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
            {cobrancas.length === 0 && !carregando && <p className="text-[9px] text-emerald-400 font-medium py-1 text-center">Tudo em dia.</p>}
            {cobrancas.slice(0, 5).map((c: any, i: number) => (
              <button key={`${c.leadId || i}-${c.tipo}`} onClick={() => c.leadId && onAbrirLead(c.leadId)}
                className={`rounded border px-2 py-1 text-left transition-all hover:bg-white/5 ${priorClasse(c.prioridade)}`}>
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[9px] font-bold">{c.nome || c.telefone || 'Lead'}</p>
                  <span className={`flex-shrink-0 text-[7px] font-black uppercase rounded px-1 py-0.5 ${c.prioridade === 'alta' ? 'bg-red-500/20 text-red-300' : c.prioridade === 'media' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-400'}`}>{c.prioridade}</span>
                </div>
                <p className="text-[8px] font-semibold opacity-90 truncate">{c.titulo}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {(cronograma.length > 0 || ordemProcessos.length > 0) && (
        <div className="px-4 pb-2 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white/5 border border-white/10 p-2">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Cronograma Comercial</p>
            <div className="flex flex-col gap-1">
              {cronograma.slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[9px]">
                  <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-200 flex items-center justify-center font-black">{c.ordem || i + 1}</span>
                  <span className="text-slate-200 font-semibold truncate">{c.etapa}</span>
                  <span className="text-slate-500 ml-auto whitespace-nowrap">{c.prazo}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-white/5 border border-white/10 p-2">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Ordem dos Processos</p>
            <div className="flex flex-col gap-1">
              {ordemProcessos.slice(0, 4).map((p: string, i: number) => (
                <p key={i} className="text-[9px] text-slate-300 truncate"><span className="text-indigo-300 font-bold">{i + 1}.</span> {p}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {processos.length > 0 && (
        <div className="px-4 pb-2">
          <div className="rounded-md bg-red-500/5 border border-red-400/20 px-3 py-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {processos.slice(0, 2).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.prioridade === 'alta' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <p className="text-[9px] font-bold text-slate-200">{p.titulo}</p>
                  <p className="text-[8px] text-slate-400 truncate max-w-xs">{p.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
function soDigitosProposta(valor?: string): string {
  return String(valor || '').replace(/\D/g, '');
}

function cidadeUfProposta(cliente: any): string {
  return [cliente?.cidade, cliente?.uf].filter(Boolean).join('/');
}

function enderecoClienteProposta(cliente: any): string {
  return [
    cliente?.logradouro,
    cliente?.numero,
    cliente?.bairro,
    cidadeUfProposta(cliente),
  ].filter(Boolean).join(', ');
}

function extrairCnpjProposta(mensagens?: Mensagem[]): string {
  const texto = (mensagens || []).map((m: any) => m.texto || m.conteudo || '').join(' ');
  const match = texto.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  return match ? soDigitosProposta(match[0]) : '';
}

async function buscarBrasilApiCnpj(cnpj: string) {
  const cnpjLimpo = soDigitosProposta(cnpj);
  if (cnpjLimpo.length !== 14) return null;
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    cnpj: cnpjLimpo,
    empresa: data.nome_fantasia || data.razao_social || '',
    razaoSocial: data.razao_social || '',
    nomeFantasia: data.nome_fantasia || '',
    inscricaoEstadual: data.inscricoes_estaduais?.[0]?.inscricao_estadual || '',
    cep: data.cep || '',
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    bairro: data.bairro || '',
    cidade: data.municipio || '',
    uf: data.uf || '',
  };
}

function primeiroNumeroPositivo(...valores: any[]): number {
  for (const valor of valores) {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function precoProdutoCadastro(produto?: Partial<Produto> | null): number {
  return primeiroNumeroPositivo(produto?.preco, produto?.precoRegular, produto?.precoPromocional);
}

function descricaoProdutoCadastro(produto: Produto, atual?: string): string {
  if (String(atual || '').trim()) return String(atual).trim();
  return [
    produto.sku ? `SKU: ${produto.sku}` : '',
    produto.descricao || produto.categoria || '',
  ].filter(Boolean).join(' - ');
}

function itemComProdutoCadastro(produto: Produto, atual: ItemProposta): ItemProposta {
  return {
    ...atual,
    nome: produto.nome || atual.nome || '',
    descricao: descricaoProdutoCadastro(produto, atual.descricao),
    qtd: Number(atual.qtd) || 1,
    valorUnitario: precoProdutoCadastro(produto),
    produtoId: produto.id,
    skuCatalogo: produto.sku,
    nomeCatalogo: produto.nome,
  };
}

function itemPropostaDaAnalise(p: any): ItemProposta {
  const opcoes = Array.isArray(p?.opcoesSugeridas) ? p.opcoesSugeridas : [];
  const opcaoEscolhida = opcoes.find((o: any) =>
    (p.skuCatalogo && o.sku === p.skuCatalogo) ||
    (p.nomeCatalogo && o.nome === p.nomeCatalogo)
  );
  const usarOpcao = p?.produtoPadrao || p?.skuCatalogo || p?.nomeCatalogo;
  const preco = primeiroNumeroPositivo(
    p?.valorUnitario,
    p?.precoUnitario,
    p?.preco,
    p?.precoRegular,
    p?.simulacaoPreco?.precoUnitario,
    opcaoEscolhida?.precoUnitario,
    usarOpcao ? opcoes[0]?.precoUnitario : 0,
  );
  const sku = p?.skuCatalogo || opcaoEscolhida?.sku || (usarOpcao ? opcoes[0]?.sku : '');
  return {
    nome: p?.nomeCatalogo || p?.nome || opcaoEscolhida?.nome || (usarOpcao ? opcoes[0]?.nome : '') || '',
    descricao: [
      p?.descricao || '',
      sku ? `SKU: ${sku}` : '',
      p?.simulacaoPreco?.observacoes?.length ? p.simulacaoPreco.observacoes.join('; ') : '',
    ].filter(Boolean).join(' - '),
    qtd: Number(p?.qtd || p?.quantidade) || 1,
    valorUnitario: preco,
    produtoId: p?.produtoId || undefined,
    skuCatalogo: sku || undefined,
    nomeCatalogo: p?.nomeCatalogo || opcaoEscolhida?.nome || undefined,
  };
}

function ProdutoPropostaInput({ item, onNomeChange, onSelect }: {
  item: ItemProposta;
  onNomeChange: (valor: string) => void;
  onSelect: (produto: Produto) => void;
}) {
  const [termo, setTermo] = useState(item.nome || '');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTermo(item.nome || '');
  }, [item.nome]);

  useEffect(() => {
    if (!aberto || termo.trim().length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const lista = await searchProdutos(termo, 8);
        if (!cancelado) setResultados(lista);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [termo, aberto]);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} className="col-span-4 relative">
      <input
        placeholder="Nome do item"
        value={item.nome || ''}
        onFocus={() => { setAberto(true); setTermo(item.nome || ''); }}
        onChange={e => { onNomeChange(e.target.value); setTermo(e.target.value); setAberto(true); }}
        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
      />
      {aberto && (resultados.length > 0 || buscando) && (
        <div className="absolute z-30 mt-1 w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-indigo-100 bg-white shadow-xl overflow-hidden">
          {buscando && <p className="px-3 py-2 text-[11px] text-gray-400">Buscando no cadastro...</p>}
          {resultados.map(produto => {
            const preco = precoProdutoCadastro(produto);
            return (
              <button
                key={produto.id || produto.sku || produto.nome}
                type="button"
                onClick={() => { onSelect(produto); setAberto(false); }}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-t first:border-t-0 border-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-800 truncate">{produto.nome}</p>
                  <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">{fmtPreco(preco)}</span>
                </div>
                <p className="text-[10px] text-gray-400 truncate">{produto.sku ? `SKU: ${produto.sku}` : produto.categoria || 'Produto cadastrado'}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PropostaModal({ lead, analisePrevia, mensagens, onClose }: {
  lead: Lead;
  analisePrevia?: any;
  mensagens?: Mensagem[];
  onClose: () => void;
}) {
  // Se recebemos uma analise ja feita pelo painel Inteligencia, pre-populamos
  const clientePrev = analisePrevia?.cliente || {};
  const enderecoPrev = enderecoClienteProposta(clientePrev);
  const documentoPrev = clientePrev.cnpj || clientePrev.cpf || (lead as any).cnpj || (lead as any).documento || extrairCnpjProposta(mensagens) || '';
  const initDados: Omit<PropostaDados,'itens'> = {
    empresa: clientePrev.empresa || clientePrev.razaoSocial || clientePrev.nomeFantasia || lead.empresa || lead.nome || '',
    ac: clientePrev.nome || lead.nome || '',
    cnpj: documentoPrev,
    telefone: clientePrev.telefone || lead.telefone || '',
    email: clientePrev.email || lead.email || '',
    endereco: enderecoPrev,
    cidade: cidadeUfProposta(clientePrev) || '',
    cep: clientePrev.cep || '',
    local: enderecoPrev || cidadeUfProposta(clientePrev) || '',
    contato: clientePrev.nome || lead.nome || '',
    vendedor: 'Jean',
    frete: 'À combinar',
    validade: '7 dias corridos',
    pagamento: '50% de entrada e 50% na entrega',
    prazoEntrega: analisePrevia?.prazoEntrega || 'A confirmar apÃ³s aceite formal',
    intro: analisePrevia?.resumoConversa
      ? `Em atendimento ao contato realizado, apresentamos proposta conforme dados coletados na conversa: ${analisePrevia.resumoConversa}`
      : '',
  } as any;
  const initItens: ItemProposta[] = Array.isArray(analisePrevia?.produtos) && analisePrevia.produtos.length > 0
    ? analisePrevia.produtos.map(itemPropostaDaAnalise)
    : [{ nome: '', descricao: '', qtd: 1, valorUnitario: 0 }];

  const [dados, setDados] = useState<Omit<PropostaDados,'itens'>>(initDados);
  const [itens, setItens] = useState<ItemProposta[]>(initItens);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const [iaOk, setIaOk] = useState(!!analisePrevia);
  const cnpjConsultadoRef = useRef('');
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

  useEffect(() => {
    const cnpj = soDigitosProposta((dados as any).cnpj);
    if (cnpj.length !== 14 || cnpjConsultadoRef.current === cnpj) return;
    if (dados.empresa && dados.endereco && dados.cep) return;

    cnpjConsultadoRef.current = cnpj;
    buscarBrasilApiCnpj(cnpj)
      .then(info => {
        if (!info) return;
        const endereco = enderecoClienteProposta(info);
        setDados(prev => ({
          ...prev,
          cnpj: prev.cnpj || info.cnpj,
          empresa: prev.empresa || info.empresa || info.razaoSocial,
          endereco: prev.endereco || endereco,
          cidade: prev.cidade || cidadeUfProposta(info),
          cep: prev.cep || info.cep,
          local: prev.local || endereco || cidadeUfProposta(info),
        }));
      })
      .catch(() => {});
  }, [dados.empresa, dados.endereco, dados.cep, (dados as any).cnpj]);

  const gerarComIA = async () => {
    if (!lead.telefone) { setErroIA('Este lead não tem telefone — necessário para buscar a conversa.'); return; }
    setGerandoIA(true); setErroIA(''); setIaOk(false);
    try {
      const res = await fetch('/api/proposta-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: lead.telefone, nome: lead.nome, email: lead.email, empresa: lead.empresa, mensagens: (mensagens || []).map((m: any) => ({ texto: m.texto || m.conteudo || m.body || (normalizarTipoMidia(m.mediaType) ? `[${normalizarTipoMidia(m.mediaType)}]` : ''), tipo: m.tipo || m.direction || 'entrada', criadoEm: m.criadoEm || m.timestamp || '' })) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro desconhecido');
      const p = json.proposta;
      setDados({ empresa: p.empresa || dados.empresa, ac: p.ac || dados.ac || '', telefone: p.telefone || dados.telefone,
        email: p.email || dados.email, cnpj: p.cnpj || dados.cnpj, endereco: p.endereco || dados.endereco,
        cep: p.cep || dados.cep, cidade: p.cidade || dados.cidade, local: p.local || dados.local,
        contato: p.contato || dados.contato || dados.ac, vendedor: p.vendedor || 'Jean',
        frete: p.frete || 'À combinar', validade: p.validade || '7 dias corridos',
        pagamento: p.pagamento || '50% de entrada e 50% na entrega',
        prazoEntrega: p.prazoEntrega || 'A confirmar após aceite formal', intro: p.intro || '' });
      if (p.itens?.length > 0) {
        setItens(p.itens.map((it: any) => ({
          nome: it.nomeCatalogo || it.nome || it.descricao || 'Item',
          descricao: [
            it.descricao || '',
            it.skuCatalogo ? `SKU: ${it.skuCatalogo}` : '',
          ].filter(Boolean).join(' - '),
          qtd: Number(it.qtd || it.quantidade) || 1,
          valorUnitario: primeiroNumeroPositivo(it.valorUnitario, it.precoUnitario, it.preco, it.precoRegular),
          produtoId: it.produtoId,
          skuCatalogo: it.skuCatalogo,
          nomeCatalogo: it.nomeCatalogo,
        })));
      }
      setIaOk(true);
    } catch (e: any) { setErroIA(e.message || 'Erro ao chamar IA'); }
    finally { setGerandoIA(false); }
  };

  // Auto-dispara IA ao abrir o modal, APENAS se nao veio analise previa do painel Inteligencia
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!analisePrevia) gerarComIA(); }, []);

  const gerar = async () => {
    const documento = String((dados as any).cnpj || documentoPrev || '').trim();
    const documentoDigitos = soDigitosProposta(documento);
    const tipoCliente: Cliente['tipo'] = documentoDigitos.length === 11 ? 'PF' : 'PJ';
    const cidadePartes = String((dados as any).cidade || '').split('/');
    const clientePatch: Partial<Cliente> = {
      nome: (dados as any).contato || dados.ac || clientePrev.nome || lead.nome || dados.empresa || 'Cliente',
      email: dados.email || lead.email || clientePrev.email || '',
      telefone: dados.telefone || lead.telefone || clientePrev.telefone || '',
      tipo: tipoCliente,
      documento,
      cnpj: documentoDigitos.length === 14 ? documentoDigitos : undefined,
      razaoSocial: clientePrev.razaoSocial || undefined,
      nomeFantasia: clientePrev.nomeFantasia || undefined,
      inscricaoEstadual: clientePrev.inscricaoEstadual || undefined,
      endereco: dados.endereco || enderecoPrev || '',
      cep: dados.cep || clientePrev.cep || '',
      logradouro: clientePrev.logradouro || dados.endereco || '',
      numero: clientePrev.numero || '',
      bairro: clientePrev.bairro || '',
      cidade: clientePrev.cidade || cidadePartes[0] || '',
      uf: clientePrev.uf || cidadePartes[1] || '',
      funnelStage: 'Negociação',
      mensagens: [],
    };
    // Registra ou atualiza cliente no ERP
    const clienteExistente = state.clientes.find(
      (c: Cliente) =>
        c.telefone === lead.telefone ||
        (lead.email && c.email === lead.email) ||
        (documentoDigitos && soDigitosProposta(c.documento || c.cnpj) === documentoDigitos)
    );
    const idFinal = `CLI-${Date.now()}`;
    if (clienteExistente) {
      if (atualizarCliente) {
        atualizarCliente(clienteExistente.id, {
          ...clientePatch,
          nome: clientePatch.nome || clienteExistente.nome,
          email: clientePatch.email || clienteExistente.email,
          telefone: clientePatch.telefone || clienteExistente.telefone,
        });
      }
      // senao, mantem os dados antigos do cliente — nao bloqueia a geracao da proposta
    } else {
      const novoCliente: Cliente = {
        id: idFinal,
        nome: clientePatch.nome || dados.empresa || 'Cliente',
        email: clientePatch.email || '',
        telefone: clientePatch.telefone || '',
        tipo: clientePatch.tipo || 'PJ',
        documento: clientePatch.documento || '',
        cnpj: clientePatch.cnpj,
        razaoSocial: clientePatch.razaoSocial,
        nomeFantasia: clientePatch.nomeFantasia,
        inscricaoEstadual: clientePatch.inscricaoEstadual,
        endereco: clientePatch.endereco || '',
        cep: clientePatch.cep || '',
        logradouro: clientePatch.logradouro || '',
        numero: clientePatch.numero || '',
        bairro: clientePatch.bairro || '',
        cidade: clientePatch.cidade || '',
        uf: clientePatch.uf || '',
        funnelStage: 'Negociação',
        mensagens: clientePatch.mensagens || [],
      };
      adicionarCliente(novoCliente);
    }
    // Salva proposta no ERP
    const total = itens.reduce((s, it) => s + (it.qtd * it.valorUnitario), 0);
    const proposta: Proposta = {
      id: `PROP-${Date.now()}`,
      clienteId: clienteExistente?.id || idFinal,
      clienteNome: clientePatch.nome || dados.empresa || 'Cliente',
      items: itens.map((it, i) => ({
        id: `it-${i}`,
        name: it.nome || 'Item',
        descricao: it.descricao || '',
        quantidade: it.qtd,
        price: it.valorUnitario,
      })),
      total,
      formaPagamento: 'outros',
      descontoPix: 0,
      totalComDesconto: total,
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
          nome_cliente: clientePatch.nome || dados.empresa || 'Cliente',
          empresa: dados.empresa || lead.empresa || '',
          itens: itens.map((it, i) => ({
            nome: it.nome || 'Item',
            descricao: it.descricao || '',
            qtd: it.qtd,
            valorUnitario: it.valorUnitario,
          })),
          valor_total: total,
          status: 'enviada',
          observacoes: [
            (dados as any).observacoes,
            documento ? `Documento: ${documento}` : '',
            dados.endereco ? `Endereco: ${dados.endereco}` : '',
            dados.cep ? `CEP: ${dados.cep}` : '',
          ].filter(Boolean).join('\n'),
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
          {([['empresa','Empresa'],['ac','A/C (contato)'],['cnpj','CNPJ/CPF'],['telefone','Telefone'],['email','E-mail'],['endereco','Endereco'],['cidade','Cidade/UF'],['cep','CEP'],['local','Local de entrega'],['contato','Contato'],['vendedor','Vendedor'],['validade','Validade'],['frete','Frete'],['prazoEntrega','Prazo de Entrega'],['pagamento','Pagamento']] as [string,string][]).map(([k, label]) => (
            <div key={k} className={['pagamento', 'intro', 'endereco', 'local'].includes(k) ? 'col-span-2' : ''}>
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
              <ProdutoPropostaInput
                item={it}
                onNomeChange={valor => setItem(i, 'nome', valor)}
                onSelect={produto => setItens(prev => prev.map((atual, idx) => idx === i ? itemComProdutoCadastro(produto, atual) : atual))}
              />
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
type ProdutoCadastroSugerido = {
  nome: string;
  descricao: string;
  categoria: string;
};

function titleCaseProduto(valor: string) {
  return String(valor || '')
    .toLowerCase()
    .replace(/\b([a-z0-9])([a-z0-9]+)/gi, (_, a, b) => `${a.toUpperCase()}${b}`)
    .replace(/\b(Pvc|Aco|Inox|Mdf)\b/g, (m) => m.toUpperCase())
    .replace(/\bPara\b/g, 'para')
    .trim();
}

function extrairMedidaCadastro(texto: string) {
  const match = String(texto || '').match(/\b\d+([.,]\d+)?\s*(x|por)\s*\d+([.,]\d+)?(\s*(x|por)\s*\d+([.,]\d+)?)?\s*(mm|cm|m)?\b/i);
  return match?.[0]
    ?.replace(/\s*(x|por)\s*/gi, 'x')
    ?.replace(/\s+/g, '')
    ?.replace(/cm|mm|m/gi, '')
    || '';
}

function extrairUsoCadastro(texto: string) {
  const norm = String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/\bgranito\b/.test(norm)) return 'Mesa de Granito';
  if (/\bmarmore\b/.test(norm)) return 'Mesa de Marmore';
  if (/\bmadeira\b/.test(norm)) return 'Mesa de Madeira';
  if (/\bmdf\b/.test(norm)) return 'Mesa de MDF';
  if (/\baco\b/.test(norm)) return 'Mesa de Aco';
  if (/\bmesa\b/.test(norm)) return 'Mesa';
  return '';
}

function montarNomeCadastro(produto: string, medida: string, uso: string) {
  return [produto, medida, uso ? `para ${uso}` : '']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sugerirCadastroGenerico(produto: any): ProdutoCadastroSugerido {
  const textoOriginal = `${produto?.nome || ''} ${produto?.descricao || ''}`;
  const texto = textoOriginal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const medida = extrairMedidaCadastro(textoOriginal);
  const uso = extrairUsoCadastro(textoOriginal);

  if (/\b(carrinho|plataforma|rodizio|rodizios)\b/.test(texto)) {
    return {
      nome: 'Carrinho Plataforma Sob Medida',
      descricao: 'Carrinho plataforma metalico sob medida, configuravel por carga, dimensoes, tipo de rodizio, piso de uso, acabamento e quantidade.',
      categoria: 'sob-medida',
    };
  }

  if (/\b(tampa|tampao|bandeja|alcapao)\b/.test(texto)) {
    return {
      nome: 'Tampa Metalica Sob Medida',
      descricao: 'Tampa metalica fabricada sob medida, configuravel por dimensoes, espessura, carga, fixacao, acabamento e ambiente de uso.',
      categoria: 'caldeiraria',
    };
  }

  if (/\b(pe|pes|base|mesa|bancada|suporte)\b/.test(texto)) {
    return {
      nome: montarNomeCadastro('Pes de Mesa', medida, uso),
      descricao: 'Pes de mesa sob medida, configuraveis por dimensoes, material, perfil/espessura, carga do tampo, acabamento e quantidade.',
      categoria: 'estrutura-metalica',
    };
  }

  if (/\b(chapa|corte|dobra|dobrada|aba|abas)\b/.test(texto)) {
    return {
      nome: 'Chapa Dobrada Sob Medida',
      descricao: 'Chapa metalica cortada e dobrada sob medida, configuravel por material, espessura, dimensoes, dobras, acabamento e quantidade.',
      categoria: 'caldeiraria',
    };
  }

  const nomeBase = titleCaseProduto(String(produto?.nome || 'Produto Sob Medida')
    .replace(/\b\d+([.,]\d+)?\s*(x|por)\s*\d+([.,]\d+)?(\s*(x|por)\s*\d+([.,]\d+)?)?\s*(mm|cm|m)?\b/gi, '')
    .replace(/\bcep\b.*$/gi, '')
    .replace(/\bcliente\b.*$/gi, '')
    .replace(/\s+/g, ' ')
  ) || 'Produto Sob Medida';

  return {
    nome: nomeBase,
    descricao: 'Produto metalico sob medida, configuravel por dimensoes, material, carga, acabamento e quantidade conforme necessidade do projeto.',
    categoria: 'sob-medida',
  };
}

function CadastrarProdutoModal({ produto, onClose, onSalvo }: {
  produto: any;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const cadastro = sugerirCadastroGenerico(produto);
  const [form, setForm] = useState({
    nome: cadastro.nome,
    sku: (produto.skuCatalogo || cadastro.nome || '').toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 20),
    descricao: cadastro.descricao,
    preco: String(produto.precoUnitario || 0),
    unidade: produto.unidade || 'UN',
    ncm: '',
    categoria: cadastro.categoria,
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
      const res = await fetch('/api/produtos?crud=1', {
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
  const { state } = useERP();
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
  const [painelExpandido, setPainelExpandido] = useState(false);

  // Rastreia quais leads foram lidos — persiste em localStorage (cache) + Supabase (permanente)
  const [lidos, setLidos] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_leads_lidos') || '{}');
    } catch { return {}; }
  });

  // Carrega estado de lidos do servidor ao montar (sincroniza entre dispositivos)
  useEffect(() => {
    fetch('/api/leads?recurso=leitura')
      .then(r => r.json())
      .then(data => {
        if (data.lidos && typeof data.lidos === 'object') {
          setLidos(prev => {
            const merged = { ...prev, ...data.lidos };
            localStorage.setItem('crm_leads_lidos', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(() => {}); // falha silenciosa — fallback para localStorage
  }, []);

  const marcarComoLido = useCallback((lead: Lead) => {
    const hora = lead.ultimaHora || lead.criadoEm || new Date().toISOString();
    setLidos(prev => {
      const next = { ...prev, [lead.id]: hora };
      localStorage.setItem('crm_leads_lidos', JSON.stringify(next));
      return next;
    });
    // Persiste no Supabase — memória permanente entre dispositivos/sessões
    fetch('/api/leads?recurso=leitura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, ultima_hora: hora }),
    }).catch(() => {}); // falha silenciosa — estado local já foi atualizado
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
    // Registra resultado positivo — Bruno aprende que a abordagem funcionou
    fetch('/api/assistente-vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'aprendizado-resultado', lead_id: leadAtivo.id, resultado: 'etapa_avancou' }),
    }).catch(() => {});
  };
  const abrirLeadPorId = useCallback((leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    setLeadAtivo(lead);
    marcarComoLido(lead);
  }, [leads, marcarComoLido]);

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
  const clienteAtivoRelacionado = leadAtivo
    ? state.clientes.find((c: Cliente) => (leadAtivo.telefone && c.telefone === leadAtivo.telefone) || (leadAtivo.clienteId && c.id === leadAtivo.clienteId))
    : null;
  const cnpjAtivo =
    String(clienteAtivoRelacionado?.documento || (leadAtivo as any)?.cnpj || (leadAtivo as any)?.documento || '').replace(/\D/g, '').length === 14
      ? String(clienteAtivoRelacionado?.documento || (leadAtivo as any)?.cnpj || (leadAtivo as any)?.documento || '')
      : '';

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

      <CheckupBrunoGeral onAbrirLead={abrirLeadPorId} />

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
            <ConversaPanel 
              lead={leadAtivo} 
              onEtapaChange={handleMudarEtapa} 
              textoInjetado={textoInjetado} 
              onMsgsChange={setMsgsAtivas} 
              onUpdateLead={handleUpdateLead}
            />
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
          <div className={`${painelExpandido ? 'w-[500px]' : 'w-72'} flex-shrink-0 border-l bg-white flex flex-col overflow-hidden transition-all duration-300`}>
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
              <button
                onClick={() => setPainelExpandido(p => !p)}
                title={painelExpandido ? 'Recolher painel' : 'Expandir painel'}
                className="px-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border-l"
              >
                {painelExpandido ? '▶' : '◀'}
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
                  leadCnpj={cnpjAtivo}
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
