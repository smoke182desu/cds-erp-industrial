import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lead, EtapaFunil, LeadOrigem,
  ETAPAS_FUNIL, ORIGEM_LABELS,
  subscribeLeads, adicionarLead, atualizarLead, moverEtapa,
} from '../services/leadsService';
import {
  Mensagem, buscarMensagens, enviarMensagem, formatarConversaParaCopiar,
} from '../services/conversasService';
import {
  PropostaDados, ItemProposta,
  proximoNumeroProposta, abrirProposta,
} from '../services/propostaService';

// ---------- cores por etapa ----------
const ETAPA_COR: Record<EtapaFunil, string> = {
  lead_novo: 'border-indigo-400', contato_feito: 'border-sky-400',
  qualificado: 'border-amber-400', proposta_enviada: 'border-violet-400',
  negociacao: 'border-pink-400', fechado_ganho: 'border-emerald-400', fechado_perdido: 'border-red-400',
};
const ETAPA_BG: Record<EtapaFunil, string> = {
  lead_novo: 'bg-indigo-50', contato_feito: 'bg-sky-50', qualificado: 'bg-amber-50',
  proposta_enviada: 'bg-violet-50', negociacao: 'bg-pink-50',
  fechado_ganho: 'bg-emerald-50', fechado_perdido: 'bg-red-50',
};
const ETAPA_HDR: Record<EtapaFunil, string> = {
  lead_novo: 'bg-indigo-500', contato_feito: 'bg-sky-500', qualificado: 'bg-amber-500',
  proposta_enviada: 'bg-violet-500', negociacao: 'bg-pink-500',
  fechado_ganho: 'bg-emerald-500', fechado_perdido: 'bg-red-500',
};
const ORIGEM_ICONS: Record<string, string> = {
  site: '🌐', whatsapp: '💬', woocommerce: '🛒', calculadora: '📐', manual: '✏️',
};

function fmt(v?: number) {
  if (!v) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function timeAgo(iso?: string) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora'; if (m < 60) return m + 'min';
  const h = Math.floor(m / 60);
  return h < 24 ? h + 'h' : Math.floor(h / 24) + 'd';
}

// ============================================================
// Lead Card
// ============================================================
function LeadCard({ lead, onClick, onDragStart }: {
  lead: Lead; onClick: () => void; onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div draggable onDragStart={onDragStart} onClick={onClick}
      className={'cursor-pointer rounded-lg border-l-4 bg-white shadow-sm hover:shadow-md transition-shadow p-3 ' + ETAPA_COR[lead.etapa]}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-800 text-sm leading-tight truncate flex-1">{lead.nome || '—'}</p>
        <span className="text-xs text-gray-400 shrink-0">{timeAgo(lead.criadoEm)}</span>
      </div>
      {lead.empresa && <p className="text-xs text-gray-500 truncate mt-0.5">{lead.empresa}</p>}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {lead.telefone && (
          <a href={'https://wa.me/' + lead.telefone.replace(/\D/g,'')}
            target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5 hover:bg-green-200">
            📱 {lead.telefone}
          </a>
        )}
        <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
          {ORIGEM_ICONS[lead.origem] || '•'} {ORIGEM_LABELS[lead.origem as LeadOrigem] || lead.origem}
        </span>
        {lead.valor ? <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">{fmt(lead.valor)}</span> : null}
      </div>
    </div>
  );
}

// ============================================================
// Kanban Column
// ============================================================
function KanbanColuna({ etapa, leads, onCardClick, onDrop }: {
  etapa: typeof ETAPAS_FUNIL[0]; leads: Lead[];
  onCardClick: (l: Lead) => void; onDrop: (e: EtapaFunil) => void;
}) {
  const [over, setOver] = useState(false);
  const total = leads.reduce((s, l) => s + (l.valor || 0), 0);
  return (
    <div className={'flex flex-col rounded-xl min-h-[400px] w-64 shrink-0 ' + ETAPA_BG[etapa.id] + ' border ' + (over ? 'border-dashed border-2 border-gray-400' : 'border-transparent')}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(etapa.id); }}>
      <div className={'rounded-t-xl px-3 py-2 ' + ETAPA_HDR[etapa.id] + ' text-white'}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{etapa.label}</span>
          <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">{leads.length}</span>
        </div>
        {total > 0 && <p className="text-xs text-white/80 mt-0.5">{fmt(total)}</p>}
      </div>
      <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)]">
        {leads.map(l => (
          <LeadCard key={l.id} lead={l} onClick={() => onCardClick(l)}
            onDragStart={e => e.dataTransfer.setData('leadId', l.id)} />
        ))}
        {leads.length === 0 && <div className="flex-1 flex items-center justify-center text-gray-400 text-xs italic pt-8">Nenhum lead</div>}
      </div>
    </div>
  );
}

