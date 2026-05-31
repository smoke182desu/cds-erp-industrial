// src/pages/trafego/TrafegoCampanhas.tsx
// Lista campanhas do cliente ativo + atalho pra criar nova

import { useEffect, useState, useMemo } from 'react';
import {
  Megaphone, Plus, Search, Loader2, Edit3, Trash2, Eye, Copy,
  Target, DollarSign, Calendar, TrendingUp, AlertCircle, Sparkles,
} from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';
import { WizardNovaCampanha } from './CampanhaWizard';
import { CampanhaDetalhe } from './CampanhaDetalhe';

export interface Campanha {
  id: string;
  cliente_agencia_id: string;
  nome: string;
  objetivo: string;
  plataformas: string[];
  orcamento_diario?: number;
  orcamento_total?: number;
  data_inicio?: string;
  data_fim?: string;
  status: 'rascunho' | 'revisao' | 'aprovada' | 'publicada' | 'pausada' | 'encerrada';
  briefing_md?: string;
  metricas_cache?: any;
  criado_em?: string;
  atualizado_em?: string;
}

const OBJETIVO_LABEL: Record<string, string> = {
  vendas: 'Vendas', leads: 'Leads', alcance: 'Alcance', trafego: 'Tráfego',
  engajamento: 'Engajamento', consideracao: 'Consideração', conversao: 'Conversão',
  app_installs: 'Instalações', video_views: 'Views de vídeo', messages: 'Mensagens',
};

const STATUS_COLOR: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  revisao: 'bg-amber-100 text-amber-800',
  aprovada: 'bg-blue-100 text-blue-800',
  publicada: 'bg-emerald-100 text-emerald-800',
  pausada: 'bg-orange-100 text-orange-800',
  encerrada: 'bg-slate-200 text-slate-500',
};

const PLATAFORMA_BADGE: Record<string, { label: string; color: string }> = {
  meta:           { label: 'Meta',         color: 'bg-blue-600 text-white' },
  facebook:       { label: 'FB',           color: 'bg-blue-700 text-white' },
  instagram:      { label: 'IG',           color: 'bg-pink-600 text-white' },
  google_ads:     { label: 'Google Ads',   color: 'bg-amber-500 text-white' },
  google:         { label: 'Google',       color: 'bg-amber-500 text-white' },
  youtube:        { label: 'YouTube',      color: 'bg-red-600 text-white' },
  tiktok:         { label: 'TikTok',       color: 'bg-slate-900 text-white' },
  linkedin:       { label: 'LinkedIn',     color: 'bg-sky-700 text-white' },
  twitter:        { label: 'X',            color: 'bg-slate-800 text-white' },
  whatsapp:       { label: 'WhatsApp',     color: 'bg-emerald-600 text-white' },
};

