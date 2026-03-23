import React from 'react';
import { Package } from 'lucide-react';

export const PlanoEmbalagem: React.FC = () => (
  <div className="p-6 text-slate-900">
    <h2 className="text-2xl font-bold flex items-center gap-2"><Package /> Plano de Embalagem</h2>
    <p className="text-slate-600">Romaneio de peças e conferência de itens miúdos.</p>
  </div>
);
