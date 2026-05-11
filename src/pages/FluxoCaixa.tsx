import React, { useMemo, useState } from 'react';
import { useERP } from '../contexts/ERPContext';
import { CheckCircle, DollarSign, TrendingUp, TrendingDown, Wallet, Filter, CreditCard } from 'lucide-react';
import { FORMAS_PAGAMENTO_LABEL, type FormaPagamento } from '../types';

const fmtMoeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtData = (d: string) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
};

type FiltroTipo = 'TODOS' | 'RECEITA' | 'DESPESA';

export const FluxoCaixa: React.FC = () => {
  const { state, atualizarStatusTransacao } = useERP();
  const transacoes = state.transacoesFinanceiras || [];
  const [filtro, setFiltro] = useState<FiltroTipo>('TODOS');

  const transacoesFiltradas = useMemo(() => {
    if (filtro === 'TODOS') return transacoes;
    return transacoes.filter(t => t.tipo === filtro);
  }, [transacoes, filtro]);

  const resumo = useMemo(() => {
    const aReceber = transacoes
      .filter(t => t.tipo === 'RECEITA' && t.status === 'PENDENTE')
      .reduce((acc, t) => acc + t.valor, 0);
    const aPagar = transacoes
      .filter(t => t.tipo === 'DESPESA' && t.status === 'PENDENTE')
      .reduce((acc, t) => acc + t.valor, 0);
    const recebido = transacoes
      .filter(t => t.tipo === 'RECEITA' && t.status === 'PAGO')
      .reduce((acc, t) => acc + t.valor, 0);
    const pago = transacoes
      .filter(t => t.tipo === 'DESPESA' && t.status === 'PAGO')
      .reduce((acc, t) => acc + t.valor, 0);
    const totalDescontoPix = transacoes
      .filter(t => t.tipo === 'RECEITA' && (t.descontoPix || 0) > 0)
      .reduce((acc, t) => acc + (t.descontoPix || 0), 0);
    return { aReceber, aPagar, recebido, pago, saldo: (recebido + aReceber) - (pago + aPagar), totalDescontoPix };
  }, [transacoes]);

  return (
    <div className="h-full flex flex-col gap-5 bg-slate-50 p-6 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="text-blue-500" size={24} /> Fluxo de Caixa
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Movimentações financeiras baseadas em vendas</p>
        </div>
        {resumo.totalDescontoPix > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm">
            <span className="text-green-600 font-medium">Descontos PIX concedidos: </span>
            <span className="text-green-700 font-bold">{fmtMoeda(resumo.totalDescontoPix)}</span>
          </div>
        )}
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-amber-100 p-1.5 rounded-lg"><TrendingUp size={16} className="text-amber-600" /></div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">A Receber</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{fmtMoeda(resumo.aReceber)}</p>
          <p className="text-xs text-slate-400 mt-1">{transacoes.filter(t => t.tipo === 'RECEITA' && t.status === 'PENDENTE').length} pendentes</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-red-100 p-1.5 rounded-lg"><TrendingDown size={16} className="text-red-600" /></div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">A Pagar</p>
          </div>
          <p className="text-2xl font-bold text-red-500">{fmtMoeda(resumo.aPagar)}</p>
          <p className="text-xs text-slate-400 mt-1">{transacoes.filter(t => t.tipo === 'DESPESA' && t.status === 'PENDENTE').length} pendentes</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-emerald-100 p-1.5 rounded-lg"><DollarSign size={16} className="text-emerald-600" /></div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Recebido</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{fmtMoeda(resumo.recebido)}</p>
          <p className="text-xs text-slate-400 mt-1">{transacoes.filter(t => t.tipo === 'RECEITA' && t.status === 'PAGO').length} confirmados</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-100 p-1.5 rounded-lg"><Wallet size={16} className="text-blue-600" /></div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Saldo Projetado</p>
          </div>
          <p className={`text-2xl font-bold ${resumo.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtMoeda(resumo.saldo)}</p>
          <p className="text-xs text-slate-400 mt-1">Receitas - Despesas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        {(['TODOS', 'RECEITA', 'DESPESA'] as FiltroTipo[]).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              filtro === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'TODOS' ? 'Todas' : f === 'RECEITA' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-2">{transacoesFiltradas.length} movimentações</span>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Descrição</th>
                <th className="p-3 text-left">Forma Pgto</th>
                <th className="p-3 text-left">Origem</th>
                <th className="p-3 text-right">Valor Cheio</th>
                <th className="p-3 text-right">Desconto</th>
                <th className="p-3 text-right">Valor Final</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400 text-xs italic">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              ) : (
                transacoesFiltradas.map(t => {
                  const formaPgtoLabel = t.formaPagamento
                    ? FORMAS_PAGAMENTO_LABEL[t.formaPagamento as FormaPagamento] || t.formaPagamento
                    : '-';
                  const temDesconto = (t.descontoPix || 0) > 0;
                  const valorCheio = t.valorCheio || t.valor;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-3 text-slate-600 whitespace-nowrap text-xs">{fmtData(t.dataVencimento)}</td>
                      <td className="p-3">
                        <p className="font-medium text-slate-900 text-sm">{t.descricao}</p>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.formaPagamento === 'pix'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          <CreditCard size={10} />
                          {formaPgtoLabel}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[10px]">{t.origem}</td>
                      <td className="p-3 text-right text-slate-500 text-xs font-mono">
                        {temDesconto ? fmtMoeda(valorCheio) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {temDesconto ? (
                          <span className="text-green-600 font-bold text-xs">-{fmtMoeda(t.descontoPix || 0)}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className={`p-3 text-right font-bold font-mono ${t.tipo === 'RECEITA' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {t.tipo === 'RECEITA' ? '+' : '-'}{fmtMoeda(t.valor)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                          t.status === 'PAGO'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {t.status === 'PENDENTE' && (
                          <button
                            onClick={() => atualizarStatusTransacao(t.id)}
                            title="Confirmar pagamento"
                            className="p-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-500 rounded-lg transition-all"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
