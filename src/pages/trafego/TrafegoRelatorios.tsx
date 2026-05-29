// src/pages/trafego/TrafegoRelatorios.tsx
// Placeholder — implementado depois do MVP.

import { FileText, AlertCircle } from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';

export function TrafegoRelatorios() {
  const { clienteAtivo } = useTrafego();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <FileText className="w-7 h-7 text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Relatórios para o Cliente</h2>
        <p className="text-sm text-slate-500 mt-1">
          {clienteAtivo
            ? <>Gera relatórios PDF/WhatsApp para <strong>{clienteAtivo.nome}</strong>.</>
            : 'Selecione um cliente no topo.'}
        </p>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Pós-MVP.</strong>
            <p className="text-xs text-amber-700 mt-1">
              Geração automática (mensal/semanal) de relatório consolidado em PDF + envio por e-mail/WhatsApp ao cliente. Entra depois que Sprints 2 e 3 estiverem rodando.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
