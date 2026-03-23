import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Center, ContactShadows } from '@react-three/drei';
import { ShoppingCart, Camera, Layers, Ruler, X, Square, Zap, FileText, Activity, Bomb } from 'lucide-react';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import { perfisDB } from '../../data/perfisDB';
import { QuadroNode } from './QuadroNode';
import { PortaoBasculante } from './Templates/PortaoBasculante';
import { PortaoDeslizante } from './Templates/PortaoDeslizante';
import { EscadaL } from './Templates/EscadaL';
import { CoberturaParametrica } from './Templates/CoberturaParametrica';
import { Galpao } from './Templates/Galpao';
import { Tesoura } from './Templates/Tesoura';
import { AbrigoOnibus } from './Templates/AbrigoOnibus';
import { CarrinhoPlataforma } from './Templates/CarrinhoPlataforma';
import { GaiolaRollContainer } from './Templates/GaiolaRollContainer';
import { CarrinhoCilindros } from './Templates/CarrinhoCilindros';
import { ReboqueIndustrial } from './Templates/ReboqueIndustrial';
import { EscadaRetaIndustrial } from './Templates/EscadaRetaIndustrial';
import { RampaAcessibilidade } from './Templates/RampaAcessibilidade';
import { SheetMetal3D } from './Templates/SheetMetal3D';
import { GenericProduct3D } from './Templates/GenericProduct3D';
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
  tipoProduto?: string;
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
  materialCoberturaRampa?: string;
  telhaSelecionadaId?: string;
  fixacao?: 'chumbado' | 'sapata_parafuso';
  tipoTesouraId?: string;
  beiralFrontal?: number;
  beiralTraseiro?: number;
  beiralEsquerdo?: number;
  beiralDireito?: number;
  tipoTelhado?: 'uma_agua' | 'duas_aguas' | 'invertido';
  tipoChegada?: 'Abaixo' | 'Nivelado';
  mostrarNodes?: boolean;
  colorBanzo?: string;
  colorMontante?: string;
  colorDiagonal?: string;
  colorTerca?: string;
  colorColuna?: string;
  colorViga?: string;
  colorFechamento?: string;
  perfilQuadroRampaId?: string;
  perfilQuadroId?: string;
  perfilCaixaId?: string;
  perfilTrilhoId?: string;
  perfilTravessaId?: string;
  perfilBracoId?: string;
  perfilMontanteId?: string;
  perfilGradeId?: string;
  onBOMCalculated?: (bom: any) => void;
}

