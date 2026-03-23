import React from 'react';
import { Truck } from 'lucide-react';

export const PlanoEntrega: React.FC = () => (
  <div className="p-6 text-slate-900">
    <h2 className="text-2xl font-bold flex items-center gap-2"><Truck /> Plano de Entrega</h2>
    <p className="text-slate-600">Logística, peso total e endereços de entrega.</p>
  </div>
);
