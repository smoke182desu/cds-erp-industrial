import React, { useState, useRef, useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Viewer3D } from './Part3DViewer/Viewer3D';
import { perfisDB, PerfilData } from '../data/perfisDB';
import { telhasDB, TelhaData } from '../data/telhasDB';
import { tesourasDB } from '../data/tesourasDB'; // Importado
import { acabamentosMetal, materiaisDegrau, AcabamentoMetalKey, MaterialDegrauKey } from '../data/materiaisDB';
import { gerarPropostaPDF } from '../utils/pdfGenerator';
import { 
  Ruler, 
  DoorOpen, 
  ChevronRight, 
  Layers, 
  Settings, 
  Hammer, 
  Paintbrush, 
  ShieldAlert, 
  Package, 
  Eye, 
  FileText, 
  Warehouse, 
  DollarSign, 
  ShoppingCart,
  HelpCircle,
  Square,
  ArrowRightLeft,
  CornerDownRight,
  Home,
  Check,
  Factory,
  Plus,
  ChevronDown,
  ChevronUp,
  Share2,
  Truck
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useERP } from '../contexts/ERPContext';
import { CheckoutPropostaModal } from './CheckoutPropostaModal';
import { CatalogoIndustrial } from './CatalogoIndustrial';

import { calcularPortaoBasculante } from '../utils/EngCalculations';
import { coresDB } from '../data/coresDB';
import { ProjectState } from '../types';
import { PropostaComercial } from './PropostaComercial';

interface ConfiguradorProps {
  project: ProjectState;
  onUpdate: (updates: Partial<ProjectState>) => void;
}

export const bitolasChapa = [
  { id: '20', label: 'Chapa 20 (0.90mm)', value: 0.90 },
  { id: '18', label: 'Chapa 18 (1.20mm)', value: 1.20 },
  { id: '16', label: 'Chapa 16 (1.50mm)', value: 1.50 },
  { id: '14', label: 'Chapa 14 (1.90mm)', value: 1.90 },
  { id: '13', label: 'Chapa 13 (2.25mm)', value: 2.25 },
  { id: '12', label: 'Chapa 12 (2.65mm)', value: 2.65 },
  { id: '11', label: 'Chapa 11 (3.00mm)', value: 3.00 },
  { id: '3_16', label: 'Chapa 3/16" (4.75mm)', value: 4.75 },
  { id: '1_4', label: 'Chapa 1/4" (6.35mm)', value: 6.35 },
];

export const getQtdDobras = (tipo: string) => {
  switch (tipo) {
    case 'chapa_cortada': return 0;
    case 'chapa_dobrada_l': return 1;
    case 'chapa_dobrada_u': return 2;
    case 'chapa_dobrada_z': return 2;
    case 'chapa_dobrada_cartola': return 4;
    case 'bandeja_metalica': return 4;
    case 'perfil_u_enrijecido': return 4;
    default: return 0;
  }
};

