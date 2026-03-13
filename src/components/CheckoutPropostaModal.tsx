import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle, Save, UserPlus, ShoppingCart, Tag, FileText } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { NovoClienteModal } from './NovoClienteModal';
import { PropostaDocumento } from './PropostaDocumento';

interface CheckoutPropostaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutPropostaModal: React.FC<CheckoutPropostaModalProps> = ({ isOpen, onClose }) => {
  const { state, totalCarrinho, aprovarVenda, salvarRascunho, limparCarrinho, adicionarAoCarrinho } = useERP();
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [isNovoClienteModalOpen, setIsNovoClienteModalOpen] = useState(false);
  const [isPropostaOpen, setIsPropostaOpen] = useState(false);

  const handleAdicionarProduto = () => {
    const produto = state.inventoryItems.find(item => item.id === selectedProductId);
    if (!produto) {
      alert('Selecione um produto!');
      return;
    }
    
    adicionarAoCarrinho({
      ...produto,
      nome: produto.nome,
      preco: produto.precoVenda * selectedQuantity,
      qtd: selectedQuantity
    });
    
    setSelectedProductId('');
    setSelectedQuantity(1);
  };

  const proposalId = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PROP-${today}-${random}`;
  }, [isOpen]);

  const todayFormatted = new Date().toLocaleDateString('pt-BR');

  if (!isOpen) return null;

  const handleSalvarRascunho = () => {
    if (!selectedClienteId) {
      alert('Selecione um cliente para salvar o rascunho!');
      return;
    }
    salvarRascunho(selectedClienteId);
    onClose();
  };

  const handleAprovarVenda = () => {
    if (!selectedClienteId) {
      alert('Selecione um cliente!');
      return;
    }
    setIsPropostaOpen(true);
  };

  const cliente = state.clientes.find(c => c.id === selectedClienteId);

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl text-slate-100 border border-slate-700"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Fechamento de Negócio</h2>
              <div className="flex gap-4 mt-1">
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">ID: {proposalId}</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Data: {todayFormatted}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Identificação do Cliente</label>
              <button 
                onClick={() => setIsNovoClienteModalOpen(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <UserPlus size={12} /> NOVO CLIENTE
              </button>
            </div>
            <select 
              value={selectedClienteId}
              onChange={(e) => setSelectedClienteId(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">Selecione um cliente da base...</option>
              {state.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resumo dos Itens (Motor Fiscal MEI/DF)</label>
          </div>
          
          <div className="mb-6 p-4 bg-slate-900 border border-slate-700 rounded-xl">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">➕ Adicionar Produto de Prateleira</label>
            <div className="flex gap-2">
              <select 
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
              >
                <option value="">Selecione um produto...</option>
                {state.inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.nome} (Estoque: {item.quantidadeEstoque})</option>
                ))}
              </select>
              <input 
                type="number" 
                value={selectedQuantity}
                onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                placeholder="Qtd" 
                className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200" 
              />
              <button 
                onClick={handleAdicionarProduto}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-500"
              >
                Adicionar
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto border border-slate-700 rounded-xl p-4 bg-slate-900/50">
            {state.carrinhoAtual.length === 0 ? (
              <div className="py-8 text-center text-slate-500 italic text-sm">
                Carrinho vazio. Adicione produtos para fechar a proposta.
              </div>
            ) : (
              state.carrinhoAtual.map((item, index) => (
                <div key={index} className="flex justify-between items-start border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-sm text-white">{item.nome || item.name}</p>
                    
                    {item.pecas && item.pecas.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                        <span className="text-blue-400 font-bold">⚙️ Materiais:</span> {item.pecas.map((p: any) => `${p.qtd}x ${p.nome}`).join(', ')}
                      </p>
                    )}
                    {item.insumos && item.insumos.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        <span className="text-amber-400 font-bold">⚡ Insumos:</span> {item.insumos.map((i: any) => `${i.qtd}${i.unidade} ${i.nome}`).join(', ')}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <span className="flex items-center gap-1 text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                        <Tag size={8} /> NCM: {item.ncm || '7308.90.10'}
                      </span>
                      <span className="text-[9px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800/50">
                        CFOP: {item.cfop || '5101'} (MEI)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-white text-sm">
                      {typeof item.preco === 'number' || typeof item.price === 'number'
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco || item.price)
                        : 'R$ 0,00'}
                    </p>
                    <p className="text-[9px] text-emerald-500 font-bold uppercase">Isento de Impostos</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between items-center mb-8 p-4 bg-slate-900 rounded-xl border border-slate-700">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total do Investimento</p>
              <p className="text-xs text-slate-400 italic">Regime MEI - Sem destaque de ICMS/IPI</p>
            </div>
            <span className="text-3xl font-black text-white tracking-tighter">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCarrinho)}
            </span>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleSalvarRascunho} 
              disabled={state.carrinhoAtual.length === 0}
              className="flex-1 py-4 bg-slate-700 text-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Save size={18} /> Salvar Rascunho
            </button>
            <button 
              onClick={handleAprovarVenda} 
              disabled={state.carrinhoAtual.length === 0 || !selectedClienteId}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <FileText size={18} /> GERAR PROPOSTA
            </button>
          </div>
        </motion.div>
      </div>

      {isNovoClienteModalOpen && <NovoClienteModal onClose={() => setIsNovoClienteModalOpen(false)} />}
      
      {isPropostaOpen && cliente && (
        <div className="fixed inset-0 z-[200] bg-white p-8 overflow-y-auto">
          <div className="flex justify-between mb-4">
            <button onClick={() => setIsPropostaOpen(false)} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Fechar</button>
            <button onClick={() => {
              aprovarVenda(selectedClienteId);
              window.print();
              setIsPropostaOpen(false);
              onClose();
            }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg">Imprimir/Finalizar</button>
          </div>
          <PropostaDocumento cliente={cliente} proposta={{ id: proposalId, clienteId: selectedClienteId, items: state.carrinhoAtual, total: totalCarrinho, status: 'Aprovada/Produção', data: new Date().toISOString() }} />
        </div>
      )}
    </>
  );
};
