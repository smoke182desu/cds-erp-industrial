import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, RefreshCw, Calendar, User, Package, Clock, AlertCircle, Plus, Trash2 } from 'lucide-react';

// =====================================================================
// PCPKanban - Kanban de Producao end-to-end
// Le e atualiza ordens_servico no Supabase via /api/ordens
// 10 colunas: fila -> corte -> dobra -> solda_montagem -> pintura ->
//             embalagem -> transporte -> entregue -> pos_venda -> concluido
// Drag-and-drop nativo HTML5; mudancas sao persistidas com PATCH.
// =====================================================================

export type Etapa =
  | 'fila' | 'corte' | 'dobra' | 'solda_montagem' | 'pintura'
  | 'embalagem' | 'transporte' | 'entregue' | 'pos_venda' | 'concluido';

interface OrdemServico {
  id: string;
  numero?: number;
  propostaId?: string | null;
  clienteId?: string | null;
  clienteNome: string;
  itens: any[];
  valorTotal: number;
  etapa: Etapa;
  dataEntrega?: string | null;
  observacoes?: string;
  etapaAtualizadaEm?: string;
  historicoEtapas?: Array<{ de: string; para: string; em: string }>;
  criadoEm?: string;
  atualizadoEm?: string;
}

const COLUNAS: { etapa: Etapa; titulo: string; cor: string; corHeader: string }[] = [
  { etapa: 'fila',           titulo: 'Fila',             cor: 'bg-slate-100',  corHeader: 'bg-slate-200 text-slate-700' },
  { etapa: 'corte',          titulo: 'Corte',            cor: 'bg-amber-50',   corHeader: 'bg-amber-200 text-amber-900' },
  { etapa: 'dobra',          titulo: 'Dobra',            cor: 'bg-orange-50',  corHeader: 'bg-orange-200 text-orange-900' },
  { etapa: 'solda_montagem', titulo: 'Solda / Montagem', cor: 'bg-rose-50',    corHeader: 'bg-rose-200 text-rose-900' },
  { etapa: 'pintura',        titulo: 'Pintura',          cor: 'bg-indigo-50',  corHeader: 'bg-indigo-200 text-indigo-900' },
  { etapa: 'embalagem',      titulo: 'Embalagem',        cor: 'bg-teal-50',    corHeader: 'bg-teal-200 text-teal-900' },
  { etapa: 'transporte',     titulo: 'Transporte',       cor: 'bg-sky-50',     corHeader: 'bg-sky-200 text-sky-900' },
  { etapa: 'entregue',       titulo: 'Entregue',         cor: 'bg-emerald-50', corHeader: 'bg-emerald-200 text-emerald-900' },
  { etapa: 'pos_venda',      titulo: 'Pos-venda',        cor: 'bg-violet-50',  corHeader: 'bg-violet-200 text-violet-900' },
  { etapa: 'concluido',      titulo: 'Concluido',        cor: 'bg-zinc-100',   corHeader: 'bg-zinc-300 text-zinc-700' },
];

