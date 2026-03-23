import React from 'react';
import { PaintBucket } from 'lucide-react';

export const PlanoPintura: React.FC = () => (
  <div className="p-6 text-slate-900">
    <h2 className="text-2xl font-bold flex items-center gap-2"><PaintBucket /> Plano de Pintura</h2>
    <p className="text-slate-600">Fila de peças, cores e consumo de tinta.</p>
  </div>
);
