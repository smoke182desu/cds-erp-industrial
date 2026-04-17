import { useState, useEffect, useCallback, useMemo } from 'react';
import { buscarProdutos, fmtPreco } from '../services/produtosService';
import {
  RefreshCw, Search, Package, Plus, Edit2, Trash2, X,
  ChevronLeft, ChevronRight, AlertTriangle, Tag, Loader2,
  Info, ExternalLink, CheckCircle,
} from 'lucide-react';

// ── NF-e constants ──────────────────────────────────────────────────────────
const UNIDADES = ['UN','KG','M','M2','M3','CJ','PCT','L','T','H','PAR','ROLO','SET'];
const ORIGEMS  = [
  { v:'0', l:'0 – Nacional' },
  { v:'1', l:'1 – Estrangeira (importação direta)' },
  { v:'2', l:'2 – Estrangeira (mercado interno)' },
  { v:'3', l:'3 – Nacional (>40% importado)' },
  { v:'4', l:'4 – Nacional (prod. básicos)' },
  { v:'5', l:'5 – Nacional (≤40% importado)' },
];
const CSOSNS = [
  { v:'101', l:'101 – Tributada com permissão de crédito' },
  { v:'102', l:'102 – Sem permissão de crédito (padrão MEI)' },
  { v:'103', l:'103 – Isenção do ICMS – Simples Nacional' },
  { v:'400', l:'400 – Não tributada' },
  { v:'500', l:'500 – ICMS cobrado por ST' },
];
const CST_PIS_COFINS = [
  { v:'01', l:'01 – Tributável à alíquota básica' },
  { v:'07', l:'07 – Operação isenta' },
  { v:'49', l:'49 – Outras operações (padrão MEI)' },
  { v:'50', l:'50 – Operação com direito ao crédito' },
  { v:'99', l:'99 – Outras operações' },
];

// ── NCM helpers ──────────────────────────────────────────────────────────────
const rawNcm = (v: string) => v.replace(/\D/g, '').slice(0, 8);
const fmtNcm  = (v: string) => {
  const d = rawNcm(v);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0,4)}.${d.slice(4)}`;
  return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6)}`;
};

// ── Template produto novo ────────────────────────────────────────────────────
const NOVO: Record<string, any> = {
  nome:'', sku:'', categoria:'', descricao:'', imagem:'', tipo:'produto',
  preco:0, precoRegular:0, custo:0, descontoPix:0, prazoProd:0,
  unidade:'UN', peso:0,
  ncm:'', ean:'SEM GTIN', origemMercadoria:'0',
  csosnIcms:'102', aliqIcms:0,
  cfopDentro:'5102', cfopFora:'6102',
  cstPis:'49', aliqPis:0,
  cstCofins:'49', aliqCofins:0,
  gerenciarEstoque:true, estoque:0, estoqueMinimo:0, emEstoque:true, localizacao:'',
  origem:'manual',
};

const POR_PAGINA = 50;

// ── Mini components ──────────────────────────────────────────────────────────
function StatusBadge({ status, emEstoque }: { status?: string; emEstoque?: boolean }) {
  if (status === 'publish' || (!status && emEstoque !== false))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Ativo</span>;
  if (status === 'draft')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Rascunho</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inativo</span>;
}

