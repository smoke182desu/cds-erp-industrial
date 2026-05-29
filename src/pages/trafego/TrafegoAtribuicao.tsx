// src/pages/trafego/TrafegoAtribuicao.tsx
// Placeholder — implementado na Sprint 3.

import { Link2, AlertCircle } from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';

export function TrafegoAtribuicao() {
  const { clienteAtivo } = useTrafego();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Link2 className="w-7 h-7 text-teal-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Atribuição de Leads</h2>
        <p className="text-sm text-slate-500 mt-1">
          {clienteAtivo
            ? <>Liga cada lead de <strong>{clienteAtivo.nome}</strong> à campanha de origem.</>
            : 'Selecione um cliente no topo.'}
        </p>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Em construção — Sprint 3.</strong>
            <p className="text-xs text-amber-700 mt-1">
              Captura UTMs (source/medium/campaign), fbclid, gclid; integra com Meta CAPI e Google Enhanced Conversions; mostra atribuição lead → campanha.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
