import React from 'react';
import { Wrench } from 'lucide-react';

export const PlanoMontagemSolda: React.FC = () => (
  <div className="p-6 text-white">
    <h2 className="text-2xl font-bold flex items-center gap-2"><Wrench /> Plano de Montagem e Solda</h2>
    <p className="text-slate-400">Gerenciamento de conjuntos soldados e controle de qualidade.</p>
  </div>
);
