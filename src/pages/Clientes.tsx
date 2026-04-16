import React, { useState } from 'react';
import { Phone, Plus, MoreVertical, Calendar, Briefcase, DollarSign, MessageCircle } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { NovoClienteModal } from '../components/NovoClienteModal';
import { WhatsAppAnalyzerModal } from '../components/WhatsAppAnalyzerModal';
import { Cliente } from '../types';

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
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [clienteParaAnalisar, setClienteParaAnalisar] = useState<Cliente | undefined>(undefined);

  const crmClients = state.clientes.map(c => {
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
      phone: c.telefone,
      clienteOriginal: c,
    };
  });

  const openWhatsApp = (client: any) => {
    const message = encodeURIComponent(`Olá ${client.name}, aqui está o resumo do seu projeto ${client.project} no valor de R$ ${client.value.toLocaleString('pt-BR')}.`);
    window.open(`https://wa.me/${client.phone}?text=${message}`, '_blank');
  };

  const abrirAnalisadorWhatsApp = (cliente?: Cliente) => {
    setClienteParaAnalisar(cliente);
    setIsWhatsAppModalOpen(true);
  };

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-lg font-bold text-slate-800">CRM de Clientes</h2>
        <button
          onClick={() => abrirAnalisadorWhatsApp()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all"
        >
          <MessageCircle size={16} />
          📲 Novo Cliente via WhatsApp
        </button>
      </div>

      <div className="flex gap-6 min-w-max pb-4">
        {columns.map((column) => (
          <div key={column.id} className="w-80 flex-shrink-0 bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">{column.label}</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => abrirAnalisadorWhatsApp()}
                  title="Novo cliente via análise de WhatsApp"
                  className="p-1 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-500 transition-colors"
                >
                  <MessageCircle size={16} />
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  title="Novo cliente manual"
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
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
                      <Briefcase size={14} />{client.project}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <DollarSign size={14} />R$ {client.value.toLocaleString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={14} />{client.date}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openWhatsApp(client)}
                      className="flex-1 flex items-center justify-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition-all shadow-md shadow-emerald-900/20"
                    >
                      <Phone size={14} /> Chamar
                    </button>
                    <button
                      onClick={() => abrirAnalisadorWhatsApp(client.clienteOriginal)}
                      title="Analisar conversa do WhatsApp e atualizar cadastro"
                      className="flex items-center justify-center gap-1 text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 transition-all"
                    >
                      <MessageCircle size={14} />
                      🤖 IA
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

      {isWhatsAppModalOpen && (
        <WhatsAppAnalyzerModal
          clienteExistente={clienteParaAnalisar}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setClienteParaAnalisar(undefined);
          }}
        />
      )}
    </div>
  );
};
