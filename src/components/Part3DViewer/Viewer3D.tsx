import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Center } from '@react-three/drei';
import { ShoppingCart, Camera, Layers, Ruler, X, Square, Zap, FileText, Activity } from 'lucide-react';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import { QuadroNode } from './QuadroNode';
import { PortaoBasculante } from './Templates/PortaoBasculante';
import { PortaoDeslizante } from './Templates/PortaoDeslizante';
import { EscadaReta } from './Templates/EscadaReta';
import { EscadaL } from './Templates/EscadaL';
import { CoberturaParametrica } from './Templates/CoberturaParametrica';
import { Galpao } from './Templates/Galpao';
import { Tesoura } from './Templates/Tesoura';
import { SheetMetal3D } from './Templates/SheetMetal3D';
import { PerfilData } from '../../data/perfisDB';
import { AcabamentoMetalKey, MaterialDegrauKey } from '../../data/materiaisDB';
import { useMaterials } from '../../hooks/useMaterials';
import { EngineeringPanel } from './EngineeringPanel';

import { TechnicalDrawing } from './TechnicalDrawing';

interface Viewer3DProps {
  largura: number;
  altura: number;
  profundidade?: number;
  inclinacaoPercentual?: number;
  perfilData: PerfilData;
  perfilColunaData?: PerfilData;
  perfilVigaData?: PerfilData;
  perfilDiagonalData?: PerfilData;
  quantidadeGrades: number;
  tipoMontagem: 'reto' | 'meia-esquadria';
  tipoProduto?: 'quadro_simples' | 'portao_basculante' | 'portao_deslizante' | 'escada_reta' | 'escada_l' | 'cobertura_pergolado' | 'galpao' | 'tesoura' | 'galpao_tesoura_personalizada' | 'chapa_cortada' | 'chapa_dobrada_l' | 'chapa_dobrada_u' | 'perfil_u_enrijecido' | 'chapa_dobrada_z' | 'chapa_dobrada_cartola' | 'bandeja_metalica';
  anguloAbertura?: number;
  temGuardaCorpo?: boolean;
  ladoGuardaCorpo?: 'esquerdo' | 'direito' | 'ambos';
  acabamentoMetal?: AcabamentoMetalKey;
  materialDegrau?: MaterialDegrauKey;
  alturaPatamar?: number;
  direcaoCurva?: 'esquerda' | 'direita';
  abaExtra?: number;
  espessuraChapa?: number;
  mostrarCotas?: boolean;
  planificada?: boolean;
  onPlanificadaChange?: (val: boolean) => void;
  explodedFactor?: number;
  qtdTercas?: number;
  qtdColunasExtras?: number;
  perfilTercaData?: PerfilData;
  perfilTrilhoData?: PerfilData;
  perfilGuiaData?: PerfilData;
  perfilBatenteData?: PerfilData;
  perfilColunaPortaoData?: PerfilData;
  incluirPortaoPedestre?: boolean;
  materialCobertura?: 'vidro' | 'policarbonato' | 'telha' | 'vazio';
  telhaSelecionadaId?: string;
  fixacao?: 'chumbado' | 'sapata_parafuso';
  tipoTesouraId?: string;
  beiralFrontal?: number;
  beiralTraseiro?: number;
  beiralEsquerdo?: number;
  beiralDireito?: number;
  tipoTelhado?: 'uma_agua' | 'duas_aguas' | 'invertido';
  mostrarNodes?: boolean;
  colorBanzo?: string;
  colorMontante?: string;
  colorDiagonal?: string;
  colorTerca?: string;
  colorColuna?: string;
  colorViga?: string;
  colorFechamento?: string;
}

