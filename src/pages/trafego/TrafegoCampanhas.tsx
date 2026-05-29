// src/pages/trafego/TrafegoCampanhas.tsx
// Placeholder — implementado na Sprint 2.

import { Megaphone, AlertCircle } from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';

export function TrafegoCampanhas() {
  const { clienteAtivo } = useTrafego();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Megaphone className="w-7 h-7 text-pink-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Campanhas</h2>
        <p className="text-sm text-slate-500 mt-1">
          {clienteAtivo
            ? <>Vai listar as campanhas Meta Ads e Google Ads de <strong>{clienteAtivo.nome}</strong>.</>
            : 'Selecione um cliente no topo.'}
        </p>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Em construção — Sprint 2.</strong>
            <p className="text-xs text-amber-700 mt-1">
              Sync de campanhas (nome, objetivo, status, budget, gasto, métricas) puxando da Marketing API e da Google Ads API. Por enquanto, pause/ative pelo Gerenciador de Anúncios mesmo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
