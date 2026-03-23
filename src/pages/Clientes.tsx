import React, { useState } from 'react';
import { Phone, Plus, MoreVertical, Calendar, Briefcase, DollarSign } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { NovoClienteModal } from '../components/NovoClienteModal';

const columns = [
  { id: 'Novo Contato', label: '🆕 Novo Contato' },
  { id: 'Em Negociação', label: '⏳ Em Negociação' },
  { id: 'Proposta Enviada', label: '📄 Proposta Enviada' },
  { id: 'Fechado (Ganha)', label: '✅ Fechado (Ganha)' },
  { id: 'Perdido', label: '❌ Perdido' },
];

export const Clientes: React.FC = () => {
  const { state } = useERP();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mapeamento de clientes do ERP para o formato do CRM
  // Como o ERPContext.Cliente não tem projeto/valor/status de CRM, 
  // vamos usar os dados reais do ERP e complementar com defaults ou dados de propostas se existirem.
  const crmClients = state.clientes.map(c => {
    // Busca a última proposta deste cliente para pegar dados de valor/projeto
    const proposta = state.propostas.find(p => p.clienteId === c.id);
    
    return {
      id: c.id,
      name: c.nome,
      project: proposta ? (proposta.items[0]?.name || 'Projeto em Definição') : 'Sem Projeto Ativo',
      status: (proposta?.status === 'Rascunho' ? 'Novo Contato' :
               proposta?.status === 'Em Negociação' ? 'Em Negociação' : 
               proposta?.status === 'Proposta Enviada' ? 'Proposta Enviada' :
               proposta?.status === 'Aprovada/Produção' ? 'Fechado (Ganha)' : 
               proposta?.status === 'Perdida' ? 'Perdido' : 'Novo Contato') as any,
      value: proposta?.total || 0,
      date: proposta ? new Date(proposta.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      phone: c.telefone
    };
  });

  const openWhatsApp = (client: any) => {
    const message = encodeURIComponent(`Olá ${client.name}, aqui está o resumo do seu projeto ${client.project} no valor de R$ ${client.value.toLocaleString('pt-BR')}.`);
    window.open(`https://wa.me/${client.phone}?text=${message}`, '_blank');
  };

  return (
    <div className="h-full overflow-x-auto">
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

                  <button 
                    onClick={() => openWhatsApp(client)}
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <Phone size={16} /> 📲 Chamar no WhatsApp
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <NovoClienteModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};
