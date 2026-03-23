import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle, Save, UserPlus, ShoppingCart, Tag, FileText, Search } from 'lucide-react';
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
  const [clienteSearch, setClienteSearch] = useState<string>('');
  const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [isNovoClienteModalOpen, setIsNovoClienteModalOpen] = useState(false);
  const [isPropostaOpen, setIsPropostaOpen] = useState(false);
  const clienteInputRef = useRef<HTMLInputElement>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);

  // Filtered clients based on search
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch.trim()) return state.clientes;
    const termo = clienteSearch.toLowerCase();
    return state.clientes.filter(c => 
      c.nome.toLowerCase().includes(termo) || 
      c.documento?.toLowerCase().includes(termo) ||
      c.cidade?.toLowerCase().includes(termo)
    );
  }, [clienteSearch, state.clientes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(e.target as Node)) {
        setIsClienteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCliente = (id: string, nome: string) => {
    setSelectedClienteId(id);
    setClienteSearch(nome);
    setIsClienteDropdownOpen(false);
  };

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

  const formatPrice = (item: any) => {
    const val = Number(item.preco ?? item.price ?? 0);
    return isFinite(val)
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
      : 'R$ 0,00';
  };

  return (
    <>
      {/* Overlay with very high z-index to block everything behind */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ isolation: 'isolate' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-100 w-full max-w-2xl rounded-2xl p-6 shadow-2xl text-slate-900 border border-slate-300 max-h-[90vh] overflow-y-auto relative"
          style={{ zIndex: 10000 }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Fechamento de Negócio</h2>
              <div className="flex gap-4 mt-1">
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">ID: {proposalId}</span>
                <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Data: {todayFormatted}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
          </div>

          {/* Searchable Client Input */}
          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest">Identificação do Cliente</label>
              <button 
                onClick={() => setIsNovoClienteModalOpen(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                <UserPlus size={12} /> NOVO CLIENTE
              </button>
            </div>
            <div className="relative" ref={clienteDropdownRef}>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={clienteInputRef}
                  type="text"
                  value={clienteSearch}
                  onChange={(e) => {
                    setClienteSearch(e.target.value);
                    setIsClienteDropdownOpen(true);
                    if (!e.target.value) setSelectedClienteId('');
                  }}
                  onFocus={() => setIsClienteDropdownOpen(true)}
                  placeholder="Digite o nome do cliente para buscar..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              {isClienteDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-lg max-h-48 overflow-y-auto" style={{ zIndex: 10001 }}>
                  {clientesFiltrados.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 italic text-center">Nenhum cliente encontrado</div>
                  ) : (
                    clientesFiltrados.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCliente(c.id, c.nome)}
                        className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 ${selectedClienteId === c.id ? 'bg-blue-50 text-blue-700' : 'text-slate-800'}`}
                      >
                        <p className="font-bold text-sm">{c.nome}</p>
                        <p className="text-[10px] text-slate-500">{c.documento} • {c.cidade}/{c.uf}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Add shelf product */}
          <div className="mb-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Resumo dos Itens (Motor Fiscal MEI/DF)</label>
          </div>
          
          <div className="mb-4 p-4 bg-white border border-slate-300 rounded-xl">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">➕ Adicionar Produto de Prateleira</label>
            <div className="space-y-2">
              <select 
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full p-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-800"
              >
                <option value="">Selecione um produto...</option>
                {state.inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.nome} (Estoque: {item.quantidadeEstoque})</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={isNaN(selectedQuantity) ? "" : selectedQuantity}
                  onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                  placeholder="Qtd" 
                  className="w-24 p-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-800" 
                />
                <button 
                  onClick={handleAdicionarProduto}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* Cart items */}
          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto border border-slate-300 rounded-xl p-4 bg-white/50">
            {state.carrinhoAtual.length === 0 ? (
              <div className="py-8 text-center text-slate-500 italic text-sm">
                Carrinho vazio. Adicione produtos para fechar a proposta.
              </div>
            ) : (
              state.carrinhoAtual.map((item, index) => (
                <div key={index} className="flex justify-between items-start border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-bold text-sm text-slate-900">
                      {item.nome || item.name}
                      <span className="ml-2 text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-black">
                        {item.tier || 'Comercial'}
                      </span>
                    </p>
                    
                    {item.materiaisNecessarios && item.materiaisNecessarios.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-wider">📦 Materiais do Estoque:</p>
                        <div className="grid grid-cols-1 gap-1">
                          {item.materiaisNecessarios.map((m: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[9px] text-slate-700 bg-slate-50 p-1 rounded border border-slate-100">
                              <span className="font-bold">{m.qtd} {m.unidade}</span>
                              <span className="truncate">{m.nome}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : item.bom && item.bom.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-wider">⚙️ Índice de Peças (BOM):</p>
                        <div className="grid grid-cols-1 gap-1">
                          {item.bom.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[9px] text-slate-700 bg-slate-50 p-1 rounded border border-slate-100">
                              <span className="font-black text-indigo-600 min-w-[20px]">{p.codigo}</span>
                              <span className="font-bold truncate">{p.nome}</span>
                              <span className="text-slate-500 ml-auto shrink-0">Qtd: {p.qtd}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : item.pecas && item.pecas.length > 0 && (
                      <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                        <span className="text-blue-400 font-bold">⚙️ Materiais:</span> {item.pecas.map((p: any) => `${p.qtd}x ${p.nome}`).join(', ')}
                      </p>
                    )}
                    {item.insumos && item.insumos.length > 0 && (
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                        <span className="text-amber-400 font-bold">⚡ Insumos:</span> {item.insumos.map((i: any) => `${i.qtd}${i.unidade} ${i.nome}`).join(', ')}
                      </p>
                    )}
                    <p className="text-[9px] text-slate-500 mt-1">
                      <span className="font-bold">🕒 Mão de Obra:</span> {item.horasTrabalhadas || 0}h estimadas
                    </p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-300">
                        <Tag size={8} /> NCM: {item.ncm || '7308.90.10'}
                      </span>
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                        CFOP: {item.cfop || '5101'} (MEI)
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-slate-900 text-sm">{formatPrice(item)}</p>
                    <p className="text-[9px] text-emerald-500 font-bold uppercase">Isento de Impostos</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center mb-6 p-4 bg-white rounded-xl border border-slate-300">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total do Investimento</p>
              <p className="text-xs text-slate-600 italic">Regime MEI - Sem destaque de ICMS/IPI</p>
            </div>
            <span className="text-3xl font-black text-slate-900 tracking-tighter">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCarrinho)}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={handleSalvarRascunho} 
              disabled={state.carrinhoAtual.length === 0}
              className="flex-1 py-4 bg-slate-200 text-slate-800 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
        <div className="fixed inset-0 z-[10002] bg-white p-8 overflow-y-auto">
          <div className="flex justify-between mb-4">
            <button onClick={() => setIsPropostaOpen(false)} className="bg-slate-100 text-slate-900 px-4 py-2 rounded-lg">Fechar</button>
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
