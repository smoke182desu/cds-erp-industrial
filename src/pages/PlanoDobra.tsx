import React from 'react';
import { Layers } from 'lucide-react';

export const PlanoDobra: React.FC = () => (
  <div className="p-6 text-slate-900">
    <h2 className="text-2xl font-bold flex items-center gap-2"><Layers /> Plano de Dobra</h2>
    <p className="text-slate-600">Instruções de dobra para chapas e perfis.</p>
  </div>
);
