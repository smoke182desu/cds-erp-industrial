import { useState, useEffect, useRef } from 'react';
import {
  Lead, EtapaFunil, LeadOrigem,
  ETAPAS_FUNIL, ORIGEM_LABELS,
  subscribeLeads, adicionarLead, atualizarLead, moverEtapa,
} from '../services/leadsService';

// ---- ícones simples (inline SVG como componente) ----
const Icon = ({ d, size = 16, color = 'currentColor' }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ORIGEM_ICONS: Record<string, string> = {
  site:        '🌐',
  whatsapp:    '💬',
  woocommerce: '🛒',
  calculadora: '📐',
  manual:      '✏️',
};

const ETAPA_COR: Record<EtapaFunil, string> = {
  lead_novo:        'border-indigo-400',
  contato_feito:    'border-sky-400',
  qualificado:      'border-amber-400',
  proposta_enviada: 'border-violet-400',
  negociacao:       'border-pink-400',
  fechado_ganho:    'border-emerald-400',
  fechado_perdido:  'border-red-400',
};

const ETAPA_BG: Record<EtapaFunil, string> = {
  lead_novo:        'bg-indigo-50',
  contato_feito:    'bg-sky-50',
  qualificado:      'bg-amber-50',
  proposta_enviada: 'bg-violet-50',
  negociacao:       'bg-pink-50',
  fechado_ganho:    'bg-emerald-50',
  fechado_perdido:  'bg-red-50',
};

const ETAPA_HEADER: Record<EtapaFunil, string> = {
  lead_novo:        'bg-indigo-500',
  contato_feito:    'bg-sky-500',
  qualificado:      'bg-amber-500',
  proposta_enviada: 'bg-violet-500',
  negociacao:       'bg-pink-500',
  fechado_ganho:    'bg-emerald-500',
  fechado_perdido:  'bg-red-500',
};

function fmt(v?: number) {
  if (!v) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ---- Card do lead ----
function LeadCard({ lead, onClick, onDragStart }: { lead: Lead; onClick: () => void; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border-l-4 bg-white shadow-sm hover:shadow-md transition-shadow p-3 ${ETAPA_COR[lead.etapa]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-800 text-sm leading-tight truncate flex-1">{lead.nome || '—'}</p>
        <span className="text-xs text-gray-400 shrink-0">{timeAgo(lead.criadoEm)}</span>
      </div>
      {lead.empresa && <p className="text-xs text-gray-500 truncate mt-0.5">{lead.empresa}</p>}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {lead.telefone && (
          <a
            href={`https://wa.me/${lead.telefone.replace(/\D/g,'')}`}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5 hover:bg-green-200"
          >
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

// ---- Coluna Kanban ----
function KanbanColuna({
  etapa, leads, onCardClick, onDrop,
}: {
  etapa: typeof ETAPAS_FUNIL[0];
  leads: Lead[];
  onCardClick: (l: Lead) => void;
  onDrop: (etapa: EtapaFunil) => void;
}) {
  const [over, setOver] = useState(false);
  const total = leads.reduce((s, l) => s + (l.valor || 0), 0);

  return (
    <div
      className={`flex flex-col rounded-xl min-h-[400px] w-64 shrink-0 ${ETAPA_BG[etapa.id]} border ${over ? 'border-dashed border-2 border-gray-400' : 'border-transparent'}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(etapa.id); }}
    >
      {/* header */}
      <div className={`rounded-t-xl px-3 py-2 ${ETAPA_HEADER[etapa.id]} text-white`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{etapa.label}</span>
          <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">{leads.length}</span>
        </div>
        {total > 0 && <p className="text-xs text-white/80 mt-0.5">{fmt(total)}</p>}
      </div>

      {/* cards */}
      <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)]">
        {leads.map(l => (
          <LeadCard
            key={l.id}
            lead={l}
            onClick={() => onCardClick(l)}
            onDragStart={e => e.dataTransfer.setData('leadId', l.id)}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-xs italic pt-8">
            Nenhum lead
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Modal Detalhes / Edição ----
function LeadModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (data: Partial<Lead>) => void }) {
  const [form, setForm] = useState<Partial<Lead>>({ ...lead });
  const set = (k: keyof Lead, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`rounded-t-2xl px-5 py-4 ${ETAPA_HEADER[form.etapa as EtapaFunil || 'lead_novo']} text-white flex items-center justify-between`}>
          <h2 className="font-bold text-lg">{form.nome || 'Lead'}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {([['nome','Nome','text'],['empresa','Empresa','text'],['email','E-mail','email'],['telefone','Telefone','tel']] as [keyof Lead, string, string][]).map(([k, label, type]) => (
            <div key={k} className={k === 'nome' ? 'col-span-2' : ''}>
              <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
              <input
                type={type}
                value={String(form[k] || '')}
                onChange={e => set(k, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Etapa</label>
            <select value={form.etapa || 'lead_novo'} onChange={e => set('etapa', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {ETAPAS_FUNIL.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Valor (R$)</label>
            <input type="number" value={form.valor || ''} onChange={e => set('valor', parseFloat(e.target.value) || 0)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">Observações</label>
            <textarea rows={3} value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
          {lead.pedidoId && <div className="col-span-2 text-xs text-gray-400">Pedido WC: #{lead.pedidoId}</div>}
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold">Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ---- Modal Novo Lead ----
function NovoLeadModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Omit<Lead,'id'|'criadoEm'>) => void }) {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', empresa: '', mensagem: '', valor: '', origem: 'manual' as LeadOrigem, etapa: 'lead_novo' as EtapaFunil });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-indigo-600 rounded-t-2xl px-5 py-4 text-white flex items-center justify-between">
          <h2 className="font-bold text-lg">+ Novo Lead</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {([['nome','Nome *','text',true],['empresa','Empresa','text',false],['email','E-mail','email',false],['telefone','Telefone / WhatsApp','tel',false]] as [string,string,string,boolean][]).map(([k,label,type,req]) => (
            <div key={k} className={k==='nome'?'col-span-2':''}>
              <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
              <input type={type} required={req} value={(form as any)[k]} onChange={e => set(k, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Etapa inicial</label>
            <select value={form.etapa} onChange={e => set('etapa', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {ETAPAS_FUNIL.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Valor (R$)</label>
            <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">Mensagem / Obs.</label>
            <textarea rows={2} value={form.mensagem} onChange={e => set('mensagem', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
          <button
            onClick={() => {
              if (!form.nome.trim()) return;
              onSave({ ...form, valor: parseFloat(form.valor) || undefined, observacoes: form.mensagem });
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
          >
            Criar Lead
          </button>
        </div>
      </div>
    </div>
  );
}

// ======== COMPONENTE PRINCIPAL ========
export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [showNovoLead, setShowNovoLead] = useState(false);
  const dragLeadId = useRef<string | null>(null);

  useEffect(() => {
    const unsub = subscribeLeads((data) => {
      setLeads(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // filtros
  const leadsFiltrados = leads.filter(l => {
    const matchBusca = !busca || [l.nome, l.email, l.telefone, l.empresa]
      .some(v => v?.toLowerCase().includes(busca.toLowerCase()));
    const matchOrigem = filtroOrigem === 'todos' || l.origem === filtroOrigem;
    return matchBusca && matchOrigem;
  });

  const leadsParaEtapa = (etapa: EtapaFunil) =>
    leadsFiltrados.filter(l => l.etapa === etapa);

  // drag & drop
  const handleDrop = async (etapa: EtapaFunil) => {
    if (!dragLeadId.current) return;
    await moverEtapa(dragLeadId.current, etapa);
    dragLeadId.current = null;
  };

  // salvar edição
  const handleSalvar = async (data: Partial<Lead>) => {
    if (!leadSelecionado) return;
    await atualizarLead(leadSelecionado.id, data);
    setLeadSelecionado(null);
  };

  // novo lead
  const handleNovoLead = async (data: Omit<Lead, 'id' | 'criadoEm'>) => {
    await adicionarLead(data);
    setShowNovoLead(false);
  };

  // totais
  const totalLeads  = leads.length;
  const totalValor  = leads.filter(l => l.etapa !== 'fechado_perdido').reduce((s, l) => s + (l.valor || 0), 0);
  const ganhos      = leads.filter(l => l.etapa === 'fechado_ganho').length;
  const taxa        = totalLeads ? Math.round((ganhos / totalLeads) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-gray-100">

      {/* ---- Topo ---- */}
      <div className="bg-white border-b px-6 py-4 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Funil de Vendas</h1>
          <p className="text-xs text-gray-500">CRM • Leads e oportunidades em tempo real</p>
        </div>

        {/* KPIs */}
        <div className="flex gap-4 ml-4 flex-wrap">
          {[
            { label: 'Total Leads', valor: totalLeads, cor: 'text-indigo-600' },
            { label: 'Pipeline',    valor: fmt(totalValor) || 'R$ 0', cor: 'text-violet-600' },
            { label: 'Fechados',    valor: ganhos, cor: 'text-emerald-600' },
            { label: 'Conversão',   valor: taxa + '%', cor: 'text-amber-600' },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-lg px-3 py-1.5 text-center min-w-[80px]">
              <p className={`font-bold text-base ${k.cor}`}>{k.valor}</p>
              <p className="text-xs text-gray-400">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* Busca + filtro */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="search"
            placeholder="Buscar lead..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
          />
          <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="todos">Todas origens</option>
            {Object.entries(ORIGEM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button
            onClick={() => setShowNovoLead(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Novo Lead
          </button>
        </div>
      </div>

      {/* ---- Kanban ---- */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 h-full" style={{ minWidth: 'max-content' }}>
            {ETAPAS_FUNIL.map(etapa => (
              <KanbanColuna
                key={etapa.id}
                etapa={etapa}
                leads={leadsParaEtapa(etapa.id)}
                onCardClick={setLeadSelecionado}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---- Modais ---- */}
      {leadSelecionado && (
        <LeadModal lead={leadSelecionado} onClose={() => setLeadSelecionado(null)} onSave={handleSalvar} />
      )}
      {showNovoLead && (
        <NovoLeadModal onClose={() => setShowNovoLead(false)} onSave={handleNovoLead} />
      )}
    </div>
  );
}
