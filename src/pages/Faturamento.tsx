import React, { useState } from 'react';
import { FileText, Loader2, Download, Send } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { transmitirNFe, NFeResponse } from '../services/NFeService';

export const Faturamento: React.FC = () => {
  const { state } = useERP();
  const [ambiente, setAmbiente] = useState<1 | 2>(2); // 2: Homologação
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Record<string, 'Pendente' | 'Autorizado' | 'Erro'>>({});
  const [nfeData, setNfeData] = useState<Record<string, NFeResponse>>({});

  const handleEmitirNFe = async (projeto: any) => {
    setLoading(true);
    try {
      const response = await transmitirNFe(projeto, ambiente);
      if (response.status === 'sucesso') {
        setStatus(prev => ({ ...prev, [projeto.id]: 'Autorizado' }));
        setNfeData(prev => ({ ...prev, [projeto.id]: response }));
      } else {
        setStatus(prev => ({ ...prev, [projeto.id]: 'Erro' }));
        alert(response.mensagem);
      }
    } catch (error) {
      setStatus(prev => ({ ...prev, [projeto.id]: 'Erro' }));
      alert('Erro ao conectar com SEFAZ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 p-2">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="text-blue-500" /> Faturamento e NF-e
        </h2>
        <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 flex items-center gap-4">
          <span className="text-sm font-medium text-slate-400">Ambiente SEFAZ:</span>
          <button 
            onClick={() => setAmbiente(ambiente === 1 ? 2 : 1)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              ambiente === 1 ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
            }`}
          >
            {ambiente === 1 ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO (Sem Valor Fiscal)'}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Projeto</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Ação</th>
            </tr>
          </thead>
          <tbody>
            {state.budget.items.map((projeto) => (
              <tr key={projeto.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="px-6 py-4 font-medium text-white">{projeto.nome}</td>
                <td className="px-6 py-4">{projeto.cliente || 'Cliente Padrão'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    status[projeto.id] === 'Autorizado' ? 'bg-emerald-900 text-emerald-400' :
                    status[projeto.id] === 'Erro' ? 'bg-rose-900 text-rose-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {status[projeto.id] || 'Pendente'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {status[projeto.id] === 'Autorizado' ? (
                    <button className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-bold">
                      <Download size={16} /> Baixar DANFE / XML
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleEmitirNFe(projeto)}
                      disabled={loading}
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Conectando ao WebService da SEFAZ...
                        </>
                      ) : (
                        <>
                          <Send size={16} /> Assinar e Transmitir NF-e
                        </>
                      )}
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
