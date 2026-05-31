// src/components/BuscaGlobal.tsx — Modal de busca global Cmd+K
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, Loader2, Building2, User, FileText, Calendar, Target,
  ShoppingBag, Receipt, MessageCircle, ArrowRight, Hash,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';

interface Resultado {
  tipo: string;
  icon: string;
  titulo: string;
  sub: string;
  meta: { id: string; cliente?: string; slug?: string; cor?: string; status?: string };
  navega: string;
}

const ICONS: Record<string, any> = {
  Building2, User, FileText, Calendar, Target, ShoppingBag, Receipt, MessageCircle,
};

const TIPO_LABEL: Record<string, string> = {
  empresa: 'Empresa', lead: 'Lead', proposta: 'Proposta', post: 'Post',
  campanha: 'Campanha', pedido: 'Pedido', fatura: 'Fatura', mensagem: 'Mensagem',
};

const TIPO_COR: Record<string, string> = {
  empresa: 'text-violet-600 bg-violet-50',
  lead: 'text-indigo-600 bg-indigo-50',
  proposta: 'text-amber-600 bg-amber-50',
  post: 'text-purple-600 bg-purple-50',
  campanha: 'text-pink-600 bg-pink-50',
  pedido: 'text-violet-600 bg-violet-50',
  fatura: 'text-emerald-600 bg-emerald-50',
  mensagem: 'text-blue-600 bg-blue-50',
};

export function BuscaGlobal() {
  const { setClienteAtivoId } = useTrafego();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecionado, setSelecionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const buscar = useCallback(async (term: string) => {
    if (term.length < 2) { setResultados([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/busca-global?q=${encodeURIComponent(term)}`);
      const d = await r.json();
      setResultados(d.resultados || []);
      setSelecionado(0);
    } finally { setLoading(false); }
  }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => buscar(q), 250);
    return () => clearTimeout(t);
  }, [q, buscar]);

  // Atalho Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberto(true);
      }
      if (e.key === 'Escape' && aberto) {
        setAberto(false);
      }
      if (aberto && resultados.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelecionado(s => Math.min(s + 1, resultados.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelecionado(s => Math.max(s - 1, 0)); }
        if (e.key === 'Enter') { e.preventDefault(); abrir(resultados[selecionado]); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, resultados, selecionado]);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(''); setResultados([]); }
  }, [aberto]);

  function abrir(r: Resultado) {
    if (r.meta?.cliente) setClienteAtivoId(r.meta.cliente);
    if (r.tipo === 'empresa' && r.meta?.id) setClienteAtivoId(r.meta.id);
    window.location.hash = r.navega;
    setAberto(false);
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-lg hover:shadow-xl transition text-sm text-slate-600"
        title="Busca global (Ctrl/Cmd+K)">
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-start justify-center pt-[10vh] px-4" onClick={() => setAberto(false)}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar em todo o sistema: empresa, lead, proposta, post, pedido, fatura..."
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-500">ESC</kbd>
          <button onClick={() => setAberto(false)}><X className="w-4 h-4 text-slate-400 hover:text-slate-700" /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Digite pelo menos 2 letras para buscar</p>
              <p className="text-xs mt-2">⌘K em qualquer lugar pra abrir esse modal</p>
            </div>
          ) : resultados.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Nada encontrado para "<strong>{q}</strong>"
            </div>
          ) : (
            <div className="py-1">
              {resultados.map((r, i) => {
                const Icon = ICONS[r.icon] || Search;
                const isSel = i === selecionado;
                return (
                  <div
                    key={i}
                    onClick={() => abrir(r)}
                    onMouseEnter={() => setSelecionado(i)}
                    className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${isSel ? 'bg-violet-50' : 'hover:bg-slate-50'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TIPO_COR[r.tipo] || 'text-slate-600 bg-slate-100'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{r.titulo}</div>
                      <div className="text-xs text-slate-500 truncate">{r.sub}</div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                      {TIPO_LABEL[r.tipo] || r.tipo}
                    </span>
                    {isSel && <ArrowRight className="w-4 h-4 text-violet-600 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 bg-slate-50">
          <div className="flex gap-3">
            <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">↵</kbd> abrir</span>
            <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">ESC</kbd> fechar</span>
          </div>
          <span>{resultados.length} resultados</span>
        </div>
      </div>
    </div>
  );
}

export default BuscaGlobal;
