// src/pages/trafego/TrafegoVisaoGeral.tsx
// Placeholder — implementado na Sprint 2 (Meta Ads end-to-end).

import { TrendingUp, AlertCircle } from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';

export function TrafegoVisaoGeral() {
  const { clienteAtivo } = useTrafego();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-7 h-7 text-indigo-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Dashboard de Tráfego</h2>
        <p className="text-sm text-slate-500 mt-1">
          {clienteAtivo
            ? <>Cliente selecionado: <strong>{clienteAtivo.nome}</strong></>
            : 'Selecione um cliente no topo para visualizar suas métricas.'}
        </p>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Em construção — Sprint 2.</strong>
            <p className="text-xs text-amber-700 mt-1">
              Esta tela vai mostrar gasto vs. leads, CPL, ROAS, evolução diária e alertas — assim que a integração com Meta Ads / Google Ads estiver conectada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
