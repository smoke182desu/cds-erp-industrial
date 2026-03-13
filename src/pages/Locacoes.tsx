import React from 'react';
import { Truck, Calendar, User, AlertTriangle, Wrench } from 'lucide-react';

export const Locacoes: React.FC = () => {
  const columns = [
    { id: 'disponivel', title: 'Estoque Disponível', color: 'bg-emerald-900' },
    { id: 'locacao', title: 'Em Locação (Cliente)', color: 'bg-blue-900' },
    { id: 'atrasados', title: 'Atrasados', color: 'bg-red-900' },
    { id: 'manutencao', title: 'Em Manutenção', color: 'bg-amber-900' },
  ];

  const mockCards = [
    { id: 1, title: 'Carrinho Plataforma 300kg', status: 'locacao', cliente: 'Construtora ABC', data: '20/03/2026', valor: 'R$ 50/dia' },
    { id: 2, title: 'Escada Plataforma 2m', status: 'disponivel', cliente: '-', data: '-', valor: 'R$ 80/dia' },
    { id: 3, title: 'Container de Lixo 1000L', status: 'atrasados', cliente: 'Condomínio XYZ', data: '10/03/2026', valor: 'R$ 150/mês' },
    { id: 4, title: 'Carrinho Plataforma 300kg', status: 'manutencao', cliente: '-', data: '-', valor: 'R$ 50/dia' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Gestão de Locações</h1>
      <div className="grid grid-cols-4 gap-4">
        {columns.map(col => (
          <div key={col.id} className={`${col.color} p-4 rounded-xl`}>
            <h2 className="font-bold text-white mb-4">{col.title}</h2>
            <div className="space-y-3">
              {mockCards.filter(c => c.status === col.id).map(card => (
                <div key={card.id} className="bg-slate-950 p-3 rounded-lg border border-slate-700">
                  <h3 className="font-bold text-sm text-white">{card.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">Cliente: {card.cliente}</p>
                  <p className="text-xs text-slate-400">Devolução: {card.data}</p>
                  <p className="text-xs font-bold text-emerald-400 mt-1">{card.valor}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
