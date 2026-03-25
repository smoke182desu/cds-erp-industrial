// =================================================================
//  Licitacoes.tsx  –  Módulo B2G do ERP CDS Industrial
//  Integração em tempo-real com o PNCP (Portal Nacional de
//  Contratações Públicas) + Kanban persistente em localStorage
// =================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Filter, ExternalLink, RefreshCw, ChevronLeft, ChevronRight,
  MapPin, Calendar, DollarSign, Tag, Briefcase, Building2, AlertCircle,
  Loader2, Plus, X, ClipboardList, Globe,
  CheckCircle2, Clock, Info, TrendingUp, AlertTriangle, Trophy,
} from 'lucide-react';
import {
  buscarLicitacoes, ContratacaoPNCP, BuscaPNCPParams,
  MODALIDADES, UFS_BR, PALAVRAS_CHAVE_SUGERIDAS,
  formatarDataPNCP, formatarMoeda, urlPNCP,
} from '../services/LicitacoesService';
import { LicitacaoWorkspace } from '../components/licitacoes/LicitacaoWorkspace';
import {
  useLicitacoesState, EtapaLicitacao, LicitacaoTracked, LicitacaoManualData,
} from '../hooks/useLicitacoesState';

// ── Constantes ─────────────────────────────────────────────────────

const ETAPAS: { id: EtapaLicitacao; label: string; color: string; icon: string }[] = [
  { id: 'captacao', label: 'Captação',         color: 'bg-slate-100 border-slate-300 text-slate-700',    icon: '🔍' },
  { id: 'analise',  label: 'Análise do Edital', color: 'bg-blue-50 border-blue-200 text-blue-700',        icon: '📋' },
  { id: 'proposta', label: 'Montando Proposta', color: 'bg-amber-50 border-amber-200 text-amber-700',     icon: '✍️' },
  { id: 'disputa',  label: 'Em Disputa',        color: 'bg-indigo-50 border-indigo-200 text-indigo-700',  icon: '⚔️' },
  { id: 'ganha',    label: '🏆 Ganhas',          color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: '🏆' },
];

// ── Badge de modalidade ────────────────────────────────────────────