const SceneContent: React.FC<Viewer3DProps & { aberto?: boolean }> = (props) => {
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
    aberto = false,
    temGuardaCorpo = false,
    ladoGuardaCorpo = 'ambos',
    acabamentoMetal = 'preto_fosco',
    materialDegrau = 'madeira_clara',
    tipoChegada = 'Abaixo',
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
    materialCoberturaRampa,
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
    colorFechamento,
    perfilQuadroId,
    perfilCaixaId,
    perfilTrilhoId,
    perfilTravessaId,
    perfilBracoId,
    perfilMontanteId,
    perfilGradeId
  } = props;

  return (
    <>
      <color attach="background" args={['#0f172a']} />
      <ambientLight intensity={0.8} />
      <hemisphereLight intensity={0.5} groundColor="#000000" />
      <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={1} />
      <directionalLight position={[0, 10, -10]} intensity={1} />
      <pointLight position={[0, 5, 5]} intensity={1} />

      <ContactShadows 
        opacity={0.4} 
        scale={20} 
        blur={2.4} 
        far={4.5} 
        resolution={256} 
        color="#000000" 
      />

      {tipoProduto === 'quadro_simples' && (
        <QuadroNode 
          largura={largura} 
          altura={altura} 
          perfilData={perfilData} 
          quantidadeGrades={quantidadeGrades} 
          tipoMontagem={tipoMontagem} 
          acabamentoMetal={acabamentoMetal}
          mostrarCotas={mostrarCotas}
          explodedFactor={explodedFactor}
          onBOMCalculated={props.onBOMCalculated}
          perfilTravessaData={perfisDB.find(p => p.id === perfilTravessaId)}
          perfilMontanteData={perfisDB.find(p => p.id === perfilMontanteId)}
          perfilGradeData={perfisDB.find(p => p.id === perfilGradeId)}
        />
      )}
      {tipoProduto === 'portao_basculante' && (
        <PortaoBasculante 
          largura={largura} 
          altura={altura} 
          aberto={aberto}
          anguloAbertura={anguloAbertura} 
          acabamentoMetal={acabamentoMetal}
          mostrarCotas={mostrarCotas}
          explodedFactor={explodedFactor}
          onBOMCalculated={props.onBOMCalculated}
          perfilQuadroId={perfilQuadroId}
          perfilCaixaId={perfilCaixaId}
          perfilTrilhoId={perfilTrilhoId}
          perfilTravessaId={perfilTravessaId}
          perfilBracoId={perfilBracoId}
        />
      )}
      {tipoProduto === 'portao_deslizante' && (
        <PortaoDeslizante 
          largura={largura} 
          altura={altura} 
          aberto={aberto}
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
          explodedFactor={explodedFactor}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'abrigo_onibus' && (
        <AbrigoOnibus 
          explodedFactor={explodedFactor}
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'carrinho_plataforma' && (
        <CarrinhoPlataforma 
          explodedFactor={explodedFactor}
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'gaiola_roll_container' && (
        <GaiolaRollContainer 
          explodedFactor={explodedFactor}
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'carrinho_cilindros' && (
        <CarrinhoCilindros 
          explodedFactor={explodedFactor}
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'reboque_industrial' && (
        <ReboqueIndustrial 
          explodedFactor={explodedFactor}
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'escada_reta' && (
        <EscadaRetaIndustrial 
          explodedFactor={explodedFactor}
          altura={altura}
          comprimento={profundidade || 3600}
          largura={largura}
          tipoChegada={tipoChegada}
          acabamentoMetal={acabamentoMetal}
          materialDegrau={materialDegrau}
          temGuardaCorpo={temGuardaCorpo}
          ladoGuardaCorpo={ladoGuardaCorpo}
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'escada_l' && (
        <EscadaL 
          alturaTotal={altura} 
          larguraEscada={largura} 
          profundidade={profundidade}
          alturaPatamar={alturaPatamar}
          direcaoCurva={direcaoCurva}
          perfilSelecionado={perfilData}
          acabamentoMetal={acabamentoMetal}
          materialDegrau={materialDegrau}
          mostrarCotas={mostrarCotas}
          colorViga={colorViga}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {tipoProduto === 'rampa_acessibilidade' && (
        <RampaAcessibilidade 
          largura={largura}
          altura={altura}
          comprimento={profundidade || 3000}
          explodedFactor={explodedFactor}
          mostrarCotas={mostrarCotas}
          tipoFixacao={fixacao === 'chumbado' ? 'Chumbador Embutido' : 'Sapata Flangeada'}
          materialCoberturaRampa={materialCoberturaRampa}
          onBOMCalculated={props.onBOMCalculated}
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
          onBOMCalculated={props.onBOMCalculated}
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
          onBOMCalculated={props.onBOMCalculated}
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
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
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
          mostrarCotas={mostrarCotas}
          onBOMCalculated={props.onBOMCalculated}
        />
      )}
      {(![
        'quadro_simples', 'portao_basculante', 'portao_deslizante', 'escada_reta', 'escada_l', 'rampa_acessibilidade',
        'cobertura_pergolado', 'galpao', 'galpao_tesoura_personalizada', 'tesoura',
        'perfil_u_enrijecido', 'bandeja_metalica', 'abrigo_onibus', 'carrinho_plataforma', 'gaiola_roll_container', 'carrinho_cilindros', 'reboque_industrial', 'escada_reta_industrial'
      ].includes(tipoProduto || '') && !tipoProduto?.startsWith('chapa_')) && (
        <GenericProduct3D
          tipoProduto={tipoProduto || 'generic'}
          largura={largura}
          altura={altura}
          profundidade={profundidade || 1000}
          color={colorViga}
          mostrarCotas={mostrarCotas}
        />
      )}
    </>
  );
};

export const Viewer3D: React.FC<Viewer3DProps> = (props) => {
  const [view, setView] = useState<'front' | 'top' | 'iso'>('iso');
  const [showLegend, setShowLegend] = useState(true);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [engineeringOpen, setEngineeringOpen] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [bom, setBOM] = useState<any[]>([]);
  const controlsRef = useRef<any>(null);

  React.useEffect(() => {
    // Reset camera when product or dimensions change
    const timer = setTimeout(() => {
      setCameraView(view);
    }, 100);
    return () => clearTimeout(timer);
  }, [props.tipoProduto, props.largura, props.altura, props.profundidade]);

  const handleBOMCalculated = React.useCallback((newBOM: any[]) => {
    setBOM(newBOM);
    if (props.onBOMCalculated) {
      props.onBOMCalculated(newBOM);
    }
  }, [props.onBOMCalculated]);

  const setCameraView = (viewType: 'front' | 'top' | 'iso') => {
    setView(viewType);
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    // Dimensions are in mm, convert to meters for camera distance
    const maxDim = Math.max(props.largura, props.altura, props.profundidade || 0) / 1000;
    // Increase distance factor to ensure framing
    const dist = Math.max(3, maxDim * 3.2);

    if (viewType === 'front') {
      controls.object.position.set(0, 0, dist);
    } else if (viewType === 'top') {
      controls.object.position.set(0, dist, 0);
    } else {
      controls.object.position.set(dist * 0.8, dist * 0.8, dist * 0.8);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const initialMaxDim = Math.max(props.largura, props.altura, props.profundidade || 0) / 1000;
  const initialDist = Math.max(3, initialMaxDim * 3.2);

  return (
    <div className="relative w-full h-full min-h-[350px] md:min-h-[450px] bg-white rounded overflow-hidden shadow-inner border border-slate-200 touch-none">
      <div className="absolute inset-0 bg-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-800/50"></div>
        
        <Canvas camera={{ position: [initialDist, initialDist, initialDist], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
          <Center top>
            <SceneContent {...props} aberto={aberto} explodedFactor={exploded ? 1 : (props.explodedFactor ?? 0)} onBOMCalculated={handleBOMCalculated} />
          </Center>
          <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={1.5} />
        </Canvas>
      </div>

      <div className={`absolute left-4 top-4 bottom-4 z-30 flex flex-col gap-4 pointer-events-none transition-all duration-500 ${showLegend ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
        <div className="pointer-events-auto">
          {/* Legend removed */}
        </div>
      </div>

      {/* Toolbar Vertical Estilo AutoCAD */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col bg-white/80 backdrop-blur-md border border-slate-300 rounded overflow-hidden shadow-2xl">
        <button 
          onClick={() => setCameraView('front')}
          className="p-3 hover:bg-blue-600/20 text-slate-600 hover:text-blue-400 transition-all border-b border-slate-200 group relative"
          title="Vista Frontal"
        >
          <Square size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">FRENTE</span>
        </button>
        <button 
          onClick={() => setCameraView('top')}
          className="p-3 hover:bg-blue-600/20 text-slate-600 hover:text-blue-400 transition-all border-b border-slate-200 group relative"
          title="Vista Superior"
        >
          <Layers size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">TOPO</span>
        </button>
        <button 
          onClick={() => setCameraView('iso')}
          className="p-3 hover:bg-blue-600/20 text-slate-600 hover:text-blue-400 transition-all border-b border-slate-200 group relative"
          title="Vista Isométrica"
        >
          <Camera size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">3D / ISO</span>
        </button>
        
        {props.tipoProduto?.startsWith('chapa_') || props.tipoProduto === 'perfil_u_enrijecido' || props.tipoProduto === 'bandeja_metalica' ? (
          <button 
            onClick={() => props.onPlanificadaChange?.(!props.planificada)}
            className={`p-3 transition-all border-b border-slate-200 group relative ${props.planificada ? 'bg-blue-600 text-white' : 'hover:bg-blue-600/20 text-slate-600 hover:text-blue-400'}`}
            title={props.planificada ? 'Ver Dobrada' : 'Ver Aberta'}
          >
            <Zap size={16} />
            <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{props.planificada ? 'DOBRADA' : 'PLANIFICADA'}</span>
          </button>
        ) : null}

        <button 
          onClick={() => setAberto(!aberto)}
          className={`p-3 transition-all border-b border-slate-200 group relative ${aberto ? 'bg-blue-600 text-white' : 'hover:bg-blue-600/20 text-slate-600 hover:text-blue-400'}`}
          title={aberto ? 'Fechar Portão' : 'Abrir Portão'}
        >
          <Zap size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{aberto ? 'FECHAR' : 'ABRIR'}</span>
        </button>

        <button 
          onClick={() => setShowLegend(!showLegend)}
          className={`p-3 transition-all group relative ${showLegend ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-600/20 text-slate-600 hover:text-indigo-400'}`}
          title="Índice de Peças"
        >
          <Layers size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap uppercase">ÍNDICE</span>
        </button>

        <button 
          onClick={() => setExploded(!exploded)}
          className={`p-3 transition-all border-b border-slate-200 group relative ${exploded ? 'bg-orange-600 text-white' : 'hover:bg-orange-600/20 text-slate-600 hover:text-orange-400'}`}
          title="Visão Explodida"
        >
          <Bomb size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">DINAMITE</span>
        </button>

        <button 
          onClick={() => setIsBlueprintOpen(true)}
          className="p-3 hover:bg-blue-600/20 text-slate-600 hover:text-blue-400 transition-all border-b border-slate-200 group relative"
          title="Desenho Técnico"
        >
          <FileText size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">BLUEPRINT</span>
        </button>

        <button 
          onClick={() => setEngineeringOpen(!engineeringOpen)}
          className={`p-3 transition-all group relative ${engineeringOpen ? 'bg-blue-600 text-white' : 'hover:bg-blue-600/20 text-slate-600 hover:text-blue-400'}`}
          title="Painel de Engenharia"
        >
          <Activity size={16} />
          <span className="absolute right-full mr-2 px-2 py-1 bg-slate-100 text-[8px] font-bold text-slate-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ENGENHARIA</span>
        </button>
      </div>

      {isBlueprintOpen && (
        <div className="absolute inset-0 z-[100] bg-slate-50 p-4 lg:p-8 text-slate-900 flex flex-col backdrop-blur-md">
          <div className="flex justify-between items-center mb-6 bg-white/50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">
                <Ruler size={20} className="text-slate-900" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase">BLUEPRINT TÉCNICO</h2>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Visualização de Fabricação 2D</p>
              </div>
            </div>
            <button 
              onClick={() => setIsBlueprintOpen(false)} 
              className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 border border-red-500/50 shadow-xl shadow-red-900/20"
            >
              <X size={16} /> FECHAR
            </button>
          </div>
          
          <div className="flex-1 min-h-0 bg-white rounded border border-slate-200">
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
