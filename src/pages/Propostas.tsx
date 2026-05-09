import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Printer, X, MessageCircle, RefreshCw, Filter, TrendingUp, Clock, CheckCircle2, XCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useConfig } from '../contexts/ConfigContext';
import { configEmpresa } from '../constants/configEmpresa';

interface PropostaBD {
  id: string;
  numero: number;
  lead_id: string | null;
  telefone: string | null;
  nome_cliente: string;
  empresa: string | null;
  itens: any[];
  valor_total: number;
  status: string;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; icon: React.ReactNode; bg: string }> = {
  rascunho:  { label: 'Rascunho',  cor: 'text-amber-700',   icon: <Clock size={14} />,        bg: 'bg-amber-50 border-amber-200' },
  enviada:   { label: 'Enviada',   cor: 'text-blue-700',    icon: <Send size={14} />,          bg: 'bg-blue-50 border-blue-200' },
  ganha:     { label: 'Ganha',     cor: 'text-emerald-700', icon: <CheckCircle2 size={14} />,  bg: 'bg-emerald-50 border-emerald-200' },
  perdida:   { label: 'Perdida',   cor: 'text-red-700',     icon: <XCircle size={14} />,       bg: 'bg-red-50 border-red-200' },
};

const fmtMoeda = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtData = (d: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const Propostas: React.FC = () => {
  const { config } = useConfig();
  const [propostas, setPropostas] = useState<PropostaBD[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [selected, setSelected] = useState<PropostaBD | null>(null);

  const carregarPropostas = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filtroStatus !== 'todas' ? `?status=${filtroStatus}` : '';
      const res = await fetch(`/api/propostas${qs}`);
      const data = await res.json();
      setPropostas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar propostas:', e);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => { carregarPropostas(); }, [carregarPropostas]);

  const atualizarStatus = async (id: string, novoStatus: string) => {
    try {
      await fetch('/api/propostas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: novoStatus }),
      });
      setPropostas(prev => prev.map(p => p.id === id ? { ...p, status: novoStatus } : p));
    } catch (e) {
      console.error('Erro ao atualizar status:', e);
    }
  };

  const handleWhatsApp = (p: PropostaBD) => {
    const msg = `Olá ${p.nome_cliente}, segue o resumo da proposta nº CDS-${p.numero} no valor de ${fmtMoeda(p.valor_total)}. Estamos à disposição!`;
    const fone = p.telefone?.replace(/\D/g, '');
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Totalizadores
  const totalGeral = propostas.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalEnviadas = propostas.filter(p => p.status === 'enviada').reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalGanhas = propostas.filter(p => p.status === 'ganha').reduce((s, p) => s + (p.valor_total || 0), 0);
  const qtdTotal = propostas.length;
  const qtdGanhas = propostas.filter(p => p.status === 'ganha').length;

  return (
    <div className="h-full flex flex-col gap-5 bg-slate-50 p-6 rounded-2xl border border-slate-200/50">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Propostas Comerciais</h2>
          <p className="text-slate-500 text-sm mt-0.5">Todas as propostas geradas pelo CRM</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={carregarPropostas} disabled={loading}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Total Propostas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{qtdTotal}</p>
          <p className="text-xs text-slate-500">{fmtMoeda(totalGeral)}</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase text-blue-400 font-bold tracking-wider">Enviadas (Pipeline)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{propostas.filter(p => p.status === 'enviada').length}</p>
          <p className="text-xs text-blue-500">{fmtMoeda(totalEnviadas)}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider">Ganhas</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{qtdGanhas}</p>
          <p className="text-xs text-emerald-500">{fmtMoeda(totalGanhas)}</p>
        </div>
        <div className="bg-white border border-violet-200 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase text-violet-400 font-bold tracking-wider">Taxa de Conversão</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">{qtdTotal > 0 ? Math.round((qtdGanhas / qtdTotal) * 100) : 0}%</p>
          <p className="text-xs text-violet-500">{qtdGanhas} de {qtdTotal}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        {['todas', 'rascunho', 'enviada', 'ganha', 'perdida'].map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              filtroStatus === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}>
            {s === 'todas' ? 'Todas' : STATUS_CONFIG[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Itens</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs">Carregando propostas...</td></tr>
              ) : propostas.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs italic">Nenhuma proposta encontrada.</td></tr>
              ) : (
                propostas.map(p => {
                  const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.rascunho;
                  const itensArr = Array.isArray(p.itens) ? p.itens : [];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3">
                        <span className="font-mono text-indigo-600 font-bold text-xs">CDS-{p.numero}</span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 text-sm">{p.nome_cliente || '-'}</p>
                        {p.empresa && <p className="text-[10px] text-slate-400">{p.empresa}</p>}
                        {p.telefone && <p className="text-[10px] text-slate-400">{p.telefone}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-0.5">
                          {itensArr.slice(0, 2).map((it: any, i: number) => (
                            <span key={i} className="text-xs text-slate-600 truncate max-w-[180px]">
                              {it.qtd || 1}x {it.nome || 'Item'}
                            </span>
                          ))}
                          {itensArr.length > 2 && <span className="text-[10px] text-slate-400">+{itensArr.length - 2} mais</span>}
                          {itensArr.length === 0 && <span className="text-[10px] text-slate-400 italic">Sem itens</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono font-bold text-slate-900">{fmtMoeda(p.valor_total)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.cor}`}>
                          {st.icon}
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtData(p.criado_em)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSelected(p)} title="Ver detalhes"
                            className="p-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-500 rounded-lg transition-all">
                            <FileText size={14} />
                          </button>
                          {p.telefone && (
                            <button onClick={() => handleWhatsApp(p)} title="Enviar via WhatsApp"
                              className="p-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-500 rounded-lg transition-all">
                              <MessageCircle size={14} />
                            </button>
                          )}
                          {p.status === 'enviada' && (
                            <>
                              <button onClick={() => atualizarStatus(p.id, 'ganha')} title="Marcar como Ganha"
                                className="p-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-500 rounded-lg transition-all">
                                <CheckCircle2 size={14} />
                              </button>
                              <button onClick={() => atualizarStatus(p.id, 'perdida')} title="Marcar como Perdida"
                                className="p-1.5 bg-slate-100 hover:bg-red-600 hover:text-white text-slate-500 rounded-lg transition-all">
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {p.status === 'rascunho' && (
                            <button onClick={() => atualizarStatus(p.id, 'enviada')} title="Marcar como Enviada"
                              className="p-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-500 rounded-lg transition-all">
                              <Send size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalhe */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelected(null)}>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-lg text-white"><FileText size={20} /></div>
                  <div>
                    <h3 className="font-bold text-slate-900">Proposta CDS-{selected.numero}</h3>
                    <p className="text-xs text-slate-500">{fmtData(selected.criado_em)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm transition-all">
                    <Printer size={16} /> Imprimir
                  </button>
                  <button onClick={() => setSelected(null)} className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition-all">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Conteudo */}
              <div className="p-6 space-y-6">
                {/* Dados do Cliente */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Cliente</h4>
                    <p className="font-bold text-slate-900">{selected.nome_cliente}</p>
                    {selected.empresa && <p className="text-sm text-slate-600">{selected.empresa}</p>}
                    {selected.telefone && <p className="text-sm text-slate-500 mt-1">{selected.telefone}</p>}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Status & Valor</h4>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${(STATUS_CONFIG[selected.status] || STATUS_CONFIG.rascunho).bg} ${(STATUS_CONFIG[selected.status] || STATUS_CONFIG.rascunho).cor}`}>
                      {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.rascunho).icon}
                      {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.rascunho).label}
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-2">{fmtMoeda(selected.valor_total)}</p>
                  </div>
                </div>

                {/* Tabela de itens */}
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Itens da Proposta</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="py-2 text-left font-bold text-[10px] uppercase text-slate-500">Item</th>
                        <th className="py-2 text-center font-bold text-[10px] uppercase text-slate-500">Qtd</th>
                        <th className="py-2 text-right font-bold text-[10px] uppercase text-slate-500">Unitário</th>
                        <th className="py-2 text-right font-bold text-[10px] uppercase text-slate-500">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(Array.isArray(selected.itens) ? selected.itens : []).map((it: any, i: number) => (
                        <tr key={i}>
                          <td className="py-3">
                            <p className="font-medium text-slate-900">{it.nome || 'Item'}</p>
                            {it.descricao && <p className="text-[10px] text-slate-400">{it.descricao}</p>}
                          </td>
                          <td className="py-3 text-center font-mono text-slate-700">{it.qtd || 1}</td>
                          <td className="py-3 text-right font-mono text-slate-600">{fmtMoeda(it.valorUnitario || it.price || 0)}</td>
                          <td className="py-3 text-right font-mono font-bold text-slate-900">{fmtMoeda((it.qtd || 1) * (it.valorUnitario || it.price || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300">
                        <td colSpan={3} className="py-4 text-right font-bold uppercase text-xs text-slate-500">Total</td>
                        <td className="py-4 text-right font-bold text-xl text-indigo-700">{fmtMoeda(selected.valor_total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {selected.observacoes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="text-[10px] uppercase font-bold text-amber-500 tracking-wider mb-1">Observações</h4>
                    <p className="text-sm text-amber-800">{selected.observacoes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <p className="text-[10px] text-slate-400">{config.nomeEmpresa || configEmpresa.razaoSocial} — Proposta gerada via ERP CDS</p>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {selected.id?.slice(0, 8)}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