function OrigemBadge({ origem }: { origem?: string }) {
  if (origem === 'manual')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Manual</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">WooCommerce</span>;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-100">
      <td className="px-4 py-3"><div className="w-10 h-10 bg-gray-200 rounded-lg"/></td>
      <td className="px-4 py-3"><div className="space-y-2"><div className="h-4 w-52 bg-gray-200 rounded"/><div className="h-3 w-28 bg-gray-200 rounded"/></div></td>
      <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded"/></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded ml-auto"/></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full mx-auto"/></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full mx-auto"/></td>
      <td className="px-4 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full mx-auto"/></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded ml-auto"/></td>
    </tr>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function Produtos() {
  const [produtos, setProdutos]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState('');
  const [erro, setErro]           = useState('');
  const [toast, setToast]         = useState('');

  // Filtros
  const [busca, setBusca]               = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroOrigem, setFiltroOrigem]       = useState('');
  const [filtroStatus, setFiltroStatus]       = useState('');

  // Paginação
  const [pagina, setPagina] = useState(1);

  // Modal
  const [modal, setModal]         = useState<'create'|'edit'|null>(null);
  const [editando, setEditando]   = useState<any>(null);
  const [form, setForm]           = useState<any>({ ...NOVO });
  const [abaModal, setAbaModal]   = useState(0);
  const [salvando, setSalvando]   = useState(false);
  const [errosForm, setErrosForm] = useState<string[]>([]);

  // Delete
  const [deletandoId, setDeletandoId] = useState<string|null>(null);

  // ── Carregar ─────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true); setErro('');
    try { setProdutos(await buscarProdutos()); }
    catch (e: any) { setErro(e.message || 'Erro ao carregar produtos'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // ── Sincronizar ───────────────────────────────────────────────────────────
  const sincronizar = async () => {
    setSyncing(true); setSyncMsg('Conectando ao WooCommerce...');
    try {
      const res  = await fetch('/api/produtos?sync=all');
      const data = await res.json();
      if (data.ok) {
        setSyncMsg(`✓ ${data.totalSincronizados} produtos sincronizados`);
        showToast(`${data.totalSincronizados} produtos sincronizados com sucesso`);
        await carregar();
      } else {
        setSyncMsg(`Erro: ${data.error}`);
      }
    } catch (e: any) { setSyncMsg(`Erro: ${e.message}`); }
    finally { setSyncing(false); setTimeout(() => setSyncMsg(''), 5000); }
  };

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3500);
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  const categorias = useMemo(() =>
    [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort()
  , [produtos]);

  const filtrados = useMemo(() => {
    let list = produtos;
    if (busca) {
      const q = busca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      list = list.filter(p => `${p.nome} ${p.sku} ${p.categoria} ${p.descricao}`
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));
    }
    if (filtroCategoria) list = list.filter(p => p.categoria === filtroCategoria);
    if (filtroOrigem)    list = list.filter(p => (p.origem || 'woocommerce') === filtroOrigem);
    if (filtroStatus === 'ativo')       list = list.filter(p => p.status === 'publish' || (!p.status && p.emEstoque !== false));
    if (filtroStatus === 'sem_estoque') list = list.filter(p => p.gerenciarEstoque && p.estoque <= 0);
    return list;
  }, [produtos, busca, filtroCategoria, filtroOrigem, filtroStatus]);

  useEffect(() => { setPagina(1); }, [busca, filtroCategoria, filtroOrigem, filtroStatus]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual  = Math.min(pagina, totalPaginas);
  const inicio       = (paginaAtual - 1) * POR_PAGINA;
  const itensPagina  = filtrados.slice(inicio, inicio + POR_PAGINA);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      produtos.length,
    ativos:     produtos.filter(p => p.status === 'publish' || (!p.status && p.emEstoque !== false)).length,
    manuais:    produtos.filter(p => p.origem === 'manual').length,
    semEstoque: produtos.filter(p => p.gerenciarEstoque && p.estoque <= (p.estoqueMinimo || 0)).length,
  }), [produtos]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const abrirCriacao = () => { setForm({...NOVO}); setEditando(null); setAbaModal(0); setErrosForm([]); setModal('create'); };
  const abrirEdicao  = (p: any) => { setForm({...p}); setEditando(p); setAbaModal(0); setErrosForm([]); setModal('edit'); };
  const fecharModal  = () => { setModal(null); setEditando(null); };
  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }));

  // ── Salvar ────────────────────────────────────────────────────────────────
  const salvar = async () => {
    setSalvando(true); setErrosForm([]);
    try {
      const url    = modal === 'edit' ? `/api/produto?id=${editando.id}` : '/api/produto';
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) { setErrosForm(data.erros || [data.error || 'Erro ao salvar']); return; }
      showToast(modal === 'edit' ? 'Produto atualizado' : 'Produto criado com sucesso');
      fecharModal(); await carregar();
    } catch (e: any) { setErrosForm([e.message]); }
    finally { setSalvando(false); }
  };

  // ── Deletar ───────────────────────────────────────────────────────────────
  const confirmarDelete = async () => {
    if (!deletandoId) return;
    try {
      await fetch(`/api/produto?id=${deletandoId}`, { method:'DELETE' });
      showToast('Produto excluído');
      setProdutos(prev => prev.filter(p => p.id !== deletandoId));
    } catch (e: any) { showToast(`Erro: ${e.message}`); }
    finally { setDeletandoId(null); }
  };

  // Margem calculada
  const margem = form.custo > 0 && form.preco > 0
    ? (((form.preco - form.custo) / form.preco) * 100).toFixed(1) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm animate-fade-in">
          <CheckCircle size={16} className="text-emerald-400 shrink-0"/>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Produtos</h1>
            <p className="text-sm text-gray-400 mt-0.5">Catálogo de produtos e serviços</p>
          </div>
          <div className="flex items-center gap-3">
            {syncMsg && <span className="text-sm text-gray-500 italic">{syncMsg}</span>}
            <button onClick={sincronizar} disabled={syncing||loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''}/>
              {syncing ? 'Sincronizando...' : 'Sincronizar WooCommerce'}
            </button>
            <button onClick={abrirCriacao}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              <Plus size={15}/> Novo Produto
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { label:'Total de Produtos',    value: stats.total,       color:'blue',   icon:'📦' },
            { label:'Ativos / Publicados',  value: stats.ativos,      color:'emerald',icon:'✅' },
            { label:'Cadastro Manual',      value: stats.manuais,     color:'amber',  icon:'🏷️' },
            { label:'Estoque Baixo/Zero',   value: stats.semEstoque,  color:'red',    icon:'⚠️' },
          ] as const).map(({ label, value, color, icon }) => (
            <div key={label} className={`bg-white rounded-xl border p-4 flex items-center gap-4 shadow-sm ${
              color==='red' && value>0 ? 'border-red-200' : 'border-gray-200'}`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${
                color==='blue'    ? 'bg-blue-50' :
                color==='emerald' ? 'bg-emerald-50' :
                color==='amber'   ? 'bg-amber-50' : 'bg-red-50'}`}>
                {icon}
              </div>
              <div>
                <div className={`text-2xl font-bold ${color==='red'&&value>0?'text-red-600':'text-gray-900'}`}>{value}</div>
                <div className="text-xs text-gray-400 leading-tight">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Buscar nome, SKU, categoria..." value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14}/>
              </button>
            )}
          </div>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white">
            <option value="">Todas as categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white">
            <option value="">Todas as origens</option>
            <option value="woocommerce">WooCommerce</option>
            <option value="manual">Manual</option>
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white">
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="sem_estoque">Sem Estoque</option>
          </select>
          {(busca||filtroCategoria||filtroOrigem||filtroStatus) && (
            <button onClick={() => { setBusca(''); setFiltroCategoria(''); setFiltroOrigem(''); setFiltroStatus(''); }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
              Limpar filtros
            </button>
          )}
          <span className="ml-auto text-sm text-gray-400 whitespace-nowrap">
            {filtrados.length.toLocaleString('pt-BR')} {filtrados.length===1?'produto':'produtos'}
          </span>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-sm text-red-700">
            <AlertTriangle size={16} className="shrink-0"/> {erro}
            <button onClick={carregar} className="ml-auto underline font-medium">Tentar novamente</button>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left text-gray-500 font-semibold w-14">Foto</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-semibold">Produto</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-semibold">Categoria</th>
                  <th className="px-4 py-3 text-right text-gray-500 font-semibold">Preço</th>
                  <th className="px-4 py-3 text-center text-gray-500 font-semibold">Estoque</th>
                  <th className="px-4 py-3 text-center text-gray-500 font-semibold">Status</th>
                  <th className="px-4 py-3 text-center text-gray-500 font-semibold">Origem</th>
                  <th className="px-4 py-3 text-right text-gray-500 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({length:8}).map((_,i)=><SkeletonRow key={i}/>)
                ) : itensPagina.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Package size={44} strokeWidth={1}/>
                      <div>
                        <p className="font-medium text-gray-600 text-base">Nenhum produto encontrado</p>
                        <p className="text-sm mt-1">
                          {busca||filtroCategoria||filtroOrigem||filtroStatus
                            ? 'Tente ajustar os filtros de busca'
                            : 'Cadastre manualmente ou sincronize com o WooCommerce'}
                        </p>
                      </div>
                      {!(busca||filtroCategoria||filtroOrigem||filtroStatus) && (
                        <button onClick={abrirCriacao}
                          className="mt-1 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                          <Plus size={14}/> Novo Produto
                        </button>
                      )}
                    </div>
                  </td></tr>
                ) : itensPagina.map(p => (

                  <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 py-3">
                      {p.imagem
                        ? <img src={p.imagem} alt={p.nome} className="w-10 h-10 object-cover rounded-lg border border-gray-200"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}/>
                        : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package size={18} className="text-gray-400"/>
                          </div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{p.nome}</div>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
                        {p.sku && <span>SKU: <span className="font-mono">{p.sku}</span></span>}
                        {p.ncm && <span>NCM: <span className="font-mono">{fmtNcm(p.ncm)}</span></span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {p.categoria || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-gray-900">{fmtPreco(p.preco)}</div>
                      {p.custo > 0 && <div className="text-xs text-gray-400">custo {fmtPreco(p.custo)}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.gerenciarEstoque
                        ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.estoque <= 0 ? 'bg-red-100 text-red-700' :
                            p.estoque <= (p.estoqueMinimo||0) ? 'bg-yellow-100 text-yellow-700' :
                            'bg-emerald-100 text-emerald-700'}`}>
                            {p.estoque ?? 0} {p.unidade || 'UN'}
                          </span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.status} emEstoque={p.emEstoque}/>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <OrigemBadge origem={p.origem}/>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.permalink && (
                          <a href={p.permalink} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Ver no site">
                            <ExternalLink size={14}/>
                          </a>
                        )}
                        <button onClick={() => abrirEdicao(p)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                          <Edit2 size={14}/>
                        </button>
                        <button onClick={() => setDeletandoId(p.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>

                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {!loading && filtrados.length > POR_PAGINA && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-sm text-gray-500">
                Mostrando {(inicio+1).toLocaleString('pt-BR')}–{Math.min(inicio+POR_PAGINA,filtrados.length).toLocaleString('pt-BR')} de {filtrados.length.toLocaleString('pt-BR')} produtos
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagina(p => Math.max(1,p-1))} disabled={paginaAtual===1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={16}/>
                </button>
                {Array.from({length: Math.min(7, totalPaginas)}, (_,i) => {
                  let num: number;
                  if (totalPaginas <= 7) num = i+1;
                  else if (paginaAtual <= 4) num = i+1;
                  else if (paginaAtual >= totalPaginas-3) num = totalPaginas-6+i;
                  else num = paginaAtual-3+i;
                  return (
                    <button key={num} onClick={() => setPagina(num)}
                      className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                        num===paginaAtual ? 'bg-blue-600 text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-white'}`}>
                      {num}
                    </button>
                  );
                })}
                <button onClick={() => setPagina(p => Math.min(totalPaginas,p+1))} disabled={paginaAtual===totalPaginas}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL CRIAR / EDITAR ── */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={fecharModal}/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {modal==='create' ? 'Novo Produto' : 'Editar Produto'}
                </h2>
                {modal==='edit' && <OrigemBadge origem={editando?.origem}/>}
              </div>
              <button onClick={fecharModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18}/>
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-100 px-6 bg-gray-50/50">
              {[
                { label:'Identificação', icon:'📋' },
                { label:'Preços',        icon:'💰' },
                { label:'Fiscal NF-e',  icon:'📄' },
                { label:'Estoque',      icon:'📦' },
              ].map(({ label, icon }, i) => (
                <button key={i} onClick={() => setAbaModal(i)}
                  className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                    abaModal===i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <span className="text-base">{icon}</span>{label}
                </button>
              ))}
            </div>

            {/* Erros */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {errosForm.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {errosForm.map((e,i) => <div key={i}>• {e}</div>)}
                </div>
              )}

              {/* ABA 0 — Identificação */}
              {abaModal===0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome do Produto *</label>
                    <input value={form.nome} onChange={e=>set('nome',e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Tanque de Aço Inox 500L"/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">SKU / Código Interno</label>
                      <input value={form.sku} onChange={e=>set('sku',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="Ex: TNQ-INOX-500"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Categoria</label>
                      <input value={form.categoria} onChange={e=>set('categoria',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Tanques e Vasos" list="cats"/>
                      <datalist id="cats">{categorias.map(c=><option key={c} value={c}/>)}</datalist>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unidade de Medida</label>
                      <select value={form.unidade} onChange={e=>set('unidade',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {UNIDADES.map(u=><option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo</label>
                      <select value={form.tipo} onChange={e=>set('tipo',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="produto">Produto</option>
                        <option value="service">Serviço</option>
                        <option value="variable">Produto com variações</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descrição</label>
                    <textarea value={form.descricao} onChange={e=>set('descricao',e.target.value)} rows={3}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Descrição resumida do produto ou serviço..."/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">URL da Imagem</label>
                    <input value={form.imagem} onChange={e=>set('imagem',e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."/>
                  </div>
                </div>
              )}

              {/* ABA 1 — Preços */}
              {abaModal===1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preço de Venda *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
                        <input type="number" min="0" step="0.01" value={form.preco}
                          onChange={e=>set('preco', parseFloat(e.target.value)||0)}
                          className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preço Regular / Tabela</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
                        <input type="number" min="0" step="0.01" value={form.precoRegular}
                          onChange={e=>set('precoRegular', parseFloat(e.target.value)||0)}
                          className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Custo (Preço de Compra)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
                        <input type="number" min="0" step="0.01" value={form.custo}
                          onChange={e=>set('custo', parseFloat(e.target.value)||0)}
                          className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Margem de Lucro</label>
                      <div className={`w-full text-sm border rounded-lg px-3 py-2.5 font-semibold text-center ${
                        margem===null         ? 'border-gray-200 text-gray-400 bg-gray-50' :
                        parseFloat(margem)<20 ? 'border-red-200 text-red-600 bg-red-50' :
                        parseFloat(margem)<40 ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                                                'border-emerald-200 text-emerald-700 bg-emerald-50'}`}>
                        {margem!==null ? `${margem}%` : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Desconto PIX (%)</label>
                      <input type="number" min="0" max="100" step="0.1" value={form.descontoPix||0}
                        onChange={e=>set('descontoPix', parseFloat(e.target.value)||0)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Prazo de Produção (dias)</label>
                      <input type="number" min="0" value={form.prazoProd||0}
                        onChange={e=>set('prazoProd', parseInt(e.target.value)||0)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2 — Fiscal NF-e */}
              {abaModal===2 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
                    <Info size={15} className="text-blue-500 shrink-0 mt-0.5"/>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      <strong>Padrão MEI pré-configurado:</strong> CSOSN 102, CST PIS/COFINS 49, CFOP 5102/6102, alíquotas 0%. Altere somente se necessário.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">NCM (8 dígitos)</label>
                      <input value={fmtNcm(form.ncm||'')} onChange={e=>set('ncm',rawNcm(e.target.value))} maxLength={10}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
                        placeholder="0000.00.00"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">EAN / GTIN</label>
                      <input value={form.ean||'SEM GTIN'} onChange={e=>set('ean',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="SEM GTIN"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Origem da Mercadoria</label>
                    <select value={form.origemMercadoria||'0'} onChange={e=>set('origemMercadoria',e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {ORIGEMS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">CSOSN ICMS</label>
                      <select value={form.csosnIcms||'102'} onChange={e=>set('csosnIcms',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {CSOSNS.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alíquota ICMS (%)</label>
                      <input type="number" min="0" max="100" step="0.01" value={form.aliqIcms||0}
                        onChange={e=>set('aliqIcms', parseFloat(e.target.value)||0)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">CFOP Dentro do Estado</label>
                      <input value={form.cfopDentro||'5102'} onChange={e=>set('cfopDentro',e.target.value)} maxLength={4}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-widest"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">CFOP Fora do Estado</label>
                      <input value={form.cfopFora||'6102'} onChange={e=>set('cfopFora',e.target.value)} maxLength={4}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-widest"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">CST PIS</label>
                      <select value={form.cstPis||'49'} onChange={e=>set('cstPis',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {CST_PIS_COFINS.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">CST COFINS</label>
                      <select value={form.cstCofins||'49'} onChange={e=>set('cstCofins',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {CST_PIS_COFINS.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alíquota PIS (%)</label>
                      <input type="number" min="0" max="100" step="0.01" value={form.aliqPis||0}
                        onChange={e=>set('aliqPis', parseFloat(e.target.value)||0)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alíquota COFINS (%)</label>
                      <input type="number" min="0" max="100" step="0.01" value={form.aliqCofins||0}
                        onChange={e=>set('aliqCofins', parseFloat(e.target.value)||0)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 3 — Estoque */}
              {abaModal===3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Controlar Estoque</div>
                      <div className="text-xs text-gray-400 mt-0.5">Rastrear quantidade disponível</div>
                    </div>
                    <button onClick={()=>set('gerenciarEstoque',!form.gerenciarEstoque)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner ${form.gerenciarEstoque?'bg-blue-600':'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.gerenciarEstoque?'translate-x-6':'translate-x-1'}`}/>
                    </button>
                  </div>

                  {form.gerenciarEstoque && (<>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantidade em Estoque</label>
                        <input type="number" min="0" value={form.estoque||0}
                          onChange={e=>set('estoque', parseInt(e.target.value)||0)}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Estoque Mínimo (alerta)</label>
                        <input type="number" min="0" value={form.estoqueMinimo||0}
                          onChange={e=>set('estoqueMinimo', parseInt(e.target.value)||0)}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Localização no Estoque</label>
                      <input value={form.localizacao||''} onChange={e=>set('localizacao',e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Corredor A, Prateleira 3"/>
                    </div>
                  </>)}

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Disponível para Venda</div>
                      <div className="text-xs text-gray-400 mt-0.5">Exibir como disponível no site</div>
                    </div>
                    <button onClick={()=>set('emEstoque',!form.emEstoque)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner ${form.emEstoque?'bg-blue-600':'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.emEstoque?'translate-x-6':'translate-x-1'}`}/>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
              <div className="text-xs text-gray-400">
                {modal==='edit' && editando?.atualizadoEm &&
                  `Atualizado em ${new Date(editando.atualizadoEm).toLocaleString('pt-BR')}`}
              </div>
              <div className="flex gap-3">
                <button onClick={fecharModal}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                  {salvando && <Loader2 size={14} className="animate-spin"/>}
                  {salvando ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMAR EXCLUSÃO ── */}
      {deletandoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setDeletandoId(null)}/>
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600"/>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Excluir produto?</h3>
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                  Esta ação não pode ser desfeita. O produto será removido permanentemente do catálogo.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={()=>setDeletandoId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                Excluir Produto
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
