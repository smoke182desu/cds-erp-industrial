import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, ExternalLink, RefreshCw, ChevronLeft, ChevronRight,
  MapPin, Calendar, DollarSign, Tag, Briefcase, Building2, AlertCircle,
  Loader2, Plus, X, ClipboardList, Globe,
  CheckCircle2, Clock, Info, Settings
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import {
  buscarLicitacoes, ContratacaoPNCP, BuscaPNCPParams,
  MODALIDADES, UFS_BR, PALAVRAS_CHAVE_SUGERIDAS,
  formatarDataPNCP, formatarMoeda, urlPNCP,
} from '../services/LicitacoesService';
import { LicitacaoWorkspace, LicitacaoExtra, defaultExtra } from '../components/licitacoes/LicitacaoWorkspace';

// ── Tipos locais ─────────────────────────────────────────────────

interface LicitacaoTracked extends ContratacaoPNCP {
  etapa: 'captacao' | 'analise' | 'proposta' | 'disputa' | 'ganha';
}

const ETAPAS = [
  { id: 'captacao', label: 'Captação', color: 'bg-slate-100 border-slate-300 text-slate-700' },
  { id: 'analise',  label: 'Análise do Edital', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'proposta', label: 'Montando Proposta', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'disputa',  label: 'Em Disputa', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { id: 'ganha',    label: '🏆 Ganhas', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
] as const;

// ── Componente: Badge de modalidade ─────────────────────────────

const ModalidadeBadge: React.FC<{ id: number }> = ({ id }) => {
  const cores: Record<number, string> = {
    6: 'bg-blue-100 text-blue-700',
    8: 'bg-amber-100 text-amber-700',
    5: 'bg-indigo-100 text-indigo-700',
    4: 'bg-purple-100 text-purple-700',
    9: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cores[id] || 'bg-slate-100 text-slate-600'}`}>
      {MODALIDADES[id] || `Modalidade ${id}`}
    </span>
  );
};

// ── Componente: Card de licitação ────────────────────────────────

const LicitacaoCard: React.FC<{
  item: ContratacaoPNCP;
  onAcompanhar: (item: ContratacaoPNCP) => void;
  onDetalhar: (item: ContratacaoPNCP) => void;
  acompanhando: boolean;
}> = ({ item, onAcompanhar, onDetalhar, acompanhando }) => {
  const diasRestantes = item.dataEncerramentoProposta
    ? Math.ceil((new Date(item.dataEncerramentoProposta).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{item.objetoCompra}</p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Building2 size={11} />
            {item.orgaoEntidade.razaoSocial}
          </p>
        </div>
        <ModalidadeBadge id={item.modalidadeId} />
      </div>

      {/* Localidade + datas */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <MapPin size={11} />
          {item.unidadeOrgao.municipioNome} — {item.unidadeOrgao.ufSigla}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          Publicado: {formatarDataPNCP(item.dataPublicacaoPncp)}
        </span>
        {item.dataEncerramentoProposta && (
          <span className={`flex items-center gap-1 font-semibold ${
            diasRestantes != null && diasRestantes <= 3 ? 'text-rose-600' :
            diasRestantes != null && diasRestantes <= 7 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            <Clock size={11} />
            Encerra: {formatarDataPNCP(item.dataEncerramentoProposta)}
            {diasRestantes != null && diasRestantes >= 0 && ` (${diasRestantes}d)`}
          </span>
        )}
      </div>

      {/* Valor estimado */}
      <div className="flex items-center justify-between mb-4">
        <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
          <DollarSign size={13} />
          {formatarMoeda(item.valorTotalEstimado)}
        </span>
        <span className="text-xs text-slate-400 font-mono">{item.numeroControlePNCP.slice(-12)}</span>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={() => onAcompanhar(item)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
            acompanhando
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {acompanhando ? <><CheckCircle2 size={13} /> Acompanhando</> : <><Plus size={13} /> Acompanhar</>}
        </button>
        <button
          onClick={() => onDetalhar(item)}
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <Info size={13} />
        </button>
        <a
          href={urlPNCP(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
};

// ── Componente: Modal de detalhes ────────────────────────────────

const DetalheModal: React.FC<{ item: ContratacaoPNCP; onClose: () => void; onAcompanhar: () => void; acompanhando: boolean }> = ({
  item, onClose, onAcompanhar, acompanhando
}) => (
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
        {/* Grid de dados */}
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Órgão',        item.orgaoEntidade.razaoSocial],
            ['CNPJ Órgão',   item.orgaoEntidade.cnpj],
            ['Unidade',      item.unidadeOrgao.nomeUnidade],
            ['Município/UF', `${item.unidadeOrgao.municipioNome} — ${item.unidadeOrgao.ufSigla}`],
            ['Publicação',   formatarDataPNCP(item.dataPublicacaoPncp)],
            ['Abertura',     formatarDataPNCP(item.dataAberturaProposta)],
            ['Encerramento', formatarDataPNCP(item.dataEncerramentoProposta)],
            ['Situação',     item.situacaoCompraNome],
            ['Valor Est.',   formatarMoeda(item.valorTotalEstimado)],
            ['Nº PNCP',      item.numeroControlePNCP],
          ].map(([label, value]) => (
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
        <button onClick={() => { onAcompanhar(); onClose(); }}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition ${
            acompanhando ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
          {acompanhando ? 'Já acompanhando' : <><Plus size={15} /> Adicionar ao Kanban</>}
        </button>
      </div>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════

export const Licitacoes: React.FC = () => {
  const { config } = useConfig();
  const [aba, setAba] = useState<'busca' | 'gestao'>('busca');

  // ── Estado de busca ───────────────────────────────────────────
  const [keyword, setKeyword] = useState('');
  const [ufFiltro, setUfFiltro] = useState('');
  const [modalidadeFiltro, setModalidadeFiltro] = useState<number | ''>('');
  const [apenasAbertas, setApenasAbertas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ContratacaoPNCP[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [erroApi, setErroApi] = useState('');
  const [jaConsultou, setJaConsultou] = useState(false);

  // ── Estado de gestão (kanban) ─────────────────────────────────
  const [tracked, setTracked] = useState<LicitacaoTracked[]>([]);
  const [extras, setExtras] = useState<Record<string, LicitacaoExtra>>({});
  const [workspaceAberto, setWorkspaceAberto] = useState<LicitacaoTracked | null>(null);
  const [detalheItem, setDetalheItem] = useState<ContratacaoPNCP | null>(null);
  const [mostraSugestoes, setMostraSugestoes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getExtra = (id: string): LicitacaoExtra => extras[id] ?? defaultExtra();
  const setExtra = (id: string, patch: Partial<LicitacaoExtra>) =>
    setExtras(prev => ({ ...prev, [id]: { ...getExtra(id), ...patch } }));

  // ── Buscar ────────────────────────────────────────────────────
  const handleBuscar = async (pg = 1) => {
    setLoading(true);
    setErroApi('');
    setJaConsultou(true);
    setPagina(pg);

    const params: BuscaPNCPParams & { apenasAbertas?: boolean } = {
      q: keyword,
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
  };

  // Busca automática ao entrar na aba com sugestão do negócio
  useEffect(() => {
    if (aba === 'busca' && !jaConsultou) {
      setKeyword('estrutura metálica');
      handleBuscar();
    }
  }, [aba]);

  // ── Acompanhar licitação ──────────────────────────────────────
  const acompanhar = (item: ContratacaoPNCP) => {
    if (tracked.find(t => t.numeroControlePNCP === item.numeroControlePNCP)) {
      setTracked(prev => prev.filter(t => t.numeroControlePNCP !== item.numeroControlePNCP));
      return;
    }
    const novo: LicitacaoTracked = { ...item, etapa: 'captacao' };
    setTracked(prev => [...prev, novo]);
    // Inicializa extras com checklist padrão
    setExtras(prev => ({ ...prev, [item.numeroControlePNCP]: defaultExtra() }));
  };

  const isTracked = (id: string) => tracked.some(t => t.numeroControlePNCP === id);

  const moverEtapa = (id: string, etapa: LicitacaoTracked['etapa']) => {
    setTracked(prev => prev.map(t => t.numeroControlePNCP === id ? { ...t, etapa } : t));
  };

  const removerTracked = (id: string) => setTracked(prev => prev.filter(t => t.numeroControlePNCP !== id));

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-50">

      {/* ── Cabeçalho ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase size={22} className="text-blue-600" /> Licitações B2G
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Portal Nacional de Contratações Públicas (PNCP) — dados em tempo real</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
            <Globe size={13} className="text-emerald-600" />
            <span className="text-emerald-700 font-medium">API PNCP conectada</span>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1">
          {[
            { id: 'busca',  label: 'Buscar Oportunidades', icon: <Search size={15} /> },
            { id: 'gestao', label: `Gestão / Kanban ${tracked.length > 0 ? `(${tracked.length})` : ''}`, icon: <ClipboardList size={15} /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id as 'busca' | 'gestao')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                aba === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ABA: BUSCA
      ══════════════════════════════════════════════════════════ */}
      {aba === 'busca' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Painel de filtros */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">

              {/* Palavra-chave */}
              <div className="md:col-span-2 relative">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Palavra-chave no objeto</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onFocus={() => setMostraSugestoes(true)}
                    onBlur={() => setTimeout(() => setMostraSugestoes(false), 200)}
                    onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                    placeholder="Ex: estrutura metálica, portão, galpão..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {mostraSugestoes && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                      {PALAVRAS_CHAVE_SUGERIDAS.map(s => (
                        <button key={s} onMouseDown={() => { setKeyword(s); setMostraSugestoes(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2">
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
                <select value={ufFiltro} onChange={e => setUfFiltro(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm">
                  <option value="">Todos</option>
                  {UFS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>

              {/* Modalidade */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Modalidade</label>
                <select value={modalidadeFiltro} onChange={e => setModalidadeFiltro(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm">
                  <option value="">Todas</option>
                  {Object.entries(MODALIDADES).map(([id, nome]) => (
                    <option key={id} value={id}>{nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={apenasAbertas} onChange={e => setApenasAbertas(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600" />
                <span className="font-medium text-slate-700">Apenas com proposta aberta</span>
              </label>
              <button onClick={() => handleBuscar(1)} disabled={loading}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition shadow-sm">
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
                    <><span className="text-blue-600">{totalRegistros.toLocaleString('pt-BR')}</span> resultado(s) encontrados</>
                  ) : 'Nenhum resultado encontrado'}
                </p>
                <button onClick={() => handleBuscar(pagina)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                  <RefreshCw size={13} /> Atualizar
                </button>
              </div>

              {resultados.length === 0 && !erroApi && (
                <div className="text-center py-16 text-slate-400">
                  <Search size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma licitação encontrada</p>
                  <p className="text-sm mt-1">Tente outras palavras-chave ou ampliar o período</p>
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
                  <button onClick={() => handleBuscar(pagina - 1)} disabled={pagina <= 1 || loading}
                    className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span className="text-sm text-slate-600 font-medium">
                    Página {pagina} de {totalPaginas}
                  </span>
                  <button onClick={() => handleBuscar(pagina + 1)} disabled={pagina >= totalPaginas || loading}
                    className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50">
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
              <p className="text-xs">API: api.pncp.gov.br</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ABA: GESTÃO (KANBAN)
      ══════════════════════════════════════════════════════════ */}
      {aba === 'gestao' && (
        <div className="flex-1 overflow-x-auto p-6">
          {tracked.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-24">
              <ClipboardList size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-semibold">Nenhuma licitação sendo acompanhada</p>
              <p className="text-sm mt-1">Vá até a aba <strong>Buscar Oportunidades</strong> e clique em <strong>Acompanhar</strong> nas licitações de interesse</p>
              <button onClick={() => setAba('busca')}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                <Search size={15} /> Buscar Licitações
              </button>
            </div>
          ) : (
            <div className="flex gap-4 h-full min-w-max">
              {ETAPAS.map(etapa => {
                const cards = tracked.filter(t => t.etapa === etapa.id);
                return (
                  <div key={etapa.id} className={`w-72 rounded-xl border ${etapa.color} p-3 flex flex-col`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm">{etapa.label}</h3>
                      <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded-full">{cards.length}</span>
                    </div>
                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[60vh] pr-0.5">
                      {cards.map(card => {
                      const ex = getExtra(card.numeroControlePNCP);
                      const pct = ex.checklist.length > 0
                        ? Math.round((ex.checklist.filter(c => c.feito).length / ex.checklist.length) * 100) : 0;
                      return (
                        <div key={card.numeroControlePNCP} className="bg-white rounded-lg border border-white/80 p-3 shadow-sm">
                          <p className="text-xs font-bold text-slate-900 line-clamp-2 mb-1">{card.objetoCompra}</p>
                          <p className="text-xs text-slate-500 mb-1">{card.orgaoEntidade.razaoSocial}</p>
                          <p className="text-xs font-bold text-emerald-600 mb-2">{formatarMoeda(card.valorTotalEstimado)}</p>

                          {/* Barra de progresso checklist */}
                          <div className="mb-2">
                            <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                              <span>Checklist</span><span className={pct===100?'text-emerald-600 font-bold':''}>{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct===100?'bg-emerald-500':'bg-blue-400'}`} style={{width:`${pct}%`}} />
                            </div>
                          </div>

                          <select value={card.etapa}
                            onChange={e => moverEtapa(card.numeroControlePNCP, e.target.value as LicitacaoTracked['etapa'])}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1 mb-2">
                            {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                          </select>

                          <div className="flex gap-1">
                            <button onClick={() => setWorkspaceAberto(card)}
                              className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-600 text-white rounded py-1 hover:bg-blue-700 transition">
                              <ClipboardList size={11} /> Abrir
                            </button>
                            <a href={urlPNCP(card)} target="_blank" rel="noopener noreferrer"
                              className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50">
                              <ExternalLink size={11} />
                            </a>
                            <button onClick={() => removerTracked(card.numeroControlePNCP)}
                              className="px-2 py-1 text-xs border border-rose-200 rounded text-rose-500 hover:bg-rose-50">
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
          )}
        </div>
      )}

      {/* Workspace de licitação */}
      {workspaceAberto && (
        <LicitacaoWorkspace
          item={workspaceAberto}
          extra={getExtra(workspaceAberto.numeroControlePNCP)}
          onChangeExtra={patch => setExtra(workspaceAberto.numeroControlePNCP, patch)}
          onClose={() => setWorkspaceAberto(null)}
        />
      )}

      {/* Modal de detalhes */}
      {detalheItem && (
        <DetalheModal
          item={detalheItem}
          onClose={() => setDetalheItem(null)}
          onAcompanhar={() => acompanhar(detalheItem)}
          acompanhando={isTracked(detalheItem.numeroControlePNCP)}
        />
      )}
    </div>
  );
};