const ModalidadeBadge: React.FC<{ id: number }> = ({ id }) => {
  const cores: Record<number, string> = {
    6: 'bg-blue-100 text-blue-700',
    8: 'bg-amber-100 text-amber-700',
    5: 'bg-indigo-100 text-indigo-700',
    4: 'bg-purple-100 text-purple-700',
    9: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cores[id] ?? 'bg-slate-100 text-slate-600'}`}>
      {MODALIDADES[id] ?? `Modalidade ${id}`}
    </span>
  );
};

// ── Card de resultado de busca ─────────────────────────────────────

const LicitacaoCard: React.FC<{
  item: ContratacaoPNCP;
  onAcompanhar: () => void;
  onDetalhar: () => void;
  acompanhando: boolean;
}> = ({ item, onAcompanhar, onDetalhar, acompanhando }) => {
  const dias =
    item.dataEncerramentoProposta
      ? Math.ceil((new Date(item.dataEncerramentoProposta).getTime() - Date.now()) / 86_400_000)
      : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{item.objetoCompra}</p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Building2 size={11} /> {item.orgaoEntidade.razaoSocial}
          </p>
        </div>
        <ModalidadeBadge id={item.modalidadeId} />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <MapPin size={11} />
          {item.unidadeOrgao.municipioNome} – {item.unidadeOrgao.ufSigla}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={11} /> Pub: {formatarDataPNCP(item.dataPublicacaoPncp)}
        </span>
        {item.dataEncerramentoProposta && (
          <span className={`flex items-center gap-1 font-semibold ${
            dias != null && dias <= 3 ? 'text-rose-600' :
            dias != null && dias <= 7 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            <Clock size={11} />
            Enc: {formatarDataPNCP(item.dataEncerramentoProposta)}
            {dias != null && dias >= 0 && ` (${dias}d)`}
            {dias != null && dias <= 3 && <AlertTriangle size={11} />}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
          <DollarSign size={13} /> {formatarMoeda(item.valorTotalEstimado)}
        </span>
        <span className="text-xs text-slate-400 font-mono">{item.numeroControlePNCP.slice(-12)}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onAcompanhar}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
            acompanhando
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {acompanhando
            ? <><CheckCircle2 size={13} /> Acompanhando</>
            : <><Plus size={13} /> Acompanhar</>}
        </button>
        <button
          onClick={onDetalhar}
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          title="Ver detalhes"
        >
          <Info size={13} />
        </button>
        <a
          href={urlPNCP(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          title="Abrir no PNCP"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
};

// ── Modal de detalhes ──────────────────────────────────────────────

const DetalheModal: React.FC<{
  item: ContratacaoPNCP;
  onClose: () => void;
  onAcompanhar: () => void;
  acompanhando: boolean;
}> = ({ item, onClose, onAcompanhar, acompanhando }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
      <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <ModalidadeBadge id={item.modalidadeId} />
          <h2 className="text-base font-bold text-slate-900 mt-1 leading-snug max-w-xl">{item.objetoCompra}</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2"><X size={22} /></button>
      </div>

      <div className="overflow-y-auto p-6 space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          {([
            ['Órgão',        item.orgaoEntidade.razaoSocial],
            ['CNPJ Órgão',   item.orgaoEntidade.cnpj],
            ['Unidade',      item.unidadeOrgao.nomeUnidade],
            ['Município/UF', `${item.unidadeOrgao.municipioNome} – ${item.unidadeOrgao.ufSigla}`],
            ['Publicação',   formatarDataPNCP(item.dataPublicacaoPncp)],
            ['Abertura',     formatarDataPNCP(item.dataAberturaProposta)],
            ['Encerramento', formatarDataPNCP(item.dataEncerramentoProposta)],
            ['Situação',     item.situacaoCompraNome],
            ['Valor Est.',   formatarMoeda(item.valorTotalEstimado)],
            ['Nº PNCP',      item.numeroControlePNCP],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400 font-medium">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5 break-words">{value}</p>
            </div>
          ))}
        </div>
        {item.informacaoComplementar && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Informação Complementar</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{item.informacaoComplementar}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
        <a href={urlPNCP(item)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-white transition">
          <Globe size={15} /> Abrir no PNCP
        </a>
        <button
          onClick={() => { onAcompanhar(); onClose(); }}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition ${
            acompanhando ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {acompanhando ? 'Já acompanhando' : <><Plus size={15} /> Adicionar ao Kanban</>}
        </button>
      </div>
    </div>
  </div>
);

// ── Painel de estatísticas ─────────────────────────────────────────

const StatsBar: React.FC<{ stats: ReturnType<typeof useLicitacoesState>['stats'] }> = ({ stats }) => {
  if (stats.total === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {[
        { label: 'Acompanhando', value: stats.total, icon: <ClipboardList size={16} className="text-blue-500" />, bg: 'bg-blue-50 border-blue-200' },
        { label: 'Ganhas', value: stats.ganhas, icon: <Trophy size={16} className="text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-200' },
        { label: 'Urgentes (≤7d)', value: stats.urgentes, icon: <AlertTriangle size={16} className="text-rose-500" />, bg: stats.urgentes > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200' },
        { label: 'Valor em Disputa', value: formatarMoeda(stats.valorTotal), icon: <TrendingUp size={16} className="text-indigo-500" />, bg: 'bg-indigo-50 border-indigo-200', wide: true },
      ].map(s => (
        <div key={s.label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.bg}`}>
          {s.icon}
          <div>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-base font-bold text-slate-900">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// =================================================================
//  COMPONENTE PRINCIPAL
// =================================================================

export const Licitacoes: React.FC = () => {
  const [aba, setAba] = useState<'busca' | 'gestao'>('busca');

  // ── Estado persistente (hook) ────────────────────────────────────
  const {
    tracked, extras, getExtra, setExtra,
    acompanhar, isTracked, moverEtapa, removerTracked, adicionarManual, stats,
  } = useLicitacoesState();

  // ── Estado de busca ──────────────────────────────────────────────
  const [keyword,           setKeyword]           = useState('');
  const [ufFiltro,          setUfFiltro]          = useState('');
  const [modalidadeFiltro,  setModalidadeFiltro]  = useState<number | ''>('');
  const [apenasAbertas,     setApenasAbertas]     = useState(true);
  const [pagina,            setPagina]            = useState(1);
  const [loading,           setLoading]           = useState(false);
  const [resultados,        setResultados]        = useState<ContratacaoPNCP[]>([]);
  const [totalRegistros,    setTotalRegistros]    = useState(0);
  const [totalPaginas,      setTotalPaginas]      = useState(0);
  const [erroApi,           setErroApi]           = useState('');
  const [jaConsultou,       setJaConsultou]       = useState(false);
  const [mostraSugestoes,   setMostraSugestoes]   = useState(false);

  // ── Estado de UI ─────────────────────────────────────────────────
  const [workspaceAberto,   setWorkspaceAberto]   = useState<LicitacaoTracked | null>(null);
  const [detalheItem,       setDetalheItem]       = useState<ContratacaoPNCP | null>(null);
  const [modalManualAberto, setModalManualAberto] = useState(false);
  const [formManual,        setFormManual]        = useState<LicitacaoManualData>({
    titulo: '', orgao: '', numeroEdital: '', modalidade: 'Pregão Eletrônico', objeto: '',
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Busca ────────────────────────────────────────────────────────

  const handleBuscar = useCallback(async (pg = 1, kw?: string) => {
    setLoading(true);
    setErroApi('');
    setJaConsultou(true);
    setPagina(pg);

    const params: BuscaPNCPParams = {
      q: kw ?? keyword,
      uf: ufFiltro || undefined,
      modalidadeId: modalidadeFiltro ? Number(modalidadeFiltro) : undefined,
      pagina: pg,
      tamanhoPagina: 20,
      apenasAbertas,
    };

    const res = await buscarLicitacoes(params);
    setResultados(res.data);
    setTotalRegistros(res.totalRegistros);
    setTotalPaginas(res.totalPaginas);
    if (res.erro) setErroApi(res.erro);
    setLoading(false);
  }, [keyword, ufFiltro, modalidadeFiltro, apenasAbertas]);

  // Busca automática ao entrar na aba pela primeira vez
  // Passa o keyword explicitamente para evitar bug de timing do React
  useEffect(() => {
    if (aba === 'busca' && !jaConsultou) {
      const kw = 'estrutura metálica';
      setKeyword(kw);
      handleBuscar(1, kw);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  // Sincroniza workspaceAberto com dados atualizados do tracked
  useEffect(() => {
    if (workspaceAberto) {
      const atualizado = tracked.find(t => t.numeroControlePNCP === workspaceAberto.numeroControlePNCP);
      if (atualizado) setWorkspaceAberto(atualizado);
    }
  }, [tracked]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-slate-50">

      {/* ── Cabeçalho ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase size={22} className="text-blue-600" /> Licitações B2G
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Portal Nacional de Contratações Públicas (PNCP) – dados em tempo real
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
            <Globe size={13} className="text-emerald-600" />
            <span className="text-emerald-700 font-medium">API PNCP conectada</span>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1">
          {[
            { id: 'busca',  label: 'Buscar Oportunidades',
              icon: <Search size={15} /> },
            { id: 'gestao', label: `Gestão / Kanban${stats.total > 0 ? ` (${stats.total})` : ''}`,
              icon: <ClipboardList size={15} />,
              badge: stats.urgentes > 0 ? stats.urgentes : undefined },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setAba(tab.id as 'busca' | 'gestao')}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                aba === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.badge && (
                <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white text-xs rounded-full font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          ABA: BUSCA
      ════════════════════════════════════════════════════════ */}
      {aba === 'busca' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Estatísticas resumidas */}
          <StatsBar stats={stats} />

          {/* Painel de filtros */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">

              {/* Palavra-chave */}
              <div className="md:col-span-2 relative">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Palavra-chave no objeto
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onFocus={() => setMostraSugestoes(true)}
                    onBlur={() => setTimeout(() => setMostraSugestoes(false), 200)}
                    onKeyDown={e => e.key === 'Enter' && handleBuscar(1)}
                    placeholder="Ex: estrutura metálica, portão, galpão..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {mostraSugestoes && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                      {PALAVRAS_CHAVE_SUGERIDAS.map(s => (
                        <button
                          key={s}
                          onMouseDown={() => { setKeyword(s); setMostraSugestoes(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                        >
                          <Tag size={12} className="text-blue-400 shrink-0" /> {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* UF */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Estado (UF)</label>
                <select
                  value={ufFiltro}
                  onChange={e => setUfFiltro(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">Todos</option>
                  {UFS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>

              {/* Modalidade */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Modalidade</label>
                <select
                  value={modalidadeFiltro}
                  onChange={e => setModalidadeFiltro(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">Todas</option>
                  {Object.entries(MODALIDADES).map(([id, nome]) => (
                    <option key={id} value={id}>{nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={apenasAbertas}
                  onChange={e => setApenasAbertas(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="font-medium text-slate-700">Apenas com proposta aberta</span>
              </label>
              <button
                onClick={() => handleBuscar(1)}
                disabled={loading}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? 'Buscando...' : 'Buscar no PNCP'}
              </button>
            </div>
          </div>

          {/* Erro */}
          {erroApi && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-sm text-red-700">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-bold">Erro ao consultar a API do PNCP</p>
                <p className="text-xs mt-1 opacity-80">{erroApi}</p>
                <p className="text-xs mt-1">Verifique sua conexão ou tente novamente em instantes.</p>
              </div>
            </div>
          )}

          {/* Resultados */}
          {jaConsultou && !loading && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">
                  {totalRegistros > 0 ? (
                    <><span className="text-blue-600">{totalRegistros.toLocaleString('pt-BR')}</span> resultado(s) encontrado(s)</>
                  ) : 'Nenhum resultado encontrado'}
                </p>
                <button
                  onClick={() => handleBuscar(pagina)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <RefreshCw size={13} /> Atualizar
                </button>
              </div>

              {resultados.length === 0 && !erroApi && (
                <div className="text-center py-16 text-slate-400">
                  <Search size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma licitação encontrada</p>
                  <p className="text-sm mt-1">Tente outras palavras-chave ou desmarque o filtro de propostas abertas</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {resultados.map(item => (
                  <LicitacaoCard
                    key={item.numeroControlePNCP}
                    item={item}
                    onAcompanhar={() => acompanhar(item)}
                    onDetalhar={() => setDetalheItem(item)}
                    acompanhando={isTracked(item.numeroControlePNCP)}
                  />
                ))}
              </div>

              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => handleBuscar(pagina - 1)}
                    disabled={pagina <= 1 || loading}
                    className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span className="text-sm text-slate-600 font-medium">
                    Página {pagina} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => handleBuscar(pagina + 1)}
                    disabled={pagina >= totalPaginas || loading}
                    className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
                  >
                    Próxima <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {!jaConsultou && !loading && (
            <div className="text-center py-20 text-slate-400">
              <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold">Busque licitações no PNCP</p>
              <p className="text-sm mt-1">Use os filtros acima e clique em <strong>Buscar no PNCP</strong></p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
              <Loader2 size={36} className="animate-spin text-blue-500" />
              <p className="font-medium">Consultando o Portal Nacional de Contratações Públicas...</p>
              <p className="text-xs">api.pncp.gov.br</p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ABA: GESTÃO (KANBAN)
      ════════════════════════════════════════════════════════ */}
      {aba === 'gestao' && (
        <div className="flex-1 overflow-auto p-6">
          {tracked.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-24">
              <ClipboardList size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-semibold">Nenhuma licitação sendo acompanhada</p>
              <p className="text-sm mt-1">
                Vá até <strong>Buscar Oportunidades</strong> e clique em <strong>Acompanhar</strong>,<br />
                ou adicione uma licitação manualmente abaixo.
              </p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setAba('busca')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                  <Search size={15} /> Buscar no PNCP
                </button>
                <button onClick={() => setModalManualAberto(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                  <Plus size={15} /> Adicionar Manualmente
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mini stats + botão manual */}
              <div className="flex gap-3 mb-4 flex-wrap items-center">
                <span className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-600 font-medium">
                  Total: <strong>{stats.total}</strong>
                </span>
                <span className="text-xs bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-emerald-700 font-medium">
                  Ganhas: <strong>{stats.ganhas}</strong>
                </span>
                {stats.urgentes > 0 && (
                  <span className="text-xs bg-rose-50 border border-rose-200 rounded-full px-3 py-1 text-rose-700 font-medium animate-pulse">
                    ⚠️ {stats.urgentes} licitação(ões) com prazo urgente!
                  </span>
                )}
                <span className="text-xs bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 text-indigo-700 font-medium">
                  Valor total: <strong>{formatarMoeda(stats.valorTotal)}</strong>
                </span>
                <div className="ml-auto">
                  <button onClick={() => setModalManualAberto(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-sm">
                    <Plus size={13} /> Adicionar Licitação Manual
                  </button>
                </div>
              </div>

              {/* Colunas do Kanban */}
              <div className="flex gap-4 min-w-max pb-2">
                {ETAPAS.map(etapa => {
                  const cards = tracked.filter(t => t.etapa === etapa.id);
                  return (
                    <div key={etapa.id} className={`w-72 rounded-xl border ${etapa.color} p-3 flex flex-col`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm">{etapa.label}</h3>
                        <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded-full">{cards.length}</span>
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[65vh] pr-0.5">
                        {cards.map(card => {
                          const ex = getExtra(card.numeroControlePNCP);
                          const pct = ex.checklist.length > 0
                            ? Math.round((ex.checklist.filter(c => c.feito).length / ex.checklist.length) * 100)
                            : 0;
                          const dias = card.dataEncerramentoProposta
                            ? Math.ceil((new Date(card.dataEncerramentoProposta).getTime() - Date.now()) / 86_400_000)
                            : null;
                          const urgente = dias != null && dias >= 0 && dias <= 7;

                          return (
                            <div
                              key={card.numeroControlePNCP}
                              className={`bg-white rounded-lg border p-3 shadow-sm ${urgente ? 'border-rose-300' : 'border-white/80'}`}
                            >
                              {urgente && (
                                <div className="flex items-center gap-1 text-xs text-rose-600 font-bold mb-1">
                                  <AlertTriangle size={11} /> Prazo em {dias}d
                                </div>
                              )}
                              <p className="text-xs font-bold text-slate-900 line-clamp-2 mb-1">{card.objetoCompra}</p>
                              <p className="text-xs text-slate-500 mb-1">{card.orgaoEntidade.razaoSocial}</p>
                              <p className="text-xs font-bold text-emerald-600 mb-2">{formatarMoeda(card.valorTotalEstimado)}</p>

                              {/* Progresso checklist */}
                              <div className="mb-2">
                                <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                                  <span>Checklist</span>
                                  <span className={pct === 100 ? 'text-emerald-600 font-bold' : ''}>{pct}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-400'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>

                              {/* Mover etapa */}
                              <select
                                value={card.etapa}
                                onChange={e => moverEtapa(card.numeroControlePNCP, e.target.value as EtapaLicitacao)}
                                className="w-full text-xs border border-slate-200 rounded px-2 py-1 mb-2 bg-white"
                              >
                                {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
                              </select>

                              {/* Ações */}
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setWorkspaceAberto(card)}
                                  className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-600 text-white rounded py-1 hover:bg-blue-700 transition"
                                >
                                  <ClipboardList size={11} /> Abrir
                                </button>
                                <a
                                  href={urlPNCP(card)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                                  title="Ver no PNCP"
                                >
                                  <ExternalLink size={11} />
                                </a>
                                <button
                                  onClick={() => removerTracked(card.numeroControlePNCP)}
                                  className="px-2 py-1 text-xs border border-rose-200 rounded text-rose-500 hover:bg-rose-50"
                                  title="Remover do kanban"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Workspace de licitação ── */}
      {workspaceAberto && (
        <LicitacaoWorkspace
          item={workspaceAberto}
          extra={getExtra(workspaceAberto.numeroControlePNCP)}
          onChangeExtra={patch => setExtra(workspaceAberto.numeroControlePNCP, patch)}
          onClose={() => setWorkspaceAberto(null)}
        />
      )}

      {/* ── Modal de detalhes ── */}
      {detalheItem && (
        <DetalheModal
          item={detalheItem}
          onClose={() => setDetalheItem(null)}
          onAcompanhar={() => acompanhar(detalheItem)}
          acompanhando={isTracked(detalheItem.numeroControlePNCP)}
        />
      )}

      {/* ── Modal: Adicionar Licitação Manual ── */}
      {modalManualAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 pt-5 pb-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Licitação Manual</p>
                <h2 className="text-base font-bold text-slate-900">Adicionar ao Kanban</h2>
              </div>
              <button onClick={() => setModalManualAberto(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Título / Objeto */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Título da Licitação *</label>
                <input value={formManual.titulo} onChange={e => setFormManual(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Pregão para aquisição de portões metálicos"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Objeto / Descrição</label>
                <textarea value={formManual.objeto} onChange={e => setFormManual(p => ({ ...p, objeto: e.target.value }))}
                  rows={2} placeholder="Descrição detalhada do objeto..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>

              {/* Órgão + Nº Edital */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Órgão Licitante *</label>
                  <input value={formManual.orgao} onChange={e => setFormManual(p => ({ ...p, orgao: e.target.value }))}
                    placeholder="Ex: Prefeitura de Brasília"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nº do Edital</label>
                  <input value={formManual.numeroEdital} onChange={e => setFormManual(p => ({ ...p, numeroEdital: e.target.value }))}
                    placeholder="Ex: PE 045/2026"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Modalidade + Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Modalidade</label>
                  <select value={formManual.modalidade} onChange={e => setFormManual(p => ({ ...p, modalidade: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    {Object.values({ 6: 'Pregão Eletrônico', 7: 'Pregão Presencial', 8: 'Dispensa Eletrônica', 4: 'Concorrência', 5: 'Concorrência Eletrônica', 9: 'Inexigibilidade', 3: 'Concurso', 12: 'Credenciamento' }).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Valor Estimado (R$)</label>
                  <input type="number" value={formManual.valorEstimado ?? ''} onChange={e => setFormManual(p => ({ ...p, valorEstimado: parseFloat(e.target.value) || undefined }))}
                    placeholder="0,00"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Data de Abertura</label>
                  <input type="date" value={formManual.dataAbertura ?? ''} onChange={e => setFormManual(p => ({ ...p, dataAbertura: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Data de Encerramento</label>
                  <input type="date" value={formManual.dataEncerramento ?? ''} onChange={e => setFormManual(p => ({ ...p, dataEncerramento: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Observações</label>
                <textarea value={formManual.observacoes ?? ''} onChange={e => setFormManual(p => ({ ...p, observacoes: e.target.value }))}
                  rows={2} placeholder="Notas internas, pontos de atenção..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setModalManualAberto(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button
                disabled={!formManual.titulo || !formManual.orgao}
                onClick={() => {
                  adicionarManual(formManual);
                  setModalManualAberto(false);
                  setFormManual({ titulo: '', orgao: '', numeroEdital: '', modalidade: 'Pregão Eletrônico', objeto: '' });
                  setAba('gestao');
                }}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition">
                Adicionar ao Kanban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
