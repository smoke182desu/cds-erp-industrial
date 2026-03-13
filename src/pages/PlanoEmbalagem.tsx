import React from 'react';
import { Package } from 'lucide-react';

export const PlanoEmbalagem: React.FC = () => (
  <div className="p-6 text-white">
    <h2 className="text-2xl font-bold flex items-center gap-2"><Package /> Plano de Embalagem</h2>
    <p className="text-slate-400">Romaneio de peças e conferência de itens miúdos.</p>
  </div>
);
