import React from 'react';
import { Truck } from 'lucide-react';

export const PlanoEntrega: React.FC = () => (
  <div className="p-6 text-white">
    <h2 className="text-2xl font-bold flex items-center gap-2"><Truck /> Plano de Entrega</h2>
    <p className="text-slate-400">Logística, peso total e endereços de entrega.</p>
  </div>
);
