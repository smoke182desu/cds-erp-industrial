import React, { useState } from 'react';
import { Wrench, Cpu, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { analisarSolda, DadosConexao, DecisaoSolda } from '../utils/weldingLogic';

export const PlanoMontagemSolda: React.FC = () => {
  const [inputData, setInputData] = useState<DadosConexao>({
    ligacao: 'A1-B1',
    peca_origem: 'Chapa Lateral',
    peca_destino: 'Base',
    espessura_origem_mm: 3.0,
    espessura_destino_mm: 5.0,
    material_origem: 'Aço Carbono',
    material_destino: 'Aço Carbono',
    angulo_graus: 90,
    comprimento_contato_mm: 500,
    distancia_mm: 0.5
  });

  const [resultado, setResultado] = useState<DecisaoSolda | null>(null);

  const handleAnalise = () => {
    const decisao = analisarSolda(inputData);
    setResultado(decisao);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'Cordão': return <CheckCircle2 className="text-emerald-500" size={24} />;
      case 'Cordao_Intermitente': return <AlertTriangle className="text-amber-500" size={24} />;
      case 'Ponteado': return <Info className="text-blue-500" size={24} />;
      case 'Vazio': return <XCircle className="text-red-500" size={24} />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto bg-slate-50 text-slate-900">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
          <Cpu size={24} className="text-slate-900" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Módulo de IA - Soldagem</h2>
          <p className="text-slate-600 text-sm">Análise automática de juntas e conexões 3D</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel de Entrada */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
            <Wrench size={18} className="text-blue-500" /> Dados da Conexão (Nó)
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Ligação ID</label>
              <input 
                type="text" 
                value={inputData.ligacao}
                onChange={e => setInputData({...inputData, ligacao: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Distância (mm)</label>
              <input 
                type="number" 
                step="0.1"
                value={inputData.distancia_mm}
                onChange={e => setInputData({...inputData, distancia_mm: parseFloat(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Material Origem</label>
              <input 
                type="text" 
                value={inputData.material_origem}
                onChange={e => setInputData({...inputData, material_origem: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Material Destino</label>
              <input 
                type="text" 
                value={inputData.material_destino}
                onChange={e => setInputData({...inputData, material_destino: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Espessura Origem (mm)</label>
              <input 
                type="number" 
                step="0.1"
                value={inputData.espessura_origem_mm}
                onChange={e => setInputData({...inputData, espessura_origem_mm: parseFloat(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Espessura Destino (mm)</label>
              <input 
                type="number" 
                step="0.1"
                value={inputData.espessura_destino_mm}
                onChange={e => setInputData({...inputData, espessura_destino_mm: parseFloat(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Ângulo (Graus)</label>
              <input 
                type="number" 
                value={inputData.angulo_graus}
                onChange={e => setInputData({...inputData, angulo_graus: parseFloat(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Comprimento Contato (mm)</label>
              <input 
                type="number" 
                value={inputData.comprimento_contato_mm}
                onChange={e => setInputData({...inputData, comprimento_contato_mm: parseFloat(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <button 
            onClick={handleAnalise}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Cpu size={18} /> Processar Lógica de Solda
          </button>
        </div>

        {/* Painel de Saída */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
            Saída JSON (Decisão da IA)
          </h3>
          
          {resultado ? (
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-sm overflow-x-auto">
                <pre className="text-emerald-400">
                  {JSON.stringify(resultado, null, 2)}
                </pre>
              </div>
              
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-300 mt-auto">
                <div className="flex items-center gap-3 mb-2">
                  {getIconForType(resultado.tipo_solda)}
                  <h4 className="font-bold text-lg">Resultado: {resultado.tipo_solda.replace('_', ' ')}</h4>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">
                  {resultado.justificativa}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 flex-col gap-4">
              <Cpu size={48} className="opacity-20" />
              <p>Aguardando dados para análise...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