// ============================================================
// Painel de Conversa
// ============================================================
function ConversaPanel({ lead, onCriarProposta }: { lead: Lead; onCriarProposta: () => void }) {
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    if (!lead.telefone) return;
    setLoading(true);
    try { setMsgs(await buscarMensagens(lead.telefone)); } finally { setLoading(false); }
  }, [lead.telefone]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const enviar = async () => {
    if (!texto.trim() || !lead.telefone) return;
    setEnviando(true);
    try {
      await enviarMensagem(lead.telefone, texto.trim(), lead.id);
      setTexto('');
      await carregar();
    } finally { setEnviando(false); }
  };

  const copiar = () => {
    const txt = formatarConversaParaCopiar(msgs, lead.nome);
    navigator.clipboard.writeText(txt).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* action buttons */}
      <div className="flex gap-2 px-5 pt-4 pb-2">
        <button onClick={copiar}
          className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 flex items-center justify-center gap-1">
          {copiado ? '✅ Copiado!' : '📋 Copiar Conversa'}
        </button>
        <button onClick={carregar}
          className="text-xs border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50">
          🔄
        </button>
        <button onClick={onCriarProposta}
          className="flex-1 text-xs bg-indigo-600 text-white rounded-lg px-3 py-2 hover:bg-indigo-700 flex items-center justify-center gap-1 font-semibold">
          📄 Criar Proposta
        </button>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-5 py-2 flex flex-col gap-2 min-h-0" style={{maxHeight:'320px'}}>
        {loading && <div className="text-center text-xs text-gray-400 py-4">Carregando...</div>}
        {!loading && msgs.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-8">
            {lead.telefone ? 'Nenhuma mensagem registrada ainda.' : 'Lead sem telefone — conversa indisponível.'}
          </div>
        )}
        {msgs.map(m => (
          <div key={m.id} className={'flex ' + (m.tipo === 'saida' ? 'justify-end' : 'justify-start')}>
            <div className={'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ' +
              (m.tipo === 'saida' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm')}>
              <p className="whitespace-pre-wrap break-words">{m.texto}</p>
              <p className={'text-xs mt-1 ' + (m.tipo === 'saida' ? 'text-indigo-200' : 'text-gray-400')}>
                {m.criadoEm ? new Date(m.criadoEm).toLocaleString('pt-BR', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}) : ''}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* send input */}
      <div className="px-5 pb-4 pt-2 border-t">
        {!lead.telefone ? (
          <p className="text-xs text-red-400 text-center">Adicione um telefone ao lead para enviar mensagens.</p>
        ) : (
          <div className="flex gap-2">
            <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Digite a mensagem... (Enter para enviar)"
              className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={enviar} disabled={enviando || !texto.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl px-4 font-bold text-lg">
              {enviando ? '⏳' : '➤'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Modal Criar Proposta
// ============================================================
function PropostaModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [dados, setDados] = useState<Omit<PropostaDados,'itens'>>({
    empresa: lead.empresa || lead.nome || '',
    telefone: lead.telefone || '',
    email: lead.email || '',
    cidade: '',
    vendedor: 'Jean',
    frete: 'À combinar',
    validade: '7 dias corridos',
    pagamento: 'A definir em comum acordo.',
    prazoEntrega: 'A confirmar após aceite formal da proposta.',
    intro: '',
  });
  const [itens, setItens] = useState<ItemProposta[]>([{ nome: '', descricao: '', qtd: 1, valorUnitario: 0 }]);
  const [gerando, setGerando] = useState(false);

  const setD = (k: string, v: string) => setDados(p => ({ ...p, [k]: v }));
  const setItem = (i: number, k: keyof ItemProposta, v: string | number) =>
    setItens(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItens(p => [...p, { nome: '', descricao: '', qtd: 1, valorUnitario: 0 }]);
  const rmItem = (i: number) => setItens(p => p.filter((_, idx) => idx !== i));

  const subtotal = itens.reduce((s, it) => s + it.qtd * it.valorUnitario, 0);

  const gerar = async () => {
    if (!dados.empresa || itens.some(it => !it.nome)) {
      alert('Preencha empresa e nome de todos os itens.');
      return;
    }
    setGerando(true);
    try {
      const num = await proximoNumeroProposta();
      abrirProposta({ ...dados, itens, numero: num });
    } finally { setGerando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>
        <div className="bg-indigo-700 rounded-t-2xl px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h2 className="font-bold text-lg">📄 Criar Proposta Comercial</h2>
            <p className="text-xs text-indigo-200">Numeração automática · 2 páginas A4 · Pronto para imprimir</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Cliente */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Cliente</p>
            <div className="grid grid-cols-2 gap-3">
              {([['empresa','Empresa *','text'],['cnpj','CNPJ/CPF','text'],['email','E-mail','email'],
                ['telefone','Telefone','tel'],['endereco','Endereço','text'],['cidade','Cidade/UF','text'],
                ['cep','CEP','text'],['ac','A/C (atenção)','text']] as [string,string,string][]).map(([k,label,type]) => (
                <div key={k} className={k==='empresa'||k==='endereco'?'col-span-2':''}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input type={type} value={(dados as any)[k]||''} onChange={e => setD(k,e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              ))}
            </div>
          </div>

          {/* Projeto */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Projeto</p>
            <div className="grid grid-cols-3 gap-3">
              {([['vendedor','Vendedor'],['validade','Validade'],['frete','Frete'],
                ['contato','Contato'],['local','Local / Obra'],['pagamento','Pagamento']] as [string,string][]).map(([k,label]) => (
                <div key={k} className={k==='local'||k==='pagamento'?'col-span-2':''}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input type="text" value={(dados as any)[k]||''} onChange={e => setD(k,e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-xs text-gray-500 block mb-1">Texto de introdução (opcional)</label>
              <textarea rows={2} value={dados.intro||''} onChange={e => setD('intro',e.target.value)}
                placeholder="Prezado(a), Em atendimento ao contato... (deixe em branco para usar o padrão)"
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Itens</p>
              <button onClick={addItem} className="text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-1 hover:bg-indigo-200">+ Adicionar item</button>
            </div>
            <div className="space-y-3">
              {itens.map((it, i) => (
                <div key={i} className="border rounded-xl p-3 bg-gray-50">
                  <div className="grid grid-cols-12 gap-2 mb-2">
                    <div className="col-span-5">
                      <label className="text-xs text-gray-400">Nome do item *</label>
                      <input value={it.nome} onChange={e => setItem(i,'nome',e.target.value)}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400">Qtd</label>
                      <input type="number" min="1" value={it.qtd} onChange={e => setItem(i,'qtd',parseInt(e.target.value)||1)}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-400">Valor Unit. (R$)</label>
                      <input type="number" min="0" step="0.01" value={it.valorUnitario||''}
                        onChange={e => setItem(i,'valorUnitario',parseFloat(e.target.value)||0)}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </div>
                    <div className="col-span-1 flex items-end">
                      {itens.length > 1 &&
                        <button onClick={() => rmItem(i)} className="text-red-400 hover:text-red-600 text-lg font-bold w-full">×</button>}
                    </div>
                  </div>
                  <textarea rows={2} value={it.descricao||''} onChange={e => setItem(i,'descricao',e.target.value)}
                    placeholder="Descrição técnica do item..."
                    className="w-full border rounded-lg px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <p className="text-right text-xs text-gray-500 mt-1">Subtotal: {fmt(it.qtd * it.valorUnitario)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2 gap-4 text-sm font-bold text-indigo-700">
              <span>TOTAL: {fmt(subtotal)}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 text-sm">Cancelar</button>
          <button onClick={gerar} disabled={gerando}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
            {gerando ? '⏳ Gerando...' : '📄 Gerar Proposta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal Lead (detalhes + conversa)
// ============================================================
function LeadModal({ lead, onClose, onSave }: {
  lead: Lead; onClose: () => void; onSave: (data: Partial<Lead>) => void;
}) {
  const [tab, setTab] = useState<'dados'|'conversa'>('dados');
  const [form, setForm] = useState<Partial<Lead>>({ ...lead });
  const [showProposta, setShowProposta] = useState(false);
  const set = (k: keyof Lead, v: string|number) => setForm(p => ({ ...p, [k]: v }));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{maxHeight:'90vh'}} onClick={e => e.stopPropagation()}>
          {/* header */}
          <div className={'rounded-t-2xl px-5 py-4 text-white flex items-center justify-between ' + (ETAPA_HDR[form.etapa as EtapaFunil || 'lead_novo'])}>
            <div>
              <h2 className="font-bold text-lg">{form.nome || 'Lead'}</h2>
              {form.empresa && <p className="text-xs text-white/80">{form.empresa}</p>}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">&times;</button>
          </div>

          {/* tabs */}
          <div className="flex border-b">
            {(['dados','conversa'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={'flex-1 py-2.5 text-sm font-medium transition-colors ' +
                  (tab === t ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700')}>
                {t === 'dados' ? '📋 Dados' : '💬 Conversa'}
              </button>
            ))}
          </div>

          {/* content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tab === 'dados' ? (
              <div className="p-5 grid grid-cols-2 gap-3">
                {([['nome','Nome','text'],['empresa','Empresa','text'],['email','E-mail','email'],
                  ['telefone','Telefone','tel']] as [keyof Lead,string,string][]).map(([k,label,type]) => (
                  <div key={k as string} className={k==='nome'?'col-span-2':''}>
                    <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                    <input type={type} value={String(form[k]||'')} onChange={e => set(k,e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Etapa</label>
                  <select value={form.etapa||'lead_novo'} onChange={e => set('etapa',e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {ETAPAS_FUNIL.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Valor (R$)</label>
                  <input type="number" value={form.valor||''} onChange={e => set('valor',parseFloat(e.target.value)||0)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Observações</label>
                  <textarea rows={3} value={form.observacoes||''} onChange={e => set('observacoes',e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                </div>
                {lead.pedidoId && <div className="col-span-2 text-xs text-gray-400">Pedido WC: #{lead.pedidoId}</div>}
              </div>
            ) : (
              <ConversaPanel lead={lead} onCriarProposta={() => setShowProposta(true)} />
            )}
          </div>

          {/* footer buttons (only on dados tab) */}
          {tab === 'dados' && (
            <div className="px-5 py-4 border-t flex gap-3 justify-end">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
              <button onClick={() => onSave(form)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold">Salvar</button>
            </div>
          )}
        </div>
      </div>
      {showProposta && <PropostaModal lead={lead} onClose={() => setShowProposta(false)} />}
    </>
  );
}

// ============================================================
// Modal Novo Lead
// ============================================================
function NovoLeadModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Omit<Lead,'id'|'criadoEm'>) => void }) {
  const [form, setForm] = useState({ nome:'',email:'',telefone:'',empresa:'',mensagem:'',
    valor:'', origem:'manual' as LeadOrigem, etapa:'lead_novo' as EtapaFunil });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-indigo-600 rounded-t-2xl px-5 py-4 text-white flex items-center justify-between">
          <h2 className="font-bold text-lg">+ Novo Lead</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {([['nome','Nome *','text'],['empresa','Empresa','text'],['email','E-mail','email'],['telefone','Telefone','tel']] as [string,string,string][]).map(([k,label,type]) => (
            <div key={k} className={k==='nome'?'col-span-2':''}>
              <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
              <input type={type} value={(form as any)[k]} onChange={e => set(k,e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Etapa</label>
            <select value={form.etapa} onChange={e => set('etapa',e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {ETAPAS_FUNIL.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Valor (R$)</label>
            <input type="number" value={form.valor} onChange={e => set('valor',e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">Mensagem</label>
            <textarea rows={2} value={form.mensagem} onChange={e => set('mensagem',e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
          <button onClick={() => { if (!form.nome.trim()) return; onSave({...form,valor:parseFloat(form.valor)||undefined,observacoes:form.mensagem}); }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold">Criar Lead</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('todos');
  const [leadSel, setLeadSel] = useState<Lead|null>(null);
  const [showNovo, setShowNovo] = useState(false);
  const dragId = useRef<string|null>(null);

  useEffect(() => {
    return subscribeLeads(data => { setLeads(data); setLoading(false); });
  }, []);

  const filtrados = leads.filter(l => {
    const ok = !busca || [l.nome,l.email,l.telefone,l.empresa].some(v => v?.toLowerCase().includes(busca.toLowerCase()));
    const orig = filtroOrigem === 'todos' || l.origem === filtroOrigem;
    return ok && orig;
  });

  const deEtapa = (e: EtapaFunil) => filtrados.filter(l => l.etapa === e);

  const handleDrop = async (etapa: EtapaFunil) => {
    if (!dragId.current) return;
    await moverEtapa(dragId.current, etapa);
    dragId.current = null;
  };
  const handleSalvar = async (data: Partial<Lead>) => {
    if (!leadSel) return;
    await atualizarLead(leadSel.id, data);
    setLeadSel(null);
  };
  const handleNovo = async (data: Omit<Lead,'id'|'criadoEm'>) => {
    await adicionarLead(data); setShowNovo(false);
  };

  const totalVal = leads.filter(l => l.etapa !== 'fechado_perdido').reduce((s,l) => s+(l.valor||0), 0);
  const ganhos  = leads.filter(l => l.etapa === 'fechado_ganho').length;
  const taxa    = leads.length ? Math.round((ganhos/leads.length)*100) : 0;

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* topo */}
      <div className="bg-white border-b px-6 py-4 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Funil de Vendas</h1>
          <p className="text-xs text-gray-500">CRM • Leads em tempo real · clique para detalhes e conversa</p>
        </div>
        <div className="flex gap-3 ml-4 flex-wrap">
          {[['Total',leads.length,'text-indigo-600'],['Pipeline',fmt(totalVal)||'R$ 0','text-violet-600'],
            ['Fechados',ganhos,'text-emerald-600'],['Conversão',taxa+'%','text-amber-600']].map(([l,v,c]) => (
            <div key={l as string} className="bg-gray-50 rounded-lg px-3 py-1.5 text-center min-w-[76px]">
              <p className={'font-bold text-base ' + c}>{v}</p>
              <p className="text-xs text-gray-400">{l}</p>
            </div>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 flex-wrap">
          <input type="search" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44" />
          <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="todos">Todas origens</option>
            {Object.entries(ORIGEM_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setShowNovo(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
            + Novo Lead
          </button>
        </div>
      </div>

      {/* kanban */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 h-full" style={{minWidth:'max-content'}}>
            {ETAPAS_FUNIL.map(etapa => (
              <KanbanColuna key={etapa.id} etapa={etapa} leads={deEtapa(etapa.id)}
                onCardClick={l => setLeadSel(l)}
                onDrop={e => { dragId.current = e as any; handleDrop(etapa.id); }} />
            ))}
          </div>
        </div>
      )}

      {leadSel && <LeadModal lead={leadSel} onClose={() => setLeadSel(null)} onSave={handleSalvar} />}
      {showNovo && <NovoLeadModal onClose={() => setShowNovo(false)} onSave={handleNovo} />}
    </div>
  );
            }