export const Configurador: React.FC<ConfiguradorProps> = ({ project, onUpdate }) => {
  const { config } = useConfig();
  const { state, adicionarAoCarrinho } = useERP();

  // ... (rest of the component)

  const [largura, setLargura] = useState<number>(project.dimensions.width || 5000); // mm
  const [altura, setAltura] = useState<number>(project.dimensions.height || 2500); // mm
  const [perfilSelecionadoId, setPerfilSelecionadoId] = useState<string>(project.material || 'perfil_u_enrijecido_150x50x2');
  const [quantidadeGrades, setQuantidadeGrades] = useState<number>(project.quantidadeGrades || 3);
  const [tipoMontagem, setTipoMontagem] = useState<'reto' | 'meia-esquadria'>(project.tipoMontagem || 'meia-esquadria');
  const [tipoEntrega, setTipoEntrega] = useState<'pecas' | 'montado_sem_pintura' | 'montado_com_pintura'>(project.tipoEntrega || 'montado_com_pintura');
  const [tipoProduto, setTipoProduto] = useState<string>(project.tipoProduto || 'cobertura_pergolado');
  
  const [anguloAberturaGraus, setAnguloAberturaGraus] = useState<number>(0);
  
  // Novos estados para Chapas e Dobras
  const [espessuraChapa, setEspessuraChapa] = useState<number>(0.90);
  const [referenciaMedida, setReferenciaMedida] = useState<'interna' | 'externa'>('externa');
  const [abaExtra, setAbaExtra] = useState<number>(15); // Para dentes de U enrijecido ou abas externas de cartola
  
  // Novos estados para a Cobertura / Pergolado
  const [profundidade, setProfundidade] = useState<number>(project.dimensions.depth || 5000);
  const [inclinacaoPercentual, setInclinacaoPercentual] = useState<number>(project.inclinacaoPercentual || 10);
  const [materialCobertura, setMaterialCobertura] = useState<'vidro' | 'policarbonato' | 'telha' | 'vazio'>(project.materialCobertura || 'telha');
  const [materialCoberturaRampa, setMaterialCoberturaRampa] = useState<string>(project.materialCoberturaRampa || 'chapa_antiderrapante_aco_3');
  const [perfilQuadroRampaId, setPerfilQuadroRampaId] = useState<string>(project.perfilQuadroRampaId || 'metalon40x40x1.5');
  const [telhaSelecionadaId, setTelhaSelecionadaId] = useState<string>(project.telhaSelecionadaId || 'telha_galvanizada_trap_40');
  const [alturaPatamar, setAlturaPatamar] = useState<number>(1400);
  const [direcaoCurva, setDirecaoCurva] = useState<'esquerda' | 'direita'>('direita');
  const [fixacao, setFixacao] = useState<'chumbado' | 'sapata_parafuso'>(project.fixacao || 'sapata_parafuso');

  // Novos estados para o Guarda-Corpo
  const [temGuardaCorpo, setTemGuardaCorpo] = useState<boolean>(false);
  const [ladoGuardaCorpo, setLadoGuardaCorpo] = useState<'esquerdo' | 'direito' | 'ambos'>('ambos');

  // Novos estados para Materiais PBR
  const [acabamento, setAcabamento] = useState<AcabamentoMetalKey>((project.acabamento as AcabamentoMetalKey) || 'preto_fosco');
  const [materialDegrau, setMaterialDegrau] = useState<MaterialDegrauKey>('madeira_clara');
  const [qtdTercas, setQtdTercas] = useState<number>(project.qtdTercas || 6);
  const [perfilTercaId, setPerfilTercaId] = useState<string>(project.perfilTercaId || 'perfil_u_enrijecido_75x40');
  const [perfilColunaId, setPerfilColunaId] = useState<string>(project.perfilColunaId || 'metalon100x100x2.0');
  const [perfilVigaId, setPerfilVigaId] = useState<string>(project.perfilVigaId || 'metalon100x100x2.0');
  const [perfilDiagonalId, setPerfilDiagonalId] = useState<string>(project.perfilDiagonalId || 'metalon100x100x2.0');
  const [perfilTrilhoId, setPerfilTrilhoId] = useState<string>(project.perfilTrilhoId || 'ferro_redondo_macico_5/8');
  const [perfilGuiaId, setPerfilGuiaId] = useState<string>(project.perfilGuiaId || 'trilho_u_guia');
  const [perfilBatenteId, setPerfilBatenteId] = useState<string>(project.perfilBatenteId || 'perfil_u_batente');
  const [perfilColunaPortaoId, setPerfilColunaPortaoId] = useState<string>(project.perfilColunaPortaoId || 'metalon100x100x2.0');
  const [perfilQuadroId, setPerfilQuadroId] = useState<string>(project.perfilQuadroId || 'metalon50x50x1.5');
  const [perfilCaixaId, setPerfilCaixaId] = useState<string>(project.perfilCaixaId || 'chapa_dobrada_u_100x40');
  const [perfilTravessaId, setPerfilTravessaId] = useState<string>(project.perfilTravessaId || 'metalon100x100x2.0');
  const [perfilBracoId, setPerfilBracoId] = useState<string>(project.perfilBracoId || 'metalon50x30x1.5');
  const [perfilMontanteId, setPerfilMontanteId] = useState<string>(project.perfilMontanteId || 'metalon50x50x1.5');
  const [perfilGradeId, setPerfilGradeId] = useState<string>(project.perfilGradeId || 'metalon20x20x1.2');
  const [incluirPortaoPedestre, setIncluirPortaoPedestre] = useState<boolean>(project.incluirPortaoPedestre || false);
  const [tipoTesouraId, setTipoTesouraId] = useState<string>(project.tipoTesouraId || 'fink');
  const [isValueOpen, setIsValueOpen] = useState<boolean>(false);
  const [isPropostaOpen, setIsPropostaOpen] = useState<boolean>(false);
  const [qtdColunasExtras, setQtdColunasExtras] = useState<number>(project.qtdColunasExtras || 0);

  // Estado para Cotas 3D
  const [mostrarCotas, setMostrarCotas] = useState<boolean>(project.mostrarCotas !== undefined ? project.mostrarCotas : true);
  const [mostrarNodes, setMostrarNodes] = useState<boolean>(project.mostrarNodes !== undefined ? project.mostrarNodes : true);
  const [explodedFactor, setExplodedFactor] = useState<number>(project.explodedFactor || 0);
  const [planificada, setPlanificada] = useState<boolean>(false);
  const [temPintura, setTemPintura] = useState<boolean>(project.temPintura || false);

  const isGalpao = tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada';
  const isTesoura = tipoProduto === 'tesoura';
  const isCobertura = tipoProduto === 'cobertura_pergolado';

  const [isSaving, setIsSaving] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [tier, setTier] = useState<'comercial' | 'reforcado' | 'premium'>('comercial');

  // Efeito para aplicar configuraÃ§Ãµes de Tier
  useEffect(() => {
    if (tier === 'comercial') {
      setPerfilCaixaId('chapa_dobrada_u_100x40');
      setPerfilQuadroId('metalon50x50x1.5');
      setPerfilColunaId('metalon100x100x2.0');
      setPerfilVigaId('metalon100x100x2.0');
      setPerfilTercaId('perfil_u_enrijecido_75x40');
      setEspessuraChapa(0.90);
    } else if (tier === 'reforcado') {
      setPerfilCaixaId('chapa_dobrada_u_150x50');
      setPerfilQuadroId('metalon50x50x2.0');
      setPerfilColunaId('metalon150x150x2.0');
      setPerfilVigaId('metalon150x150x2.0');
      setPerfilTercaId('perfil_u_enrijecido_100x40');
      setEspessuraChapa(1.20);
    } else if (tier === 'premium') {
      setPerfilCaixaId('chapa_dobrada_u_200x50');
      setPerfilQuadroId('metalon80x80x2.0');
      setPerfilColunaId('metalon200x200x1.2'); // Note: metalon200x200x1.2 was found in grep, maybe need a thicker one if available
      setPerfilVigaId('metalon200x200x1.2');
      setPerfilTercaId('perfil_u_enrijecido_150x50x2');
      setEspessuraChapa(1.90);
    }
  }, [tier]);

  const steps = [
    { label: 'PRODUTO', icon: Package },
    { label: 'DIMENSÃ•ES', icon: Ruler },
    { label: 'ESTRUTURA', icon: Settings },
    { label: 'MATERIAIS', icon: Paintbrush },
    { label: 'PROJETO', icon: Eye },
  ];

  const [activeStep, setActiveStep] = useState(0);

  // Cores automÃ¡ticas baseadas no padrÃ£o ABNT
  const systemColors = {
    banzo: coresDB.find(c => c.id === 'azul_1')?.hex || '#3b82f6',
    montante: coresDB.find(c => c.id === 'verde_3')?.hex || '#166534',
    diagonal: coresDB.find(c => c.id === 'verde_1')?.hex || '#22c55e',
    terca: coresDB.find(c => c.id === 'amarelo_1')?.hex || '#eab308',
    coluna: coresDB.find(c => c.id === 'vermelho_2')?.hex || '#dc2626',
    viga: coresDB.find(c => c.id === 'laranja_1')?.hex || '#f97316',
    fechamento: coresDB.find(c => c.id === 'cinza_1')?.hex || '#64748b',
  };

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [autoColunas, setAutoColunas] = useState<boolean>(true);
  const [tipoTelhado, setTipoTelhado] = useState<'uma_agua' | 'duas_aguas' | 'invertido'>(project.tipoTelhado || 'uma_agua');
  const [tipoChegada, setTipoChegada] = useState<'Abaixo' | 'Nivelado'>(project.tipoChegada || 'Abaixo');
  const [isReportExpanded, setIsReportExpanded] = useState(false);

  const [isChangingProduct, setIsChangingProduct] = useState(false);
  const [isPropostaModalOpen, setIsPropostaModalOpen] = useState(false);
  const [rampaBOM, setRampaBOM] = useState<any>(null);
  const [currentBOM, setCurrentBOM] = useState<any[]>([]);

  const renderSubstitutoSelector = (code: string) => {
    const getOptions = (compat: string[]) => {
      return perfisDB.filter(p => p.componentesCompativeis?.some(c => compat.includes(c)));
    };

    // Special case for material types (not profiles)
    if (tipoProduto === 'cobertura_pergolado' && code === 'D') {
      return (
        <select
          value={materialCobertura}
          onChange={(e) => setMaterialCobertura(e.target.value as any)}
          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="vidro">Vidro Laminado</option>
          <option value="policarbonato">Policarbonato Alveolar</option>
          <option value="telha">Telha TermoacÃºstica</option>
          <option value="vazio">Sem Cobertura</option>
        </select>
      );
    }

    // Mapeamento de cÃ³digos para estados e compatibilidades (SensÃ­vel ao tipo de produto)
    const getMapping = (): Record<string, { state: string, setter: (val: string) => void, compat: string[] }> => {
      if (tipoProduto === 'portao_basculante') {
        return {
          'A': { state: perfilCaixaId, setter: setPerfilCaixaId, compat: ['coluna', 'quadro'] },
          'B': { state: perfilTrilhoId, setter: setPerfilTrilhoId, compat: ['trilho'] },
          'C': { state: perfilTravessaId, setter: setPerfilTravessaId, compat: ['viga', 'quadro'] },
          'I': { state: perfilBracoId, setter: setPerfilBracoId, compat: ['quadro'] },
          'L': { state: perfilQuadroId, setter: setPerfilQuadroId, compat: ['quadro'] },
          'N': { state: perfilTravessaId, setter: setPerfilTravessaId, compat: ['viga', 'quadro'] },
          'O': { state: perfilMontanteId, setter: setPerfilMontanteId, compat: ['coluna', 'quadro'] },
          'P': { state: perfilGradeId, setter: setPerfilGradeId, compat: ['grade', 'quadro'] },
        };
      }
      
      if (tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada') {
        return {
          'A': { state: perfilColunaId, setter: setPerfilColunaId, compat: ['coluna'] },
          'C': { state: perfilTercaId, setter: setPerfilTercaId, compat: ['viga', 'quadro'] },
          'B-A': { state: perfilVigaId, setter: setPerfilVigaId, compat: ['viga', 'quadro'] },
          'B-B': { state: perfilVigaId, setter: setPerfilVigaId, compat: ['viga', 'quadro'] },
          'B-C': { state: perfilDiagonalId, setter: setPerfilDiagonalId, compat: ['quadro'] },
          'B-D': { state: perfilDiagonalId, setter: setPerfilDiagonalId, compat: ['quadro'] },
        };
      }

      if (tipoProduto === 'tesoura') {
        return {
          'A': { state: perfilVigaId, setter: setPerfilVigaId, compat: ['viga', 'quadro'] },
          'B': { state: perfilVigaId, setter: setPerfilVigaId, compat: ['viga', 'quadro'] },
          'C': { state: perfilDiagonalId, setter: setPerfilDiagonalId, compat: ['quadro'] },
          'D': { state: perfilDiagonalId, setter: setPerfilDiagonalId, compat: ['quadro'] },
        };
      }

      if (tipoProduto === 'escada_reta_industrial') {
        return {
          'A': { state: perfilVigaId, setter: setPerfilVigaId, compat: ['viga', 'quadro'] },
        };
      }

      if (tipoProduto === 'cobertura_pergolado') {
        return {
          'A': { state: perfilColunaId, setter: setPerfilColunaId, compat: ['coluna'] },
          'B': { state: perfilVigaId, setter: setPerfilVigaId, compat: ['viga', 'quadro'] },
          'C': { state: perfilTercaId, setter: setPerfilTercaId, compat: ['viga', 'quadro'] },
        };
      }

      return {};
    };

    const mapping = getMapping();
    const config = mapping[code];
    if (!config) return null;

    const options = getOptions(config.compat);

    // Indicador de Qualidade
    const currentPerfil = perfisDB.find(p => p.id === config.state);
    const getQualityStatus = (pId: string) => {
      const p = perfisDB.find(x => x.id === pId);
      if (!p || !currentPerfil) return null;
      const currentWeight = currentPerfil.pesoPorMetro || 0;
      const targetWeight = p.pesoPorMetro || 0;
      if (targetWeight > currentWeight * 1.05) return { label: 'Melhora', color: 'text-emerald-500', icon: ChevronUp };
      if (targetWeight < currentWeight * 0.95) return { label: 'Reduz', color: 'text-rose-500', icon: ChevronDown };
      return { label: 'MantÃ©m', color: 'text-slate-400', icon: ArrowRightLeft };
    };

    return (
      <div className="space-y-1">
        <select
          value={config.state}
          onChange={(e) => config.setter(e.target.value)}
          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          {options.map(p => {
            const status = getQualityStatus(p.id);
            return (
              <option key={p.id} value={p.id}>
                {p.nome} {status ? `(${status.label})` : ''}
              </option>
            );
          })}
        </select>
        <div className="flex items-center gap-1 px-1">
          {(() => {
            const status = getQualityStatus(config.state);
            if (!status) return null;
            return (
              <span className={`text-[8px] font-bold uppercase flex items-center gap-0.5 ${status.color}`}>
                <status.icon size={8} /> {status.label} Qualidade
              </span>
            );
          })()}
        </div>
      </div>
    );
  };

  const handleAdicionarAoCarrinho = () => {
    // 1. Montar Objeto do Produto com Dados Reais do 3D
    const produtoCarrinho = {
      nome: productSummary.nome,
      tipo: tipoProduto,
      tier: productSummary.tier,
      dimensoes: { largura, altura, profundidade },
      material: perfilSelecionado.nome,
      tipoEntrega,
      pecas: productSummary.pecas,
      insumos: productSummary.insumos,
      horasTrabalhadas: productSummary.horasTrabalhadas,
      pesoFinal: productSummary.pesoFinal,
      materiaisNecessarios: productSummary.materiaisNecessarios,
      custos: productSummary.custos,
      preco: productSummary.precoTotal,
      bom: currentBOM // Adicionando o Ãndice de PeÃ§as (Regra de Ouro)
    };

    // 2. AÃ§Ã£o no Estado Global
    adicionarAoCarrinho(produtoCarrinho);

    // 3. Feedback Visual
    alert('Item adicionado ao carrinho!');
    setActiveStep(0);
  };

  const projectStates = React.useRef<Record<string, any>>({
    quadro_simples: { largura: 1500, altura: 1500, profundidade: 100, perfilSelecionadoId: 'metalon30x30x1.2', tipoEntrega: 'montado_com_pintura' },
    portao_basculante: { largura: 3000, altura: 2200, profundidade: 100, perfilSelecionadoId: 'metalon50x50x1.5', tipoEntrega: 'montado_com_pintura' },
    portao_deslizante: { largura: 3000, altura: 2200, profundidade: 100, perfilSelecionadoId: 'metalon50x50x1.5', tipoEntrega: 'montado_com_pintura' },
    escada_reta: { largura: 900, altura: 2800, profundidade: 3000, perfilSelecionadoId: 'metalon100x40x2.0', tipoEntrega: 'montado_com_pintura' },
    escada_l: { largura: 900, altura: 2800, profundidade: 3000, perfilSelecionadoId: 'metalon100x40x2.0', tipoEntrega: 'montado_com_pintura' },
    rampa_acessibilidade: { largura: 1200, altura: 1639, profundidade: 9000, perfilSelecionadoId: 'metalon100x40x2.0', tipoEntrega: 'montado_com_pintura' },
    cobertura_pergolado: { largura: 5000, altura: 2500, profundidade: 5000, perfilSelecionadoId: 'metalon100x100x2.0', tipoEntrega: 'montado_com_pintura' },
    galpao: { largura: 10000, altura: 5000, profundidade: 20000, perfilSelecionadoId: 'perfil_u_enrijecido_100x40', tipoEntrega: 'montado_com_pintura' },
    tesoura: { largura: 6000, altura: 600, profundidade: 100, perfilSelecionadoId: 'perfil_u_100x40x2', tipoEntrega: 'montado_com_pintura' },
    galpao_tesoura_personalizada: { largura: 12000, altura: 6000, profundidade: 30000, perfilSelecionadoId: 'viga-i-w200', tipoEntrega: 'montado_com_pintura' },
    chapa_cortada: { largura: 1000, altura: 0, profundidade: 2000, tipoEntrega: 'pecas' },
    chapa_dobrada_l: { largura: 50, altura: 50, profundidade: 2000, tipoEntrega: 'pecas' },
    chapa_dobrada_u: { largura: 100, altura: 40, profundidade: 2000, tipoEntrega: 'pecas' },
    perfil_u_enrijecido: { largura: 100, altura: 40, profundidade: 2000, abaExtra: 15, tipoEntrega: 'pecas' },
    chapa_dobrada_z: { largura: 100, altura: 40, profundidade: 2000, tipoEntrega: 'pecas' },
    chapa_dobrada_cartola: { largura: 100, altura: 40, profundidade: 2000, abaExtra: 15, tipoEntrega: 'pecas' },
    bandeja_metalica: { largura: 500, altura: 50, profundidade: 1000, tipoEntrega: 'pecas' }
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeStep]);

  // Sync with external project changes (e.g. from templates)
  React.useEffect(() => {
    if (isChangingProduct) return;
    if (project.tipoProduto && project.tipoProduto !== tipoProduto) {
      setTipoProduto(project.tipoProduto);
    }
    if (project.dimensions.width && project.dimensions.width !== largura) {
      setLargura(project.dimensions.width);
    }
    if (project.dimensions.height && project.dimensions.height !== altura) {
      let newHeight = project.dimensions.height;
      // Apply clamping ONLY if it's a standalone truss product
      if (project.tipoProduto === 'tesoura') {
        const currentWidth = project.dimensions.width || largura;
        const minH = Math.max(200, Math.round(currentWidth * 0.05));
        const maxH = Math.max(500, Math.round(currentWidth * 0.30));
        newHeight = Math.min(Math.max(newHeight, minH), maxH);
      }
      setAltura(newHeight);
    }
    if (project.dimensions.depth && project.dimensions.depth !== profundidade) {
      setProfundidade(project.dimensions.depth);
    }
    if (project.materialCobertura && project.materialCobertura !== materialCobertura) {
      setMaterialCobertura(project.materialCobertura);
    }
    if (project.inclinacaoPercentual !== undefined && project.inclinacaoPercentual !== inclinacaoPercentual) {
      setInclinacaoPercentual(project.inclinacaoPercentual);
    }
    if (project.telhaSelecionadaId && project.telhaSelecionadaId !== telhaSelecionadaId) {
      setTelhaSelecionadaId(project.telhaSelecionadaId);
    }
    if (project.perfilColunaId && project.perfilColunaId !== perfilColunaId) {
      setPerfilColunaId(project.perfilColunaId);
    }
    if (project.perfilVigaId && project.perfilVigaId !== perfilVigaId) {
      setPerfilVigaId(project.perfilVigaId);
    }
    if (project.perfilDiagonalId && project.perfilDiagonalId !== perfilDiagonalId) {
      setPerfilDiagonalId(project.perfilDiagonalId);
    }
    if (project.perfilTercaId && project.perfilTercaId !== perfilTercaId) {
      setPerfilTercaId(project.perfilTercaId);
    }
    if (project.perfilTrilhoId && project.perfilTrilhoId !== perfilTrilhoId) {
      setPerfilTrilhoId(project.perfilTrilhoId);
    }
    if (project.perfilGuiaId && project.perfilGuiaId !== perfilGuiaId) {
      setPerfilGuiaId(project.perfilGuiaId);
    }
    if (project.perfilBatenteId && project.perfilBatenteId !== perfilBatenteId) {
      setPerfilBatenteId(project.perfilBatenteId);
    }
    if (project.perfilColunaPortaoId && project.perfilColunaPortaoId !== perfilColunaPortaoId) {
      setPerfilColunaPortaoId(project.perfilColunaPortaoId);
    }
    if (project.perfilQuadroId && project.perfilQuadroId !== perfilQuadroId) {
      setPerfilQuadroId(project.perfilQuadroId);
    }
    if (project.perfilCaixaId && project.perfilCaixaId !== perfilCaixaId) {
      setPerfilCaixaId(project.perfilCaixaId);
    }
    if (project.perfilTravessaId && project.perfilTravessaId !== perfilTravessaId) {
      setPerfilTravessaId(project.perfilTravessaId);
    }
    if (project.perfilBracoId && project.perfilBracoId !== perfilBracoId) {
      setPerfilBracoId(project.perfilBracoId);
    }
    if (project.perfilMontanteId && project.perfilMontanteId !== perfilMontanteId) {
      setPerfilMontanteId(project.perfilMontanteId);
    }
    if (project.perfilGradeId && project.perfilGradeId !== perfilGradeId) {
      setPerfilGradeId(project.perfilGradeId);
    }
    if (project.incluirPortaoPedestre !== undefined && project.incluirPortaoPedestre !== incluirPortaoPedestre) {
      setIncluirPortaoPedestre(project.incluirPortaoPedestre);
    }
    if (project.tipoTesouraId && project.tipoTesouraId !== tipoTesouraId) {
      setTipoTesouraId(project.tipoTesouraId);
    }
    if (project.qtdTercas && project.qtdTercas !== qtdTercas) {
      setQtdTercas(project.qtdTercas);
    }
    if (project.qtdColunasExtras !== undefined && project.qtdColunasExtras !== qtdColunasExtras) {
      setQtdColunasExtras(project.qtdColunasExtras);
    }
    if (project.mostrarCotas !== undefined && project.mostrarCotas !== mostrarCotas) {
      setMostrarCotas(project.mostrarCotas);
    }
    if (project.mostrarNodes !== undefined && project.mostrarNodes !== mostrarNodes) {
      setMostrarNodes(project.mostrarNodes);
    }
    if (project.explodedFactor !== undefined && project.explodedFactor !== explodedFactor) {
      setExplodedFactor(project.explodedFactor);
    }
    if (project.tipoTelhado !== undefined) setTipoTelhado(project.tipoTelhado);
    if (project.tipoChegada !== undefined) setTipoChegada(project.tipoChegada);
    if (project.espessuraChapa !== undefined) setEspessuraChapa(project.espessuraChapa);
    if (project.abaExtra !== undefined) setAbaExtra(project.abaExtra);
    if (project.referenciaMedida !== undefined) setReferenciaMedida(project.referenciaMedida);
    if (project.temPintura !== undefined) setTemPintura(project.temPintura);
  }, [project]);

  // Sync local state back to project (debounced)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Only update if something actually changed to avoid infinite loops
      const hasChanges = 
        project.dimensions.width !== largura ||
        project.dimensions.height !== altura ||
        project.dimensions.depth !== profundidade ||
        project.tipoProduto !== tipoProduto ||
        project.inclinacaoPercentual !== inclinacaoPercentual ||
        project.materialCobertura !== materialCobertura ||
        project.telhaSelecionadaId !== telhaSelecionadaId ||
        project.perfilColunaId !== perfilColunaId ||
        project.perfilVigaId !== perfilVigaId ||
        project.perfilDiagonalId !== perfilDiagonalId ||
        project.perfilTercaId !== perfilTercaId ||
        project.perfilTrilhoId !== perfilTrilhoId ||
        project.perfilGuiaId !== perfilGuiaId ||
        project.perfilBatenteId !== perfilBatenteId ||
        project.perfilColunaPortaoId !== perfilColunaPortaoId ||
        project.incluirPortaoPedestre !== incluirPortaoPedestre ||
        project.tipoTesouraId !== tipoTesouraId ||
        project.qtdTercas !== qtdTercas ||
        project.qtdColunasExtras !== qtdColunasExtras ||
        project.acabamento !== acabamento ||
        project.mostrarCotas !== mostrarCotas ||
        project.mostrarNodes !== mostrarNodes ||
        project.explodedFactor !== explodedFactor ||
        project.fixacao !== fixacao ||
        project.tipoTelhado !== tipoTelhado ||
        project.tipoChegada !== tipoChegada ||
        project.espessuraChapa !== espessuraChapa ||
        project.abaExtra !== abaExtra ||
        project.referenciaMedida !== referenciaMedida ||
        project.temPintura !== temPintura;

      if (hasChanges) {
        onUpdate({
          dimensions: { width: largura, height: altura, depth: profundidade },
          tipoProduto,
          inclinacaoPercentual,
          materialCobertura,
          telhaSelecionadaId,
          perfilColunaId,
          perfilVigaId,
          perfilDiagonalId,
          perfilTercaId,
          perfilTrilhoId,
          perfilGuiaId,
          perfilBatenteId,
          perfilColunaPortaoId,
          incluirPortaoPedestre,
          tipoTesouraId,
          qtdTercas,
          qtdColunasExtras,
          acabamento,
          mostrarCotas,
          mostrarNodes,
          explodedFactor,
          fixacao,
          tipoTelhado,
          tipoChegada,
          espessuraChapa,
          abaExtra,
          referenciaMedida,
          temPintura,
          material: (tipoProduto === 'cobertura_pergolado' ? perfilColunaId : perfilSelecionadoId) as any
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [largura, altura, profundidade, tipoProduto, inclinacaoPercentual, materialCobertura, telhaSelecionadaId, perfilColunaId, perfilVigaId, perfilDiagonalId, perfilTercaId, perfilTrilhoId, perfilGuiaId, perfilBatenteId, perfilColunaPortaoId, incluirPortaoPedestre, tipoTesouraId, qtdTercas, qtdColunasExtras, acabamento, mostrarCotas, mostrarNodes, explodedFactor, fixacao, perfilSelecionadoId, tipoTelhado, espessuraChapa, abaExtra, referenciaMedida, temPintura]);

  // LÃ³gica de colunas automÃ¡ticas
  React.useEffect(() => {
    if (tipoProduto === 'cobertura_pergolado' && autoColunas) {
      // Regra: Uma coluna extra a cada 3.5 metros de vÃ£o
      const colunasLargura = Math.max(0, Math.floor(largura / 3500));
      const colunasProfundidade = Math.max(0, Math.floor(profundidade / 3500));
      // SimplificaÃ§Ã£o: pegamos o maior reforÃ§o necessÃ¡rio
      const totalSugerido = colunasLargura + colunasProfundidade;
      if (totalSugerido !== qtdColunasExtras) {
        setQtdColunasExtras(totalSugerido);
      }
    }
  }, [largura, profundidade, tipoProduto, autoColunas]);

  // Filtrar perfis compatÃ­veis com o tipo de projeto
  const perfisCompativeis = perfisDB.filter(p => 
    tipoProduto === 'tesoura' || 
    tipoProduto === 'galpao' || 
    tipoProduto === 'galpao_tesoura_personalizada' ||
    !p.projetosCompativeis || 
    p.projetosCompativeis.includes(tipoProduto as any)
  );

  // Filtros especÃ­ficos por componente
  const perfisColuna = perfisCompativeis.filter(p => p.componentesCompativeis?.includes('coluna'));
  const perfisViga = perfisCompativeis.filter(p => p.componentesCompativeis?.includes('viga'));
  const perfisDiagonal = perfisCompativeis.filter(p => p.componentesCompativeis?.includes('viga') || p.componentesCompativeis?.includes('coluna'));
  const perfisTerca = perfisCompativeis.filter(p => p.componentesCompativeis?.includes('terca'));
  const perfisQuadro = perfisCompativeis.filter(p => p.componentesCompativeis?.includes('quadro'));

  const perfilSelecionado = (tipoProduto === 'tesoura' || tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada')
    ? (perfisViga.find(p => p.id === perfilSelecionadoId) || perfisViga[0] || perfisCompativeis[0] || perfisDB[0])
    : (perfisQuadro.find(p => p.id === perfilSelecionadoId) || perfisQuadro[0] || perfisCompativeis[0] || perfisDB[0]);
  const perfilTercaSelecionado = perfisTerca.find(p => p.id === perfilTercaId) || perfisTerca[0] || perfisCompativeis[0] || perfisDB[0];
  const perfilColunaSelecionado = perfisColuna.find(p => p.id === perfilColunaId) || perfisColuna[0] || perfisCompativeis[0] || perfisDB[0];
  const perfilVigaSelecionado = perfisViga.find(p => p.id === perfilVigaId) || perfisViga[0] || perfisCompativeis[0] || perfisDB[0];
  const perfilDiagonalSelecionado = perfisDiagonal.find(p => p.id === perfilDiagonalId) || perfisDiagonal[0] || perfisCompativeis[0] || perfisDB[0];
  
  const perfilTrilhoSelecionado = perfisDB.find(p => p.id === perfilTrilhoId) || perfisDB[0];
  const perfilGuiaSelecionado = perfisDB.find(p => p.id === perfilGuiaId) || perfisDB[0];
  const perfilBatenteSelecionado = perfisDB.find(p => p.id === perfilBatenteId) || perfisDB[0];
  const perfilColunaPortaoSelecionado = perfisDB.find(p => p.id === perfilColunaPortaoId) || perfisDB[0];

  const productSummary = React.useMemo(() => {
    const perfilSize = perfilSelecionado.tipoShape === 'redondo_oco' ? (perfilSelecionado.diametro || 50) : (perfilSelecionado.largura || 50);

    let materialTotalMM = 0;
    let vaoLivreCalculadoEmMM = 0;
    
    // Escada Reta calculations
    let numDegraus = 0;
    let espelho = 0;
    let pisada = 280;
    let comprimentoTotal = 0;
    let hipotenusa = 0;
    let angulo = 0;
    let qtdMontantes = 0;
    let materialGuardaCorpoMM = 0;
    let confortabilidade = 100;
    let nivelConforto = '100% ConfortÃ¡vel';
    let corConforto = 'text-emerald-400';
    
    // VariÃ¡veis para exibiÃ§Ã£o no relatÃ³rio
    const telha = telhasDB.find(t => t.id === telhaSelecionadaId) || telhasDB[0];
    const maxSpan = telha.tipo === 'sanduiche' ? 2000 : 1500; // em mm
    
    const halfW = largura / 2;
    const rise = (largura / 2) * (inclinacaoPercentual / 100);
    const slopeLength = Math.sqrt(Math.pow(halfW, 2) + Math.pow(rise, 2));
    
    const qtdTercasCalculada = isGalpao ? Math.max(2, Math.ceil(slopeLength / maxSpan) + 1) : qtdTercas;

    const alturaGrade = altura - (2 * perfilSize);
    const larguraFolha = largura - 40;
    const alturaFolha = altura - 40;
    const alturaGradeFolha = alturaFolha - (2 * perfilSize);

    let areaCobertura = 0;
    let custoMaterialCobertura = 0;
    let pesoFinal = 0;
    let custoFinal = 0;

    const listaCorte: { nome: string; qtd: number; medida: string }[] = [];

    if (tipoProduto === 'quadro_simples') {
      const espacoUtil = largura - (2 * perfilSize);
      vaoLivreCalculadoEmMM = (espacoUtil - (quantidadeGrades * perfilSize)) / (quantidadeGrades + 1);
      materialTotalMM = (2 * largura) + (2 * alturaGrade) + (quantidadeGrades * alturaGrade);
      
      listaCorte.push({ nome: 'Barras Horizontais', qtd: 2, medida: `${largura} mm` });
      listaCorte.push({ nome: 'Barras Verticais (Laterais)', qtd: 2, medida: `${alturaGrade} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ nome: 'Grades Internas', qtd: quantidadeGrades, medida: `${alturaGrade} mm` });
      }
    } else if (tipoProduto === 'portao_basculante') {
      const calcBasculante = calcularPortaoBasculante(largura, altura, 'chapa');
      
      const espacoUtil = larguraFolha - (2 * perfilSize);
      vaoLivreCalculadoEmMM = (espacoUtil - (quantidadeGrades * perfilSize)) / (quantidadeGrades + 1);
      
      // Usamos os pesos calculados pela engenharia
      pesoFinal = parseFloat(calcBasculante.pesos.totalEstimado);
      materialTotalMM = (parseFloat(calcBasculante.folhaMovel[0].qtd) + parseFloat(calcBasculante.quadroFixo[1].qtd)) * 1000;

      // Adiciona itens da BOM por categorias
      calcBasculante.quadroFixo.forEach(item => {
        listaCorte.push({ nome: `[FIXO] ${item.item}`, qtd: parseFloat(item.qtd), medida: item.unit });
      });
      calcBasculante.folhaMovel.forEach(item => {
        listaCorte.push({ nome: `[FOLHA] ${item.item}`, qtd: parseFloat(item.qtd), medida: item.unit });
      });
      calcBasculante.kitCinematico.forEach(item => {
        listaCorte.push({ nome: `[KIT] ${item.item}`, qtd: parseFloat(item.qtd), medida: item.unit });
      });
      calcBasculante.sistemaContrapeso.forEach(item => {
        listaCorte.push({ nome: `[PESO] ${item.item}`, qtd: parseFloat(item.qtd), medida: item.unit });
      });
      
      // Notas de engenharia
      calcBasculante.notas.forEach(nota => {
        listaCorte.push({ nome: `DICA`, qtd: 0, medida: nota });
      });

      if (quantidadeGrades > 0) {
        listaCorte.push({ nome: 'Grades Adicionais', qtd: quantidadeGrades, medida: `${alturaGradeFolha} mm` });
      }
    } else if (tipoProduto === 'portao_deslizante') {
      const espacoUtil = larguraFolha - (2 * perfilSize);
      vaoLivreCalculadoEmMM = (espacoUtil - (quantidadeGrades * perfilSize)) / (quantidadeGrades + 1);
      
      const materialFolha = (2 * larguraFolha) + (2 * alturaGradeFolha) + (quantidadeGrades * alturaGradeFolha);
      materialTotalMM = materialFolha;

      listaCorte.push({ nome: 'Trilho Inferior', qtd: 1, medida: `${largura * 2} mm` });
      listaCorte.push({ nome: 'Guia Superior', qtd: 1, medida: `${largura * 2} mm` });
      listaCorte.push({ nome: 'Colunas de SustentaÃ§Ã£o', qtd: 2, medida: `${altura} mm` });
      listaCorte.push({ nome: 'Travessa Superior (Batente)', qtd: 1, medida: `${largura} mm` });
      listaCorte.push({ nome: 'Folha - Horizontais', qtd: 2, medida: `${larguraFolha} mm` });
      listaCorte.push({ nome: 'Folha - Verticais', qtd: 2, medida: `${alturaGradeFolha} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ nome: 'Folha - Grades', qtd: quantidadeGrades, medida: `${alturaGradeFolha} mm` });
      }
      if (incluirPortaoPedestre) {
        listaCorte.push({ nome: 'PortÃ£o Pedestre - Horizontais', qtd: 2, medida: `900 mm` });
        listaCorte.push({ nome: 'PortÃ£o Pedestre - Verticais', qtd: 2, medida: `2100 mm` });
      }
    } else if (tipoProduto === 'escada_reta') {
      const numEspelhos = Math.round(altura / 180);
      espelho = altura / numEspelhos;
      const numPisadas = tipoChegada === 'Abaixo' ? numEspelhos - 1 : numEspelhos;
      pisada = profundidade / numPisadas;
      numDegraus = numPisadas;
      
      comprimentoTotal = profundidade;
      hipotenusa = Math.sqrt(Math.pow(altura, 2) + Math.pow(comprimentoTotal, 2));
      angulo = Math.atan2(altura, comprimentoTotal);
      materialTotalMM = 2 * hipotenusa;

      const blondel = (2 * espelho) + pisada;
      if (blondel >= 620 && blondel <= 640) {
        confortabilidade = 100;
        nivelConforto = 'Escada ConfortÃ¡vel (Dentro da Norma)';
        corConforto = 'text-emerald-400';
      } else if (blondel < 620) {
        confortabilidade = 60;
        nivelConforto = 'Escada Curta/Passo Apertado';
        corConforto = 'text-orange-400';
      } else {
        confortabilidade = 40;
        nivelConforto = 'Escada Longa/Muito Inclinada';
        corConforto = 'text-red-500';
      }

      if (temGuardaCorpo) {
        const qtdLados = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        const alturaGuardaCorpoMM = 900;
        qtdMontantes = Math.floor(numDegraus / 2) + 1;
        if (numDegraus % 2 !== 0) qtdMontantes += 1;
        const materialCorrimao = hipotenusa * qtdLados;
        const materialMontantes = alturaGuardaCorpoMM * qtdMontantes * qtdLados;
        materialGuardaCorpoMM = materialCorrimao + materialMontantes;
        materialTotalMM += materialGuardaCorpoMM;
      }

      listaCorte.push({ nome: 'Vigas Laterais', qtd: 2, medida: `${hipotenusa.toFixed(1)} mm (Ã‚ngulo: ${(angulo * 180 / Math.PI).toFixed(1)}Â°)` });
      listaCorte.push({ nome: 'Degraus', qtd: numDegraus, medida: `Pisada: ${pisada} mm, Espelho: ${espelho.toFixed(1)} mm` });
      if (temGuardaCorpo) {
        const qtdLados = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        listaCorte.push({ nome: 'CorrimÃ£o Superior', qtd: qtdLados, medida: `${hipotenusa.toFixed(1)} mm` });
        listaCorte.push({ nome: 'Montantes Verticais', qtd: qtdMontantes * qtdLados, medida: `900 mm` });
      }
    } else if (tipoProduto === 'escada_l') {
      const numDegraus1 = Math.max(1, Math.round(alturaPatamar / 180));
      const espelho1 = alturaPatamar / numDegraus1;
      pisada = Math.max(200, Math.round((profundidade - largura) / numDegraus1));
      const comprimento1 = numDegraus1 * pisada;
      
      const alturaRestante = altura - alturaPatamar;
      const numDegraus2 = Math.max(1, Math.round(alturaRestante / 180));
      const espelho2 = alturaRestante / numDegraus2;
      const comprimento2 = numDegraus2 * pisada;

      numDegraus = numDegraus1 + numDegraus2;
      espelho = (espelho1 + espelho2) / 2;
      comprimentoTotal = comprimento1 + comprimento2 + largura;
      
      const hipotenusa1 = Math.sqrt(Math.pow(alturaPatamar, 2) + Math.pow(comprimento1, 2));
      const hipotenusa2 = Math.sqrt(Math.pow(alturaRestante, 2) + Math.pow(comprimento2, 2));
      hipotenusa = hipotenusa1 + hipotenusa2;
      angulo = Math.atan2(alturaPatamar, comprimento1); // Ã‚ngulo mÃ©dio
      
      materialTotalMM = (2 * hipotenusa1) + (2 * hipotenusa2) + (4 * largura); // Vigas laterais + patamar

      const blondel = (2 * espelho) + pisada;
      if (blondel >= 630 && blondel <= 640) {
        confortabilidade = 100;
        nivelConforto = '100% ConfortÃ¡vel (Ideal)';
        corConforto = 'text-emerald-400';
      } else {
        const desvio = Math.min(Math.abs(blondel - 635), 150);
        confortabilidade = Math.max(0, Math.round(100 - (desvio * 1.2)));
        if (confortabilidade >= 90) {
          nivelConforto = 'Muito ConfortÃ¡vel';
          corConforto = 'text-emerald-400';
        } else if (confortabilidade >= 75) {
          nivelConforto = 'ConfortÃ¡vel';
          corConforto = 'text-green-400';
        } else if (confortabilidade >= 50) {
          nivelConforto = 'DesconfortÃ¡vel';
          corConforto = 'text-yellow-400';
        } else if (confortabilidade >= 25) {
          nivelConforto = 'Muito DesconfortÃ¡vel (Risco de Queda)';
          corConforto = 'text-orange-400';
        } else {
          nivelConforto = 'Altamente DesconfortÃ¡vel (Risco Fatal)';
          corConforto = 'text-red-500';
        }
      }

      if (temGuardaCorpo) {
        const qtdLados = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        const alturaGuardaCorpoMM = 900;
        qtdMontantes = Math.floor(numDegraus / 2) + 2;
        const materialCorrimao = hipotenusa * qtdLados;
        const materialMontantes = alturaGuardaCorpoMM * qtdMontantes * qtdLados;
        materialGuardaCorpoMM = materialCorrimao + materialMontantes;
        materialTotalMM += materialGuardaCorpoMM;
      }

      listaCorte.push({ nome: 'Vigas Lance 1', qtd: 2, medida: `${hipotenusa1.toFixed(1)} mm` });
      listaCorte.push({ nome: 'Vigas Lance 2', qtd: 2, medida: `${hipotenusa2.toFixed(1)} mm` });
      listaCorte.push({ nome: 'Degraus', qtd: numDegraus, medida: `Pisada: ${pisada} mm, Espelho MÃ©dio: ${espelho.toFixed(1)} mm` });
      listaCorte.push({ nome: 'Patamar', qtd: 1, medida: `${largura} x ${largura} mm` });
      
      if (temGuardaCorpo) {
        const qtdLados = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        listaCorte.push({ nome: 'CorrimÃ£o', qtd: qtdLados, medida: `${hipotenusa.toFixed(1)} mm` });
        listaCorte.push({ nome: 'Montantes Verticais', qtd: qtdMontantes * qtdLados, medida: `900 mm` });
      }
    } else if (isCobertura || isGalpao || isTesoura) {
      const inclinacaoReal = isNaN(inclinacaoPercentual) ? 0 : inclinacaoPercentual;
      const _l = isNaN(largura) ? 0 : largura;
      const _a = isNaN(altura) ? 0 : altura;
      const _p = isNaN(profundidade) ? 0 : profundidade;
      const _qT = isNaN(qtdTercas) ? 0 : qtdTercas;
      const _qC = isNaN(qtdColunasExtras) ? 0 : qtdColunasExtras;

      const diferencaAltura = (isGalpao ? (_l / 2) : _p) * (inclinacaoReal / 100);
      const comprimentoInclinado = isGalpao 
        ? Math.sqrt(Math.pow(_l / 2, 2) + Math.pow(diferencaAltura, 2)) * 2
        : Math.sqrt(Math.pow(_p, 2) + Math.pow(diferencaAltura, 2));
      
      areaCobertura = isGalpao 
        ? (comprimentoInclinado / 1000) * (_p / 1000)
        : isTesoura ? 0 : (_l / 1000) * (comprimentoInclinado / 1000);
      
      if (isGalpao) {
        const numTesouras = Math.ceil(_p / 4000) + 1;
        const materialPilares = (_a * 2) * numTesouras;
        const materialTesouras = (_l + (diferencaAltura * 2)) * numTesouras;
        const materialTerÃ§as = (qtdTercasCalculada * 2) * _p;
        materialTotalMM = materialPilares + materialTesouras + materialTerÃ§as;

        listaCorte.push({ nome: 'Pilares Estruturais', qtd: numTesouras * 2, medida: `${_a} mm` });
        listaCorte.push({ nome: 'Tesouras (Banzos)', qtd: numTesouras * 2, medida: `${(comprimentoInclinado / 2).toFixed(1)} mm` });
        listaCorte.push({ nome: 'TerÃ§as de Cobertura', qtd: qtdTercasCalculada * 2, medida: `${_p} mm` });
      } else if (isTesoura) {
        const materialBanzos = _l + 2 * Math.sqrt(Math.pow(_l/2, 2) + Math.pow(_a, 2));
        const materialInternos = _l + 2 * _a;
        materialTotalMM = materialBanzos + materialInternos;

        listaCorte.push({ nome: 'Banzo Inferior', qtd: 1, medida: `${_l} mm` });
        listaCorte.push({ nome: 'Banzos Superiores', qtd: 2, medida: `${Math.sqrt(Math.pow(_l/2, 2) + Math.pow(_a, 2)).toFixed(1)} mm` });
        listaCorte.push({ nome: 'Montantes/Diagonais', qtd: 1, medida: `Estimado: ${materialInternos.toFixed(1)} mm` });
      } else {
        const alturaTraseira = _a + diferencaAltura;
        const materialPilares = (_a * 2) + (alturaTraseira * 2) + (_qC * ((_a + alturaTraseira) / 2));
        const materialVigas = (_l * 2) + (_p * 2);
        const materialTerÃ§as = _qT * _l;
        materialTotalMM = materialPilares + materialVigas + materialTerÃ§as;

        listaCorte.push({ nome: 'Pilares Frontais', qtd: 2, medida: `${_a} mm` });
        listaCorte.push({ nome: 'Pilares Traseiros', qtd: 2, medida: `${alturaTraseira.toFixed(1)} mm` });
        listaCorte.push({ nome: 'Vigas de Contorno', qtd: 2, medida: `${_l} mm e ${_p} mm` });
        listaCorte.push({ nome: 'TerÃ§as', qtd: _qT, medida: `${_l} mm` });
      }
      
      if (materialCobertura === 'telha') {
        const numTelhasLargura = isGalpao ? Math.ceil(profundidade / telha.larguraUtil) : Math.ceil(largura / telha.larguraUtil);
        const comprimentoTelha = (isGalpao ? (comprimentoInclinado / 2) : comprimentoInclinado) + 100;
        const metrosLinearesTelha = (numTelhasLargura * comprimentoTelha * (isGalpao ? 2 : 1)) / 1000;
        custoMaterialCobertura = metrosLinearesTelha * telha.precoPorMetroLinear;
      } else {
        const precoM2 = materialCobertura === 'vidro' ? 300 : materialCobertura === 'policarbonato' ? 150 : 0;
        custoMaterialCobertura = areaCobertura * precoM2;
      }
    }

    const materialTotalMetros = materialTotalMM / 1000;
    const precoKgMetal = (acabamentosMetal as any)[acabamento]?.precoKg || 20.0;
    const multiplicadorDegrau = tipoProduto === 'escada_reta' ? (materiaisDegrau[materialDegrau as MaterialDegrauKey]?.multiplicadorPreco || 1.0) : 1;

    let custoFixacao = 0;
    let pesoFixacao = 0;
    if (isCobertura || tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') {
      const numPontosFixacao = isCobertura ? 4 : 2;
      if (fixacao === 'sapata_parafuso') {
        custoFixacao = numPontosFixacao * 45;
        pesoFixacao = numPontosFixacao * 1.5;
      } else {
        custoFixacao = numPontosFixacao * 15;
        pesoFixacao = numPontosFixacao * 0.8;
      }
    }

    const pesoTotal = (materialTotalMetros * (perfilSelecionado.pesoPorMetro || 0)) + (areaCobertura * (perfilSelecionado.pesoPorM2 || 0)) + pesoFixacao;
    if (pesoFinal === 0) pesoFinal = pesoTotal;
    if (custoFinal === 0) custoFinal = (((materialTotalMetros * (perfilSelecionado.pesoPorMetro || 0) * precoKgMetal) + (areaCobertura * (perfilSelecionado.pesoPorM2 || 0) * precoKgMetal)) * multiplicadorDegrau) + custoMaterialCobertura + custoFixacao;

    if (isCobertura || isGalpao || isTesoura) {
      const inclinacaoReal = isNaN(inclinacaoPercentual) ? 0 : inclinacaoPercentual;
      const _l = isNaN(largura) ? 0 : largura;
      const _a = isNaN(altura) ? 0 : altura;
      const _p = isNaN(profundidade) ? 0 : profundidade;
      const _qT = isNaN(qtdTercas) ? 0 : qtdTercas;
      const _qC = isNaN(qtdColunasExtras) ? 0 : qtdColunasExtras;

      const diferencaAltura = (isGalpao ? (_l / 2) : _p) * (inclinacaoReal / 100);
      const comprimentoInclinado = isGalpao 
        ? Math.sqrt(Math.pow(_l / 2, 2) + Math.pow(diferencaAltura, 2)) * 2
        : Math.sqrt(Math.pow(_p, 2) + Math.pow(diferencaAltura, 2));

      if (isGalpao) {
        const numTesouras = Math.ceil(_p / 4000) + 1;
        const materialPilares = (_a * 2) * numTesouras;
        const materialVigas = (_l + (diferencaAltura * 2)) * numTesouras * 2; 
        const materialTerÃ§as = (qtdTercasCalculada * 2) * _p;
        const numWebMembersPerTruss = 16;
        const avgWebLength = (diferencaAltura / 2);
        const materialWeb = (numWebMembersPerTruss * avgWebLength) * numTesouras * 2;
        const diagLateral = Math.sqrt(Math.pow(_a, 2) + Math.pow(4000, 2));
        const diagTelhado = Math.sqrt(Math.pow(_l/2, 2) + Math.pow(4000, 2));
        const materialBracing = (diagLateral * 8) + (diagTelhado * 8);
        const materialTerÃ§asTotal = materialTerÃ§as + materialWeb + materialBracing;
        
        const pesoPilares = (materialPilares / 1000) * (perfilColunaSelecionado.pesoPorMetro || 0);
        const pesoVigas = (materialVigas / 1000) * (perfilVigaSelecionado.pesoPorMetro || 0);
        const pesoTercas = (materialTerÃ§asTotal / 1000) * (perfilTercaSelecionado.pesoPorMetro || 0);
        pesoFinal = pesoPilares + pesoVigas + pesoTercas + pesoFixacao;
        
        const custoPilares = (materialPilares / 1000) * ((perfilColunaSelecionado.pesoPorMetro || 0) * precoKgMetal);
        const custoVigas = (materialVigas / 1000) * ((perfilVigaSelecionado.pesoPorMetro || 0) * precoKgMetal);
        const custoTercas = (materialTerÃ§asTotal / 1000) * ((perfilTercaSelecionado.pesoPorMetro || 0) * precoKgMetal);
        custoFinal = (custoPilares + custoVigas + custoTercas) + custoMaterialCobertura + custoFixacao;
      } else if (isTesoura) {
        const materialBanzos = _l + 2 * Math.sqrt(Math.pow(_l/2, 2) + Math.pow(_a, 2));
        const materialInternos = _l + 2 * _a;
        const pesoBanzos = (materialBanzos / 1000) * (perfilSelecionado.pesoPorMetro || 0);
        const pesoInternos = (materialInternos / 1000) * (perfilVigaSelecionado.pesoPorMetro || 0);
        pesoFinal = pesoBanzos + pesoInternos + pesoFixacao;
        const custoBanzos = (materialBanzos / 1000) * ((perfilSelecionado.pesoPorMetro || 0) * precoKgMetal);
        const custoInternos = (materialInternos / 1000) * ((perfilVigaSelecionado.pesoPorMetro || 0) * precoKgMetal);
        custoFinal = (custoBanzos + custoInternos) + custoFixacao;
      } else {
        const alturaTraseira = _a + diferencaAltura;
        const materialPilares = (_a * 2) + (alturaTraseira * 2) + (_qC * ((_a + alturaTraseira) / 2));
        const materialVigas = (_l * 2) + (_p * 2);
        const materialTerÃ§as = _qT * _l;
        const pesoPilares = (materialPilares / 1000) * (perfilColunaSelecionado.pesoPorMetro || 0);
        const pesoVigas = (materialVigas / 1000) * (perfilVigaSelecionado.pesoPorMetro || 0);
        const pesoTercas = (materialTerÃ§as / 1000) * (perfilTercaSelecionado.pesoPorMetro || 0);
        pesoFinal = pesoPilares + pesoVigas + pesoTercas + pesoFixacao;
        const custoPilares = (materialPilares / 1000) * ((perfilColunaSelecionado.pesoPorMetro || 0) * precoKgMetal);
        const custoVigas = (materialVigas / 1000) * ((perfilVigaSelecionado.pesoPorMetro || 0) * precoKgMetal);
        const custoTercas = (materialTerÃ§as / 1000) * ((perfilTercaSelecionado.pesoPorMetro || 0) * precoKgMetal);
        custoFinal = (custoPilares + custoVigas + custoTercas) + custoMaterialCobertura + custoFixacao;
      }
    } else if (tipoProduto === 'portao_deslizante') {
      const materialBatente = (2 * altura) + largura;
      const materialTrilho = largura * 2;
      const materialGuia = largura * 2;
      const materialColunas = altura * 2;
      const materialPedestre = incluirPortaoPedestre ? (2 * 2100) + (2 * 900) : 0;
      const pesoFolha = (materialTotalMM / 1000) * (perfilSelecionado.pesoPorMetro || 0);
      const pesoBatente = (materialBatente / 1000) * (perfilBatenteSelecionado.pesoPorMetro || 0);
      const pesoTrilho = (materialTrilho / 1000) * (perfilTrilhoSelecionado.pesoPorMetro || 0);
      const pesoGuia = (materialGuia / 1000) * (perfilGuiaSelecionado.pesoPorMetro || 0);
      const pesoColunas = (materialColunas / 1000) * (perfilColunaPortaoSelecionado.pesoPorMetro || 0);
      const pesoPedestre = (materialPedestre / 1000) * (perfilSelecionado.pesoPorMetro || 0);
      pesoFinal = pesoFolha + pesoBatente + pesoTrilho + pesoGuia + pesoColunas + pesoPedestre + pesoFixacao;
      const custoFolha = (materialTotalMM / 1000) * ((perfilSelecionado.pesoPorMetro || 0) * precoKgMetal);
      const custoBatente = (materialBatente / 1000) * ((perfilBatenteSelecionado.pesoPorMetro || 0) * precoKgMetal);
      const custoTrilho = (materialTrilho / 1000) * ((perfilTrilhoSelecionado.pesoPorMetro || 0) * precoKgMetal);
      const custoGuia = (materialGuia / 1000) * ((perfilGuiaSelecionado.pesoPorMetro || 0) * precoKgMetal);
      const custoColunas = (materialColunas / 1000) * ((perfilColunaPortaoSelecionado.pesoPorMetro || 0) * precoKgMetal);
      const custoPedestre = (materialPedestre / 1000) * ((perfilSelecionado.pesoPorMetro || 0) * precoKgMetal);
      custoFinal = (custoFolha + custoBatente + custoTrilho + custoGuia + custoColunas + custoPedestre) + custoFixacao;
    } else if (['rampa_acessibilidade', 'carrinho_plataforma', 'gaiola_roll_container', 'carrinho_cilindros', 'reboque_industrial', 'abrigo_onibus', 'escada_reta', 'escada_l', 'cobertura_pergolado', 'galpao', 'galpao_tesoura_personalizada', 'tesoura'].includes(tipoProduto || '')) {
      if (currentBOM && currentBOM.length > 0) {
        custoFinal = currentBOM.reduce((acc, item) => acc + (item.cost || 0), 0);
        pesoFinal = currentBOM.reduce((acc, item) => acc + (item.weight || 0), 0);
        
        currentBOM.forEach(item => {
          listaCorte.push({ nome: item.name, qtd: item.quantity, medida: item.unit });
        });
      }
    } else if (
      tipoProduto === 'chapa_cortada' ||
      tipoProduto === 'chapa_dobrada_l' ||
      tipoProduto === 'chapa_dobrada_u' ||
      tipoProduto === 'perfil_u_enrijecido' ||
      tipoProduto === 'chapa_dobrada_z' ||
      tipoProduto === 'chapa_dobrada_cartola' ||
      tipoProduto === 'bandeja_metalica'
    ) {
      const qtdDobras = getQtdDobras(tipoProduto);
      let somaAbas = 0;
      let somaAbasC = 0; // Para bandeja metÃ¡lica (comprimento)

      if (tipoProduto === 'chapa_cortada') {
        somaAbas = largura;
      } else if (tipoProduto === 'chapa_dobrada_l') {
        somaAbas = largura + altura;
      } else if (tipoProduto === 'chapa_dobrada_u' || tipoProduto === 'chapa_dobrada_z') {
        somaAbas = largura + (2 * altura);
      } else if (tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'chapa_dobrada_cartola') {
        somaAbas = largura + (2 * altura) + (2 * abaExtra);
      } else if (tipoProduto === 'bandeja_metalica') {
        somaAbas = largura + (2 * altura);
        somaAbasC = profundidade + (2 * altura);
      }

      let desenvolvimento = 0;
      let desenvolvimentoC = 0; // Para bandeja metÃ¡lica

      if (referenciaMedida === 'interna') {
        desenvolvimento = somaAbas;
        if (tipoProduto === 'bandeja_metalica') {
          desenvolvimentoC = somaAbasC;
        }
      } else {
        // Externa
        if (tipoProduto === 'bandeja_metalica') {
          // Bandeja tem 2 dobras em cada direÃ§Ã£o
          desenvolvimento = somaAbas - (2 * espessuraChapa);
          desenvolvimentoC = somaAbasC - (2 * espessuraChapa);
        } else {
          desenvolvimento = somaAbas - (qtdDobras * espessuraChapa);
        }
      }

      // Para bandeja metÃ¡lica, o corte plano Ã© uma chapa de (desenvolvimento) x (desenvolvimentoC)
      // Para os outros, Ã© (desenvolvimento) x (profundidade)
      const comprimentoCorte = tipoProduto === 'bandeja_metalica' ? desenvolvimentoC : profundidade;
      
      listaCorte.push({
        nome: 'Corte Plano (Desenvolvimento)',
        qtd: 1,
        medida: tipoProduto === 'bandeja_metalica' 
          ? `${desenvolvimento.toFixed(1)} x ${desenvolvimentoC.toFixed(1)} mm`
          : `${desenvolvimento.toFixed(1)} x ${comprimentoCorte.toFixed(1)} mm`
      });

      // CÃ¡lculo de peso e custo (aproximado para chapa de aÃ§o carbono)
      // Densidade do aÃ§o = 7.85 g/cmÂ³ = 7850 kg/mÂ³
      const areaM2 = (desenvolvimento / 1000) * (comprimentoCorte / 1000);
      pesoFinal = areaM2 * (espessuraChapa / 1000) * 7850;
      custoFinal = pesoFinal * precoKgMetal;
      materialTotalMM = desenvolvimento;
    }

    const areaTotal = (largura / 1000) * (altura / 1000);
    const arameMIG = areaTotal > 5 ? 2 : 0.5; // kg
    const tintaPrimer = areaTotal > 5 ? 1 : 0.25; // latas
    const tintaEsmalte = areaTotal > 5 ? 1 : 0.25; // latas

    const materiaisNecessarios: { id: string; nome: string; qtd: number; unidade: string; custo: number }[] = [];
    const addMaterial = (nomeBusca: string, qtd: number, unidade: string) => {
      if (qtd <= 0) return;
      
      // Tenta encontrar o item no estoque por uma busca mais flexÃ­vel
      const nomeBase = nomeBusca.split(' (')[0].toLowerCase(); // Remove "(Chapa 18)", etc.
      
      const item = state.inventoryItems.find(i => i.nome.toLowerCase().includes(nomeBase));
      if (item) {
        materiaisNecessarios.push({ id: item.id, nome: item.nome, qtd, unidade: item.unidade, custo: item.custo });
      } else {
        materiaisNecessarios.push({ id: `temp-${nomeBusca.replace(/\s+/g, '-')}`, nome: nomeBusca, qtd, unidade, custo: 0 });
      }
    };

    // Adiciona materiais principais (estimativa em barras de 6m)
    const barrasPrincipais = Math.ceil(materialTotalMetros / 6);
    if (barrasPrincipais > 0) {
      addMaterial(perfilSelecionado.nome, barrasPrincipais, 'barra');
    }

    // CÃ¡lculo de Horas Trabalhadas (Estimativa baseada no peso e complexidade)
    const baseHoursPerKg = 0.15; // 0.15h por kg
    const complexityFactor = tipoProduto.includes('galpao') ? 1.5 : 1.2;
    const horasTrabalhadas = Math.ceil(pesoFinal * baseHoursPerKg * complexityFactor);

    // Adiciona insumos
    addMaterial('Arame MIG', arameMIG, 'kg');
    addMaterial('Primer', tintaPrimer, 'galao');
    addMaterial('Esmalte', tintaEsmalte, 'galao');

    return {
      nome: project.name,
      tier,
      pecas: listaCorte,
      insumos: [
        { nome: 'Arame MIG', qtd: arameMIG, unidade: 'kg' },
        { nome: 'Primer Anticorrosivo', qtd: tintaPrimer, unidade: 'latas' },
        { nome: 'Esmalte SintÃ©tico', qtd: tintaEsmalte, unidade: 'latas' },
        { nome: 'Disco de Corte', qtd: Math.ceil(barrasPrincipais * 2), unidade: 'un' },
        { nome: 'Disco de Desbaste', qtd: Math.ceil(barrasPrincipais / 2), unidade: 'un' },
        { nome: 'Energia ElÃ©trica', qtd: horasTrabalhadas * 2.5, unidade: 'kWh' }
      ],
      horasTrabalhadas,
      materiaisNecessarios,
      custos: {
        material: custoFinal * 0.6, // Estimativa 60% material
        insumos: custoFinal * 0.1, // Estimativa 10% insumos
        maoDeObra: horasTrabalhadas * 45, // R$ 45/h
        frete: 120
      },
      pesoFinal,
      custoFinal,
      precoTotal: custoFinal + (custoFinal * config.multiplicadorLucro),
      materialTotalMetros,
      vaoLivreCalculadoEmMM,
      numDegraus,
      espelho,
      pisada,
      comprimentoTotal,
      hipotenusa,
      angulo,
      qtdMontantes,
      materialGuardaCorpoMM,
      confortabilidade,
      nivelConforto,
      corConforto,
      areaCobertura,
      alturaGrade,
      larguraFolha,
      alturaFolha,
      alturaGradeFolha,
      qtdTercasCalculada
    };
  }, [
    tipoProduto, largura, altura, profundidade, quantidadeGrades, 
    perfilSelecionado, perfilColunaSelecionado, perfilVigaSelecionado, 
    perfilTercaSelecionado, perfilGuiaId, perfilBatenteId, 
    perfilColunaPortaoId, perfilTrilhoId, qtdTercas, 
    telhaSelecionadaId, inclinacaoPercentual, materialCobertura, 
    materialCoberturaRampa, perfilQuadroRampaId,
    acabamento, temGuardaCorpo, ladoGuardaCorpo, materialDegrau, 
    fixacao, qtdColunasExtras, incluirPortaoPedestre, project.name,
    espessuraChapa, abaExtra, referenciaMedida, state.inventoryItems,
    alturaPatamar, rampaBOM, currentBOM
  ]);

  const {
    materialTotalMetros, vaoLivreCalculadoEmMM, numDegraus, espelho,
    pisada, comprimentoTotal, hipotenusa, angulo, qtdMontantes,
    materialGuardaCorpoMM, confortabilidade, nivelConforto, corConforto,
    areaCobertura, alturaGrade, larguraFolha,
    alturaFolha, alturaGradeFolha, qtdTercasCalculada, pesoFinal,
    custoFinal, precoTotal
  } = productSummary;

  const handleGerarPDF = () => {
    const canvas = document.querySelector('canvas');
    let imagem3D = '';
    let canvasWidth = 0;
    let canvasHeight = 0;
    if (canvas) {
      imagem3D = canvas.toDataURL('image/png');
      canvasWidth = canvas.width;
      canvasHeight = canvas.height;
    }

    // Preparar lista de corte
    const listaCorte: { item: string; quantidade: number; medida: string }[] = [];

    if (tipoProduto === 'quadro_simples') {
      listaCorte.push({ item: 'Barras Horizontais', quantidade: 2, medida: `${largura} mm` });
      listaCorte.push({ item: 'Barras Verticais (Laterais)', quantidade: 2, medida: `${alturaGrade} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ item: 'Grades Internas', quantidade: quantidadeGrades, medida: `${alturaGrade} mm` });
      }
    } else if (tipoProduto === 'portao_basculante') {
      listaCorte.push({ item: 'Batente - Horizontais', quantidade: 2, medida: `${largura} mm` });
      listaCorte.push({ item: 'Batente - Verticais', quantidade: 2, medida: `${altura} mm` });
      listaCorte.push({ item: 'Folha - Horizontais', quantidade: 2, medida: `${larguraFolha} mm` });
      listaCorte.push({ item: 'Folha - Verticais', quantidade: 2, medida: `${alturaGradeFolha} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ item: 'Folha - Grades', quantidade: quantidadeGrades, medida: `${alturaGradeFolha} mm` });
      }
    } else if (tipoProduto === 'portao_deslizante') {
      listaCorte.push({ item: 'Trilho Inferior', quantidade: 1, medida: `${largura * 2} mm` });
      listaCorte.push({ item: 'Guia Superior', quantidade: 1, medida: `${largura * 2} mm` });
      listaCorte.push({ item: 'Colunas de SustentaÃ§Ã£o', quantidade: 2, medida: `${altura} mm` });
      listaCorte.push({ item: 'Travessa Superior (Batente)', quantidade: 1, medida: `${largura} mm` });
      listaCorte.push({ item: 'Folha - Horizontais', quantidade: 2, medida: `${larguraFolha} mm` });
      listaCorte.push({ item: 'Folha - Verticais', quantidade: 2, medida: `${alturaGradeFolha} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ item: 'Folha - Grades', quantidade: quantidadeGrades, medida: `${alturaGradeFolha} mm` });
      }
      if (incluirPortaoPedestre) {
        listaCorte.push({ item: 'PortÃ£o Pedestre - Horizontais', quantidade: 2, medida: `900 mm` });
        listaCorte.push({ item: 'PortÃ£o Pedestre - Verticais', quantidade: 2, medida: `2100 mm` });
      }
    } else if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') {
      if (tipoProduto === 'escada_reta') {
        listaCorte.push({ item: 'Vigas Laterais', quantidade: 2, medida: `${hipotenusa.toFixed(1)} mm (Ã‚ngulo: ${(angulo * 180 / Math.PI).toFixed(1)}Â°)` });
        listaCorte.push({ item: 'Degraus', quantidade: numDegraus, medida: `Pisada: ${pisada} mm, Espelho: ${espelho.toFixed(1)} mm` });
      } else {
        const numDegraus1 = Math.max(1, Math.round(alturaPatamar / 180));
        const comprimento1 = numDegraus1 * pisada;
        const alturaRestante = altura - alturaPatamar;
        const numDegraus2 = Math.max(1, Math.round(alturaRestante / 180));
        const comprimento2 = numDegraus2 * pisada;
        const hipotenusa1 = Math.sqrt(Math.pow(alturaPatamar, 2) + Math.pow(comprimento1, 2));
        const hipotenusa2 = Math.sqrt(Math.pow(alturaRestante, 2) + Math.pow(comprimento2, 2));
        
        listaCorte.push({ item: 'Vigas Lance 1', quantidade: 2, medida: `${hipotenusa1.toFixed(1)} mm` });
        listaCorte.push({ item: 'Vigas Lance 2', quantidade: 2, medida: `${hipotenusa2.toFixed(1)} mm` });
        listaCorte.push({ item: 'Degraus', quantidade: numDegraus, medida: `Pisada: ${pisada} mm, Espelho MÃ©dio: ${espelho.toFixed(1)} mm` });
        listaCorte.push({ item: 'Patamar', quantidade: 1, medida: `${largura} x ${largura} mm` });
      }
      
      listaCorte.push({ item: 'Confortabilidade', quantidade: 1, medida: `${confortabilidade}% - ${nivelConforto}` });

      if (temGuardaCorpo) {
        const qtdLados = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        listaCorte.push({ item: 'CorrimÃ£o Superior', quantidade: qtdLados, medida: `${hipotenusa.toFixed(1)} mm` });
        listaCorte.push({ item: 'Montantes Verticais', quantidade: qtdMontantes * qtdLados, medida: `900 mm` });
      }
    } else if (tipoProduto === 'cobertura_pergolado' || tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada' || tipoProduto === 'tesoura') {
      const isGalpao = tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada';
      const isTesoura = tipoProduto === 'tesoura';
      const inclinacaoReal = inclinacaoPercentual;
      const halfWidth = isGalpao ? (largura / 2) : largura;
      const baseLength = isGalpao ? halfWidth : profundidade;
      const rise = baseLength * (inclinacaoReal / 100);
      const slopeLength = Math.sqrt(Math.pow(baseLength, 2) + Math.pow(rise, 2));

      if (isGalpao) {
        const numTesouras = Math.ceil(profundidade / 4000) + 1;
        const compBanzoSup = Math.sqrt(Math.pow(largura / 2, 2) + Math.pow(rise, 2));
        
        listaCorte.push({ item: 'Pilares (Colunas)', quantidade: numTesouras * 2, medida: `${altura} mm` });
        listaCorte.push({ item: 'TerÃ§as de Telhado', quantidade: qtdTercasCalculada * 2, medida: `${profundidade} mm` });
        
        // Detalhamento da Tesoura dentro do GalpÃ£o
        listaCorte.push({ item: 'Banzos Inferiores (Tesouras)', quantidade: numTesouras, medida: `${largura} mm` });
        listaCorte.push({ item: 'Banzos Superiores (Tesouras)', quantidade: numTesouras * 2, medida: `${compBanzoSup.toFixed(1)} mm` });
        listaCorte.push({ item: 'Montantes Centrais (Tesouras)', quantidade: numTesouras, medida: `${rise.toFixed(1)} mm` });
        listaCorte.push({ item: 'Internos (Montantes/Diagonais)', quantidade: numTesouras, medida: `Aprox. ${(largura + rise).toFixed(1)} mm por tesoura` });
      } else if (isTesoura) {
        const compBanzoSup = Math.sqrt(Math.pow(largura/2, 2) + Math.pow(altura, 2));
        listaCorte.push({ item: 'Banzo Inferior', quantidade: 1, medida: `${largura} mm` });
        listaCorte.push({ item: 'Banzos Superiores', quantidade: 2, medida: `${compBanzoSup.toFixed(1)} mm` });
        listaCorte.push({ item: 'Montante Central', quantidade: 1, medida: `${altura} mm` });
        listaCorte.push({ item: 'Diagonais e Montantes Menores', quantidade: 1, medida: `Aprox. ${(largura + altura).toFixed(1)} mm total` });
      } else {
        listaCorte.push({ item: 'Pilares Principais', quantidade: 4, medida: `Frontal: ${altura} mm, Traseiro: ${(altura + rise).toFixed(1)} mm` });
        if (qtdColunasExtras > 0) {
          listaCorte.push({ item: 'Colunas de ReforÃ§o (Flambagem)', quantidade: qtdColunasExtras, medida: `MÃ©dia: ${((altura + (altura + rise)) / 2).toFixed(1)} mm` });
        }
        listaCorte.push({ item: 'Vigas Principais', quantidade: 4, medida: `Largura: ${largura} mm, Profundidade: ${profundidade} mm` });
        listaCorte.push({ item: 'TerÃ§as', quantidade: qtdTercas, medida: `${largura} mm` });
      }
      
      if (materialCobertura === 'telha') {
        const telha = telhasDB.find(t => t.id === telhaSelecionadaId) || telhasDB[0];
        const numTelhasLargura = Math.ceil(profundidade / telha.larguraUtil);
        const comprimentoTelha = slopeLength + 100;
        listaCorte.push({ item: `Telhas (${telha.nome})`, quantidade: numTelhasLargura * (isGalpao ? 2 : 1), medida: `${comprimentoTelha.toFixed(1)} mm` });
      } else {
        listaCorte.push({ item: 'Cobertura', quantidade: 1, medida: `${areaCobertura.toFixed(2)} mÂ² (${materialCobertura})` });
      }
    }

    const dadosProjeto = {
      largura,
      altura,
      profundidade,
      inclinacaoPercentual,
      materialCobertura,
      areaCobertura,
      perfilSelecionado,
      quantidadeGrades,
      tipoMontagem,
      tipoProduto,
      qtdColunasExtras,
      pesoTotal: pesoFinal,
      custoTotal: custoFinal,
      temGuardaCorpo,
      ladosGuardaCorpo: ladoGuardaCorpo,
      acabamentoMetal: { nome: acabamentosMetal[acabamento].nome },
      materialDegrau: { nome: materiaisDegrau[materialDegrau].nome },
      fixacao: fixacao === 'chumbado' ? 'Chumbado com Ferro' : 'Sapata e Parafuso',
      listaCorte
    };

    gerarPropostaPDF(dadosProjeto, imagem3D, config, canvasWidth, canvasHeight);
  };

  const handleCompartilhar = async () => {
    if (!auth.currentUser) {
      alert("VocÃª precisa estar logado para compartilhar projetos.");
      return;
    }

    setIsSaving(true);
    try {
      const dadosProjeto = {
        tipo: 'configurador',
        largura,
        altura,
        perfilSelecionadoId,
        perfilTercaId,
        qtdTercas,
        quantidadeGrades,
        tipoMontagem,
        tipoProduto,
        qtdColunasExtras,
        profundidade,
        inclinacaoPercentual,
        materialCobertura,
        temGuardaCorpo,
        ladoGuardaCorpo,
        fixacao,
        acabamento,
        materialDegrau,
        materialCoberturaRampa,
        perfilQuadroRampaId,
        pesoTotal: pesoFinal,
        custoTotal: custoFinal
      };

      const docData = {
        name: `Proposta 3D - ${tipoProduto.replace(/_/g, ' ').toUpperCase()}`,
        data: dadosProjeto,
        userId: auth.currentUser.uid,
        updated_at: Date.now(),
        isPublic: true,
        companyConfig: {
          nomeEmpresa: config.nomeEmpresa,
          telefone: config.telefone,
          logoBase64: config.logoBase64,
          multiplicadorLucro: config.multiplicadorLucro
        }
      };

      const docRef = await addDoc(collection(db, 'projects'), docData);
      const url = `${window.location.origin}/p/${docRef.id}`;
      await navigator.clipboard.writeText(url);
      setShareLink(url);
      alert("Link copiado! Envie para o seu cliente.");
    } catch (error) {
      console.error("Erro ao compartilhar:", error);
      alert("Erro ao gerar link de compartilhamento.");
    } finally {
      setIsSaving(false);
    }
  };

  // Componente de Tooltip Aprimorado
  const Tooltip = ({ text, title }: { text: string, title?: string }) => (
    <div className="group relative inline-block ml-1 align-middle">
      <HelpCircle size={14} className="text-slate-600 hover:text-indigo-500 cursor-help transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-white/95 backdrop-blur-sm text-slate-900 text-[11px] rounded-xl shadow-xl z-50 leading-relaxed border border-white/10">
        {title && <div className="font-bold mb-1 text-indigo-300 uppercase text-[9px] tracking-wider">{title}</div>}
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900/95" />
      </div>
    </div>
  );

  // Componente de SeÃ§Ã£o de ConfiguraÃ§Ã£o
  const ConfigSection = ({ title, icon: Icon, children, isOpen = true }: { title: string, icon: any, children: React.ReactNode, isOpen?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(isOpen);
    return (
      <div className="bg-slate-100/50 rounded border border-slate-200 overflow-visible shadow-xl">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between bg-slate-100 hover:bg-slate-100 transition-colors border-b border-slate-200"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded">
              <Icon size={14} />
            </div>
            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em]">{title}</h3>
          </div>
          <ChevronRight size={14} className={`text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
        {isExpanded && <div className="p-5 space-y-5">{children}</div>}
      </div>
    );
  };

  // Componente de Input com Setas
  const DimensionInput = ({ label, value, onChange, min = 100, max = 10000, step = 10, info, title, hint, trackColor }: { label: string, value: number, onChange: (val: number) => void, min?: number, max?: number, step?: number, info?: string, title?: string, hint?: React.ReactNode, trackColor?: string }) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
          {label}
          {info && <Tooltip text={info} title={title || label} />}
        </label>
        <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
          {value} mm
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 transition-all active:scale-95 flex items-center justify-center font-bold"
        >
          -
        </button>
        <input
          type="number"
          value={isNaN(value) ? "" : value}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={() => {
            if (value < min) onChange(min);
            if (value > max) onChange(max);
          }}
          className="flex-1 bg-slate-50 border border-slate-200 rounded p-2 text-center font-mono text-sm text-slate-900 focus:border-blue-500 outline-none transition-all"
          min={min}
          max={max}
        />
        <button 
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 transition-all active:scale-95 flex items-center justify-center font-bold"
        >
          +
        </button>
      </div>
      <div className="relative h-8 flex items-center">
        <div 
          className="absolute w-full h-2.5 rounded-full pointer-events-none shadow-inner"
          style={{ 
            background: trackColor || '#1e293b',
            transition: 'background 0.3s ease',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={isNaN(value) ? min : value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-8 bg-transparent appearance-none cursor-pointer accent-white relative z-10"
          style={{
            WebkitAppearance: 'none',
            outline: 'none'
          }}
        />
      </div>
      {hint && <div className="mt-1">{hint}</div>}
    </div>
  );

  const handleTipoProdutoChange = (novoTipo: ProjectState['tipoProduto']) => {
    if (!novoTipo) return;
    setIsChangingProduct(true);
    
    // Save current state for the current tipoProduto
    projectStates.current[tipoProduto] = {
      largura, altura, profundidade, perfilSelecionadoId, quantidadeGrades, tipoMontagem, tipoEntrega,
      anguloAberturaGraus, inclinacaoPercentual, materialCobertura, telhaSelecionadaId,
      alturaPatamar, direcaoCurva, fixacao, temGuardaCorpo, ladoGuardaCorpo,
      acabamento, materialDegrau, qtdTercas, perfilTercaId, perfilColunaId, perfilVigaId,
      perfilDiagonalId, tipoTesouraId, autoColunas, qtdColunasExtras, tipoTelhado
    };

    const isTrussProduct = (t: string) => t === 'tesoura' || t === 'galpao_tesoura_personalizada' || t === 'galpao';

    // Load saved state or set defaults
    const savedState = projectStates.current[novoTipo];
    
    let finalLargura = savedState?.largura || largura;
    let finalAltura = savedState?.altura || altura;
    let finalProfundidade = savedState?.profundidade || profundidade;
    let finalInclinacao = savedState?.inclinacaoPercentual || inclinacaoPercentual;

    if (isTrussProduct(novoTipo) && isTrussProduct(tipoProduto)) {
      if (tipoProduto === 'tesoura' && (novoTipo === 'galpao' || novoTipo === 'galpao_tesoura_personalizada')) {
        // De Tesoura para GalpÃ£o: Altura da tesoura vira InclinaÃ§Ã£o
        finalInclinacao = (altura / (largura / 2)) * 100;
        setInclinacaoPercentual(finalInclinacao);
        // Se a altura era pequena (altura de tesoura), define um pÃ© direito padrÃ£o
        if (altura < 3500) {
          finalAltura = 5000;
          setAltura(5000);
        }
        // Se a profundidade era de tesoura (100mm), define uma profundidade padrÃ£o para galpÃ£o
        if (profundidade < 1000) {
          finalProfundidade = 12000;
          setProfundidade(12000);
        }
      } else if ((tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada') && novoTipo === 'tesoura') {
        // De GalpÃ£o para Tesoura: InclinaÃ§Ã£o vira Altura da tesoura
        finalAltura = Math.round((largura / 2) * (inclinacaoPercentual / 100));
        setAltura(finalAltura);
        // Tesoura isolada tem profundidade mÃ­nima (100mm)
        finalProfundidade = 100;
        setProfundidade(100);
      }
    } else if (savedState) {
      setLargura(savedState.largura);
      setAltura(savedState.altura);
      setProfundidade(savedState.profundidade);
      setPerfilSelecionadoId(savedState.perfilSelecionadoId);
      setQuantidadeGrades(savedState.quantidadeGrades);
      setTipoMontagem(savedState.tipoMontagem);
      setAnguloAberturaGraus(savedState.anguloAberturaGraus);
      setInclinacaoPercentual(savedState.inclinacaoPercentual);
      setMaterialCobertura(savedState.materialCobertura);
      setTelhaSelecionadaId(savedState.telhaSelecionadaId);
      setAlturaPatamar(savedState.alturaPatamar);
      setDirecaoCurva(savedState.direcaoCurva);
      setFixacao(savedState.fixacao);
      setTemGuardaCorpo(savedState.temGuardaCorpo);
      setLadoGuardaCorpo(savedState.ladoGuardaCorpo);
      setAcabamento(savedState.acabamento);
      setTipoEntrega(savedState.tipoEntrega || 'montado_com_pintura');
      setMaterialDegrau(savedState.materialDegrau);
      setQtdTercas(savedState.qtdTercas);
      setPerfilTercaId(savedState.perfilTercaId);
      setPerfilColunaId(savedState.perfilColunaId);
      setPerfilVigaId(savedState.perfilVigaId);
      setPerfilDiagonalId(savedState.perfilDiagonalId);
      setTipoTesouraId(savedState.tipoTesouraId);
      setAutoColunas(savedState.autoColunas);
      setQtdColunasExtras(savedState.qtdColunasExtras);
      setTipoTelhado(savedState.tipoTelhado);
    } else {
      // Fallback defaults if no saved state (should not happen with the new initialization)
      if (novoTipo === 'escada_l' || novoTipo === 'escada_reta') {
        finalAltura = 2800;
        finalLargura = 900;
        setAltura(2800);
        setLargura(900);
        setAlturaPatamar(1400);
        setPerfilSelecionadoId('metalon100x40x2.0');
      } else if (novoTipo === 'portao_basculante' || novoTipo === 'portao_deslizante') {
        finalAltura = 2200;
        finalLargura = 3000;
        setAltura(2200);
        setLargura(3000);
        setPerfilSelecionadoId('metalon50x50x1.5');
      } else if (novoTipo?.startsWith('chapa_') || novoTipo === 'perfil_u_enrijecido' || novoTipo === 'bandeja_metalica') {
        finalAltura = 100;
        finalLargura = 100;
        finalProfundidade = 1000;
        setAltura(100);
        setLargura(100);
        setProfundidade(1000);
      }
    }

    setTipoProduto(novoTipo);
    setActiveStep(1); // AvanÃ§a automaticamente para o prÃ³ximo passo
    onUpdate({ 
      tipoProduto: novoTipo,
      inclinacaoPercentual: finalInclinacao,
      dimensions: {
        width: finalLargura,
        height: finalAltura,
        depth: finalProfundidade
      }
    });

    // Release the guard after a short delay to allow states to settle
    setTimeout(() => {
      setIsChangingProduct(false);
    }, 100);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] lg:h-full flex flex-col lg:flex-row gap-0 bg-slate-50 relative overflow-hidden">
      <CheckoutPropostaModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />

      {/* Right Column: 3D Viewer - First on mobile */}
      <div className="w-full lg:w-2/3 h-[400px] sm:h-[500px] lg:h-auto order-1 lg:order-2 relative bg-slate-50 border-b lg:border-b-0 lg:border-l border-slate-100">
        {/* Mini-Cart Icon - CAD Style */}
        <button 
          onClick={() => setIsCheckoutOpen(true)}
          className="absolute top-3 right-3 lg:top-4 lg:right-4 z-50 bg-white/90 backdrop-blur-md text-slate-900 p-2 lg:p-2 px-3 lg:px-4 rounded border border-slate-200 flex items-center gap-2 lg:gap-3 transition-all hover:bg-slate-100 active:scale-95 group shadow-2xl"
        >
          <div className="relative">
            <ShoppingCart size={14} className="text-blue-400 lg:w-4 lg:h-4" />
            {state.carrinhoAtual.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[7px] lg:text-[8px] font-bold w-3.5 h-3.5 lg:w-4 lg:h-4 rounded-full flex items-center justify-center border border-white">
                {state.carrinhoAtual.length}
              </span>
            )}
          </div>
          <span className="text-[10px] lg:text-xs font-mono font-bold tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(state.carrinhoAtual.reduce((acc, item) => acc + (item.preco || 0), 0))}
          </span>
        </button>

        {/* BotÃ£o Adicionar ao Carrinho - CAD Style - Only on Desktop here */}
        <div className="hidden lg:block absolute bottom-6 left-6 right-6 z-40 max-w-md mx-auto">
          <button 
            onClick={handleAdicionarAoCarrinho}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded border border-blue-400/30 font-bold text-sm tracking-widest uppercase shadow-2xl transition-all flex items-center justify-center gap-3"
          >
            <ShoppingCart size={16} /> ADICIONAR AO CARRINHO
          </button>
        </div>

        <div className="absolute top-3 left-3 lg:top-4 lg:left-4 z-10">
          <div className="bg-white/90 backdrop-blur-md p-2 lg:p-3 rounded border border-slate-200 shadow-2xl max-w-[150px] lg:max-w-none">
            <h3 className="text-[8px] lg:text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-0.5 lg:mb-1">PROJETO ATIVO</h3>
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="p-1.5 lg:p-2 bg-blue-600/20 rounded border border-blue-500/30 text-blue-400">
                {(() => {
                  const item = [
                    { id: 'quadro_simples', icon: Square },
                    { id: 'portao_basculante', icon: DoorOpen },
                    { id: 'portao_deslizante', icon: ArrowRightLeft },
                    { id: 'escada_reta', icon: ChevronRight },
                    { id: 'escada_l', icon: CornerDownRight },
                    { id: 'cobertura_pergolado', icon: Home },
                    { id: 'galpao', icon: Warehouse },
                    { id: 'galpao_tesoura_personalizada', icon: Warehouse },
                    { id: 'tesoura', icon: Hammer },
                    { id: 'chapa_cortada', icon: Layers },
                    { id: 'chapa_dobrada_l', icon: Layers },
                    { id: 'chapa_dobrada_u', icon: Layers },
                    { id: 'perfil_u_enrijecido', icon: Layers },
                    { id: 'chapa_dobrada_z', icon: Layers },
                    { id: 'chapa_dobrada_cartola', icon: Layers },
                    { id: 'bandeja_metalica', icon: Package },
                    { id: 'abrigo_onibus', icon: Package },
                    { id: 'carrinho_plataforma', icon: Package },
                    { id: 'gaiola_roll_container', icon: Package },
                    { id: 'carrinho_cilindros', icon: Package },
                    { id: 'reboque_industrial', icon: Truck },
                  ].find(i => i.id === tipoProduto);
                  return item ? <item.icon size={14} className="lg:w-4 lg:h-4" strokeWidth={2.5} /> : <Package size={14} className="lg:w-4 lg:h-4" />;
                })()}
              </div>
              <span className="text-[10px] lg:text-xs font-bold text-slate-800 uppercase tracking-wider truncate">{tipoProduto.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <ErrorBoundary>
          <Viewer3D 
            largura={largura} 
            altura={altura} 
            profundidade={profundidade}
            inclinacaoPercentual={inclinacaoPercentual}
            perfilData={perfilSelecionado} 
            perfilColunaData={perfilColunaSelecionado}
            perfilVigaData={perfilVigaSelecionado}
            perfilDiagonalData={perfilDiagonalSelecionado}
            quantidadeGrades={quantidadeGrades} 
            tipoMontagem={tipoMontagem} 
            tipoProduto={tipoProduto}
            anguloAbertura={(anguloAberturaGraus * Math.PI) / 180}
            temGuardaCorpo={temGuardaCorpo}
            ladoGuardaCorpo={ladoGuardaCorpo}
            acabamentoMetal={acabamento}
            materialDegrau={materialDegrau}
            alturaPatamar={alturaPatamar}
            direcaoCurva={direcaoCurva}
            abaExtra={abaExtra}
            espessuraChapa={espessuraChapa}
            mostrarCotas={mostrarCotas}
            mostrarNodes={mostrarNodes}
            explodedFactor={explodedFactor}
            planificada={planificada}
            onPlanificadaChange={setPlanificada}
            qtdTercas={qtdTercas}
            qtdColunasExtras={qtdColunasExtras}
            perfilTercaData={perfilTercaSelecionado}
            perfilTrilhoData={perfilTrilhoSelecionado}
            perfilGuiaData={perfilGuiaSelecionado}
            perfilBatenteData={perfilBatenteSelecionado}
            perfilColunaPortaoData={perfilColunaPortaoSelecionado}
            incluirPortaoPedestre={incluirPortaoPedestre}
            materialCobertura={materialCobertura}
            telhaSelecionadaId={telhaSelecionadaId}
            colorBanzo={systemColors.banzo}
            colorMontante={systemColors.montante}
            colorDiagonal={systemColors.diagonal}
            colorTerca={systemColors.terca}
            colorColuna={systemColors.coluna}
            colorViga={systemColors.viga}
            colorFechamento={systemColors.fechamento}
            fixacao={fixacao}
            tipoTesouraId={tipoTesouraId}
            tipoTelhado={tipoTelhado}
            materialCoberturaRampa={materialCoberturaRampa}
            perfilQuadroRampaId={perfilQuadroRampaId}
            perfilQuadroId={perfilQuadroId}
            perfilCaixaId={perfilCaixaId}
            perfilTrilhoId={perfilTrilhoId}
            perfilTravessaId={perfilTravessaId}
            perfilBracoId={perfilBracoId}
            perfilMontanteId={perfilMontanteId}
            perfilGradeId={perfilGradeId}
            onBOMCalculated={setCurrentBOM}
          />
        </ErrorBoundary>
      </div>

      {/* Left Column: Controls - Second on mobile */}
      <div className="w-full lg:w-1/3 bg-white border-r border-slate-100 flex flex-col overflow-hidden order-2 lg:order-1">
        {/* Stepper Header */}
        <div className="bg-white border-b border-slate-100 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <div>
              <h2 className="text-xs lg:text-sm font-bold text-slate-900 tracking-[0.2em] uppercase">Configurador</h2>
              <p className="text-[8px] lg:text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">Passo {activeStep + 1} de {steps.length}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-slate-100 rounded border border-slate-200 text-blue-400">
              <Settings size={14} className="lg:w-4 lg:h-4" />
            </div>
          </div>
          
          <div className="flex flex-col gap-3 lg:gap-4 px-1 lg:px-2">
              {(() => {
                const ProductIcon = steps[0].icon;
                return (
                  <button
                    onClick={() => setActiveStep(0)}
                    className={`flex items-center gap-3 lg:gap-4 p-3 lg:p-4 rounded border transition-all ${
                      activeStep === 0 
                        ? 'bg-blue-600 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                        : 'bg-slate-100 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded flex items-center justify-center ${activeStep === 0 ? 'text-slate-900' : 'text-blue-400'}`}>
                      <ProductIcon size={20} className="lg:w-6 lg:h-6" />
                    </div>
                    <span className="text-xs lg:text-sm font-bold text-slate-900 uppercase tracking-widest">
                      {steps[0].label}
                    </span>
                  </button>
                );
              })()}

            {/* Other Steps */}
            <div className="grid grid-cols-4 gap-2">
              {steps.slice(1).map((step, idx) => {
                const actualIdx = idx + 1;
                return (
                  <button
                    key={actualIdx}
                    onClick={() => setActiveStep(actualIdx)}
                    className={`relative z-10 flex flex-col items-center gap-1.5 p-2 lg:p-2 rounded border transition-all ${
                      activeStep === actualIdx 
                        ? 'bg-blue-600 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                        : activeStep > actualIdx 
                          ? 'bg-slate-100 text-blue-400 border-slate-200' 
                          : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-9 h-9 lg:w-8 lg:h-8 rounded flex items-center justify-center">
                      {activeStep > actualIdx ? <Check size={16} className="lg:w-3.5 lg:h-3.5" /> : <step.icon size={16} className="lg:w-3.5 lg:h-3.5" />}
                    </div>
                    <span className={`text-[9px] lg:text-[8px] font-bold uppercase tracking-widest ${activeStep === actualIdx ? 'text-slate-900' : 'text-slate-600'}`}>
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step Content Container */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar space-y-4 lg:space-y-6 bg-white pb-24 lg:pb-6">
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-100/50 p-4 rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <Ruler className="text-blue-400" size={18} />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Exibir Medidas (Cotas)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={mostrarCotas}
                    onChange={(e) => setMostrarCotas(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              <div className="flex items-center justify-between bg-slate-100/50 p-4 rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <Settings className="text-blue-400" size={18} />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Exibir NÃ³s (Gussets)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={mostrarNodes}
                    onChange={(e) => setMostrarNodes(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              <div className="flex items-center justify-between bg-slate-100/50 p-4 rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <Layers className="text-blue-400" size={18} />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Vista Explodida</span>
                </div>
                <button 
                  onClick={() => {
                    const target = explodedFactor > 0 ? 0 : 1;
                    setExplodedFactor(target);
                  }}
                  className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${explodedFactor > 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                >
                  {explodedFactor > 0 ? 'Recolher' : 'Explodir'}
                </button>
              </div>
            </div>
          )}

          {activeStep === 0 && (
            <div className="bg-slate-100 p-4 lg:p-5 rounded border border-slate-200 shadow-xl min-h-[300px] lg:min-h-[400px] flex flex-col">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-4 block flex items-center">
                01. SELECIONE O PRODUTO
                <Tooltip text="Escolha o tipo de estrutura que deseja configurar." title="Tipo de Projeto" />
              </label>
              <div className="flex-1 min-h-0">
                <CatalogoIndustrial 
                  onSelect={(id, label) => {
                    handleTipoProdutoChange(id as any);
                    onUpdate({ name: `Projeto 3D - ${label}` });
                  }} 
                  activeId={tipoProduto} 
                />
              </div>

              {/* SELETOR DE TIER (QUALIDADE) */}
              <div className="mt-6 border-t border-slate-200 pt-6">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-4 block flex items-center">
                  01.1 CONFIGURAÃ‡ÃƒO DE QUALIDADE
                  <Tooltip text="Escolha o nÃ­vel de robustez e acabamento do projeto." title="NÃ­vel de Qualidade" />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'comercial', label: 'Comercial', desc: 'Custo-benefÃ­cio', icon: ShoppingCart, color: 'blue' },
                    { id: 'reforcado', label: 'ReforÃ§ado', desc: 'Maior durabilidade', icon: ShieldAlert, color: 'amber' },
                    { id: 'premium', label: 'Premium', desc: 'Qualidade absoluta', icon: Check, color: 'emerald' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTier(t.id as any)}
                      className={`p-3 rounded-xl border-2 transition-all text-left flex flex-col gap-1 ${
                        tier === t.id 
                          ? `border-${t.color}-500 bg-${t.color}-50 ring-2 ring-${t.color}-200` 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <t.icon size={14} className={tier === t.id ? `text-${t.color}-600` : 'text-slate-400'} />
                        <span className={`text-xs font-black uppercase tracking-tighter ${tier === t.id ? `text-${t.color}-900` : 'text-slate-600'}`}>
                          {t.label}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-medium leading-tight">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SEÃ‡ÃƒO: DIMENSÃ•ES PRINCIPAIS */}
          {activeStep === 1 && (() => {
            // CÃ¡lculo de Conforto em tempo real para os Sliders
            let currentTrackColor = '#1e293b';
            let alturaGradient = undefined;
            let profundidadeGradient = undefined;

            if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') {
              const getBlondelColor = (b: number) => {
                const ideal = 630;
                const dist = Math.abs(b - ideal);
                
                // Hue: 145 (Green) -> 45 (Yellow) -> 0 (Red)
                let hue = 0;
                let saturation = 85;
                let lightness = 45;

                if (dist <= 35) {
                  // Entre Ideal (630) e Limite Conforto (595/665)
                  // Interpola entre Verde (145) e Amarelo (45)
                  hue = 145 - (dist / 35) * (145 - 45);
                  // Mais brilhante e saturado no centro (630)
                  lightness = 42 + (1 - dist / 35) * 18; 
                  saturation = 80 + (1 - dist / 35) * 20;
                } else if (dist <= 80) {
                  // Entre Limite Conforto e CrÃ­tico
                  // Interpola entre Amarelo (45) e Vermelho (0)
                  hue = 45 - ((dist - 35) / 45) * 45;
                  saturation = 80 - ((dist - 35) / 45) * 20;
                  lightness = 42 - ((dist - 35) / 45) * 5;
                } else {
                  hue = 0;
                  saturation = 60;
                  lightness = 35;
                }
                
                return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
              };

              const generateGradient = (minVal: number, maxVal: number, type: 'altura' | 'profundidade') => {
                const stops = [];
                const steps = 60; // Mais passos para suavidade total
                for (let i = 0; i <= steps; i++) {
                  const val = minVal + (maxVal - minVal) * (i / steps);
                  let b = 0;
                  if (type === 'altura') {
                    const n = Math.round(val / 180);
                    const e = val / n;
                    const numPisadas = tipoChegada === 'Abaixo' ? n - 1 : n;
                    const p = profundidade / numPisadas;
                    b = (2 * e) + p;
                  } else {
                    const n = Math.round(altura / 180);
                    const e = altura / n;
                    const numPisadas = tipoChegada === 'Abaixo' ? n - 1 : n;
                    const p = val / numPisadas;
                    b = (2 * e) + p;
                  }
                  const color = getBlondelColor(b);
                  stops.push(`${color} ${(i / steps) * 100}%`);
                }
                return `linear-gradient(to right, ${stops.join(', ')})`;
              };

              const minAlt = 1000;
              const maxAlt = 4000;
              const minProf = tipoProduto === 'escada_reta' ? 1000 : 500;
              const maxProf = tipoProduto === 'escada_reta' ? 8000 : 12000;

              alturaGradient = generateGradient(minAlt, maxAlt, 'altura');
              profundidadeGradient = generateGradient(minProf, maxProf, 'profundidade');

              const numEspelhos = Math.round(altura / 180);
              const espelhoCalculado = altura / numEspelhos;
              const numPisadas = tipoChegada === 'Abaixo' ? numEspelhos - 1 : numEspelhos;
              const pisadaCalculada = profundidade / numPisadas;
              const blondel = (2 * espelhoCalculado) + pisadaCalculada;
              currentTrackColor = getBlondelColor(blondel);
            }

            return (
              <ConfigSection title="DimensÃµes Principais" icon={Ruler}>
                <DimensionInput 
                  label={(() => {
                    if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') return 'Largura da Escada';
                    if (tipoProduto === 'tesoura') return 'Largura (VÃ£o)';
                    if (tipoProduto === 'chapa_dobrada_l') return 'Aba 1';
                    if (tipoProduto === 'chapa_dobrada_u' || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'chapa_dobrada_cartola') return 'Base';
                    if (tipoProduto === 'chapa_dobrada_z') return 'Alma';
                    if (tipoProduto === 'bandeja_metalica') return 'Base L';
                    if (tipoProduto === 'chapa_cortada') return 'Largura';
                    return 'Largura Externa';
                  })()} 
                  value={largura} 
                  onChange={(novaLargura) => {
                    setLargura(novaLargura);
                    if (tipoProduto === 'tesoura') {
                      const minH = Math.max(200, Math.round(novaLargura * 0.10));
                      const maxH = Math.max(500, Math.round(novaLargura * 0.30));
                      if (altura < minH) setAltura(minH);
                      if (altura > maxH) setAltura(maxH);
                    }
                  }} 
                  min={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 600 : (tipoProduto === 'tesoura' ? 2000 : (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 10 : 500))} 
                  max={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 1500 : (tipoProduto === 'tesoura' || isGalpao ? 30000 : 10000)} 
                  step={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 10 : (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 1 : 50)}
                  info={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? "Largura Ãºtil dos degraus." : (tipoProduto === 'tesoura' ? "VÃ£o livre da tesoura." : "Medida em milÃ­metros.")}
                />

                {tipoProduto !== 'chapa_cortada' && (
                  <DimensionInput 
                    label={(() => {
                      if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') return 'Altura do PÃ© Direito';
                      if (tipoProduto === 'tesoura') return 'Altura da Tesoura';
                      if (isGalpao) return 'PÃ© Direito (Altura Coluna)';
                      if (tipoProduto === 'chapa_dobrada_l') return 'Aba 2';
                      if (tipoProduto === 'chapa_dobrada_u' || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'chapa_dobrada_z' || tipoProduto === 'bandeja_metalica') return 'Abas';
                      if (tipoProduto === 'chapa_dobrada_cartola') return 'Almas';
                      return 'Altura Externa';
                    })()} 
                    value={altura} 
                    onChange={(novaAltura) => {
                      setAltura(novaAltura);
                      if (tipoProduto === 'escada_l' && alturaPatamar >= novaAltura - 100) {
                        setAlturaPatamar(novaAltura - 100);
                      }
                    }} 
                    min={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 1000 : (tipoProduto === 'tesoura' ? Math.max(200, Math.round(largura * 0.10)) : (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 10 : 500))} 
                    max={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 4000 : (tipoProduto === 'tesoura' ? Math.max(500, Math.round(largura * 0.30)) : (isGalpao ? 12000 : 3000))} 
                    step={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 10 : (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 1 : 50)}
                    info={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? "Altura total do chÃ£o atÃ© o nÃ­vel superior." : (tipoProduto === 'tesoura' ? "Altura total da tesoura (da base atÃ© a cumeeira). Recomendado entre 10% e 30% do vÃ£o (ABNT)." : (isGalpao ? "Altura livre das colunas (pÃ© direito)." : "Medida em milÃ­metros."))}
                    trackColor={alturaGradient || currentTrackColor}
                    hint={tipoProduto === 'tesoura' ? (() => {
                      const percentual = (altura / largura) * 100;
                      let status = '';
                      let colorClass = '';
                      if (percentual >= 10 && percentual <= 15) {
                        status = 'Ideal (Ã“timo custo-benefÃ­cio e estÃ©tica)';
                        colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200';
                      } else if (percentual < 10) {
                        status = 'Muito Baixa (Risco de infiltraÃ§Ã£o/deformaÃ§Ã£o)';
                        colorClass = 'text-amber-600 bg-amber-50 border-amber-200';
                      } else if (percentual > 15 && percentual <= 25) {
                        status = 'Moderada (PadrÃ£o estrutural)';
                        colorClass = 'text-blue-600 bg-blue-50 border-blue-200';
                      } else {
                        status = 'Alta (Muito pontuda/Alto consumo)';
                        colorClass = 'text-rose-600 bg-rose-50 border-rose-200';
                      }
                      return (
                        <div className={`text-[10px] font-medium px-2 py-1 rounded border ${colorClass} flex justify-between items-center`}>
                          <span>ProporÃ§Ã£o: {percentual.toFixed(1)}% do vÃ£o</span>
                          <span>{status}</span>
                        </div>
                      );
                    })() : undefined}
                  />
                )}

                {(tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'chapa_dobrada_cartola') && (
                  <DimensionInput 
                    label={tipoProduto === 'perfil_u_enrijecido' ? 'Dentes' : 'Abas Externas'} 
                    value={abaExtra} 
                    onChange={setAbaExtra} 
                    min={10} 
                    max={100} 
                    step={1}
                    info="Medida em milÃ­metros."
                  />
                )}

                {(tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' || tipoProduto === 'cobertura_pergolado' || isGalpao || tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                  <DimensionInput 
                    label={(() => {
                      if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') return 'Comprimento da Escada';
                      if (tipoProduto === 'bandeja_metalica') return 'Base C';
                      if (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido') return 'Comprimento';
                      return 'Profundidade';
                    })()} 
                    value={profundidade} 
                    onChange={setProfundidade} 
                    min={tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 10 : (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 1000 : 500)} 
                    max={isGalpao ? 30000 : (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? 8000 : 12000)} 
                    step={tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 1 : 50}
                    info={isGalpao ? "Comprimento total do galpÃ£o." : (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? "Comprimento horizontal total da escada." : "Medida em milÃ­metros.")}
                    trackColor={profundidadeGradient || currentTrackColor}
                  />
                )}

                {/* 2D Step Preview */}
                {tipoProduto === 'escada_reta' && (() => {
                  const numEspelhos = Math.round(altura / 180);
                  const espelhoCalculado = altura / numEspelhos;
                  const numPisadas = tipoChegada === 'Abaixo' ? numEspelhos - 1 : numEspelhos;
                  const pisadaCalculada = profundidade / numPisadas;
                  const numDegraus = numPisadas;

                  return (
                    <div className="bg-slate-50 p-4 rounded border border-slate-100 flex flex-col items-center gap-4 mt-4">
                      <h4 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest w-full">Detalhe do Degrau (2D)</h4>
                      <div className="relative w-48 h-32 flex items-center justify-center">
                        <svg width="160" height="100" viewBox="0 0 160 100" className="drop-shadow-2xl">
                          <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                              <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
                            </marker>
                          </defs>
                          {/* Step Drawing */}
                          <path 
                            d="M 20 80 L 20 30 L 140 30" 
                            fill="none" 
                            stroke={currentTrackColor !== '#1e293b' ? currentTrackColor : '#3b82f6'} 
                            strokeWidth="3" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                          />
                          {/* Riser Label */}
                          <text x="10" y="55" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="end">
                            {espelhoCalculado.toFixed(1)} mm
                          </text>
                          {/* Tread Label */}
                          <text x="80" y="20" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
                            {pisadaCalculada.toFixed(1)} mm
                          </text>
                          {/* Arrows */}
                          <line x1="15" y1="80" x2="15" y2="30" stroke="#475569" strokeWidth="1" markerEnd="url(#arrowhead)" />
                          <line x1="20" y1="25" x2="140" y2="25" stroke="#475569" strokeWidth="1" markerEnd="url(#arrowhead)" />
                        </svg>
                      </div>
                      <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="bg-white p-2 rounded border border-slate-100 text-center">
                          <div className="text-[8px] text-slate-600 uppercase font-bold">Espelhos</div>
                          <div className="text-xs font-bold text-slate-900">{numEspelhos}x</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-100 text-center">
                          <div className="text-[8px] text-slate-600 uppercase font-bold">Degraus</div>
                          <div className="text-xs font-bold text-slate-900">{numDegraus}x</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ESCADAS: TERMÃ”METRO DE CONFORTO */}
                {(tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') && (
                  <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      NÃ­vel de Confortabilidade
                      <Tooltip text="Calculado pela fÃ³rmula de Blondel: 2x Espelho + Pisada. O ideal Ã© entre 63cm e 64cm." />
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            confortabilidade >= 90 ? 'bg-emerald-500' : 
                            confortabilidade >= 75 ? 'bg-green-500' : 
                            confortabilidade >= 50 ? 'bg-yellow-500' : 
                            confortabilidade >= 25 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${confortabilidade}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${
                        confortabilidade >= 90 ? 'text-emerald-600' : 
                        confortabilidade >= 75 ? 'text-green-600' : 
                        confortabilidade >= 50 ? 'text-yellow-600' : 
                        confortabilidade >= 25 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {confortabilidade}%
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${
                      confortabilidade >= 90 ? 'text-emerald-600' : 
                      confortabilidade >= 75 ? 'text-green-600' : 
                      confortabilidade >= 50 ? 'text-yellow-600' : 
                      confortabilidade >= 25 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {nivelConforto}
                    </span>
                  </div>
                )}

              </ConfigSection>
            );
          })()}


          {/* SEÃ‡ÃƒO: CONFIGURAÃ‡Ã•ES ESPECÃFICAS */}
          {activeStep === 2 && (
            <ConfigSection title="ConfiguraÃ§Ãµes TÃ©cnicas" icon={Settings}>
              {/* CHAPAS E DOBRAS */}
              {(tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Espessura da Chapa (Bitola)
                    </label>
                    <select
                      value={espessuraChapa}
                      onChange={(e) => setEspessuraChapa(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded p-3 font-mono focus:border-blue-500 outline-none transition-all"
                    >
                      {bitolasChapa.map((bitola) => (
                        <option key={bitola.id} value={bitola.value}>{bitola.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      ReferÃªncia da Medida
                      <Tooltip text="Externa: O desenvolvimento desconta a espessura nas dobras. Interna: O desenvolvimento Ã© a soma exata das abas." />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReferenciaMedida('externa')}
                        className={`flex-1 py-2 px-3 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          referenciaMedida === 'externa'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Externa
                      </button>
                      <button
                        onClick={() => setReferenciaMedida('interna')}
                        className={`flex-1 py-2 px-3 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          referenciaMedida === 'interna'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Interna
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* QUADRO BÃSICO */}
              {tipoProduto === 'quadro_simples' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex justify-between items-center">
                      <span className="flex items-center">
                        Quantidade de Grades
                        <Tooltip text="NÃºmero de barras verticais internas para preenchimento do quadro." />
                      </span>
                      <span className="text-blue-400 font-mono font-bold">{quantidadeGrades}</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="20" 
                      step="1" 
                      value={quantidadeGrades} 
                      onChange={(e) => setQuantidadeGrades(Number(e.target.value))}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Tipo de Montagem
                      <Tooltip text="Reto: barras cortadas em 90Â°. 45Â°: barras cortadas em meia-esquadria para acabamento superior." />
                    </label>
                    <div className="flex bg-slate-50 p-1 rounded border border-slate-100">
                      <button
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoMontagem === 'reto' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-600'}`}
                        onClick={() => setTipoMontagem('reto')}
                      >
                        Corte Reto (90Â°)
                      </button>
                      <button
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoMontagem === 'meia-esquadria' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-600'}`}
                        onClick={() => setTipoMontagem('meia-esquadria')}
                      >
                        Meia-Esquadria (45Â°)
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* PORTÃ•ES */}
              {(tipoProduto === 'portao_basculante' || tipoProduto === 'portao_deslizante') && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex justify-between items-center">
                      <span className="flex items-center">
                        SimulaÃ§Ã£o de Abertura
                        <Tooltip text="Ajuste para visualizar como o portÃ£o se comporta ao abrir." />
                      </span>
                      <span className="text-blue-400 font-mono">{anguloAberturaGraus}Â°</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="90" 
                      step="1" 
                      value={anguloAberturaGraus} 
                      onChange={(e) => setAnguloAberturaGraus(Number(e.target.value))}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex justify-between items-center">
                      <span className="flex items-center">
                        Quantidade de Palitos
                        <Tooltip text="NÃºmero de barras de preenchimento da folha do portÃ£o." />
                      </span>
                      <span className="text-blue-400 font-mono">{quantidadeGrades}</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="30" 
                      step="1" 
                      value={quantidadeGrades} 
                      onChange={(e) => setQuantidadeGrades(Number(e.target.value))}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </>
              )}

              {/* COBERTURA / PERGOLADO / GALPÃƒO / TESOURA */}
              {(tipoProduto === 'cobertura_pergolado' || isGalpao || tipoProduto === 'tesoura') && (
                <>
                  {(tipoProduto === 'cobertura_pergolado' || isGalpao) && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex justify-between items-center">
                        <span className="flex items-center">
                          InclinaÃ§Ã£o (%)
                          <Tooltip text="InclinaÃ§Ã£o para escoamento de Ã¡gua. Recomendado 10% para telhas e 5% para vidro/policarbonato." />
                        </span>
                        <span className="text-blue-400 font-mono">{inclinacaoPercentual}%</span>
                      </label>
                      <input 
                        type="range" 
                        min="0" 
                        max={tipoProduto === 'galpao_tesoura_personalizada' ? 200 : 30} 
                        step="1" 
                        value={inclinacaoPercentual} 
                        onChange={(e) => setInclinacaoPercentual(Number(e.target.value))}
                        className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      {isGalpao && (
                        <div className="mt-2 space-y-2">
                          <div className="text-[10px] font-medium px-2 py-1 rounded border text-blue-400 bg-blue-500/10 border-blue-500/30 flex justify-between items-center">
                            <span>Altura da Tesoura:</span>
                            <span className="font-bold font-mono">{Math.round((largura / 2) * (inclinacaoPercentual / 100))} mm</span>
                          </div>
                          
                          {tipoProduto === 'galpao_tesoura_personalizada' && (
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-600 uppercase">Definir Altura Exata da Tesoura (mm)</label>
                              <input 
                                type="number" 
                                value={isNaN(Math.round((largura / 2) * (inclinacaoPercentual / 100))) ? "" : Math.round((largura / 2) * (inclinacaoPercentual / 100))} 
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val > 0) {
                                    const newInc = (val / (largura / 2)) * 100;
                                    setInclinacaoPercentual(newInc);
                                  }
                                }}
                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Ex: 2400"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {tipoProduto === 'cobertura_pergolado' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center">
                        Tipo de Telhado
                        <Tooltip text="Uma Ãgua: inclinaÃ§Ã£o Ãºnica. Invertido: inclinaÃ§Ã£o para o centro (borboleta)." />
                      </label>
                      <div className="flex bg-slate-50 p-1 rounded border border-slate-100">
                        <button
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoTelhado === 'uma_agua' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-600'}`}
                          onClick={() => setTipoTelhado('uma_agua')}
                        >
                          Uma Ãgua
                        </button>
                        <button
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoTelhado === 'invertido' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-600'}`}
                          onClick={() => setTipoTelhado('invertido')}
                        >
                          Invertido
                        </button>
                      </div>
                    </div>
                  )}

                  {(isGalpao || tipoProduto === 'tesoura') && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center">
                        Modelo de Tesoura
                        <Tooltip 
                          title={tesourasDB.find(t => t.id === tipoTesouraId)?.nome || "Modelo de Tesoura"}
                          text={tesourasDB.find(t => t.id === tipoTesouraId)?.descricao || "Escolha um modelo de tesoura estrutural."} 
                        />
                      </label>
                      <select
                        value={tipoTesouraId}
                        onChange={(e) => setTipoTesouraId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-sm font-mono text-slate-900 focus:border-blue-500 outline-none transition-all"
                      >
                        {tesourasDB.map((tesoura) => (
                          <option key={tesoura.id} value={tesoura.id}>{tesoura.nome}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-600 italic mt-1 uppercase tracking-wider">
                        {tesourasDB.find(t => t.id === tipoTesouraId)?.descricao}
                      </p>
                      {tipoProduto === 'galpao_tesoura_personalizada' && (
                        <button
                          onClick={() => handleTipoProdutoChange('tesoura')}
                          className="mt-2 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-200"
                        >
                          <Hammer size={12} />
                          Ajustar Detalhes da Tesoura
                        </button>
                      )}
                    </div>
                  )}

                  {isGalpao && (
                    <DimensionInput 
                      label="Altura da Cumeeira" 
                      value={isNaN(Math.round(altura + (largura / 2) * (inclinacaoPercentual / 100))) ? 0 : Math.round(altura + (largura / 2) * (inclinacaoPercentual / 100))} 
                      onChange={(novaAlturaCumeeira) => {
                        const rise = novaAlturaCumeeira - altura;
                        const novaInclinacao = (rise / (largura / 2)) * 100;
                        setInclinacaoPercentual(Math.max(0, Math.min(45, Math.round(novaInclinacao))));
                      }} 
                      min={altura + 100} 
                      max={altura + 5000} 
                      step={10}
                      info="Altura total no ponto mais alto do telhado."
                    />
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Quantidade de TerÃ§as {isGalpao ? '(por Ã¡gua)' : ''}
                      <Tooltip text="Barras horizontais que sustentam a cobertura. Mais terÃ§as aumentam a resistÃªncia mas tambÃ©m o custo." />
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="2" 
                        max="20" 
                        step="1" 
                        value={qtdTercas} 
                        onChange={(e) => setQtdTercas(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <span className="text-indigo-600 font-mono text-sm font-bold w-8">{qtdTercas}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                        Colunas Extras
                        <Tooltip text="Colunas adicionais para vÃ£os muito grandes. O sistema sugere automaticamente a cada 3.5m." />
                      </label>
                      <button 
                        onClick={() => setAutoColunas(!autoColunas)}
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors ${autoColunas ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {autoColunas ? 'AUTO' : 'MANUAL'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="1"
                        value={qtdColunasExtras}
                        onChange={(e) => {
                          setQtdColunasExtras(Number(e.target.value));
                          setAutoColunas(false);
                        }}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <span className="text-indigo-600 font-mono text-sm font-bold w-8">{qtdColunasExtras}</span>
                    </div>
                  </div>
                </>
              )}

              {/* ESCADAS */}
              {(tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') && (
                <>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white transition-colors">
                      <input 
                        type="checkbox" 
                        checked={temGuardaCorpo}
                        onChange={(e) => setTemGuardaCorpo(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-bold text-slate-700">Adicionar Guarda-Corpo</span>
                      <Tooltip text="Inclui corrimÃ£o e montantes de seguranÃ§a na escada." />
                    </label>
                  </div>

                  {temGuardaCorpo && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                        Lados do Guarda-Corpo
                        <Tooltip text="Escolha em quais lados da escada o guarda-corpo serÃ¡ instalado." />
                      </label>
                      <select
                        value={ladoGuardaCorpo}
                        onChange={(e) => setLadoGuardaCorpo(e.target.value as 'esquerdo' | 'direito' | 'ambos')}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="ambos">Ambos os Lados</option>
                        <option value="esquerdo">Apenas Esquerda</option>
                        <option value="direito">Apenas Direita</option>
                      </select>
                    </div>
                  )}

                  {tipoProduto === 'escada_l' && (
                    <>
                      <DimensionInput 
                        label="Altura do Patamar" 
                        value={alturaPatamar} 
                        onChange={(val) => setAlturaPatamar(Math.min(val, altura - 100))} 
                        min={500} 
                        max={3000} 
                        step={10}
                        info="Altura onde a escada faz a curva."
                      />
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                          DireÃ§Ã£o da Curva
                          <Tooltip text="Sentido da curva no patamar (visto de baixo para cima)." />
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${direcaoCurva === 'esquerda' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}
                            onClick={() => setDirecaoCurva('esquerda')}
                          >
                            Esquerda
                          </button>
                          <button
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${direcaoCurva === 'direita' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}
                            onClick={() => setDirecaoCurva('direita')}
                          >
                            Direita
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* PERFIL PRINCIPAL / BANZOS */}
              {!tipoProduto.startsWith('chapa_') && tipoProduto !== 'perfil_u_enrijecido' && tipoProduto !== 'bandeja_metalica' && (
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                    {isCobertura ? 'Perfil dos Pilares' : (tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada') ? 'Perfil dos Banzos (Superior/Inferior)' : 'Perfil Principal'}
                    <Tooltip text="Selecione o perfil metÃ¡lico principal da estrutura." />
                  </label>
                  <select
                    value={isCobertura ? perfilColunaId : perfilSelecionadoId}
                    onChange={(e) => isCobertura ? setPerfilColunaId(e.target.value) : setPerfilSelecionadoId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {(tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada' || tipoProduto === 'galpao') ? (
                      perfisViga.map(p => (
                        <option key={p.id} value={p.id} className="text-slate-950">{p.nome}</option>
                      ))
                    ) : (
                      perfisQuadro.map(p => (
                        <option key={p.id} value={p.id} className="text-slate-950">{p.nome}</option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* CONFIGURAÃ‡Ã•ES DE PORTÃƒO DESLIZANTE */}
              {tipoProduto === 'portao_deslizante' && (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Perfil do Trilho
                      <Tooltip text="Selecione o perfil metÃ¡lico para o trilho inferior." />
                    </label>
                    <select
                      value={perfilTrilhoId}
                      onChange={(e) => setPerfilTrilhoId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisDB.filter(p => p.nome.toLowerCase().includes('redondo maciÃ§o') || p.nome.toLowerCase().includes('trilho')).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Perfil da Guia Superior
                      <Tooltip text="Selecione o perfil metÃ¡lico para a guia superior." />
                    </label>
                    <select
                      value={perfilGuiaId}
                      onChange={(e) => setPerfilGuiaId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisDB.filter(p => p.nome.toLowerCase().includes('guia') || p.nome.toLowerCase().includes('perfil u')).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Perfil do Batente
                      <Tooltip text="Selecione o perfil metÃ¡lico para o batente." />
                    </label>
                    <select
                      value={perfilBatenteId}
                      onChange={(e) => setPerfilBatenteId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisDB.filter(p => p.nome.toLowerCase().includes('batente') || p.nome.toLowerCase().includes('perfil u')).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Perfil das Colunas
                      <Tooltip text="Selecione o perfil metÃ¡lico para as colunas de sustentaÃ§Ã£o." />
                    </label>
                    <select
                      value={perfilColunaPortaoId}
                      onChange={(e) => setPerfilColunaPortaoId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisDB.filter(p => p.componentesCompativeis?.includes('coluna')).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <input
                      type="checkbox"
                      id="incluirPortaoPedestre"
                      checked={incluirPortaoPedestre}
                      onChange={(e) => setIncluirPortaoPedestre(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="incluirPortaoPedestre" className="text-sm font-bold text-slate-700">
                      Incluir PortÃ£o de Pedestre
                    </label>
                  </div>
                </>
              )}

              {/* CONFIGURAÃ‡Ã•ES DE TESOURA (MONTANTES E DIAGONAIS) */}
              {(tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada') && (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Perfil Interno (Montantes)
                      <Tooltip text="Selecione o perfil metÃ¡lico para os montantes verticais (interno) da tesoura." />
                    </label>
                    <select
                      value={perfilVigaId}
                      onChange={(e) => setPerfilVigaId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisViga.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Perfil Interno (Diagonais)
                      <Tooltip text="Selecione o perfil metÃ¡lico para as diagonais (interno) da tesoura." />
                    </label>
                    <select
                      value={perfilDiagonalId}
                      onChange={(e) => setPerfilDiagonalId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisDiagonal.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="h-px bg-slate-200 my-6" />

              {/* TIPO DE ENTREGA / ACABAMENTO FINAL */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                  Tipo de Entrega / Acabamento Final
                  <Tooltip text="Escolha se deseja apenas as peÃ§as cortadas, a estrutura montada sem pintura ou o produto final completo." />
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'pecas', label: 'Somente PeÃ§as (Kit para Montar)', icon: Package, desc: 'PeÃ§as cortadas e identificadas' },
                    { id: 'montado_sem_pintura', label: 'Montado sem Pintura', icon: Hammer, desc: 'Estrutura soldada em aÃ§o bruto' },
                    { id: 'montado_com_pintura', label: 'Montado e com Pintura', icon: Paintbrush, desc: 'Produto final com acabamento premium' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTipoEntrega(item.id as any)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        tipoEntrega === item.id 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md' 
                          : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${tipoEntrega === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <item.icon size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[10px] opacity-60 font-medium">{item.desc}</div>
                      </div>
                      {tipoEntrega === item.id && <Check size={16} className="ml-auto text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </div>
            </ConfigSection>
          )}

          {activeStep === 3 && (
            <ConfigSection title="Materiais e Acabamento" icon={Paintbrush}>
              <div className="space-y-6">
                {(tipoProduto === 'cobertura_pergolado' || isGalpao) && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                        Material da Cobertura
                        <Tooltip text="Escolha o material que irÃ¡ cobrir a estrutura. Isso afeta o custo e o peso total." />
                      </label>
                      <select
                        value={materialCobertura}
                        onChange={(e) => setMaterialCobertura(e.target.value as any)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="vidro">Vidro Temperado 8mm</option>
                        <option value="policarbonato">Policarbonato Alveolar</option>
                        <option value="telha">Telhas MetÃ¡licas</option>
                        <option value="vazio">Sem Cobertura (Vazio)</option>
                      </select>
                    </div>

                    {materialCobertura === 'telha' && (
                      <div className="flex flex-col gap-2 mt-4">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                          Modelo da Telha
                          <Tooltip text="Diferentes modelos de telhas possuem larguras Ãºteis e preÃ§os variados." />
                        </label>
                        <select
                          value={telhaSelecionadaId}
                          onChange={(e) => setTelhaSelecionadaId(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          {telhasDB.map((telha) => (
                            <option key={telha.id} value={telha.id}>{telha.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {tipoProduto === 'rampa_acessibilidade' && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                        Material do Piso da Rampa
                        <Tooltip text="Escolha o material antiderrapante para a superfÃ­cie da rampa." />
                      </label>
                      <select
                        value={materialCoberturaRampa}
                        onChange={(e) => setMaterialCoberturaRampa(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="chapa_antiderrapante_aco_3">Chapa Xadrez AÃ§o 3mm</option>
                        <option value="chapa_antiderrapante_aco_4.75">Chapa Xadrez AÃ§o 4.75mm</option>
                        <option value="chapa_aluminio_xadrez_2">Chapa Xadrez AlumÃ­nio 2mm</option>
                        <option value="grade_piso_aco">Grade de Piso Serrilhada</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                        Perfil do Quadro da Rampa
                        <Tooltip text="Selecione o perfil metÃ¡lico (metalon) para a estrutura do quadro e reforÃ§os." />
                      </label>
                      <select
                        value={perfilQuadroRampaId}
                        onChange={(e) => setPerfilQuadroRampaId(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {perfisDB.filter(p => p.nome.toLowerCase().includes('metalon')).map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {(tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Material dos Degraus
                      <Tooltip text="Escolha o material para o piso dos degraus." />
                    </label>
                    <select
                      value={materialDegrau}
                      onChange={(e) => setMaterialDegrau(e.target.value as MaterialDegrauKey)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {Object.entries(materiaisDegrau).map(([key, mat]) => (
                        <option key={key} value={key}>{mat.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <Paintbrush className="text-indigo-600" size={18} />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Incluir Pintura</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={temPintura}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setTemPintura(val);
                          if (val) {
                            setAcabamento('preto_fosco');
                          } else {
                            setAcabamento('aco_carbono');
                          }
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                {!temPintura && (tipoProduto?.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Material Base
                      <Tooltip text="Escolha o material da chapa metÃ¡lica." />
                    </label>
                    <select
                      value={acabamento}
                      onChange={(e) => setAcabamento(e.target.value as AcabamentoMetalKey)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {Object.entries(acabamentosMetal)
                        .filter(([key]) => !key.startsWith('preto') && !key.startsWith('branco'))
                        .map(([key, mat]) => (
                          <option key={key} value={key}>{mat.nome}</option>
                        ))}
                    </select>
                  </div>
                )}

                {temPintura && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      Cor da Pintura / Acabamento
                      <Tooltip text="Escolha a cor e o tipo de acabamento da estrutura metÃ¡lica." />
                    </label>
                    <select
                      value={acabamento}
                      onChange={(e) => setAcabamento(e.target.value as AcabamentoMetalKey)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {Object.entries(acabamentosMetal)
                        .filter(([key]) => key.startsWith('preto') || key.startsWith('branco'))
                        .map(([key, mat]) => (
                          <option key={key} value={key}>{mat.nome}</option>
                        ))}
                    </select>
                  </div>
                )}

                {!(tipoProduto?.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center">
                      MÃ©todo de FixaÃ§Ã£o
                      <Tooltip text="Sapata: base metÃ¡lica parafusada no piso. Chumbado: pilar enterrado ou fixado com concreto." />
                    </label>
                    <select
                      value={fixacao}
                      onChange={(e) => setFixacao(e.target.value as any)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="sapata_parafuso">Sapata e Parafuso (Base Plate)</option>
                      <option value="chumbado">Chumbado com Ferro (Solo/Parede)</option>
                    </select>
                  </div>
                )}

                {currentBOM.length > 0 && (
                  <div className="space-y-6 pt-6 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-600/10 rounded-lg">
                          <Layers className="text-indigo-600" size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">PersonalizaÃ§Ã£o por PeÃ§a</h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Substitua materiais e medidas individualmente</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                        {currentBOM.length} PEÃ‡AS
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {currentBOM.map((item) => (
                        <div key={item.code} className="group relative flex flex-col gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-lg shadow-inner border border-white/20" style={{ backgroundColor: item.color }} />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{item.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded leading-none">[{item.code}]</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Qtd: {item.quantity}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-2 border-t border-slate-50">
                            {renderSubstitutoSelector(item.code) ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Substituir Medida/Material:</span>
                                </div>
                                {renderSubstitutoSelector(item.code)}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Material Atual:</span>
                                <span className="text-[9px] font-bold text-slate-600 truncate max-w-[150px]">{item.material}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ConfigSection>
          )}

          {/* ALERTAS */}
          <div className="space-y-2">
            {tipoProduto === 'cobertura_pergolado' && (
              <>
                {(largura > 4500 || profundidade > 4500) && qtdColunasExtras === 0 && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 shadow-sm">
                    <ShieldAlert className="text-red-500 shrink-0" size={20} />
                    <div>
                      <p className="text-xs font-bold text-red-800 uppercase tracking-tight">Risco Estrutural</p>
                      <p className="text-[10px] text-red-700 leading-relaxed font-medium">O vÃ£o livre excede 4.5m sem reforÃ§o. Adicione colunas extras.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* BotÃµes de NavegaÃ§Ã£o */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
            <button
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeStep === 0 
                  ? 'text-slate-700 cursor-not-allowed' 
                  : 'text-slate-600 hover:bg-slate-100 active:scale-95'
              }`}
            >
              <ChevronDown className="rotate-90" size={16} />
              Voltar
            </button>
            
            <button
              onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
              disabled={activeStep === steps.length - 1}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeStep === steps.length - 1
                  ? 'bg-slate-100 text-white cursor-not-allowed'
                  : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95'
              }`}
            >
              PrÃ³ximo
              <ChevronDown className="-rotate-90" size={16} />
            </button>
          </div>
        </div>

        {/* RELATÃ“RIO DE PRODUÃ‡ÃƒO */}
        <div className="bg-white rounded-xl p-3 shadow-lg border border-slate-100 mt-2">
          <button 
            onClick={() => setIsReportExpanded(!isReportExpanded)}
            className="flex items-center justify-between w-full gap-2 mb-2"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-indigo-500/20 rounded-lg">
                <FileText className="text-indigo-400" size={14} />
              </div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">RelatÃ³rio de ProduÃ§Ã£o</h3>
            </div>
            <div className="text-slate-600">
              {isReportExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {isReportExpanded && (
            <>
              <div className="mb-2 p-2 bg-slate-100/50 rounded-lg border border-slate-200/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-600">Peso Estimado:</span>
                  <span className="text-xs font-bold text-indigo-400">{pesoFinal.toFixed(2)} Kg</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-600">Custo Material:</span>
                  <span className="text-xs font-bold text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoFinal)}
                  </span>
                </div>
                <div className="pt-1 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">Valor Sugerido:</span>
                    <span className="text-sm font-black text-emerald-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoTotal)}
                    </span>
                  </div>
                </div>
              </div>
              
              <ul className="space-y-1 text-[10px] text-slate-700">
                <li className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Produto:</span>
                  <span className="font-bold text-slate-900">{tipoProduto.replace('_', ' ').toUpperCase()}</span>
                </li>
                <li className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Acabamento:</span>
                  <span className="font-bold text-indigo-400">
                    {tipoEntrega === 'pecas' ? 'SOMENTE PEÃ‡AS' : 
                     tipoEntrega === 'montado_sem_pintura' ? 'MONTADO (BRUTO)' : 
                     'MONTADO E PINTADO'}
                  </span>
                </li>
            
            {tipoProduto === 'quadro_simples' && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Barras Horizontais:</span>
                  <span className="font-mono font-bold text-slate-900">2x {largura} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Barras Verticais:</span>
                  <span className="font-mono font-bold text-slate-900">2x {alturaGrade} mm</span>
                </li>
                {quantidadeGrades > 0 && (
                  <li className="flex justify-between items-center">
                    <span className="text-slate-600">Grades Internas:</span>
                    <span className="font-mono font-bold text-slate-900">{quantidadeGrades}x {alturaGrade} mm</span>
                  </li>
                )}
              </>
            )}

            {(tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Qtd. de Degraus:</span>
                  <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{numDegraus} un.</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Largura do Degrau:</span>
                  <span className="font-mono font-bold text-slate-900">{largura} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Largura da Almofada (Pisada):</span>
                  <span className="font-mono font-bold text-slate-900">{pisada} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Altura do Espelho:</span>
                  <span className="font-mono font-bold text-slate-900">{espelho.toFixed(1)} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Vigas Laterais:</span>
                  <span className="font-mono font-bold text-slate-900">2x {hipotenusa.toFixed(1)} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Ã‚ngulo de Corte:</span>
                  <span className="font-mono font-bold text-slate-900">{(angulo * 180 / Math.PI).toFixed(1)}Â°</span>
                </li>
                <li className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-600 font-bold">Confortabilidade:</span>
                  <span className={`font-bold ${corConforto}`}>{confortabilidade}% - {nivelConforto}</span>
                </li>
                {temGuardaCorpo && (
                  <>
                    <li className="flex justify-between items-center pt-2 border-t border-slate-100 text-blue-300">
                      <span className="font-bold uppercase text-[9px]">Guarda-Corpo:</span>
                      <span className="font-mono font-bold">{(materialGuardaCorpoMM / 1000).toFixed(2)} m</span>
                    </li>
                    <li className="flex justify-between items-center text-blue-300">
                      <span className="font-bold uppercase text-[9px]">Altura do CorrimÃ£o:</span>
                      <span className="font-mono font-bold">900 mm</span>
                    </li>
                  </>
                )}
              </>
            )}
            
            {tipoProduto === 'cobertura_pergolado' && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">TerÃ§as:</span>
                  <span className="font-mono font-bold text-slate-900">{qtdTercas}x {largura} mm</span>
                </li>
                {qtdColunasExtras > 0 && (
                  <li className="flex justify-between items-center text-blue-400">
                    <span className="font-bold">Colunas Extras:</span>
                    <span className="font-mono font-bold">{qtdColunasExtras} un.</span>
                  </li>
                )}
                {materialCobertura === 'telha' ? (
                  <>
                    <li className="flex justify-between items-center text-blue-400">
                      <span className="font-bold">Qtd. de Telhas:</span>
                      <span className="font-mono font-bold">{Math.ceil(largura / (telhasDB.find(t => t.id === telhaSelecionadaId)?.larguraUtil || 980))} un.</span>
                    </li>
                    <li className="flex justify-between items-center text-blue-400">
                      <span className="font-bold">Comprimento Telha:</span>
                      <span className="font-mono font-bold">{(Math.sqrt(Math.pow(profundidade, 2) + Math.pow(profundidade * (inclinacaoPercentual / 100), 2)) + 100).toFixed(0)} mm</span>
                    </li>
                  </>
                ) : (
                  <li className="flex justify-between items-center">
                    <span className="text-slate-600">Ãrea Cobertura:</span>
                    <span className="font-mono font-bold text-slate-900">{areaCobertura.toFixed(2)} mÂ²</span>
                  </li>
                )}
              </>
            )}

            {tipoProduto === 'tesoura' && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Modelo:</span>
                  <span className="font-mono font-bold text-slate-900 uppercase">{tipoTesouraId}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Largura (VÃ£o):</span>
                  <span className="font-mono font-bold text-slate-900">{largura} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Altura:</span>
                  <span className="font-mono font-bold text-slate-900">{altura} mm</span>
                </li>
                <li className="flex justify-between items-center text-blue-300 italic text-[9px]">
                  <span>* Inclui chapas de reforÃ§o (gussets) em todos os nÃ³s.</span>
                </li>
              </>
            )}

            {['rampa_acessibilidade', 'carrinho_plataforma', 'gaiola_roll_container', 'carrinho_cilindros', 'reboque_industrial', 'abrigo_onibus', 'escada_reta', 'escada_l', 'cobertura_pergolado', 'galpao', 'galpao_tesoura_personalizada', 'tesoura'].includes(tipoProduto || '') && currentBOM.length > 0 && (
              <>
                {currentBOM.map((item, index) => (
                  <li key={index} className="flex justify-between items-center">
                    <span className="text-slate-600 truncate max-w-[150px]" title={item.name}>{item.name}:</span>
                    <span className="font-mono font-bold text-slate-900">{parseFloat(item.quantity).toFixed(2)} {item.unit}</span>
                  </li>
                ))}
                <li className="flex justify-between items-center pt-2 border-t border-slate-100 text-emerald-400">
                  <span className="font-bold uppercase text-[9px]">Custo Estimado Materiais:</span>
                  <span className="font-mono font-bold">R$ {custoFinal.toFixed(2)}</span>
                </li>
              </>
            )}

            {isGalpao && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">Tesouras (Perfil Duplo U):</span>
                  <span className="font-mono font-bold text-slate-900">{Math.ceil(profundidade / 4000) + 1} un.</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-600">TerÃ§as (Total):</span>
                  <span className="font-mono font-bold text-slate-900">{qtdTercasCalculada * 2}x {profundidade} mm</span>
                </li>
                <li className="flex justify-between items-center text-blue-300 italic text-[9px]">
                  <span>* Estrutura da tesoura com encaixe interno.</span>
                </li>
                {materialCobertura === 'telha' && (
                  <>
                    <li className="flex justify-between items-center text-blue-400">
                      <span className="font-bold">Qtd. de Telhas:</span>
                      <span className="font-mono font-bold">{Math.ceil(profundidade / (telhasDB.find(t => t.id === telhaSelecionadaId)?.larguraUtil || 980)) * 2} un.</span>
                    </li>
                    <li className="flex justify-between items-center text-blue-400">
                      <span className="font-bold">Comprimento Telha:</span>
                      <span className="font-mono font-bold">{(Math.sqrt(Math.pow(largura / 2, 2) + Math.pow((largura / 2) * (inclinacaoPercentual / 100), 2)) + 100).toFixed(0)} mm</span>
                    </li>
                  </>
                )}
              </>
            )}
            
            {tipoProduto !== 'escada_reta' && tipoProduto !== 'escada_l' && !isCobertura && !isGalpao && tipoProduto !== 'tesoura' && (
              <li className="flex justify-between items-center py-2 border-y border-slate-100">
                <span className="text-slate-600">VÃ£o Livre (Tubos):</span>
                <span className="font-mono font-bold text-blue-400">{vaoLivreCalculadoEmMM.toFixed(1)} mm</span>
              </li>
            )}

            <li className="flex justify-between items-center pt-3 mt-1 border-t border-slate-200">
              <span className="text-slate-900 font-bold uppercase text-[10px]">Material Total:</span>
              <span className="text-xl font-mono font-black text-blue-400">{materialTotalMetros.toFixed(2)}m</span>
            </li>
          </ul>

          <div className="grid grid-cols-1 gap-3 mt-6">
            <button
              onClick={handleGerarPDF}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black uppercase tracking-widest rounded border border-slate-200 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <FileText size={18} />
              Gerar Proposta Premium PDF
            </button>
            <button
              onClick={() => setIsPropostaModalOpen(true)}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 border border-blue-500"
            >
              <FileText size={18} />
              Gerar Proposta Premium
            </button>
            <button
              onClick={handleCompartilhar}
              disabled={isSaving}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 text-xs font-black uppercase tracking-widest rounded border border-slate-200 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Share2 size={18} />
              {isSaving ? 'Gerando...' : 'Compartilhar Projeto'}
            </button>
            <button
              onClick={handleAdicionarAoCarrinho}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 border border-blue-500"
            >
              <Check size={18} />
              ðŸ›’ Adicionar ao OrÃ§amento
            </button>
          </div>
          </>
          )}
        </div>

      {isPropostaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsPropostaModalOpen(false)}
              className="mb-4 text-slate-900 hover:text-slate-700 font-bold"
            >
              Fechar
            </button>
            <PropostaComercial projectSummary={productSummary} />
          </div>
        </div>
      )}
      </div>

      {/* Mobile Sticky Add to Cart Button */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] p-4 bg-white/95 backdrop-blur-lg border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
        <button 
          onClick={handleAdicionarAoCarrinho}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded border border-blue-400/30 font-bold text-xs tracking-[0.2em] uppercase shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          <ShoppingCart size={18} /> ADICIONAR AO CARRINHO
        </button>
      </div>
    </div>
  );
};