export function TrafegoCampanhas() {
  const { clienteAtivo } = useTrafego();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [wizardAberto, setWizardAberto] = useState(false);
  const [campanhaAbrir, setCampanhaAbrir] = useState<Campanha | null>(null);

  async function carregar() {
    if (!clienteAtivo) { setCampanhas([]); setLoading(false); return; }
    try {
      setLoading(true);
      const r = await fetch(`/api/trafego/campanhas?cliente_id=${clienteAtivo.id}`);
      const data = await r.json();
      setCampanhas(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, [clienteAtivo?.id]);

  const visiveis = useMemo(() => {
    let arr = campanhas;
    if (filtroStatus !== 'todos') arr = arr.filter(c => c.status === filtroStatus);
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter(c => c.nome.toLowerCase().includes(q));
    return arr;
  }, [campanhas, filtroStatus, busca]);

  const stats = useMemo(() => ({
    rascunho: campanhas.filter(c => c.status === 'rascunho').length,
    publicada: campanhas.filter(c => c.status === 'publicada').length,
    pausada: campanhas.filter(c => c.status === 'pausada').length,
    total: campanhas.length,
  }), [campanhas]);

  async function clonarCampanha(c: Campanha) {
    const novo = { ...c, nome: `${c.nome} (cópia)`, status: 'rascunho', id: undefined };
    delete (novo as any).id; delete (novo as any).criado_em; delete (novo as any).atualizado_em;
    const r = await fetch('/api/trafego/campanhas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novo),
    });
    if (r.ok) carregar();
  }
  async function removerCampanha(id: string) {
    if (!confirm('Remover essa campanha? Não tem volta.')) return;
    await fetch(`/api/trafego/campanhas?id=${id}`, { method: 'DELETE' });
    carregar();
  }

  if (campanhaAbrir) {
    return <CampanhaDetalhe
      campanha={campanhaAbrir}
      onClose={() => { setCampanhaAbrir(null); carregar(); }}
    />;
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-pink-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Campanhas</h1>
            <p className="text-sm text-slate-500">
              {clienteAtivo ? <>de <strong>{clienteAtivo.nome}</strong> · {stats.total} campanhas</> : 'Selecione uma empresa'}
            </p>
          </div>
          {clienteAtivo && (
            <button
              onClick={() => setWizardAberto(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nova campanha
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {clienteAtivo && campanhas.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-6 grid grid-cols-4 gap-3">
          <Kpi label="Rascunhos"  value={stats.rascunho}  color="slate" />
          <Kpi label="Publicadas" value={stats.publicada} color="emerald" />
          <Kpi label="Pausadas"   value={stats.pausada}   color="orange" />
          <Kpi label="Total"      value={stats.total}     color="pink" />
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        {!clienteAtivo ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-2 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4" /> Selecione uma empresa no banner pra ver campanhas.
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text" value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar campanha..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <select
                value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              >
                <option value="todos">Todos status</option>
                <option value="rascunho">Rascunho</option>
                <option value="revisao">Em revisão</option>
                <option value="aprovada">Aprovada</option>
                <option value="publicada">Publicada</option>
                <option value="pausada">Pausada</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Carregando...
              </div>
            ) : visiveis.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-700 mb-1">
                  {busca || filtroStatus !== 'todos' ? 'Nenhuma campanha encontrada' : 'Nenhuma campanha ainda'}
                </h3>
                <p className="text-sm text-slate-500 mb-3">
                  {busca || filtroStatus !== 'todos'
                    ? 'Tenta limpar os filtros.'
                    : `Crie a primeira campanha de tráfego pago pra ${clienteAtivo.nome}.`}
                </p>
                {!busca && filtroStatus === 'todos' && (
                  <button
                    onClick={() => setWizardAberto(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-lg"
                  >
                    <Sparkles className="w-4 h-4" /> Criar primeira campanha
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visiveis.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-pink-300 transition">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-slate-900 truncate">{c.nome}</h3>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>
                            {c.status}
                          </span>
                          <span className="text-xs text-slate-500">
                            <Target className="w-3 h-3 inline mr-0.5" /> {OBJETIVO_LABEL[c.objetivo] || c.objetivo}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 my-1.5">
                          {c.plataformas?.map(p => {
                            const b = PLATAFORMA_BADGE[p] || { label: p, color: 'bg-slate-500 text-white' };
                            return <span key={p} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.color}`}>{b.label}</span>;
                          })}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          {c.orcamento_diario && (
                            <span><DollarSign className="w-3 h-3 inline" /> R$ {Number(c.orcamento_diario).toLocaleString('pt-BR', {minimumFractionDigits:2})}/dia</span>
                          )}
                          {c.orcamento_total && !c.orcamento_diario && (
                            <span><DollarSign className="w-3 h-3 inline" /> R$ {Number(c.orcamento_total).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                          )}
                          {c.data_inicio && (
                            <span><Calendar className="w-3 h-3 inline" /> {c.data_inicio}{c.data_fim ? ` → ${c.data_fim}` : ''}</span>
                          )}
                          {c.metricas_cache?.impressoes && (
                            <span><TrendingUp className="w-3 h-3 inline" /> {c.metricas_cache.impressoes.toLocaleString('pt-BR')} impr.</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setCampanhaAbrir(c)} className="p-1.5 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg" title="Abrir">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => clonarCampanha(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Duplicar">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => removerCampanha(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {wizardAberto && clienteAtivo && (
        <WizardNovaCampanha
          clienteAgenciaId={clienteAtivo.id}
          clienteNome={clienteAtivo.nome}
          onClose={() => setWizardAberto(false)}
          onCriada={(c) => { setWizardAberto(false); carregar(); setCampanhaAbrir(c); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: any = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-700',
    pink: 'bg-pink-100 text-pink-700',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Megaphone className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xl font-bold text-slate-900 leading-none">{value}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}
