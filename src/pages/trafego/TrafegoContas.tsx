// src/pages/trafego/TrafegoContas.tsx
// Tela de contas de plataformas conectadas ao cliente da agência ativo.
// Suporta cadastro MANUAL (cole token) enquanto OAuth real (Sprint 2) não está pronto.

import { useEffect, useState, useMemo } from 'react';
import {
  Plug, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2, Loader2,
  Facebook, Search, Globe, BarChart3, ShoppingBag, Tag, Megaphone, X
} from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';
import {
  TrafegoConta, TrafegoContaInput, listarContas, criarConta, atualizarConta, removerConta,
} from '../../services/trafegoService';

// Catálogo de plataformas suportadas com label + ícone + grupo
type PlataformaInfo = { id: string; label: string; grupo: string; icon: any; cor: string };
const PLATAFORMAS: PlataformaInfo[] = [
  { id: 'meta_ads',              label: 'Meta Ads (FB + IG)',         grupo: 'Anúncios pagos', icon: Facebook,   cor: 'text-blue-600 bg-blue-50' },
  { id: 'google_ads',            label: 'Google Ads',                 grupo: 'Anúncios pagos', icon: Search,     cor: 'text-red-500 bg-red-50' },
  { id: 'tiktok_ads',            label: 'TikTok Ads',                 grupo: 'Anúncios pagos', icon: Megaphone,  cor: 'text-pink-500 bg-pink-50' },
  { id: 'linkedin_ads',          label: 'LinkedIn Ads',               grupo: 'Anúncios pagos', icon: Megaphone,  cor: 'text-sky-700 bg-sky-50' },
  { id: 'pinterest_ads',         label: 'Pinterest Ads',              grupo: 'Anúncios pagos', icon: Megaphone,  cor: 'text-red-600 bg-red-50' },
  { id: 'snapchat_ads',          label: 'Snapchat Ads',               grupo: 'Anúncios pagos', icon: Megaphone,  cor: 'text-yellow-500 bg-yellow-50' },
  { id: 'youtube_ads',           label: 'YouTube Ads',                grupo: 'Anúncios pagos', icon: Megaphone,  cor: 'text-red-600 bg-red-50' },
  { id: 'twitter_ads',           label: 'Twitter/X Ads',              grupo: 'Anúncios pagos', icon: Megaphone,  cor: 'text-slate-800 bg-slate-100' },
  { id: 'google_analytics',      label: 'Google Analytics (GA4)',     grupo: 'Analytics e SEO',icon: BarChart3,  cor: 'text-orange-500 bg-orange-50' },
  { id: 'google_search_console', label: 'Google Search Console',      grupo: 'Analytics e SEO',icon: Search,     cor: 'text-emerald-600 bg-emerald-50' },
  { id: 'google_tag_manager',    label: 'Google Tag Manager',         grupo: 'Analytics e SEO',icon: Tag,        cor: 'text-blue-500 bg-blue-50' },
  { id: 'google_merchant',       label: 'Google Merchant Center',     grupo: 'E-commerce',     icon: ShoppingBag,cor: 'text-amber-500 bg-amber-50' },
  { id: 'facebook_catalog',      label: 'Facebook Catalog',           grupo: 'E-commerce',     icon: ShoppingBag,cor: 'text-blue-700 bg-blue-50' },
  { id: 'facebook_page',         label: 'Facebook Page',              grupo: 'Páginas orgânicas',icon: Facebook,  cor: 'text-blue-600 bg-blue-50' },
  { id: 'instagram_business',    label: 'Instagram Business',         grupo: 'Páginas orgânicas',icon: Globe,     cor: 'text-pink-500 bg-pink-50' },
  { id: 'linkedin_company_page', label: 'LinkedIn Company Page',      grupo: 'Páginas orgânicas',icon: Globe,     cor: 'text-sky-700 bg-sky-50' },
  { id: 'tiktok_creator',        label: 'TikTok Creator',             grupo: 'Páginas orgânicas',icon: Globe,     cor: 'text-pink-600 bg-pink-50' },
  { id: 'youtube_channel',       label: 'YouTube Channel',            grupo: 'Páginas orgânicas',icon: Globe,     cor: 'text-red-600 bg-red-50' },
  { id: 'twitter_x_account',     label: 'Twitter/X Account',          grupo: 'Páginas orgânicas',icon: Globe,     cor: 'text-slate-800 bg-slate-100' },
  { id: 'pinterest_business',    label: 'Pinterest Business',         grupo: 'Páginas orgânicas',icon: Globe,     cor: 'text-red-600 bg-red-50' },
];

const GRUPOS = ['Anúncios pagos', 'Analytics e SEO', 'E-commerce', 'Páginas orgânicas'];

function vazio(): TrafegoContaInput {
  return {
    plataforma: 'meta_ads',
    account_id: '',
    account_name: '',
    access_token: '',
    refresh_token: '',
    expires_at: undefined,
    status: 'ativo',
    metadata: {},
  };
}

