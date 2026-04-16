import { useState, useEffect, useCallback } from 'react';
import {
  buscarProdutos, sincronizarProdutos, fmtPreco, Produto,
} from '../services/produtosService';
import {
  RefreshCw, Search, Package, ExternalLink, AlertCircle, CheckCircle,
  Tag, Layers, Plus, Edit2, Trash2, X, ChevronDown, ChevronRight,
  DollarSign, FileText, BarChart2, Boxes,
} from 'lucide-react';

/* ─── Constantes NF-e ─────────────────────────────────────────────── */
const UNIDADES = ['UN','KG','M','M2','M3','CJ','PCT','L','T','H','PAR','ROLO','SET'];
const ORIGEMS  = [
  { v:'0', l:'0 – Nacional' },
  { v:'1', l:'1 – Estrangeira (importação direta)' },
  { v:'2', l:'2 – Estrangeira (adquirida no mercado interno)' },
  { v:'3', l:'3 – Nacional c/ + 40% conteúdo importado' },
  { v:'4', l:'4 – Nacional (prod. básicos)' },
  { v:'5', l:'5 – Nacional c/ ≤ 40% conteúdo importado' },
];
const CSOSN_OPTS = [
  { v:'102', l:'102 – Simples Nacional s/ crédito' },
  { v:'400', l:'400 – Não tributada pelo Simples' },
  { v:'500', l:'500 – ICMS cobrado por ST' },
  { v:'900', l:'900 – Outros' },
];
const CST_PISCOFINS = [
  { v:'49', l:'49 – Outras Operações de Saída (isento)' },
  { v:'01', l:'01 – Op. tributável (alíquota básica)' },
  { v:'07', l:'07 – Op. isenta da contribuição' },
  { v:'08', l:'08 – Op. sem incidência' },
];

/* ─── Produto vazio (template) ────────────────────────────────────── */
const NOVO: Partial<Produto> & Record<string,any> = {
  nome: '', sku: '', categoria: '', descricao: '', imagem: '',
  tipo: 'produto',
  preco: 0, precoRegular: 0, custo: 0,
  unidade: 'UN', peso: 0,
  ncm: '', ean: 'SEM GTIN',
  origemMercadoria: '0',
  csosnIcms: '102', aliqIcms: 0,
  cfopDentro: '5102', cfopFora: '6102',
  cstPis: '49', aliqPis: 0,
  cstCofins: '49', aliqCofins: 0,
  gerenciarEstoque: true, estoque: 0, estoqueMinimo: 0, emEstoque: true,
  origem: 'manual',
};

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmtNcm(s: string) {
  const d = s.replace(/\D/g,'').slice(0,8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0,4)}.${d.slice(4)}`;
  return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6)}`;
}
function rawNcm(s: string) { return s.replace(/\D/g,'').slice(0,8); }

/* ─── Badge origem ────────────────────────────────────────────────── */
function BadgeOrigem({ origem }: { origem?: string }) {
  if (origem === 'woocommerce' || origem === 'wc')
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">WooCommerce</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Manual</span>;
}

/* ─── Input helper ─────────────────────────────────────────────────── */
function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? 'flex flex-col gap-1' : 'flex flex-col gap-1 col-span-2 sm:col-span-1'}>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
const inp = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";
const sel = inp + " cursor-pointer";

