import React, { useState } from 'react';
import {
  MessageCircle, Loader2, CheckCircle2, AlertCircle, Sparkles,
  User, Building2, Phone, Mail, MapPin, FileText, X,
  Zap, Search
} from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { Cliente } from '../types';
import {
  extrairDadosWhatsApp,
  ExtractionResult,
  ExtractedClientData
} from '../utils/whatsappExtractor';

interface WhatsAppAnalyzerModalProps {
  clienteExistente?: Cliente;
  onClose: () => void;
  onClienteSalvo?: (clienteId: string) => void;
}

type Etapa = 'colar' | 'revisao' | 'salvo';

const TAG_CONFIANCA: Record<string, { label: string; cor: string }> = {
  alto:  { label: 'Confirmado', cor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  medio: { label: 'Extraído',   cor: 'text-amber-600  bg-amber-50  border-amber-200'  },
  baixo: { label: 'Incerto',    cor: 'text-red-600    bg-red-50    border-red-200'    },
};

export const WhatsAppAnalyzerModal: React.FC<WhatsAppAnalyzerModalProps> = ({
  clienteExistente,
  onClose,
  onClienteSalvo,
}) => {
  const { adicionarCliente, adicionarProposta } = useERP();
  const [etapa, setEtapa] = useState<Etapa>('colar');
  const [conversa, setConversa] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ExtractionResult | null>(null);
  const [camposEditados, setCamposEditados] = useState<Partial<ExtractedClientData>>({});
  const [usouIA, setUsouIA] = useState(false);
  const [criarProposta, setCriarProposta] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const analisarConversa = async () => {
    if (!conversa.trim()) return;
    setLoading(true); setErro(null); setUsouIA(false);
    try {
      const res = await extrairDadosWhatsApp(conversa);
      setResultado(res); setCamposEditados({}); setEtapa('revisao');
    } catch { setErro('Erro ao analisar conversa. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const completarComIA = async () => {
    if (!resultado) return;
    setLoading(true);
    try {
      const camposFaltando = resultado.camposFaltando;
      if (camposFaltando.length === 0) { setLoading(false); return; }
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY });
      const prompt = `Analise esta conversa do WhatsApp e extraia APENAS: ${camposFaltando.join(', ')}.\nConversa:\n${conversa.substring(0, 2000)}\nRetorne JSON com somente os campos pedidos.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });
      const extra = JSON.parse(response.text || '{}');
      setCamposEditados(prev => ({ ...prev, ...extra }));
      setUsouIA(true);
    } catch { setErro('Não foi possível completar com IA. Preencha manualmente.'); }
    finally { setLoading(false); }
  };

  const dadosFinais = resultado ? { ...resultado.cliente, ...camposEditados } : {} as Partial<ExtractedClientData>;
  const atualizar = (campo: keyof ExtractedClientData, valor: string) =>
    setCamposEditados(prev => ({ ...prev, [campo]: valor }));

  const salvar = () => {
    if (!dadosFinais.nome) { setErro('Nome é obrigatório.'); return; }
    let clienteId = clienteExistente?.id;
    if (!clienteExistente) {
      const novoCliente: Cliente = {
        id: Date.now().toString(),
        nome: dadosFinais.nome || '',
        email: dadosFinais.email || '',
        telefone: dadosFinais.telefone || '',
        tipo: dadosFinais.tipo || 'PF',
        documento: dadosFinais.documento || '',
        cep: dadosFinais.cep || '',
        logradouro: dadosFinais.logradouro || '',
        numero: dadosFinais.numero || '',
        bairro: dadosFinais.bairro || '',
        cidade: dadosFinais.cidade || '',
        uf: dadosFinais.uf || '',
        endereco: dadosFinais.endereco ||
          [dadosFinais.logradouro, dadosFinais.numero, dadosFinais.bairro,
           dadosFinais.cidade, dadosFinais.uf].filter(Boolean).join(', '),
        razaoSocial: dadosFinais.razaoSocial,
        funnelStage: 'Prospecção',
        dores: [], mensagens: [],
      };
      adicionarCliente(novoCliente);
      clienteId = novoCliente.id;
    }
    if (criarProposta && resultado?.proposta && clienteId) {
      const p = resultado.proposta;
      const descItem = [
        p.tipoProduto,
        p.dimensoes?.area ? `${p.dimensoes.area}m²` : '',
        p.dimensoes?.largura && p.dimensoes?.comprimento ? `${p.dimensoes.largura}x${p.dimensoes.comprimento}m` : '',
        p.dimensoes?.altura ? `Altura ${p.dimensoes.altura}m` : '',
      ].filter(Boolean).join(' - ') || 'Produto a definir';
      adicionarProposta({
        id: Date.now().toString(), clienteId,
        clienteNome: dadosFinais.nome,
        items: [{ id: '1', name: descItem, quantity: p.quantidade || 1, price: 0, total: 0, projectState: null }],
        total: 0, status: 'Rascunho', data: new Date().toISOString(),
      });
    }
    onClienteSalvo?.(clienteId!);
    setEtapa('salvo');
  };

  const Campo = ({ label, campo, icone, tipo = 'text', placeholder }: {
    label: string; campo: keyof ExtractedClientData;
    icone?: React.ReactNode; tipo?: string; placeholder?: string;
  }) => {
    const valor = (dadosFinais[campo] as string) || '';
    const confianca = resultado?.cliente.confianca[campo];
    const tag = confianca ? TAG_CONFIANCA[confianca] : null;
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">{icone}{label}</label>
          {tag && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tag.cor}`}>{tag.label}</span>}
        </div>
        <input type={tipo} value={valor} placeholder={placeholder || label}
          onChange={e => atualizar(campo, e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Analisar Conversa WhatsApp</h2>
              <p className="text-xs text-slate-500">Bot inteligente · extração automática de dados</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {etapa === 'colar' && (
          <div className="p-6 space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              <p className="font-semibold mb-1 flex items-center gap-2"><Zap size={14} /> Como funciona?</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-emerald-700">
                <li><strong>Cole a conversa</strong> do WhatsApp abaixo</li>
                <li>O <strong>bot extrai automaticamente</strong> nome, CNPJ, endereço, dimensões etc.</li>
                <li>Dados do CNPJ enriquecidos via <strong>BrasilAPI (gratuito)</strong></li>
                <li>Você <strong>revisa e salva</strong> — cadastro e rascunho de proposta criados</li>
              </ol>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Cole a conversa do WhatsApp aqui:</label>
              <textarea value={conversa} onChange={e => setConversa(e.target.value)}
                placeholder={`Exemplo:\nJoão: Preciso de orçamento para galpão 20x30m.\nEu: Qual seu CNPJ?\nJoão: 12.345.678/0001-90 — Silva Ltda. CEP 01310-100.`}
                rows={10} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition resize-none" />
              <p className="text-xs text-slate-400 mt-1">{conversa.length} caracteres</p>
            </div>
            {erro && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"><AlertCircle size={16} />{erro}</div>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all text-sm">Cancelar</button>
              <button onClick={analisarConversa} disabled={loading || conversa.trim().length < 20}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 text-sm">
                {loading ? <><Loader2 size={16} className="animate-spin" />Analisando...</> : <><Search size={16} />Analisar Conversa</>}
              </button>
            </div>
          </div>
        )}

        {etapa === 'revisao' && resultado && (
          <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            <div className={`rounded-xl p-4 border text-sm ${resultado.camposFaltando.length === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <p className="font-semibold mb-1">{resultado.camposFaltando.length === 0 ? '✅ Todos os campos extraídos!' : `⚠️ ${resultado.camposFaltando.length} campo(s) não encontrado(s)`}</p>
              {resultado.camposFaltando.length > 0 && (
                <p className="text-xs">Faltando: {resultado.camposFaltando.join(', ')}.
                  <button onClick={completarComIA} disabled={loading} className="ml-2 underline font-semibold">
                    {loading ? 'Buscando...' : <><Sparkles size={10} className="inline" /> IA (free)</>}
                  </button>
                </p>
              )}
              {usouIA && <p className="text-xs mt-1">🤖 IA utilizada para campos faltando.</p>}
            </div>
            {resultado.proposta?.tipoProduto && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                <p className="font-semibold">🏗️ Produto: {resultado.proposta.tipoProduto}</p>
                {resultado.proposta.dimensoes?.largura && <p className="text-xs">Dimensões: {resultado.proposta.dimensoes.largura}x{resultado.proposta.dimensoes.comprimento}m{resultado.proposta.dimensoes.altura ? ` · Alt: ${resultado.proposta.dimensoes.altura}m` : ''}</p>}
                {resultado.proposta.prazoMencionado && <p className="text-xs">Prazo: {resultado.proposta.prazoMencionado}</p>}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><User size={14} />Dados do Cliente</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Campo label="Nome / Fantasia" campo="nome" icone={<User size={10} />} /></div>
                {(dadosFinais.tipo === 'PJ' || dadosFinais.razaoSocial) && <div className="col-span-2"><Campo label="Razão Social" campo="razaoSocial" icone={<Building2 size={10} />} /></div>}
                <Campo label="Telefone" campo="telefone" icone={<Phone size={10} />} placeholder="(00) 00000-0000" />
                <Campo label="E-mail" campo="email" tipo="email" icone={<Mail size={10} />} />
                <Campo label="CNPJ / CPF" campo="documento" icone={<FileText size={10} />} />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tipo</label>
                  <select value={dadosFinais.tipo || 'PF'} onChange={e => atualizar('tipo', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none">
                    <option value="PF">Pessoa Física</option>
                    <option value="PJ">Pessoa Jurídica</option>
                    <option value="GOV">Governo</option>
                  </select>
                </div>
                <Campo label="CEP" campo="cep" icone={<MapPin size={10} />} />
                <Campo label="Cidade" campo="cidade" />
                <div className="col-span-2"><Campo label="Logradouro" campo="logradouro" icone={<MapPin size={10} />} /></div>
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
              <input type="checkbox" checked={criarProposta} onChange={e => setCriarProposta(e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Criar rascunho de proposta automaticamente</p>
                <p className="text-xs text-slate-500">Produto e dimensões pré-preenchidos</p>
              </div>
            </label>
            {erro && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"><AlertCircle size={16} />{erro}</div>}
            <div className="flex justify-between gap-3">
              <button onClick={() => setEtapa('colar')} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all text-sm">← Reanalisar</button>
              <button onClick={salvar} className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 text-sm">
                <CheckCircle2 size={16} />{clienteExistente ? 'Atualizar' : 'Salvar'}{criarProposta && ' + Proposta'}
              </button>
            </div>
          </div>
        )}

        {etapa === 'salvo' && (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Cadastro Concluído!</h3>
            <p className="text-slate-500 text-sm max-w-sm">Cliente cadastrado com sucesso.{criarProposta && ' Rascunho de proposta criado.'}</p>
            <button onClick={onClose} className="mt-4 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
};
