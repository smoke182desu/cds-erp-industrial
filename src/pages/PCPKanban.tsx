import React from 'react';
import { useERP } from '../contexts/ERPContext';
import { OrdemServico } from '../types';
import { AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';

export const PCPKanban: React.FC = () => {
  const { state, moverEtapaOS } = useERP();
  const colunas: OrdemServico['status'][] = ['Fila de Produção', 'Corte e Dobra', 'Solda e Montagem', 'Pintura e Acabamento', 'Expedição/Pronto'];

  const getEstoqueBaixo = (itens: any[]) => {
    return itens.some(item => {
      const itemId = item.id || 'item-generico';
      const estoque = state.inventory[itemId] || 0;
      const itemEstoque = state.inventoryItems.find(i => i.id === itemId);
      return itemEstoque && estoque < itemEstoque.estoqueMinimo;
    });
  };

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <h2 className="text-2xl font-bold text-white mb-6">Kanban de Produção (PCP)</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {colunas.map(coluna => (
          <div key={coluna} className="w-72 bg-slate-800 rounded-xl p-4 flex-shrink-0">
            <h3 className="font-bold text-slate-300 mb-4 uppercase text-sm tracking-widest">{coluna}</h3>
            <div className="space-y-4">
              {state.ordensServico.filter(os => os.status === coluna).map(os => (
                <div key={os.id} className="bg-slate-700 p-4 rounded-lg shadow-md border border-slate-600">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-blue-400">{os.id}</span>
                    {getEstoqueBaixo(os.itens) && <AlertTriangle size={16} className="text-red-500" />}
                  </div>
                  <p className="font-bold text-white text-sm">{os.clienteNome}</p>
                  <p className="text-xs text-slate-400 mt-1">{os.itens.length} itens</p>
                  
                  <div className="flex justify-between mt-4">
                    <button 
                      disabled={coluna === 'Fila de Produção'}
                      onClick={() => {
                        const index = colunas.indexOf(coluna);
                        moverEtapaOS(os.id, colunas[index - 1]);
                      }}
                      className="p-1 hover:bg-slate-600 rounded disabled:opacity-30"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      disabled={coluna === 'Expedição/Pronto'}
                      onClick={() => {
                        const index = colunas.indexOf(coluna);
                        moverEtapaOS(os.id, colunas[index + 1]);
                      }}
                      className="p-1 hover:bg-slate-600 rounded disabled:opacity-30"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