/* ═══════════════════════════════════════════════════════════════════ */
export function Produtos() {
  const [produtos, setProdutos]         = useState<Produto[]>([]);
  const [loading, setLoading]           = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca]               = useState('');
  const [catFiltro, setCatFiltro]       = useState('todas');
  const [origemFiltro, setOrigemFiltro] = useState('todas');
  const [statusSync, setStatusSync]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [ultimaSync, setUltimaSync]     = useState('');

  // Modal
  const [modal, setModal]               = useState<'closed'|'new'|'edit'>('closed');
  const [form, setForm]                 = useState<any>({ ...NOVO });
  const [tab, setTab]                   = useState<'basico'|'preco'|'fiscal'|'estoque'>('basico');
  const [saving, setSaving]             = useState(false);
  const [formErr, setFormErr]           = useState<string|null>(null);
  const [delConfirm, setDelConfirm]     = useState<string|null>(null);

  /* ── Carregar ──────────────────────────────────────────────────── */
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await buscarProdutos();
      setProdutos(lista);
      if (lista[0]?.sincronizadoEm) {
        setUltimaSync(new Date(lista[0].sincronizadoEm).toLocaleString('pt-BR'));
      }
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  /* ── Sincronizar WooCommerce ───────────────────────────────────── */
  const handleSync = async () => {
    setSincronizando(true); setStatusSync(null);
    try {
      const r = await sincronizarProdutos();
      if (r.ok) {
        setStatusSync({ ok:true, msg: `${r.sincronizados} produtos sincronizados!` });
        await carregar();
      } else {
        setStatusSync({ ok:false, msg: r.error || 'Erro na sincronização' });
      }
    } catch(e:any) {
      setStatusSync({ ok:false, msg: e.message });
    } finally {
      setSincronizando(false);
      setTimeout(() => setStatusSync(null), 5000);
    }
  };

  /* ── Abrir modal ───────────────────────────────────────────────── */
  const abrirNovo = () => {
    setForm({ ...NOVO }); setTab('basico'); setFormErr(null); setModal('new');
  };
  const abrirEdit = (p: any) => {
    setForm({ ...NOVO, ...p }); setTab('basico'); setFormErr(null); setModal('edit');
  };
  const fecharModal = () => { setModal('closed'); setFormErr(null); };

  /* ── Salvar ────────────────────────────────────────────────────── */
  const salvar = async () => {
    if (!form.nome?.trim()) { setFormErr('Nome é obrigatório.'); setTab('basico'); return; }
    setSaving(true); setFormErr(null);
    try {
      const body = {
        ...form,
        preco: Number(form.preco) || 0,
        precoRegular: Number(form.precoRegular) || 0,
        custo: Number(form.custo) || 0,
        estoque: Number(form.estoque) || 0,
        estoqueMinimo: Number(form.estoqueMinimo) || 0,
        aliqIcms: Number(form.aliqIcms) || 0,
        aliqPis: Number(form.aliqPis) || 0,
        aliqCofins: Number(form.aliqCofins) || 0,
        peso: Number(form.peso) || 0,
        ncm: rawNcm(form.ncm || ''),
      };

      const isEdit = modal === 'edit' && form.id;
      const url  = isEdit ? `/api/produto?id=${form.id}` : '/api/produto';
      const method = isEdit ? 'PUT' : 'POST';

      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erros?.join(', ') || data.error || 'Erro ao salvar');
      await carregar();
      fecharModal();
    } catch(e:any) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Excluir ───────────────────────────────────────────────────── */
  const excluir = async (id: string) => {
    try {
      await fetch(`/api/produto?id=${id}`, { method:'DELETE' });
      setProdutos(ps => ps.filter(p => p.id !== id));
    } catch(e){ console.error(e); }
    setDelConfirm(null);
  };

  /* ── Filtros ───────────────────────────────────────────────────── */
  const categorias = ['todas', ...Array.from(new Set(produtos.map(p => p.categoria || 'Sem categoria')))];
  const filtrados  = produtos.filter(p => {
    const q = busca.toLowerCase();
    const okBusca  = !q || [p.nome,p.sku,p.categoria,(p as any).ncm].some(v=>(v||'').toLowerCase().includes(q));
    const okCat    = catFiltro === 'todas' || p.categoria === catFiltro;
    const orig     = (p as any).origem || 'woocommerce';
    const isManual = orig !== 'woocommerce' && orig !== 'wc';
    const okOrig   = origemFiltro === 'todas'
      || (origemFiltro === 'manual' && isManual)
      || (origemFiltro === 'woocommerce' && !isManual);
    return okBusca && okCat && okOrig;
  });

  const manuais = produtos.filter(p => { const o=(p as any).origem; return o&&o!=='woocommerce'&&o!=='wc'; }).length;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestão de Produtos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Catálogo unificado · WooCommerce + Manuais
            {ultimaSync && <span className="ml-2 text-slate-400">· sync: {ultimaSync}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={sincronizando}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <RefreshCw size={14} className={sincronizando?'animate-spin':''} />
            {sincronizando ? 'Sincronizando...' : 'Sync WooCommerce'}
          </button>
          <button onClick={abrirNovo}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Novo Produto
          </button>
        </div>
      </div>

      {/* Status */}
      {statusSync && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${statusSync.ok?'bg-green-50 text-green-700 border border-green-200':'bg-red-50 text-red-700 border border-red-200'}`}>
          {statusSync.ok ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {statusSync.msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l:'Total', v:produtos.length, sub:'produtos', c:'text-slate-900' },
          { l:'Em Estoque', v:produtos.filter(p=>p.emEstoque!==false).length, sub:'disponíveis', c:'text-emerald-600' },
          { l:'Cadastro Manual', v:manuais, sub:'fora do WooCommerce', c:'text-amber-600' },
          { l:'Categorias', v:categorias.length-1, sub:'ativas', c:'text-indigo-600' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{s.l}</p>
            <p className={`text-2xl font-bold mt-1 ${s.c}`}>{s.v}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Buscar por nome, SKU, categoria ou NCM..."
            value={busca} onChange={e=>setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
        </div>
        <select value={catFiltro} onChange={e=>setCatFiltro(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
          {categorias.map(c=><option key={c} value={c}>{c==='todas'?'Todas as categorias':c}</option>)}
        </select>
        <select value={origemFiltro} onChange={e=>setOrigemFiltro(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
          <option value="todas">Todas as origens</option>
          <option value="woocommerce">WooCommerce</option>
          <option value="manual">Cadastro Manual</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-slate-300 mb-3"/>
          <p className="text-slate-500 font-medium">{produtos.length===0?'Nenhum produto cadastrado':'Nenhum produto corresponde ao filtro'}</p>
          {produtos.length === 0 && (
            <p className="text-sm text-slate-400 mt-1">Clique em "Novo Produto" ou "Sync WooCommerce"</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map(p => {
            const prod = p as any;
            const semEstoque = p.emEstoque === false;
            const baixoEstoque = !semEstoque && prod.gerenciarEstoque && typeof p.estoque === 'number' && p.estoque <= (prod.estoqueMinimo || 3);
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="h-36 bg-slate-50 flex items-center justify-center overflow-hidden relative">
                  {p.imagem
                    ? <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover"/>
                    : <Package size={32} className="text-slate-300"/>
                  }
                  <div className="absolute top-2 left-2 flex gap-1">
                    <BadgeOrigem origem={prod.origem}/>
                    {(prod.ncm) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">{fmtNcm(prod.ncm)}</span>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>abrirEdit(p)}
                      className="p-1.5 bg-white rounded-lg shadow text-slate-600 hover:text-indigo-600">
                      <Edit2 size={13}/>
                    </button>
                    <button onClick={()=>setDelConfirm(p.id)}
                      className="p-1.5 bg-white rounded-lg shadow text-slate-600 hover:text-red-600">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{p.nome}</h3>
                    {prod.permalink && (
                      <a href={prod.permalink} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600 flex-shrink-0 mt-0.5">
                        <ExternalLink size={13}/>
                      </a>
                    )}
                  </div>
                  {p.sku && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Tag size={10}/> {p.sku}</p>}
                  {p.categoria && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Layers size={10}/> {p.categoria}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-indigo-700">{fmtPreco(p.preco)}</p>
                      {p.precoRegular && p.precoRegular !== p.preco && (
                        <p className="text-xs text-slate-400 line-through">{fmtPreco(p.precoRegular)}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      semEstoque ? 'bg-red-100 text-red-600'
                      : baixoEstoque ? 'bg-amber-100 text-amber-600'
                      : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {semEstoque ? 'Sem estoque'
                       : prod.gerenciarEstoque && typeof p.estoque === 'number' ? `${p.estoque} ${prod.unidade||'UN'}`
                       : 'Disponível'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtrados.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {filtrados.length} de {produtos.length} produtos
        </p>
      )}

      {/* ── Modal criar/editar ─────────────────────────────────────── */}
      {modal !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {modal === 'new' ? 'Novo Produto' : 'Editar Produto'}
              </h2>
              <button onClick={fecharModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18}/>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-6 overflow-x-auto">
              {([
                { id:'basico',  icon:<Package size={14}/>,    l:'Identificação' },
                { id:'preco',   icon:<DollarSign size={14}/>, l:'Preços' },
                { id:'fiscal',  icon:<FileText size={14}/>,   l:'Fiscal NF-e' },
                { id:'estoque', icon:<Boxes size={14}/>,      l:'Estoque' },
              ] as const).map(t => (
                <button key={t.id} onClick={()=>setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                    tab===t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}>
                  {t.icon}{t.l}
                </button>
              ))}
            </div>

            {/* Conteúdo modal */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {formErr && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                  <AlertCircle size={15}/> {formErr}
                </div>
              )}

              {/* Tab: Identificação */}
              {tab === 'basico' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">Nome do Produto <span className="text-red-500">*</span></label>
                    <input className={inp} value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}
                      placeholder="Ex: Container de Aço 1200L – Horizontal" />
                  </div>
                  <Field label="SKU / Código Interno">
                    <input className={inp} value={form.sku||''} onChange={e=>setForm({...form,sku:e.target.value.toUpperCase()})}
                      placeholder="EX: CONT-ACO-1200" />
                  </Field>
                  <Field label="Tipo">
                    <select className={sel} value={form.tipo||'produto'} onChange={e=>setForm({...form,tipo:e.target.value})}>
                      <option value="produto">Produto</option>
                      <option value="servico">Serviço</option>
                      <option value="insumo">Insumo / Matéria-prima</option>
                    </select>
                  </Field>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">Categoria</label>
                    <input className={inp} value={form.categoria||''} onChange={e=>setForm({...form,categoria:e.target.value})}
                      placeholder="Ex: Reservatórios e Contenção" />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">Descrição Técnica</label>
                    <textarea className={inp + ' resize-none'} rows={3}
                      value={form.descricao||''} onChange={e=>setForm({...form,descricao:e.target.value})}
                      placeholder="Material, dimensões, capacidade, normas aplicáveis, acabamento..." />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600">URL da Imagem</label>
                    <input className={inp} value={form.imagem||''} onChange={e=>setForm({...form,imagem:e.target.value})}
                      placeholder="https://..." />
                  </div>
                  <Field label="Peso (kg)">
                    <input type="number" min="0" step="0.01" className={inp}
                      value={form.peso||0} onChange={e=>setForm({...form,peso:e.target.value})} />
                  </Field>
                  <Field label="Unidade de Venda">
                    <select className={sel} value={form.unidade||'UN'} onChange={e=>setForm({...form,unidade:e.target.value})}>
                      {UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {/* Tab: Preços */}
              {tab === 'preco' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Preço de Venda (R$)">
                    <input type="number" min="0" step="0.01" className={inp}
                      value={form.preco||0} onChange={e=>setForm({...form,preco:e.target.value})} />
                  </Field>
                  <Field label="Preço Regular / De (R$)">
                    <input type="number" min="0" step="0.01" className={inp}
                      value={form.precoRegular||0} onChange={e=>setForm({...form,precoRegular:e.target.value})}
                      placeholder="Deixe 0 se não houver desconto" />
                  </Field>
                  <Field label="Custo (R$)">
                    <input type="number" min="0" step="0.01" className={inp}
                      value={form.custo||0} onChange={e=>setForm({...form,custo:e.target.value})} />
                  </Field>
                  <Field label="Margem estimada">
                    <div className={`${inp} bg-slate-50 text-slate-600 cursor-default`}>
                      {form.preco > 0 && form.custo > 0
                        ? `${(((Number(form.preco)-Number(form.custo))/Number(form.preco))*100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </Field>
                  <div className="col-span-2 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wide">Descontos e Condições</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Desconto PIX (%)">
                        <input type="number" min="0" max="100" step="0.5" className={inp}
                          value={form.descontoPix||0} onChange={e=>setForm({...form,descontoPix:e.target.value})} />
                      </Field>
                      <Field label="Prazo de Produção (dias)">
                        <input type="number" min="0" className={inp}
                          value={form.prazoDias||0} onChange={e=>setForm({...form,prazoDias:e.target.value})} />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Fiscal NF-e */}
              {tab === 'fiscal' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 border border-blue-100">
                    Defaults MEI aplicados automaticamente (CSOSN 102, PIS/COFINS isentos). Altere apenas se necessário.
                  </div>
                  <Field label="NCM (8 dígitos)">
                    <input className={inp + ' font-mono'} value={fmtNcm(form.ncm||'')}
                      onChange={e=>setForm({...form,ncm:rawNcm(e.target.value)})}
                      placeholder="7309.00.00" maxLength={10} />
                  </Field>
                  <Field label="EAN / GTIN">
                    <input className={inp + ' font-mono'} value={form.ean||'SEM GTIN'}
                      onChange={e=>setForm({...form,ean:e.target.value})}
                      placeholder="SEM GTIN" />
                  </Field>
                  <Field label="Origem da Mercadoria">
                    <select className={sel} value={form.origemMercadoria||'0'} onChange={e=>setForm({...form,origemMercadoria:e.target.value})}>
                      {ORIGEMS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </Field>
                  <Field label="CSOSN ICMS (Simples)">
                    <select className={sel} value={form.csosnIcms||'102'} onChange={e=>setForm({...form,csosnIcms:e.target.value})}>
                      {CSOSN_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </Field>
                  <Field label="Alíquota ICMS (%)">
                    <input type="number" min="0" max="100" step="0.01" className={inp}
                      value={form.aliqIcms||0} onChange={e=>setForm({...form,aliqIcms:e.target.value})} />
                  </Field>
                  <Field label="Unidade Tributável">
                    <select className={sel} value={form.unidade||'UN'} onChange={e=>setForm({...form,unidade:e.target.value})}>
                      {UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </Field>
                  <Field label="CFOP Dentro do Estado">
                    <input className={inp + ' font-mono'} value={form.cfopDentro||'5102'}
                      onChange={e=>setForm({...form,cfopDentro:e.target.value.replace(/\D/g,'').slice(0,4)})}
                      placeholder="5102" maxLength={4} />
                  </Field>
                  <Field label="CFOP Fora do Estado">
                    <input className={inp + ' font-mono'} value={form.cfopFora||'6102'}
                      onChange={e=>setForm({...form,cfopFora:e.target.value.replace(/\D/g,'').slice(0,4)})}
                      placeholder="6102" maxLength={4} />
                  </Field>
                  <div className="col-span-2 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wide">PIS / COFINS</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="CST PIS">
                        <select className={sel} value={form.cstPis||'49'} onChange={e=>setForm({...form,cstPis:e.target.value})}>
                          {CST_PISCOFINS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                      </Field>
                      <Field label="Alíquota PIS (%)">
                        <input type="number" min="0" max="100" step="0.01" className={inp}
                          value={form.aliqPis||0} onChange={e=>setForm({...form,aliqPis:e.target.value})} />
                      </Field>
                      <Field label="CST COFINS">
                        <select className={sel} value={form.cstCofins||'49'} onChange={e=>setForm({...form,cstCofins:e.target.value})}>
                          {CST_PISCOFINS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                      </Field>
                      <Field label="Alíquota COFINS (%)">
                        <input type="number" min="0" max="100" step="0.01" className={inp}
                          value={form.aliqCofins||0} onChange={e=>setForm({...form,aliqCofins:e.target.value})} />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Estoque */}
              {tab === 'estoque' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Gerenciar Estoque</p>
                      <p className="text-xs text-slate-500 mt-0.5">Controlar quantidade disponível</p>
                    </div>
                    <button onClick={()=>setForm({...form,gerenciarEstoque:!form.gerenciarEstoque})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${form.gerenciarEstoque?'bg-indigo-600':'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform ${form.gerenciarEstoque?'translate-x-6':'translate-x-0.5'}`}/>
                    </button>
                  </div>
                  {form.gerenciarEstoque && (<>
                    <Field label="Quantidade em Estoque">
                      <input type="number" min="0" className={inp}
                        value={form.estoque||0} onChange={e=>setForm({...form,estoque:e.target.value,emEstoque:Number(e.target.value)>0})} />
                    </Field>
                    <Field label="Estoque Mínimo (alerta)">
                      <input type="number" min="0" className={inp}
                        value={form.estoqueMinimo||0} onChange={e=>setForm({...form,estoqueMinimo:e.target.value})} />
                    </Field>
                    <Field label="Localização no Estoque">
                      <input className={inp} value={form.localizacao||''} onChange={e=>setForm({...form,localizacao:e.target.value})}
                        placeholder="Ex: Galpão A - Prateleira 3" />
                    </Field>
                    <Field label="Unidade de Estoque">
                      <select className={sel} value={form.unidade||'UN'} onChange={e=>setForm({...form,unidade:e.target.value})}>
                        {UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}
                      </select>
                    </Field>
                  </>)}
                  <div className="col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Produto Disponível para Venda</p>
                      <p className="text-xs text-slate-500 mt-0.5">Aparece no catálogo e nas propostas</p>
                    </div>
                    <button onClick={()=>setForm({...form,emEstoque:!form.emEstoque})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${form.emEstoque?'bg-emerald-500':'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform ${form.emEstoque?'translate-x-6':'translate-x-0.5'}`}/>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button onClick={fecharModal} className="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">
                Cancelar
              </button>
              <button onClick={salvar} disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {saving ? <RefreshCw size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                {saving ? 'Salvando...' : modal==='new' ? 'Criar Produto' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmação de exclusão ────────────────────────────────── */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <Trash2 size={32} className="text-red-500 mx-auto mb-3"/>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Excluir Produto?</h3>
            <p className="text-sm text-slate-500 mb-5">Esta ação é irreversível. O produto será removido do catálogo.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDelConfirm(null)}
                className="flex-1 text-sm text-slate-600 border border-slate-200 rounded-lg py-2 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={()=>excluir(delConfirm)}
                className="flex-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg py-2">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
