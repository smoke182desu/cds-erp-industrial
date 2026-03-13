import React from 'react';
import { Phone, Plus, MoreVertical } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  status: 'Novo' | 'Negociação' | 'Proposta' | 'Ganho' | 'Perdido';
  value: number;
  phone: string;
}

const initialClients: Client[] = [
  { id: '1', name: 'Cliente A', status: 'Novo', value: 50000, phone: '5511999999999' },
  { id: '2', name: 'Cliente B', status: 'Negociação', value: 75000, phone: '5511888888888' },
];

const columns = ['Novo', 'Negociação', 'Proposta', 'Ganho', 'Perdido'];

export const CRMBoard: React.FC = () => {
  return (
    <div className="flex gap-6 h-full overflow-x-auto">
      {columns.map((column) => (
        <div key={column} className="w-72 flex-shrink-0 bg-slate-900 rounded-xl p-4 border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-300">{column}</h3>
            <button className="p-1 hover:bg-slate-800 rounded">
              <Plus size={16} className="text-slate-500" />
            </button>
          </div>
          
          <div className="space-y-3">
            {initialClients.filter(c => c.status === column).map((client) => (
              <div key={client.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-white">{client.name}</h4>
                  <MoreVertical size={16} className="text-slate-600" />
                </div>
                <p className="text-sm text-slate-400 mb-4">R$ {client.value.toLocaleString('pt-BR')}</p>
                <a 
                  href={`https://wa.me/${client.phone}?text=Olá ${client.name}, sobre o projeto de R$ ${client.value.toLocaleString('pt-BR')}...`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-emerald-900/30 text-emerald-400 px-3 py-2 rounded-md hover:bg-emerald-900/50 transition-colors"
                >
                  <Phone size={14} /> 📲 Chamar no WhatsApp
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
