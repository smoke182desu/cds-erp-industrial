import React, { useMemo } from 'react';
import { useERP } from '../contexts/ERPContext';
import { CheckCircle } from 'lucide-react';

export const FluxoCaixa: React.FC = () => {
  const { state, atualizarStatusTransacao } = useERP();
  const transacoes = state.transacoesFinanceiras || [];

  const resumo = useMemo(() => {
    const aReceber = transacoes
      .filter(t => t.tipo === 'RECEITA' && t.status === 'PENDENTE')
      .reduce((acc, t) => acc + t.valor, 0);
    const aPagar = transacoes
      .filter(t => t.tipo === 'DESPESA' && t.status === 'PENDENTE')
      .reduce((acc, t) => acc + t.valor, 0);
    return { aReceber, aPagar, saldo: aReceber - aPagar };
  }, [transacoes]);

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100">
      <h2 className="text-2xl font-bold mb-6">Fluxo de Caixa</h2>
      
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-sm">A Receber (Vendas)</p>
          <p className="text-3xl font-bold text-green-400">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.aReceber)}
          </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-sm">A Pagar (Fornecedores)</p>
          <p className="text-3xl font-bold text-red-400">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.aPagar)}
          </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-sm">Saldo Projetado</p>
          <p className="text-3xl font-bold text-blue-400">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.saldo)}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <h3 className="text-lg font-bold mb-4">Movimentações</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800">
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Descrição</th>
              <th className="p-3 text-left">Origem</th>
              <th className="p-3 text-right">Valor</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Ação</th>
            </tr>
          </thead>
          <tbody>
            {transacoes.map(t => (
              <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="p-3">{new Date(t.dataVencimento).toLocaleDateString()}</td>
                <td className="p-3">{t.descricao}</td>
                <td className="p-3 text-slate-500 font-mono text-xs">{t.origem}</td>
                <td className={`p-3 text-right font-bold ${t.tipo === 'RECEITA' ? 'text-green-400' : 'text-red-400'}`}>
                  {t.tipo === 'RECEITA' ? '+' : '-'}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor)}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${t.status === 'PAGO' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {t.status === 'PENDENTE' && (
                    <button onClick={() => atualizarStatusTransacao(t.id)} className="text-green-400 hover:text-green-300">
                      <CheckCircle size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
