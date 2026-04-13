import { useState, useEffect } from 'react';
import {
  Lead, LeadStatus, LeadOrigem,
  buscarLeads, adicionarLead, atualizarLead,
  STATUS_LABELS, ORIGEM_LABELS,
} from '../services/leadsService';

const STATUS_COLORS: Record<LeadStatus, string> = {
  novo:        'bg-blue-100 text-blue-800',
  em_triagem:  'bg-yellow-100 text-yellow-800',
  qualificado: 'bg-green-100 text-green-800',
  descartado:  'bg-red-100 text-red-800',
};

const ORIGEM_ICONS: Record<LeadOrigem, string> = {
  site:     '🌐',
  whatsapp: '💬',
  manual:   '✏️',
};

export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<LeadStatus | 'todos'>('todos');
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [novoLead, setNovoLead] = useState({ nome: '', email: '', telefone: '', empresa: '', mensagem: '', origem: 'manual' as LeadOrigem });

  const carregar = async () => {
    setLoading(true);
    const dados = await buscarLeads();
    setLeads(dados);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const handleStatus = async (lead: Lead, status: LeadStatus) => {
    await atualizarLead(lead.id!, { status });
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l));
    if (leadSelecionado?.id === lead.id) setLeadSelecionado(prev => prev ? { ...prev, status } : null);
  };

  const handleSalvarObs = async () => {
    if (!leadSelecionado) return;
    await atualizarLead(leadSelecionado.id!, { observacoes });
    setLeads(prev => prev.map(l => l.id === leadSelecionado.id ? { ...l, observacoes } : l));
    setLeadSelecionado(prev => prev ? { ...prev, observacoes } : null);
  };

  const handleNovoLead = async () => {
    if (!novoLead.nome && !novoLead.telefone) return;
    await adicionarLead(novoLead);
    setModalNovoLead(false);
    setNovoLead({ nome: '', email: '', telefone: '', empresa: '', mensagem: '', origem: 'manual' });
    carregar();
  };

  const leadsFiltrados = filtroStatus === 'todos' ? leads : leads.filter(l => l.status === filtroStatus);

  const contadores = {
    todos: leads.length,
    novo: leads.filter(l => l.status === 'novo').length,
    em_triagem: leads.filter(l => l.status === 'em_triagem').length,
    qualificado: leads.filter(l => l.status === 'qualificado').length,
    descartado: leads.filter(l => l.status === 'descartado').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie e triareje os leads do site e WhatsApp</p>
        </div>
        <button
          onClick={() => setModalNovoLead(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Novo Lead
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['todos', 'novo', 'em_triagem', 'qualificado', 'descartado'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {s === 'todos' ? 'Todos' : STATUS_LABELS[s]} ({contadores[s]})
          </button>
        ))}
        <button onClick={carregar} className="ml-auto px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">
          🔄 Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-2 space-y-3">
            {leadsFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">Nenhum lead encontrado</div>
            ) : leadsFiltrados.map(lead => (
              <div
                key={lead.id}
                onClick={() => { setLeadSelecionado(lead); setObservacoes(lead.observacoes || ''); }}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${leadSelecionado?.id === lead.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ORIGEM_ICONS[lead.origem]}</span>
                      <h3 className="font-semibold text-gray-900 truncate">{lead.nome || '(sem nome)'}</h3>
                    </div>
                    {lead.empresa && <p className="text-sm text-gray-500 mt-0.5">{lead.empresa}</p>}
                    {lead.telefone && <p className="text-sm text-gray-600 mt-1">📞 {lead.telefone}</p>}
                    {lead.email && <p className="text-sm text-gray-600">✉️ {lead.email}</p>}
                    {lead.mensagem && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{lead.mensagem}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                    <span className="text-xs text-gray-400">{ORIGEM_LABELS[lead.origem]}</span>
                    <span className="text-xs text-gray-400">{new Date(lead.criadoEm).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Painel de triagem */}
          <div className="lg:col-span-1">
            {leadSelecionado ? (
              <div className="bg-white rounded-xl border p-5 sticky top-4">
                <h2 className="font-bold text-gray-900 mb-1">{leadSelecionado.nome || '(sem nome)'}</h2>
                <p className="text-sm text-gray-500 mb-4">{ORIGEM_ICONS[leadSelecionado.origem]} {ORIGEM_LABELS[leadSelecionado.origem]}</p>

                <div className="space-y-1 mb-4 text-sm">
                  {leadSelecionado.empresa && <p><span className="text-gray-400">Empresa:</span> {leadSelecionado.empresa}</p>}
                  {leadSelecionado.telefone && <p><span className="text-gray-400">Telefone:</span> {leadSelecionado.telefone}</p>}
                  {leadSelecionado.email && <p><span className="text-gray-400">Email:</span> {leadSelecionado.email}</p>}
                  {leadSelecionado.mensagem && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-600">{leadSelecionado.mensagem}</div>
                  )}
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Alterar Status</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(['novo','em_triagem','qualificado','descartado'] as LeadStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatus(leadSelecionado, s)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${leadSelecionado.status === s ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Observações</p>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Adicione observações sobre este lead..."
                />
                <button
                  onClick={handleSalvarObs}
                  className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Salvar Observações
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-5 text-center text-gray-400">
                <p className="text-4xl mb-2">👈</p>
                <p className="text-sm">Selecione um lead para fazer a triagem</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Novo Lead */}
      {modalNovoLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Novo Lead Manual</h2>
            <div className="space-y-3">
              {[
                { label: 'Nome', key: 'nome', type: 'text' },
                { label: 'Telefone', key: 'telefone', type: 'text' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Empresa', key: 'empresa', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(novoLead as any)[key]}
                    onChange={e => setNovoLead(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  value={novoLead.mensagem}
                  onChange={e => setNovoLead(prev => ({ ...prev, mensagem: e.target.value }))}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalNovoLead(false)} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleNovoLead} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
