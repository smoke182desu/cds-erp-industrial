import React from 'react';
import { Phone, Plus, MoreVertical, Calendar, Briefcase, DollarSign } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  project: string;
  status: 'Novo Contato' | 'Em Negociação' | 'Proposta Enviada' | 'Fechado (Ganha)' | 'Perdido';
  value: number;
  date: string;
  phone: string;
}

const initialClients: Client[] = [
  { id: '1', name: 'Construtora Alpha', project: 'Galpão 200m²', status: 'Novo Contato', value: 50000, date: '12/03/2026', phone: '5511999999999' },
  { id: '2', name: 'Indústria Beta', project: 'Cobertura 500m²', status: 'Em Negociação', value: 120000, date: '10/03/2026', phone: '5511888888888' },
  { id: '3', name: 'Logística Gamma', project: 'Galpão 1000m²', status: 'Proposta Enviada', value: 250000, date: '05/03/2026', phone: '5511777777777' },
  { id: '4', name: 'Comércio Delta', project: 'Pergolado 50m²', status: 'Fechado (Ganha)', value: 15000, date: '01/03/2026', phone: '5511666666666' },
  { id: '5', name: 'Escritório Epsilon', project: 'Escada Metálica', status: 'Perdido', value: 8000, date: '25/02/2026', phone: '5511555555555' },
];

const columns = [
  { id: 'Novo Contato', label: '🆕 Novo Contato' },
  { id: 'Em Negociação', label: '⏳ Em Negociação' },
  { id: 'Proposta Enviada', label: '📄 Proposta Enviada' },
  { id: 'Fechado (Ganha)', label: '✅ Fechado (Ganha)' },
  { id: 'Perdido', label: '❌ Perdido' },
];

export const Clientes: React.FC = () => {
  const openWhatsApp = (client: Client) => {
    const message = encodeURIComponent(`Olá ${client.name}, aqui está o resumo do seu projeto ${client.project} no valor de R$ ${client.value.toLocaleString('pt-BR')}.`);
    window.open(`https://wa.me/${client.phone}?text=${message}`, '_blank');
  };

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-6 min-w-max pb-4">
        {columns.map((column) => (
          <div key={column.id} className="w-80 flex-shrink-0 bg-slate-900 rounded-xl p-4 border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-200 text-sm">{column.label}</h3>
              <button className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300">
                <Plus size={18} />
              </button>
            </div>
            
            <div className="space-y-3">
              {initialClients.filter(c => c.status === column.id).map((client) => (
                <div key={client.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-white">{client.name}</h4>
                    <MoreVertical size={16} className="text-slate-600" />
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Briefcase size={14} />
                      {client.project}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <DollarSign size={14} />
                      R$ {client.value.toLocaleString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
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
    </div>
  );
};