const SceneContent: React.FC<Viewer3DProps> = (props) => {
  const { 
    largura, 
    altura, 
    profundidade = 3000,
    inclinacaoPercentual = 10,
    perfilData, 
    perfilColunaData,
    perfilVigaData,
    quantidadeGrades, 
    tipoMontagem,
    tipoProduto = 'quadro_simples',
    anguloAbertura = 0,
    temGuardaCorpo = false,
    ladoGuardaCorpo = 'ambos',
    acabamentoMetal = 'preto_fosco',
    materialDegrau = 'madeira_clara',
    alturaPatamar = 1500,
    direcaoCurva = 'direita',
    mostrarCotas = false,
    explodedFactor = 0,
    qtdTercas,
    qtdColunasExtras,
    perfilTercaData,
    perfilTrilhoData,
    perfilGuiaData,
    perfilBatenteData,
    perfilColunaPortaoData,
    incluirPortaoPedestre = false,
    materialCobertura = 'vidro',
    telhaSelecionadaId,
    fixacao = 'sapata_parafuso',
    tipoTesouraId = 'fink',
    beiralFrontal = 0,
    beiralTraseiro = 0,
    beiralEsquerdo = 0,
    beiralDireito = 0,
    tipoTelhado = 'uma_agua',
    mostrarNodes = true,
    perfilDiagonalData,
    colorBanzo,
    colorMontante,
    colorDiagonal,
    colorTerca,
    colorColuna,
    colorViga,
    colorFechamento
  } = props;

  return (
    <>
      <ambientLight intensity={2.5} />
      <hemisphereLight intensity={1.5} groundColor="#000000" />
      <directionalLight position={[10, 10, 10]} intensity={3} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={2.5} />
      <directionalLight position={[0, 10, -10]} intensity={2.5} />
      <pointLight position={[0, 5, 5]} intensity={2} />

      {tipoProduto === 'quadro_simples' && (
        <QuadroNode 
          largura={largura} 
          altura={altura} 
          perfilData={perfilData} 
          quantidadeGrades={quantidadeGrades} 
          tipoMontagem={tipoMontagem} 
          acabamentoMetal={acabamentoMetal}
          mostrarCotas={mostrarCotas}
        />
      )}
      {tipoProduto === 'portao_basculante' && (
        <PortaoBasculante 
          largura={largura} 
          altura={altura} 
          perfilData={perfilData} 
          quantidadeGrades={quantidadeGrades} 
          tipoMontagem={tipoMontagem} 
          anguloAbertura={anguloAbertura} 
          acabamentoMetal={acabamentoMetal}
          mostrarCotas={mostrarCotas}
        />
      )}
      {tipoProduto === 'portao_deslizante' && (
        <PortaoDeslizante 
          largura={largura} 
          altura={altura} 
          perfilData={perfilData} 
          perfilTrilhoData={perfilTrilhoData}
          perfilGuiaData={perfilGuiaData}
          perfilBatenteData={perfilBatenteData}
          perfilColunaPortaoData={perfilColunaPortaoData}
          incluirPortaoPedestre={incluirPortaoPedestre}
          quantidadeGrades={quantidadeGrades} 
          tipoMontagem={tipoMontagem} 
          anguloAbertura={anguloAbertura} 
          acabamentoMetal={acabamentoMetal}
          mostrarCotas={mostrarCotas}
        />
      )}
      {tipoProduto === 'escada_reta' && (
        <EscadaReta 
          alturaTotal={altura} 
          larguraDegrau={largura} 
          perfilData={perfilData}
          temGuardaCorpo={temGuardaCorpo}
          ladoGuardaCorpo={ladoGuardaCorpo}
          acabamentoMetal={acabamentoMetal}
          materialDegrau={materialDegrau}
          mostrarCotas={mostrarCotas}
          colorBanzo={colorBanzo}
          colorMontante={colorMontante}
          colorViga={colorViga}
        />
      )}
      {tipoProduto === 'escada_l' && (
        <EscadaL 
          alturaTotal={altura} 
          larguraEscada={largura} 
          alturaPatamar={alturaPatamar}
          direcaoCurva={direcaoCurva}
          perfilSelecionado={perfilData}
          acabamentoMetal={acabamentoMetal}
          materialDegrau={materialDegrau}
          mostrarCotas={mostrarCotas}
          colorViga={colorViga}
        />
      )}
      {tipoProduto === 'cobertura_pergolado' && (
        <CoberturaParametrica
          largura={largura}
          profundidade={profundidade}
          alturaFrontal={altura}
          inclinacaoPercentual={inclinacaoPercentual}
          perfilData={perfilData}
          perfilColunaData={perfilColunaData}
          perfilVigaData={perfilVigaData}
          acabamentoMetal={acabamentoMetal}
          mostrarCotas={mostrarCotas}
          explodedFactor={explodedFactor}
          qtdTercas={qtdTercas}
          qtdColunasExtras={qtdColunasExtras}
          perfilTercaData={perfilTercaData}
          materialCobertura={materialCobertura}
          telhaSelecionadaId={telhaSelecionadaId}
          fixacao={fixacao}
          tipoTelhado={tipoTelhado}
          colorTerca={colorTerca}
          colorColuna={colorColuna}
          colorViga={colorViga}
          colorFechamento={colorFechamento}
        />
      )}
      {(tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada') && (
        <Galpao
          largura={largura}
          profundidade={profundidade}
          altura={altura}
          inclinacaoPercentual={inclinacaoPercentual}
          perfilData={perfilData}
          perfilColunaData={perfilColunaData}
          perfilVigaData={perfilVigaData}
          perfilDiagonalData={perfilDiagonalData}
          perfilTercaData={perfilTercaData}
          acabamentoMetal={acabamentoMetal}
          mostrarCotas={mostrarCotas}
          explodedFactor={explodedFactor}
          qtdTercas={qtdTercas}
          materialCobertura={materialCobertura}
          telhaSelecionadaId={telhaSelecionadaId}
          fixacao={fixacao}
          tipoTesouraId={tipoTesouraId}
          mostrarNodes={mostrarNodes}
          colorBanzo={colorBanzo}
          colorMontante={colorMontante}
          colorDiagonal={colorDiagonal}
          colorTerca={colorTerca}
          colorColuna={colorColuna}
          colorViga={colorViga}
          colorFechamento={colorFechamento}
        />
      )}
      {tipoProduto === 'tesoura' && (
        <Tesoura
          largura={largura}
          altura={altura}
          profundidade={0}
          perfilBanzo={perfilData}
          perfilInterno={perfilVigaData || perfilData}
          perfilDiagonal={perfilDiagonalData || perfilVigaData || perfilData}
          tipoTesoura={tipoTesouraId as any || 'fink'}
          acabamentoMetal={acabamentoMetal}
          explodedFactor={explodedFactor}
          mostrarNodes={mostrarNodes}
          colorBanzo={colorBanzo}
          colorMontante={colorMontante}
          colorDiagonal={colorDiagonal}
        />
      )}
      {(tipoProduto?.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
        <SheetMetal3D
          tipo={tipoProduto}
          largura={largura}
          altura={altura}
          profundidade={profundidade || 1000}
          espessura={props.espessuraChapa || perfilData.espessura || 1}
          abaExtra={props.abaExtra}
          acabamentoMetal={acabamentoMetal}
          planificada={props.planificada}
        />
      )}
    </>
  );
};

