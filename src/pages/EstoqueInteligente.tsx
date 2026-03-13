import React, { useMemo } from 'react';
import { Package, ShoppingCart } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';

export const EstoqueInteligente: React.FC = () => {
  const { state } = useERP();
  const { inventoryItems, inventory } = state;

  const summary = useMemo(() => {
    const totalItens = inventoryItems.length;
    const itensEmAlerta = inventoryItems.filter(item => {
      const qtdAtual = inventory[item.id] || 0;
      return qtdAtual <= item.estoqueMinimo;
    }).length;
    
    const valorTotal = inventoryItems.reduce((sum, item) => {
      const qtdAtual = inventory[item.id] || 0;
      return sum + (qtdAtual * item.custo);
    }, 0);

    return { totalItens, itensEmAlerta, valorTotal };
  }, [inventoryItems, inventory]);

  return (
    <div className="h-full flex flex-col gap-6 p-2">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="text-blue-500" /> Almoxarifado Industrial
        </h2>
        <div className="flex gap-2">
          <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-mono">
            Margem Aplicada: 30%
          </span>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <p className="text-slate-400 text-sm">Total de Itens no Catálogo</p>
          <p className="text-3xl font-bold text-white">{summary.totalItens}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <p className="text-slate-400 text-sm">Itens em Alerta (Falta)</p>
          <p className="text-3xl font-bold text-rose-400">{summary.itensEmAlerta}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <p className="text-slate-400 text-sm">Valor em Estoque (Custo)</p>
          <p className="text-3xl font-bold text-emerald-400">R$ {summary.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Cód / Nome</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4 text-right">Qtd Atual</th>
                <th className="px-6 py-4 text-right">Est. Mínimo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Custo (Un)</th>
                <th className="px-6 py-4 text-right">Venda (Un)</th>
                <th className="px-6 py-4">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {inventoryItems.map((item) => {
                const qtdAtual = inventory[item.id] || 0;
                const isAlert = qtdAtual <= item.estoqueMinimo;
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-blue-400">{item.codigo}</span>
                        <span className="font-medium text-white">{item.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] uppercase">
                        {item.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {qtdAtual} {item.unidade}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      {item.estoqueMinimo} {item.unidade}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isAlert ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className={isAlert ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {isAlert ? 'REPOR' : 'OK'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">
                      R$ {item.custo.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400 font-bold">
                      R$ {item.precoVenda.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      {isAlert && (
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                          <ShoppingCart size={12} /> COMPRAR
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
