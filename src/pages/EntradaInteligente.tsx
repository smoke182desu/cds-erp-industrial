import React, { useState } from 'react';
import { useERP } from '../contexts/ERPContext';
import { useConfig } from '../contexts/ConfigContext';
import { configEmpresa } from '../constants/configEmpresa';
import { CheckCircle } from 'lucide-react';

export const EntradaInteligente: React.FC = () => {
  const { config } = useConfig();
  const { state, darEntradaEstoque } = useERP();
  const [activeTab, setActiveTab] = useState<'necessidade' | 'entrada'>('necessidade');
  
  // Form state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qtdRecebida, setQtdRecebida] = useState(0);
  const [novoCusto, setNovoCusto] = useState(0);

  const itensNecessarios = state.inventoryItems.filter(
    item => item.quantidadeEstoque <= item.estoqueMinimo
  );

  const handleGerarPO = () => {
    const poContent = itensNecessarios.map(item => {
      const sugestao = (item.estoqueMinimo * 3) - item.quantidadeEstoque;
      return `${item.nome} (Sugestão: ${sugestao} ${item.unidade})`;
    }).join('\n');
    
    alert(`Pedido de Compra Gerado:\n\n${poContent}\n\n"Solicitamos cotação/faturamento dos itens acima para entrega na ${config.nomeEmpresa || configEmpresa.razaoSocial}. Faturamento para 30/60 dias."`);
  };

  const handleDarEntrada = () => {
    if (!selectedItemId || qtdRecebida <= 0 || novoCusto <= 0) {
      alert('Preencha todos os campos corretamente.');
      return;
    }
    darEntradaEstoque(selectedItemId, qtdRecebida, novoCusto);
    alert('Entrada no estoque realizada com sucesso!');
    setSelectedItemId('');
    setQtdRecebida(0);
    setNovoCusto(0);
  };

  return (
    <div className="p-6 bg-white min-h-screen text-slate-900">
      <h2 className="text-2xl font-bold mb-6">Gestão de Compras e Recebimento</h2>
      
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('necessidade')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'necessidade' ? 'bg-blue-600' : 'bg-slate-100'}`}
        >
          🚨 Necessidade de Compra
        </button>
        <button 
          onClick={() => setActiveTab('entrada')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'entrada' ? 'bg-blue-600' : 'bg-slate-100'}`}
        >
          📦 Entrada de Notas Fiscais
        </button>
      </div>

      {activeTab === 'necessidade' && (
        <div className="bg-slate-100 p-6 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Itens abaixo do estoque mínimo</h3>
            <button onClick={handleGerarPO} className="bg-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-500">🛒 Gerar Pedido de Compra (PDF)</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-600 border-b border-slate-300">
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-right">Estoque Atual</th>
                <th className="p-2 text-right">Mínimo</th>
                <th className="p-2 text-right">Sugestão</th>
                <th className="p-2 text-right">Custo Estimado</th>
              </tr>
            </thead>
            <tbody>
              {itensNecessarios.map(item => {
                const sugestao = (item.estoqueMinimo * 3) - item.quantidadeEstoque;
                return (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="p-2">{item.codigo}</td>
                    <td className="p-2">{item.nome}</td>
                    <td className="p-2 text-right text-red-400 font-bold">{item.quantidadeEstoque}</td>
                    <td className="p-2 text-right">{item.estoqueMinimo}</td>
                    <td className="p-2 text-right font-bold text-blue-400">{sugestao}</td>
                    <td className="p-2 text-right">R$ {item.custo.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'entrada' && (
        <div className="bg-slate-100 p-6 rounded-xl max-w-md">
          <h3 className="text-lg font-bold mb-4">Registrar Recebimento</h3>
          <div className="space-y-4">
            <select 
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded"
            >
              <option value="">Selecione um produto...</option>
              {state.inventoryItems.map(item => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
            <input 
              type="number"
              value={qtdRecebida}
              onChange={(e) => setQtdRecebida(Number(e.target.value))}
              placeholder="Quantidade Recebida"
              className="w-full p-2 bg-white border border-slate-300 rounded"
            />
            <input 
              type="number"
              value={novoCusto}
              onChange={(e) => setNovoCusto(Number(e.target.value))}
              placeholder="Novo Custo Unitário (R$)"
              className="w-full p-2 bg-white border border-slate-300 rounded"
            />
            <button 
              onClick={handleDarEntrada}
              className="w-full bg-emerald-600 py-2 rounded font-bold hover:bg-emerald-500 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Dar Entrada no Estoque
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