export function TrafegoContas() {
  const { clienteAtivo } = useTrafego();
  const [contas, setContas] = useState<TrafegoConta[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TrafegoConta | null>(null);
  const [form, setForm] = useState<TrafegoContaInput>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  async function recarregar() {
    if (!clienteAtivo) { setContas([]); return; }
    setLoading(true); setErro('');
    try {
      setContas(await listarContas(clienteAtivo.id));
    } catch (e: any) {
      setErro(e?.message || 'Erro ao listar contas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { recarregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clienteAtivo?.id]);

  const grupos = useMemo(() => {
    const mapa: Record<string, TrafegoConta[]> = {};
    contas.forEach(c => {
      const info = PLATAFORMAS.find(p => p.id === c.plataforma);
      const grupo = info?.grupo || 'Outras';
      if (!mapa[grupo]) mapa[grupo] = [];
      mapa[grupo].push(c);
    });
    return mapa;
  }, [contas]);

  function abrirNovo() {
    setEditando(null);
    setForm(vazio());
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEdit(c: TrafegoConta) {
    setEditando(c);
    setForm({
      plataforma: c.plataforma,
      account_id: c.accountId,
      account_name: c.accountName || '',
      access_token: '',  // não recebemos token no listing por segurança
      refresh_token: '',
      expires_at: c.expiresAt,
      status: c.status,
      metadata: c.metadata || {},
    });
    setErroForm('');
    setModalAberto(true);
  }

  async function salvar() {
    if (!clienteAtivo) return;
    if (!form.account_id?.trim()) { setErroForm('Account ID é obrigatório'); return; }
    setSalvando(true); setErroForm('');
    try {
      if (editando) {
        await atualizarConta(editando.id, {
          account_name: form.account_name,
          ...(form.access_token ? { access_token: form.access_token } : {}),
          ...(form.refresh_token ? { refresh_token: form.refresh_token } : {}),
          expires_at: form.expires_at,
          status: form.status,
          metadata: form.metadata,
        });
      } else {
        await criarConta(clienteAtivo.id, form);
      }
      setModalAberto(false);
      await recarregar();
    } catch (e: any) {
      setErroForm(e?.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(c: TrafegoConta) {
    if (!confirm(`Desconectar ${c.accountName || c.accountId}? Os dados sincronizados serão perdidos.`)) return;
    try {
      await removerConta(c.id);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao remover');
    }
  }

  if (!clienteAtivo) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-amber-900">Selecione um cliente no topo pra ver as contas conectadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
          <Plug className="w-6 h-6 text-violet-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">Contas conectadas</h2>
          <p className="text-xs text-slate-500">
            Plataformas vinculadas a <strong>{clienteAtivo.nome}</strong> · {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
          </p>
        </div>
        <button
          onClick={() => recarregar()}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-700 disabled:opacity-50"
          title="Recarregar"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" /> Conectar nova
        </button>
      </div>

      {/* Aviso modo manual */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-3 text-xs text-blue-900">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Modo cadastro manual</p>
          <p>O OAuth automático (Meta/Google/TikTok) chega no <strong>Sprint 2</strong>. Por enquanto cole os tokens manualmente via Graph API Explorer (Meta) ou OAuth Playground (Google).</p>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {erro}
        </div>
      )}

      {/* Lista por grupo */}
      {loading && contas.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Carregando contas...
        </div>
      ) : contas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Plug className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600 mb-3">Nenhuma conta conectada ainda pra <strong>{clienteAtivo.nome}</strong></p>
          <button onClick={abrirNovo} className="text-sm font-semibold text-violet-600 hover:underline">
            Conectar a primeira plataforma →
          </button>
        </div>
      ) : (
        GRUPOS.filter(g => grupos[g]?.length).map(g => (
          <section key={g} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-600">{g}</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {grupos[g].map(c => {
                const info = PLATAFORMAS.find(p => p.id === c.plataforma);
                const Icon = info?.icon || Globe;
                return (
                  <li key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${info?.cor || 'text-slate-500 bg-slate-100'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {c.accountName || info?.label || c.plataforma}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {info?.label} · ID: {c.accountId}
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                      c.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'expirado' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {c.status}
                    </span>
                    <button onClick={() => abrirEdit(c)} className="text-xs font-semibold text-slate-600 hover:text-violet-600 px-2 py-1">
                      Editar
                    </button>
                    <button onClick={() => remover(c)} className="text-slate-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {/* Modal cadastro/edit */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                {editando ? 'Editar conta' : 'Conectar nova conta'}
              </h3>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Plataforma */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Plataforma</label>
                <select
                  value={form.plataforma}
                  onChange={e => setForm({...form, plataforma: e.target.value})}
                  disabled={!!editando}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                >
                  {GRUPOS.map(g => (
                    <optgroup key={g} label={g}>
                      {PLATAFORMAS.filter(p => p.grupo === g).map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Account ID *</label>
                <input
                  type="text"
                  value={form.account_id}
                  onChange={e => setForm({...form, account_id: e.target.value})}
                  placeholder="ex: act_123456789 (Meta), properties/123 (GA4)"
                  disabled={!!editando}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Nome amigável</label>
                <input
                  type="text"
                  value={form.account_name}
                  onChange={e => setForm({...form, account_name: e.target.value})}
                  placeholder="ex: CDS Industrial — Conta Meta principal"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Access Token {editando && <span className="text-slate-400 font-normal">(deixe vazio pra manter o atual)</span>}
                </label>
                <textarea
                  value={form.access_token}
                  onChange={e => setForm({...form, access_token: e.target.value})}
                  placeholder="Cole o token aqui"
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({...form, status: e.target.value as any})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="ativo">Ativo</option>
                  <option value="expirado">Expirado</option>
                  <option value="desconectado">Desconectado</option>
                  <option value="erro">Erro</option>
                </select>
              </div>

              {erroForm && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {erroForm}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                {editando ? 'Salvar alterações' : 'Conectar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
