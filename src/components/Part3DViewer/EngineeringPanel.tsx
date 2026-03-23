import React, { useMemo } from 'react';
import { PerfilData } from '../../data/perfisDB';
import { calcularPropriedadesMetalon, calcularPropriedadesPerfilU, verificarFlecha } from '../../utils/EngCalculations';
import { AlertTriangle, Info, CheckCircle2, Activity, X, Ruler } from 'lucide-react';

interface EngineeringPanelProps {
  largura: number; // mm
  altura: number; // mm
  profundidade?: number; // mm
  perfilData: PerfilData;
  perfilVigaData?: PerfilData;
  perfilDiagonalData?: PerfilData;
  tipoProduto: string;
}

export const EngineeringPanel: React.FC<EngineeringPanelProps> = ({
  largura,
  altura,
  profundidade = 0,
  perfilData,
  perfilVigaData,
  perfilDiagonalData,
  tipoProduto
}) => {
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [isPropostaOpen, setIsPropostaOpen] = React.useState(true);
  const calculations = useMemo(() => {
    // ... (keep existing calculations)
    const perfilPrincipal = perfilVigaData || perfilData;
    
    let props;
    if (perfilPrincipal.tipoShape === 'quadrado_oco') {
      props = calcularPropriedadesMetalon(
        perfilPrincipal.largura || 50,
        perfilPrincipal.altura || 50,
        perfilPrincipal.espessura
      );
    } else if (perfilPrincipal.tipoShape === 'perfil_u_simples' || perfilPrincipal.tipoShape === 'perfil_u_enrijecido') {
      props = calcularPropriedadesPerfilU(
        perfilPrincipal.largura || 100,
        perfilPrincipal.abas || 40,
        perfilPrincipal.espessura,
        perfilPrincipal.enrijecedor || 0
      );
    } else {
      props = calcularPropriedadesMetalon(50, 50, 2);
    }

    const vao = largura / 1000;
    const cargaEstimada = (props.massaLinear * 9.81) + 1000; 
    const verificacao = verificarFlecha(vao, cargaEstimada, props.ix);

    return {
      props,
      verificacao,
      vao
    };
  }, [largura, perfilData, perfilVigaData]);

  if (['quadro_simples', 'portao_basculante', 'portao_deslizante'].includes(tipoProduto)) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-20 pointer-events-auto">
      {!isPanelOpen ? (
        <button 
          onClick={() => setIsPanelOpen(true)}
          className="p-2 bg-white/80 backdrop-blur-md border border-slate-300 rounded-lg text-slate-600 hover:text-blue-400 transition-all shadow-xl"
        >
          <Activity size={16} />
        </button>
      ) : (
        <div className="bg-white/95 backdrop-blur-md rounded border border-slate-300 shadow-2xl w-64 md:w-72 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-100 border-b border-slate-300">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-blue-400" />
              <h3 className="font-bold text-slate-900 text-[10px] uppercase tracking-[0.2em]">Data Analysis</h3>
            </div>
            <button onClick={() => setIsPanelOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
              <X size={14} />
            </button>
          </div>
          
          <div className="p-4 space-y-4 text-[10px]">
            {tipoProduto === 'tesoura' ? (
              <div className="space-y-2 mb-2">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    <span className="text-slate-500 uppercase tracking-wider">Banzos:</span>
                  </div>
                  <span className="font-mono text-slate-700 truncate text-right">{perfilData.nome}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-slate-500 uppercase tracking-wider">Montantes:</span>
                  </div>
                  <span className="font-mono text-slate-700 truncate text-right">{perfilVigaData?.nome || perfilData.nome}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                    <span className="text-slate-500 uppercase tracking-wider">Diagonais:</span>
                  </div>
                  <span className="font-mono text-slate-700 truncate text-right">{perfilDiagonalData?.nome || perfilVigaData?.nome || perfilData.nome}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between gap-2 py-1 border-b border-slate-200">
                <span className="text-slate-500 uppercase tracking-wider">Perfil:</span>
                <span className="font-mono text-slate-700 truncate text-right">{perfilVigaData?.nome || perfilData.nome}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase tracking-wider">Massa:</span>
                <span className="font-mono text-slate-700">{calculations.props.massaLinear.toFixed(2)} kg/m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase tracking-wider">Inércia:</span>
                <span className="font-mono text-slate-700">{(calculations.props.ix * 1e8).toFixed(2)} cm⁴</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase tracking-wider">Vão (L):</span>
                <span className="font-mono text-slate-700">{calculations.vao.toFixed(2)} m</span>
              </div>
            </div>
            
            <div className={`mt-4 p-3 rounded border ${calculations.verificacao.aprovado ? 'bg-blue-600/10 border-blue-500/30' : 'bg-red-600/10 border-red-500/30'}`}>
              <div className="flex items-start gap-2">
                {calculations.verificacao.aprovado ? (
                  <CheckCircle2 size={14} className="text-blue-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`font-bold uppercase tracking-widest ${calculations.verificacao.aprovado ? 'text-blue-400' : 'text-red-400'}`}>
                    {calculations.verificacao.aprovado ? 'Estável' : 'Instável'}
                  </p>
                  <p className={`text-[9px] mt-1 font-mono ${calculations.verificacao.aprovado ? 'text-slate-600' : 'text-red-300'}`}>
                    Flecha: {(calculations.verificacao.flecha * 1000).toFixed(1)}mm / {(calculations.verificacao.limite * 1000).toFixed(1)}mm
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center gap-2 text-[8px] text-slate-600 uppercase tracking-[0.2em]">
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
              Live Analysis
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
