import React, { useState } from 'react';
import { Phone, Plus, MoreVertical } from 'lucide-react';
import { NovoClienteModal } from './NovoClienteModal';

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex gap-6 h-full overflow-x-auto">
      {columns.map((column) => (
        <div key={column} className="w-72 flex-shrink-0 bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">{column}</h3>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <Plus size={16} className="text-slate-500 hover:text-emerald-400" />
            </button>
          </div>
          
          <div className="space-y-3">
            {initialClients.filter(c => c.status === column).map((client) => (
              <div key={client.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-slate-900">{client.name}</h4>
                  <MoreVertical size={16} className="text-slate-600" />
                </div>
                <p className="text-sm text-slate-600 mb-4">R$ {client.value.toLocaleString('pt-BR')}</p>
                <a 
                  href={`https://wa.me/${client.phone}?text=Olá ${client.name}, sobre o projeto de R$ ${client.value.toLocaleString('pt-BR')}...`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-emerald-100 text-emerald-700 px-3 py-2 rounded-md hover:bg-emerald-200 transition-colors"
                >
                  <Phone size={14} /> 📲 Chamar no WhatsApp
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}

      {isModalOpen && (
        <NovoClienteModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};
