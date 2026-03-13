import React, { useState } from 'react';
import { FileText, Briefcase, AlertTriangle, CheckCircle, X, Printer } from 'lucide-react';

interface Licitacao {
  id: number;
  uasg: string;
  orgao: string;
  objeto: string;
  data: string;
  valor: string;
  status: string;
  pregao?: string;
}

const PropostaVisualizacao: React.FC<{ licitacao: Licitacao; items: any[]; bdi: number; onClose: () => void }> = ({ licitacao, items, bdi, onClose }) => {
  const totalComBdi = items.reduce((acc, item) => acc + (item.custo * (1 + bdi / 100) * item.qtd), 0);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white p-4 print:p-0">
      <div className="w-[210mm] h-[297mm] bg-white text-black p-10 border border-slate-300 shadow-lg">
        <div className="flex justify-between mb-10 border-b-2 border-black pb-4">
          <div className="w-20 h-20 bg-slate-300">Logotipo</div>
          <div className="text-right text-sm">
            <p className="font-bold">CDS Industrial</p>
            <p>CNPJ: 00.000.000/0001-00</p>
          </div>
        </div>
        <h1 className="text-center font-bold text-lg mb-6">PROPOSTA COMERCIAL - PREGÃO Nº {licitacao.pregao || 'XXX'}</h1>
        <p className="mb-6">Ao Pregoeiro do {licitacao.orgao}</p>
        <table className="w-full text-left mb-10">
          <thead><tr className="border-b border-black"><th className="p-2">Produto</th><th className="p-2">Qtd</th><th className="p-2">Valor Unit.</th><th className="p-2">Subtotal</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="p-2">{item.nome}</td>
                <td className="p-2">{item.qtd}</td>
                <td className="p-2">R$ {(item.custo * (1 + bdi / 100)).toFixed(2)}</td>
                <td className="p-2">R$ {(item.custo * (1 + bdi / 100) * item.qtd).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right font-bold text-lg mb-10">Total: R$ {totalComBdi.toFixed(2)}</div>
        <div className="text-sm space-y-2">
          <p>"Declaramos que nos preços propostos estão inclusos todos os tributos, fretes, encargos sociais e trabalhistas."</p>
          <p>"Validade da Proposta: 60 (sessenta) dias."</p>
          <p>"Prazo de Entrega: Conforme Termo de Referência (TR)."</p>
          <p>"Dados Bancários para Empenho: Banco do Brasil, Ag X, CC Y."</p>
        </div>
        <div className="mt-20 text-center">
          <div className="w-64 border-t border-black mx-auto"></div>
          <p className="text-sm mt-2">Assinatura do Representante Legal</p>
        </div>
        <button onClick={onClose} className="mt-10 bg-slate-800 text-white px-4 py-2 rounded print:hidden">Fechar</button>
      </div>
    </div>
  );
};

const LicitacaoModal: React.FC<{ licitacao: Licitacao; onClose: () => void }> = ({ licitacao, onClose }) => {
  const [bdi, setBdi] = useState(25);
  const [items, setItems] = useState([
    { id: 1, nome: 'Estrutura Metálica', qtd: 10, custo: 1000 },
    { id: 2, nome: 'Parafusos', qtd: 100, custo: 5 },
  ]);
  const [showProposta, setShowProposta] = useState(false);

  const totalComBdi = items.reduce((acc, item) => acc + (item.custo * (1 + bdi / 100) * item.qtd), 0);

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl text-slate-100 border border-slate-700 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Gestão de Pregão: {licitacao.objeto}</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowProposta(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-500">
                <Printer size={18} /> Gerar Proposta Formal (PDF)
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <input type="text" defaultValue={licitacao.orgao} className="p-3 bg-slate-900 border border-slate-700 rounded-xl" placeholder="Órgão Público" />
            <input type="text" defaultValue={licitacao.uasg} className="p-3 bg-slate-900 border border-slate-700 rounded-xl" placeholder="UASG" />
            <input type="text" className="p-3 bg-slate-900 border border-slate-700 rounded-xl" placeholder="Nº do Pregão" />
            <input type="date" className="p-3 bg-slate-900 border border-slate-700 rounded-xl" />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold mb-2">BDI Aplicado ({bdi}%)</label>
            <input type="range" min="0" max="50" value={bdi} onChange={(e) => setBdi(Number(e.target.value))} className="w-full" />
          </div>

          <table className="w-full text-left mb-6">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="p-2">Produto</th>
                <th className="p-2">Qtd</th>
                <th className="p-2">Custo Base</th>
                <th className="p-2">Valor com BDI</th>
                <th className="p-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-slate-700 text-sm">
                  <td className="p-2">{item.nome}</td>
                  <td className="p-2">{item.qtd}</td>
                  <td className="p-2">R$ {item.custo.toFixed(2)}</td>
                  <td className="p-2">R$ {(item.custo * (1 + bdi / 100)).toFixed(2)}</td>
                  <td className="p-2">R$ {(item.custo * (1 + bdi / 100) * item.qtd).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right text-xl font-bold">Total: R$ {totalComBdi.toFixed(2)}</div>
        </div>
      </div>
      {showProposta && <PropostaVisualizacao licitacao={licitacao} items={items} bdi={bdi} onClose={() => setShowProposta(false)} />}
    </>
  );
};

export const Licitacoes: React.FC = () => {
  const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(null);
  const columns = [
    { id: 'mapeamento', title: 'Captação/Mapeamento' },
    { id: 'analise', title: 'Análise de Edital (TR)' },
    { id: 'montagem', title: 'Montagem de Proposta' },
    { id: 'disputa', title: 'Em Disputa (Pregão)' },
    { id: 'ganha', title: 'Ganha/Contrato' },
  ];

  const mockCards: Licitacao[] = [
    { id: 1, uasg: '123456', orgao: 'Exército Brasileiro', objeto: 'Aquisição de Estruturas Metálicas', data: '20/03/2026', valor: 'R$ 500.000', status: 'mapeamento' },
    { id: 2, uasg: '654321', orgao: 'Secretaria de Saúde', objeto: 'Manutenção Predial', data: '25/03/2026', valor: 'R$ 1.200.000', status: 'analise' },
    { id: 3, uasg: '987654', orgao: 'Prefeitura de SP', objeto: 'Estruturas para Eventos', data: '15/03/2026', valor: 'R$ 300.000', status: 'disputa' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Licitações (B2G)</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-500 transition-colors">
          📄 Gerar Proposta Padrão Governo (PDF)
        </button>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {columns.map(col => (
          <div key={col.id} className="bg-slate-800 p-4 rounded-xl">
            <h2 className="font-bold text-white mb-4 text-sm">{col.title}</h2>
            <div className="space-y-3">
              {mockCards.filter(c => c.status === col.id).map(card => (
                <div key={card.id} onClick={() => setSelectedLicitacao(card)} className="bg-slate-950 p-3 rounded-lg border border-slate-700 cursor-pointer hover:border-blue-500">
                  <h3 className="font-bold text-sm text-white">{card.objeto}</h3>
                  <p className="text-xs text-slate-400 mt-1">UASG: {card.uasg}</p>
                  <p className="text-xs text-slate-400">Órgão: {card.orgao}</p>
                  <p className="text-xs text-slate-400">Data: {card.data}</p>
                  <p className="text-xs font-bold text-emerald-400 mt-1">{card.valor}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {selectedLicitacao && <LicitacaoModal licitacao={selectedLicitacao} onClose={() => setSelectedLicitacao(null)} />}
    </div>
  );
};
