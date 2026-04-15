import React, { useState } from 'react';
import { Phone, Plus, MoreVertical, Calendar, Briefcase, DollarSign, Sparkles, MessageSquare } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { NovoClienteModal } from '../components/NovoClienteModal';
import { WhatsAppAnalysisModal } from '../components/WhatsAppAnalysisModal';

const columns = [
  { id: 'Novo Contato', label: 'ð Novo Contato' },
  { id: 'Em NegociaÃ§Ã£o', label: 'â³ Em NegociaÃ§Ã£o' },
  { id: 'Proposta Enviada', label: 'ð Proposta Enviada' },
  { id: 'Fechado (Ganha)', label: 'â Fechado (Ganha)' },
  { id: 'Perdido', label: 'â Perdido' },
];

export const Clientes: React.FC = () => {
  const { state } = useERP();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // undefined = fechado, null = novo cliente, string = cliente existente
  const [waClienteId, setWaClienteId] = useState<string | null | undefined>(undefined);

  const crmClients = state.clientes.map(c => {
    const proposta = state.propostas.find(p => p.clienteId === c.id);
    return {
      id: c.id,
      name: c.nome,
      project: proposta ? (proposta.items[0]?.name || 'Projeto em DefiniÃ§Ã£o') : 'Sem Projeto Ativo',
      status: (proposta?.status === 'Rascunho' ? 'Em NegociaÃ§Ã£o' :
               proposta?.status === 'Em NegociaÃ§Ã£o' ? 'Em NegociaÃ§Ã£o' :
               proposta?.status === 'Proposta Enviada' ? 'Proposta Enviada' :
               proposta?.status === 'Aprovada/ProduÃ§Ã£o' ? 'Fechado (Ganha)' :
               proposta?.status === 'Perdida' ? 'Perdido' : 'Novo Contato') as any,
      value: proposta?.total || 0,
      date: proposta ? new Date(proposta.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      phone: c.telefone
    };
  });

  const openWhatsApp = (client: any) => {
    const message = encodeURIComponent(`OlÃ¡ ${client.name}, aqui estÃ¡ o resumo do seu projeto ${client.project} no valor de R$ ${client.value.toLocaleString('pt-BR')}.`);
    window.open(`https://wa.me/${client.phone}?text=${message}`, '_blank');
  };

  return (
    <div className="h-full overflow-x-auto">
      {/* Barra superior: CTA global para analisar WhatsApp */}
      <div className="flex justify-between items-center mb-4 pr-4">
        <div className="text-xs text-slate-500">Cole a conversa do WhatsApp e a IA cuida do cadastro e da proposta em uma Ãºnica chamada.</div>
        <button
          onClick={() => setWaClienteId(null)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl shadow-sm"
        >
          <Sparkles size={16} /> Analisar conversa WhatsApp (IA)
        </button>
      </div>

      <div className="flex gap-6 min-w-max pb-4">
        {columns.map((column) => (
          <div key={column.id} className="w-80 flex-shrink-0 bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">{column.label}</h3>
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
    <h3 className="font-bold text-slate-800 text-sm">{column.label}</h3>
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {crmClients.filter(c => c.status === column.id).map((client) => (
                <div key={client.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-slate-900">{client.name}</h4>
                    <MoreVertical size={16} className="text-slate-600" />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Briefcase size={14} />
                      {client.project}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <DollarSign size={14} />
                      R$ {client.value.toLocaleString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={14} />
                      {client.date}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openWhatsApp(client)}
                      className="flex items-center justify-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-2 rounded-lg"
                      title="Abrir conversa no WhatsApp"
                    >
                      <Phone size={14} /> WhatsApp
                    </button>
                    <button
                      onClick={() => setWaClienteId(client.id)}
                      className="flex items-center justify-center gap-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 rounded-lg"
                      title="IA lÃª a conversa e monta cadastro + proposta"
                    >
                      <MessageSquare size={14} /> Analisar IA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <NovoClienteModal onClose={() => setIsModalOpen(false)} />
      )}

      {waClienteId !== undefined && (
        <WhatsAppAnalysisModal
          clienteId={waClienteId || undefined}
          onClose={() => setWaClienteId(undefined)}
        />
      )}
    </div>
  );
};