function formatarTempoParado(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'agora';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function formatarReais(v: number): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const PCPKanban: React.FC = () => {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string>('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverColuna, setHoverColuna] = useState<Etapa | null>(null);

  const carregar = async () => {
    try {
      setErro('');
      const r = await fetch('/api/ordens');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setOrdens(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErro(e.message || 'Erro carregando ordens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, []);

  const ordensPorEtapa = useMemo(() => {
    const map: Record<Etapa, OrdemServico[]> = {
      fila: [], corte: [], dobra: [], solda_montagem: [], pintura: [],
      embalagem: [], transporte: [], entregue: [], pos_venda: [], concluido: []
    };
    for (const o of ordens) {
      if (map[o.etapa]) map[o.etapa].push(o);
    }
    return map;
  }, [ordens]);

  const moverParaEtapa = async (osId: string, novaEtapa: Etapa) => {
    setOrdens(prev => prev.map(o => o.id === osId ? { ...o, etapa: novaEtapa, etapaAtualizadaEm: new Date().toISOString() } : o));
    try {
      const r = await fetch(`/api/ordens?id=${encodeURIComponent(osId)}&etapa=${encodeURIComponent(novaEtapa)}`, { method: 'PATCH' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e: any) {
      setErro(`Falha movendo OS: ${e.message}`);
      carregar();
    }
  };

  const handleDragStart = (osId: string) => (e: React.DragEvent) => {
    setDraggingId(osId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', osId);
  };

  const handleDragOver = (etapa: Etapa) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoverColuna !== etapa) setHoverColuna(etapa);
  };

  const handleDrop = (etapa: Etapa) => (e: React.DragEvent) => {
    e.preventDefault();
    const osId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setHoverColuna(null);
    if (!osId) return;
    const os = ordens.find(o => o.id === osId);
    if (!os || os.etapa === etapa) return;
    moverParaEtapa(osId, etapa);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setHoverColuna(null);
  };

  const criarOSTeste = async () => {
    const cliente = window.prompt('Nome do cliente:', 'Cliente Teste');
    if (!cliente) return;
    const produto = window.prompt('Produto / servico:', 'Produto exemplo');
    if (!produto) return;
    const valorStr = window.prompt('Valor total (R$):', '1000');
    const valor = Number((valorStr || '0').replace(',', '.')) || 0;
    try {
      const r = await fetch('/api/ordens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNome: cliente,
          itens: [{ nome: produto, qtd: 1, valor }],
          valorTotal: valor,
          etapa: 'fila',
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      carregar();
    } catch (e: any) {
      setErro(`Falha criando OS: ${e.message}`);
    }
  };

  const deletarOS = async (osId: string) => {
    if (!window.confirm('Deletar essa OS?')) return;
    try {
      const r = await fetch(`/api/ordens?id=${encodeURIComponent(osId)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setOrdens(prev => prev.filter(o => o.id !== osId));
    } catch (e: any) {
      setErro(`Falha deletando: ${e.message}`);
    }
  };

  return (
    <div className="p-4 h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">PCP - Kanban de Producao</h1>
          <p className="text-sm text-slate-500">
            Arraste os cards entre as etapas. {ordens.length} ordens no total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={criarOSTeste}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            <Plus className="w-4 h-4" /> Nova OS
          </button>
          <button
            onClick={carregar}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recarregar
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex-shrink-0">
          <AlertCircle className="w-4 h-4" /> {erro}
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 h-full min-w-max pb-4">
          {COLUNAS.map(col => {
            const items = ordensPorEtapa[col.etapa] || [];
            const isHover = hoverColuna === col.etapa;
            return (
              <div
                key={col.etapa}
                className={`flex flex-col w-72 flex-shrink-0 rounded-lg ${col.cor} ${isHover ? 'ring-2 ring-indigo-400' : ''} transition-all`}
                onDragOver={handleDragOver(col.etapa)}
                onDragLeave={() => setHoverColuna(null)}
                onDrop={handleDrop(col.etapa)}
              >
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${col.corHeader}`}>
                  <span className="font-semibold text-sm">{col.titulo}</span>
                  <span className="bg-white/50 text-xs font-medium px-2 py-0.5 rounded-full">{items.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]">
                  {items.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-4">Vazio</div>
                  )}
                  {items.map(os => {
                    const dragging = draggingId === os.id;
                    return (
                      <motion.div
                        key={os.id}
                        layoutId={os.id}
                        draggable
                        onDragStart={handleDragStart(os.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white border border-slate-200 rounded-md p-2.5 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing select-none ${dragging ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-[10px] font-mono text-slate-500">
                            OS-{os.numero || os.id.slice(0, 6)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] flex items-center gap-1 text-slate-500">
                              <Clock className="w-3 h-3" />
                              {formatarTempoParado(os.etapaAtualizadaEm)}
                            </span>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); deletarOS(os.id); }}
                              className="text-slate-300 hover:text-red-500 text-[10px]"
                              title="Deletar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-slate-800 truncate">
                            {os.clienteNome || 'Cliente nao identificado'}
                          </span>
                        </div>
                        {Array.isArray(os.itens) && os.itens.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-[11px] text-slate-600 truncate">
                              {os.itens.map((it: any) => it.nome || it.name || '').filter(Boolean).join(', ') || `${os.itens.length} item(s)`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs font-semibold text-emerald-700">
                            {formatarReais(os.valorTotal)}
                          </span>
                          {os.dataEntrega && (
                            <span className="text-[10px] flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(os.dataEntrega).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && ordens.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}
    </div>
  );
};

export default PCPKanban;
