import React, { useState } from 'react';
import { useERP } from '../contexts/ERPContext';
import { Bot, Sparkles, Upload, Loader2 } from 'lucide-react';

export const AssistenteIA: React.FC<{ onTabChange: (tab: string) => void }> = ({ onTabChange }) => {
  const { state, adicionarAoCarrinho, adicionarCliente } = useERP();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<string[]>(['Olá! Como posso ajudar na sua serralheria hoje?']);
  const [proposal, setProposal] = useState<any>(null);

  const simulateOCR = () => {
    setIsAnalyzing(true);
    setMessages(['👁️ Analisando imagem...']);
    
    setTimeout(() => {
      setMessages(prev => [...prev, '👤 Identificando cliente: João da Padaria (PF)...']);
    }, 1500);
    
    setTimeout(() => {
      setMessages(prev => [...prev, '⚙️ Cruzando lista de materiais com o Estoque Inicial...']);
    }, 3000);
    
    setTimeout(() => {
      setMessages(prev => [...prev, '✅ Proposta estruturada com sucesso!']);
      setIsAnalyzing(false);
      setProposal({
        cliente: { nome: 'João da Padaria', tipo: 'PF', documento: '000.000.000-00', email: 'joao@padaria.com', telefone: '11999999999', endereco: 'Rua das Padarias, 10' },
        itens: [
          { ...state.inventoryItems.find(i => i.nome.includes('Metalon 20x20')), qtd: 15 },
          { ...state.inventoryItems.find(i => i.nome.includes('Dobradiça')), qtd: 2 },
          { ...state.inventoryItems.find(i => i.nome.includes('Fechadura')), qtd: 1 },
          { ...state.inventoryItems.find(i => i.nome.includes('Primer')), qtd: 1 },
        ],
        maoDeObra: 450
      });
    }, 4500);
  };

  const handleEnviarParaCarrinho = () => {
    if (!proposal) return;
    adicionarCliente(proposal.cliente);
    proposal.itens.forEach((item: any) => {
      adicionarAoCarrinho({ ...item, preco: item.precoVenda });
    });
    onTabChange('checkout');
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Lado Esquerdo: Chat */}
      <div className="w-1/2 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 font-bold text-lg flex items-center gap-2">
          <Bot className="text-blue-500" /> Assistente IA
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {messages.map((m, i) => <div key={i} className="bg-white p-3 rounded-lg">{m}</div>)}
          {isAnalyzing && <Loader2 className="animate-spin text-blue-500" />}
        </div>
        <div className="p-4 border-t border-slate-200 space-y-2">
          <button onClick={simulateOCR} className="w-full bg-slate-100 p-4 rounded-xl border-2 border-dashed border-slate-400 hover:border-blue-500 flex flex-col items-center gap-2">
            <Upload /> Arraste prints ou clique para simular
          </button>
        </div>
      </div>

      {/* Lado Direito: Preview */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h3 className="text-xl font-bold mb-6">Carrinho Mágico</h3>
        {proposal ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
            <p><strong>Cliente:</strong> {proposal.cliente.nome} ({proposal.cliente.tipo})</p>
            <div>
              <strong>Itens Lidos:</strong>
              <ul className="list-disc pl-5">
                {proposal.itens.map((item: any, i: number) => <li key={i}>{item.nome}</li>)}
              </ul>
            </div>
            <p><strong>Mão de Obra Sugerida:</strong> R$ {proposal.maoDeObra.toFixed(2)}</p>
            <button onClick={handleEnviarParaCarrinho} className="w-full bg-emerald-600 py-3 rounded-xl font-bold hover:bg-emerald-500 flex items-center justify-center gap-2">
              <Sparkles /> Enviar para o Carrinho e Gerar Proposta
            </button>
          </div>
        ) : (
          <div className="text-slate-500 text-center mt-20">Aguardando análise...</div>
        )}
      </div>
    </div>
  );
};
