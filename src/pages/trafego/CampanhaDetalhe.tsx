// src/pages/trafego/CampanhaDetalhe.tsx
import { useEffect, useState } from 'react';
import { ArrowLeft, Edit3, Trash2, Plus, Loader2, Sparkles, CheckCircle2, AlertCircle, Image as ImgIcon, Eye } from 'lucide-react';
import type { Campanha } from './TrafegoCampanhas';
import { GeradorCriativoModal } from './GeradorCriativoModal';

interface Criativo {
  id: string;
  campanha_id: string;
  tipo: string;
  headline?: string;
  texto_principal?: string;
  descricao?: string;
  cta?: string;
  link_destino?: string;
  status: string;
  fonte: string;
  variacao?: string;
  metricas?: any;
  criado_em?: string;
}

interface Props {
  campanha: Campanha;
  onClose: () => void;
}

export function CampanhaDetalhe({ campanha: campIn, onClose }: Props) {
  const [campanha, setCampanha] = useState<Campanha>(campIn);
  const [criativos, setCriativos] = useState<Criativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [iaAberto, setIaAberto] = useState(false);
  const [aba, setAba] = useState<'briefing' | 'criativos' | 'metricas'>('criativos');
  const [statusSalvando, setStatusSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [cR, crR] = await Promise.all([
        fetch(`/api/trafego/campanhas?id=${campanha.id}`).then(r => r.json()),
        fetch(`/api/trafego/criativos?campanha_id=${campanha.id}`).then(r => r.json()),
      ]);
      if (cR && cR.id) setCampanha(cR);
      setCriativos(Array.isArray(crR) ? crR : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, [campanha.id]);

  async function mudarStatus(novo: Campanha['status']) {
    setStatusSalvando(true);
    try {
      await fetch(`/api/trafego/campanhas?id=${campanha.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novo, ...(novo === 'publicada' ? { publicado_em: new Date().toISOString() } : {}) }),
      });
      await carregar();
    } finally { setStatusSalvando(false); }
  }

  async function removerCriativo(id: string) {
    if (!confirm('Remover criativo?')) return;
    await fetch(`/api/trafego/criativos?id=${id}`, { method: 'DELETE' });
    carregar();
  }

  async function adicionarCriativos(vars: any[]) {
    for (const v of vars) {
      await fetch('/api/trafego/criativos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campanha_id: campanha.id,
          cliente_agencia_id: campanha.cliente_agencia_id,
          tipo: 'imagem',
          headline: v.headline, texto_principal: v.texto_principal,
          descricao: v.descricao, cta: v.cta,
          fonte: 'ia', status: 'rascunho',
        }),
      });
    }
    setIaAberto(false);
    carregar();
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-pink-600 mb-2 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar pra lista
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-slate-900">{campanha.nome}</h1>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  campanha.status === 'publicada' ? 'bg-emerald-100 text-emerald-800' :
                  campanha.status === 'rascunho' ? 'bg-slate-100 text-slate-700' :
                  campanha.status === 'revisao' ? 'bg-amber-100 text-amber-800' :
                  campanha.status === 'aprovada' ? 'bg-blue-100 text-blue-800' :
                  campanha.status === 'pausada' ? 'bg-orange-100 text-orange-800' :
                  'bg-slate-200 text-slate-500'
                }`}>{campanha.status}</span>
              </div>
              <p className="text-xs text-slate-500">Objetivo: <strong>{campanha.objetivo}</strong> · Plataformas: {campanha.plataformas?.join(', ')} · {criativos.length} criativos</p>
            </div>
            <div className="flex items-center gap-2">
              {campanha.status === 'rascunho' && (
                <button onClick={() => mudarStatus('revisao')} disabled={statusSalvando}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  Enviar pra revisão
                </button>
              )}
              {campanha.status === 'revisao' && (
                <button onClick={() => mudarStatus('aprovada')} disabled={statusSalvando}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  Aprovar
                </button>
              )}
              {campanha.status === 'aprovada' && (
                <button onClick={() => mudarStatus('publicada')} disabled={statusSalvando}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  Marcar como publicada
                </button>
              )}
              {campanha.status === 'publicada' && (
                <button onClick={() => mudarStatus('pausada')} disabled={statusSalvando}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  Pausar
                </button>
              )}
              {campanha.status === 'pausada' && (
                <button onClick={() => mudarStatus('publicada')} disabled={statusSalvando}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  Retomar
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-4 mt-3 border-b border-slate-200">
            {(['criativos','briefing','metricas'] as const).map(t => (
              <button key={t} onClick={() => setAba(t)}
                className={`pb-2 text-sm font-semibold capitalize ${aba === t ? 'text-pink-600 border-b-2 border-pink-600' : 'text-slate-500 hover:text-slate-700'}`}>
                {t === 'metricas' ? 'Métricas' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : aba === 'criativos' ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-700">{criativos.length} criativos</h2>
              <button onClick={() => setIaAberto(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg">
                <Sparkles className="w-4 h-4" /> Gerar com IA
              </button>
            </div>
            {criativos.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <ImgIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-3">Sem criativos ainda</p>
                <button onClick={() => setIaAberto(true)} className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg">+ Gerar com IA</button>
              </div>
            ) : (
              <div className="space-y-3">
                {criativos.map(cr => (
                  <div key={cr.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {cr.fonte === 'ia' && <span className="text-[9px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">IA</span>}
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            cr.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' :
                            cr.status === 'em_uso' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>{cr.status}</span>
                        </div>
                        {cr.headline && <h3 className="font-bold text-slate-900 text-sm">{cr.headline}</h3>}
                        {cr.texto_principal && <p className="text-xs text-slate-700 mt-0.5">{cr.texto_principal}</p>}
                        {cr.descricao && <p className="text-xs text-slate-500 mt-0.5 italic">{cr.descricao}</p>}
                        {cr.cta && <span className="text-[10px] font-bold text-pink-700 mt-1 inline-block">CTA: {cr.cta}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => removerCriativo(cr.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : aba === 'briefing' ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">{campanha.briefing_md || '(sem briefing)'}</pre>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 mb-1">Métricas em construção</h3>
            <p className="text-sm text-slate-600">
              Vai exibir gasto, impressões, cliques, CTR, ROAS — depois que conectarmos via OAuth do Meta/Google Ads (Sprint 2 do roadmap).
            </p>
          </div>
        )}
      </div>

      {iaAberto && (
        <GeradorCriativoModal
          contexto={{ clienteId: campanha.cliente_agencia_id, clienteNome: '', objetivo: campanha.objetivo, plataforma: campanha.plataformas?.[0] || 'meta', briefing: campanha.nome }}
          onClose={() => setIaAberto(false)}
          onUsar={adicionarCriativos}
        />
      )}
    </div>
  );
}
