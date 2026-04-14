import { useState, useEffect, useCallback } from 'react';
import { buscarProdutos, sincronizarProdutos, fmtPreco, Produto } from '../services/produtosService';
import { RefreshCw, Search, Package, ExternalLink, AlertCircle, CheckCircle, Tag, Layers } from 'lucide-react';

export function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [statusSync, setStatusSync] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string>('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await buscarProdutos();
      setProdutos(lista);
      if (lista.length > 0 && lista[0].sincronizadoEm) {
        const d = new Date(lista[0].sincronizadoEm);
        setUltimaSync(d.toLocaleString('pt-BR'));
      }
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleSincronizar = async () => {
    setSincronizando(true);
    setStatusSync(null);
    try {
      const r = await sincronizarProdutos();
      if (r.ok) {
        setStatusSync({ ok: true, msg: r.sincronizados + ' produtos sincronizados com sucesso!' });
        await carregar();
      } else {
        setStatusSync({ ok: false, msg: r.error || 'Erro na sincronizacao' });
      }
    } catch (err: any) {
      setStatusSync({ ok: false, msg: err.message });
    } finally {
      setSincronizando(false);
      setTimeout(() => setStatusSync(null), 5000);
    }
  };

  const categorias = ['todas', ...Array.from(new Set(produtos.map(p => p.categoria || 'Sem categoria')))];

  const filtrados = produtos.filter(p => {
    const ok_busca = !busca || [p.nome, p.sku, p.categoria].some(v =>
      (v || '').toLowerCase().includes(busca.toLowerCase())
    );
    const ok_cat = categoriaFiltro === 'todas' || p.categoria === categoriaFiltro;
    return ok_busca && ok_cat;
  });

  const emEstoque = produtos.filter(p => p.emEstoque !== false).length;
  const totalValor = produtos.reduce((s, p) => s + (p.preco || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Catálogo de Produtos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Sincronizado com WooCommerce
            {ultimaSync && <span className="ml-2 text-slate-400">· última sync: {ultimaSync}</span>}
          </p>
        </div>
        <button
          onClick={handleSincronizar}
          disabled={sincronizando}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={15} className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? 'Sincronizando...' : 'Sincronizar Agora'}
        </button>
      </div>

      {/* Status sync */}
      {statusSync && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${statusSync.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {statusSync.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {statusSync.msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{produtos.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">produtos cadastrados</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Em Estoque</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{emEstoque}</p>
          <p className="text-xs text-slate-400 mt-0.5">disponíveis</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Categorias</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{categorias.length - 1}</p>
          <p className="text-xs text-slate-400 mt-0.5">categorias ativas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar por nome, SKU ou categoria..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          />
        </div>
        <select
          value={categoriaFiltro}
          onChange={e => setCategoriaFiltro(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          {categorias.map(c => (
            <option key={c} value={c}>{c === 'todas' ? 'Todas as categorias' : c}</option>
          ))}
        </select>
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            {produtos.length === 0 ? 'Nenhum produto encontrado' : 'Nenhum produto corresponde ao filtro'}
          </p>
          {produtos.length === 0 && (
            <p className="text-sm text-slate-400 mt-1">
              Clique em "Sincronizar Agora" para importar do WooCommerce
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
              {/* Imagem */}
              <div className="h-40 bg-slate-50 flex items-center justify-center overflow-hidden">
                {p.imagem ? (
                  <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" />
                ) : (
                  <Package size={32} className="text-slate-300" />
                )}
              </div>
              {/* Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{p.nome}</h3>
                  {p.permalink && (
                    <a href={p.permalink} target="_blank" rel="noreferrer"
                      className="text-slate-400 hover:text-indigo-600 flex-shrink-0 mt-0.5">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                {p.sku && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Tag size={10} /> SKU: {p.sku}
                  </p>
                )}
                {p.categoria && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Layers size={10} /> {p.categoria}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-indigo-700">{fmtPreco(p.preco)}</p>
                    {p.precoRegular && p.precoRegular !== p.preco && (
                      <p className="text-xs text-slate-400 line-through">{fmtPreco(p.precoRegular)}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.emEstoque === false
                      ? 'bg-red-100 text-red-600'
                      : p.estoque !== undefined && p.estoque <= 3
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {p.emEstoque === false
                      ? 'Sem estoque'
                      : p.estoque !== undefined
                      ? p.estoque + ' un.'
                      : 'Disponível'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtrados.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Mostrando {filtrados.length} de {produtos.length} produtos
        </p>
      )}
    </div>
  );
}
