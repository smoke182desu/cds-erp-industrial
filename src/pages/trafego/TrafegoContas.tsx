// src/pages/trafego/TrafegoContas.tsx
// Placeholder — implementado na Sprint 2 (OAuth Meta/Google).

import { Plug, AlertCircle, Facebook, Search } from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';

export function TrafegoContas() {
  const { clienteAtivo } = useTrafego();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Plug className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Contas de anúncio conectadas</h2>
            <p className="text-xs text-slate-500">
              {clienteAtivo ? <>Plataformas vinculadas a <strong>{clienteAtivo.nome}</strong></> : 'Selecione um cliente no topo.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <Facebook className="w-8 h-8 text-blue-600" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">Meta Ads</p>
              <p className="text-xs text-slate-500">Facebook + Instagram</p>
            </div>
            <button disabled className="text-xs font-semibold bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg cursor-not-allowed">
              Em breve
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <Search className="w-8 h-8 text-red-500" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">Google Ads</p>
              <p className="text-xs text-slate-500">Search, Display, PMax</p>
            </div>
            <button disabled className="text-xs font-semibold bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg cursor-not-allowed">
              Em breve
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>OAuth chega na Sprint 2.</strong>
          <p className="text-xs text-amber-700 mt-1">
            Vamos usar Meta Marketing API v21 e Google Ads API v17 com fluxo OAuth do Vercel.
            As credenciais (FB_APP_ID / FB_APP_SECRET / GOOGLE_ADS_CLIENT_ID etc.) vão direto nas env vars do projeto.
          </p>
        </div>
      </div>
    </div>
  );
}