export const Viewer3D: React.FC<Viewer3DProps> = (props) => {
  const [view, setView] = useState<'front' | 'top' | 'iso'>('iso');
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [engineeringOpen, setEngineeringOpen] = useState(false);
  const controlsRef = useRef<any>(null);

  const setCameraView = (viewType: 'front' | 'top' | 'iso') => {
    setView(viewType);
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    if (viewType === 'front') {
      controls.object.position.set(0, 0, 3);
      controls.target.set(0, 0, 0);
    } else if (viewType === 'top') {
      controls.object.position.set(0, 3, 0);
      controls.target.set(0, 0, 0);
    } else {
      controls.object.position.set(3, 3, 3);
      controls.target.set(0, 0, 0);
    }
    controls.update();
  };

  return (
    <div className="relative w-full h-full min-h-[300px] md:min-h-[400px] bg-slate-950 rounded overflow-hidden shadow-inner border border-slate-800">
      <div className="absolute inset-0 bg-slate-950">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/30"></div>
        
        <Canvas camera={{ position: [3, 3, 3], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
          <SceneContent {...props} />
          <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={1.5} />
          <EffectComposer multisampling={4}>
            <N8AO aoRadius={0.5} intensity={1} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Toolbar Vertical Estilo AutoCAD */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded overflow-hidden shadow-2xl">
        <button 
          onClick={() => setCameraView('front')}
          className="p-3 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-all border-b border-slate-800 group relative"
          title="Vista Frontal"
        >
          <Square size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-[8px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">FRENTE</span>
        </button>
        <button 
          onClick={() => setCameraView('top')}
          className="p-3 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-all border-b border-slate-800 group relative"
          title="Vista Superior"
        >
          <Layers size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-[8px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">TOPO</span>
        </button>
        <button 
          onClick={() => setCameraView('iso')}
          className="p-3 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-all border-b border-slate-800 group relative"
          title="Vista Isométrica"
        >
          <Camera size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-[8px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">3D / ISO</span>
        </button>
        
        {props.tipoProduto?.startsWith('chapa_') || props.tipoProduto === 'perfil_u_enrijecido' || props.tipoProduto === 'bandeja_metalica' ? (
          <button 
            onClick={() => props.onPlanificadaChange?.(!props.planificada)}
            className={`p-3 transition-all border-b border-slate-800 group relative ${props.planificada ? 'bg-blue-600 text-white' : 'hover:bg-blue-600/20 text-slate-400 hover:text-blue-400'}`}
            title={props.planificada ? 'Ver Dobrada' : 'Ver Aberta'}
          >
            <Zap size={16} />
            <span className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-[8px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{props.planificada ? 'DOBRADA' : 'PLANIFICADA'}</span>
          </button>
        ) : null}

        <button 
          onClick={() => setIsBlueprintOpen(true)}
          className="p-3 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-all border-b border-slate-800 group relative"
          title="Desenho Técnico"
        >
          <FileText size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-[8px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">BLUEPRINT</span>
        </button>

        <button 
          onClick={() => setEngineeringOpen(!engineeringOpen)}
          className={`p-3 transition-all group relative ${engineeringOpen ? 'bg-blue-600 text-white' : 'hover:bg-blue-600/20 text-slate-400 hover:text-blue-400'}`}
          title="Painel de Engenharia"
        >
          <Activity size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-[8px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ENGENHARIA</span>
        </button>
      </div>

      {isBlueprintOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950 p-6 text-white flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded">
                <Ruler size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase">BLUEPRINT TÉCNICO</h2>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Visualização de Fabricação 2D</p>
              </div>
            </div>
            <button 
              onClick={() => setIsBlueprintOpen(false)} 
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-[10px] font-bold transition-all flex items-center gap-2 border border-slate-700"
            >
              <X size={14} /> FECHAR
            </button>
          </div>
          
          <div className="flex-1 min-h-0 bg-slate-900 rounded border border-slate-800">
            <TechnicalDrawing 
              tipo={props.tipoProduto || 'quadro_simples'}
              largura={props.largura}
              altura={props.altura}
              profundidade={props.profundidade || 1000}
              espessura={props.espessuraChapa || props.perfilData.espessura || 1}
              abaExtra={props.abaExtra}
            />
          </div>
        </div>
      )}

      {engineeringOpen && (
        <EngineeringPanel 
          largura={props.largura} 
          altura={props.altura} 
          profundidade={props.profundidade}
          perfilData={props.perfilData}
          perfilVigaData={props.perfilVigaData}
          perfilDiagonalData={props.perfilDiagonalData}
          tipoProduto={props.tipoProduto || 'quadro_simples'}
        />
      )}
    </div>
  );
};
