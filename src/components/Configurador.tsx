import React, { useState } from 'react';
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
  Share2
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useERP } from '../contexts/ERPContext';
import { CheckoutPropostaModal } from './CheckoutPropostaModal';
import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

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
  const [perfilSelecionadoId, setPerfilSelecionadoId] = useState<string>(project.material || 'metalon100x100x2.0');
  const [quantidadeGrades, setQuantidadeGrades] = useState<number>(project.quantidadeGrades || 3);
  const [tipoMontagem, setTipoMontagem] = useState<'reto' | 'meia-esquadria'>(project.tipoMontagem || 'meia-esquadria');
  const [tipoEntrega, setTipoEntrega] = useState<'pecas' | 'montado_sem_pintura' | 'montado_com_pintura'>(project.tipoEntrega || 'montado_com_pintura');
  const [tipoProduto, setTipoProduto] = useState<'quadro_simples' | 'portao_basculante' | 'portao_deslizante' | 'escada_reta' | 'escada_l' | 'cobertura_pergolado' | 'galpao' | 'tesoura' | 'galpao_tesoura_personalizada' | 'chapa_cortada' | 'chapa_dobrada_l' | 'chapa_dobrada_u' | 'perfil_u_enrijecido' | 'chapa_dobrada_z' | 'chapa_dobrada_cartola' | 'bandeja_metalica'>(project.tipoProduto || 'cobertura_pergolado');
  
  const [anguloAberturaGraus, setAnguloAberturaGraus] = useState<number>(0);
  
  // Novos estados para Chapas e Dobras
  const [espessuraChapa, setEspessuraChapa] = useState<number>(0.90);
  const [referenciaMedida, setReferenciaMedida] = useState<'interna' | 'externa'>('externa');
  const [abaExtra, setAbaExtra] = useState<number>(15); // Para dentes de U enrijecido ou abas externas de cartola
  
  // Novos estados para a Cobertura / Pergolado
  const [profundidade, setProfundidade] = useState<number>(project.dimensions.depth || 5000);
  const [inclinacaoPercentual, setInclinacaoPercentual] = useState<number>(project.inclinacaoPercentual || 10);
  const [materialCobertura, setMaterialCobertura] = useState<'vidro' | 'policarbonato' | 'telha' | 'vazio'>(project.materialCobertura || 'telha');
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

  const [isSaving, setIsSaving] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const steps = [
    { label: 'PRODUTO', icon: Package },
    { label: 'DIMENSÕES', icon: Ruler },
    { label: 'ESTRUTURA', icon: Settings },
    { label: 'MATERIAIS', icon: Paintbrush },
    { label: 'PROJETO', icon: Eye },
  ];

  const [activeStep, setActiveStep] = useState(0);

  // Cores automáticas baseadas no padrão ABNT
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
  const [isReportExpanded, setIsReportExpanded] = useState(false);

  const [isChangingProduct, setIsChangingProduct] = useState(false);
  const [isPropostaModalOpen, setIsPropostaModalOpen] = useState(false);

  const handleAdicionarAoCarrinho = () => {
    // 1. Montar Objeto do Produto com Dados Reais do 3D
    const produtoCarrinho = {
      nome: productSummary.nome,
      tipo: tipoProduto,
      dimensoes: { largura, altura, profundidade },
      material: perfilSelecionado.nome,
      tipoEntrega,
      pecas: productSummary.pecas,
      insumos: productSummary.insumos,
      custos: productSummary.custos,
      preco: productSummary.precoTotal
    };

    // 2. Ação no Estado Global
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

  // Lógica de colunas automáticas
  React.useEffect(() => {
    if (tipoProduto === 'cobertura_pergolado' && autoColunas) {
      // Regra: Uma coluna extra a cada 3.5 metros de vão
      const colunasLargura = Math.max(0, Math.floor(largura / 3500));
      const colunasProfundidade = Math.max(0, Math.floor(profundidade / 3500));
      // Simplificação: pegamos o maior reforço necessário
      const totalSugerido = colunasLargura + colunasProfundidade;
      if (totalSugerido !== qtdColunasExtras) {
        setQtdColunasExtras(totalSugerido);
      }
    }
  }, [largura, profundidade, tipoProduto, autoColunas]);

  // Filtrar perfis compatíveis com o tipo de projeto
  const perfisCompativeis = perfisDB.filter(p => 
    tipoProduto === 'tesoura' || 
    tipoProduto === 'galpao' || 
    tipoProduto === 'galpao_tesoura_personalizada' ||
    !p.projetosCompativeis || 
    p.projetosCompativeis.includes(tipoProduto)
  );

  // Filtros específicos por componente
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
    
    // Variáveis para exibição no relatório
    const isGalpao = tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada';
    const isTesoura = tipoProduto === 'tesoura';
    const isCobertura = tipoProduto === 'cobertura_pergolado';

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
      const espacoUtil = larguraFolha - (2 * perfilSize);
      vaoLivreCalculadoEmMM = (espacoUtil - (quantidadeGrades * perfilSize)) / (quantidadeGrades + 1);
      
      const materialBatente = (2 * largura) + (2 * altura);
      const materialFolha = (2 * larguraFolha) + (2 * alturaGradeFolha) + (quantidadeGrades * alturaGradeFolha);
      materialTotalMM = materialBatente + materialFolha;

      listaCorte.push({ nome: 'Batente - Horizontais', qtd: 2, medida: `${largura} mm` });
      listaCorte.push({ nome: 'Batente - Verticais', qtd: 2, medida: `${altura} mm` });
      listaCorte.push({ nome: 'Folha - Horizontais', qtd: 2, medida: `${larguraFolha} mm` });
      listaCorte.push({ nome: 'Folha - Verticais', qtd: 2, medida: `${alturaGradeFolha} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ nome: 'Folha - Grades', qtd: quantidadeGrades, medida: `${alturaGradeFolha} mm` });
      }
    } else if (tipoProduto === 'portao_deslizante') {
      const espacoUtil = larguraFolha - (2 * perfilSize);
      vaoLivreCalculadoEmMM = (espacoUtil - (quantidadeGrades * perfilSize)) / (quantidadeGrades + 1);
      
      const materialFolha = (2 * larguraFolha) + (2 * alturaGradeFolha) + (quantidadeGrades * alturaGradeFolha);
      materialTotalMM = materialFolha;

      listaCorte.push({ nome: 'Trilho Inferior', qtd: 1, medida: `${largura * 2} mm` });
      listaCorte.push({ nome: 'Guia Superior', qtd: 1, medida: `${largura * 2} mm` });
      listaCorte.push({ nome: 'Colunas de Sustentação', qtd: 2, medida: `${altura} mm` });
      listaCorte.push({ nome: 'Travessa Superior (Batente)', qtd: 1, medida: `${largura} mm` });
      listaCorte.push({ nome: 'Folha - Horizontais', qtd: 2, medida: `${larguraFolha} mm` });
      listaCorte.push({ nome: 'Folha - Verticais', qtd: 2, medida: `${alturaGradeFolha} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ nome: 'Folha - Grades', qtd: quantidadeGrades, medida: `${alturaGradeFolha} mm` });
      }
      if (incluirPortaoPedestre) {
        listaCorte.push({ nome: 'Portão Pedestre - Horizontais', qtd: 2, medida: `900 mm` });
        listaCorte.push({ nome: 'Portão Pedestre - Verticais', qtd: 2, medida: `2100 mm` });
      }
    } else if (tipoProduto === 'escada_reta') {
      numDegraus = Math.ceil(altura / 180);
      espelho = altura / numDegraus;
      comprimentoTotal = numDegraus * pisada;
      hipotenusa = Math.sqrt(Math.pow(altura, 2) + Math.pow(comprimentoTotal, 2));
      angulo = Math.atan2(altura, comprimentoTotal);
      materialTotalMM = 2 * hipotenusa;

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

      listaCorte.push({ nome: 'Vigas Laterais', qtd: 2, medida: `${hipotenusa.toFixed(1)} mm (Ângulo: ${(angulo * 180 / Math.PI).toFixed(1)}°)` });
      listaCorte.push({ nome: 'Degraus', qtd: numDegraus, medida: `Pisada: ${pisada} mm, Espelho: ${espelho.toFixed(1)} mm` });
      if (temGuardaCorpo) {
        const qtdLados = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        listaCorte.push({ nome: 'Corrimão Superior', qtd: qtdLados, medida: `${hipotenusa.toFixed(1)} mm` });
        listaCorte.push({ nome: 'Montantes Verticais', qtd: qtdMontantes * qtdLados, medida: `900 mm` });
      }
    } else if (isCobertura || isGalpao || isTesoura) {
      const inclinacaoReal = inclinacaoPercentual;
      const diferencaAltura = (isGalpao ? (largura / 2) : profundidade) * (inclinacaoReal / 100);
      const comprimentoInclinado = isGalpao 
        ? Math.sqrt(Math.pow(largura / 2, 2) + Math.pow(diferencaAltura, 2)) * 2
        : Math.sqrt(Math.pow(profundidade, 2) + Math.pow(diferencaAltura, 2));
      
      areaCobertura = isGalpao 
        ? (comprimentoInclinado / 1000) * (profundidade / 1000)
        : isTesoura ? 0 : (largura / 1000) * (comprimentoInclinado / 1000);
      
      if (isGalpao) {
        const numTesouras = Math.ceil(profundidade / 4000) + 1;
        const materialPilares = (altura * 2) * numTesouras;
        const materialTesouras = (largura + (diferencaAltura * 2)) * numTesouras;
        const materialTerças = (qtdTercasCalculada * 2) * profundidade;
        materialTotalMM = materialPilares + materialTesouras + materialTerças;

        listaCorte.push({ nome: 'Pilares Estruturais', qtd: numTesouras * 2, medida: `${altura} mm` });
        listaCorte.push({ nome: 'Tesouras (Banzos)', qtd: numTesouras * 2, medida: `${(comprimentoInclinado / 2).toFixed(1)} mm` });
        listaCorte.push({ nome: 'Terças de Cobertura', qtd: qtdTercasCalculada * 2, medida: `${profundidade} mm` });
      } else if (isTesoura) {
        const materialBanzos = largura + 2 * Math.sqrt(Math.pow(largura/2, 2) + Math.pow(altura, 2));
        const materialInternos = largura + 2 * altura;
        materialTotalMM = materialBanzos + materialInternos;

        listaCorte.push({ nome: 'Banzo Inferior', qtd: 1, medida: `${largura} mm` });
        listaCorte.push({ nome: 'Banzos Superiores', qtd: 2, medida: `${Math.sqrt(Math.pow(largura/2, 2) + Math.pow(altura, 2)).toFixed(1)} mm` });
        listaCorte.push({ nome: 'Montantes/Diagonais', qtd: 1, medida: `Estimado: ${materialInternos.toFixed(1)} mm` });
      } else {
        const alturaTraseira = altura + diferencaAltura;
        const materialPilares = (altura * 2) + (alturaTraseira * 2) + (qtdColunasExtras * ((altura + alturaTraseira) / 2));
        const materialVigas = (largura * 2) + (profundidade * 2);
        const materialTerças = qtdTercas * largura;
        materialTotalMM = materialPilares + materialVigas + materialTerças;

        listaCorte.push({ nome: 'Pilares Frontais', qtd: 2, medida: `${altura} mm` });
        listaCorte.push({ nome: 'Pilares Traseiros', qtd: 2, medida: `${alturaTraseira.toFixed(1)} mm` });
        listaCorte.push({ nome: 'Vigas de Contorno', qtd: 2, medida: `${largura} mm e ${profundidade} mm` });
        listaCorte.push({ nome: 'Terças', qtd: qtdTercas, medida: `${largura} mm` });
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
    const multiplicadorMetal = acabamentosMetal[acabamento as AcabamentoMetalKey]?.multiplicadorPreco || 1.0;
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
    let pesoFinal = pesoTotal;
    let custoFinal = (((materialTotalMetros * ((perfilSelecionado.pesoPorMetro || 0) * 20)) + (areaCobertura * (perfilSelecionado.precoPorM2 || 0))) * multiplicadorMetal * multiplicadorDegrau) + custoMaterialCobertura + custoFixacao;

    if (isCobertura || isGalpao || isTesoura) {
      const inclinacaoReal = inclinacaoPercentual;
      const diferencaAltura = (isGalpao ? (largura / 2) : profundidade) * (inclinacaoReal / 100);
      const comprimentoInclinado = isGalpao 
        ? Math.sqrt(Math.pow(largura / 2, 2) + Math.pow(diferencaAltura, 2)) * 2
        : Math.sqrt(Math.pow(profundidade, 2) + Math.pow(diferencaAltura, 2));

      if (isGalpao) {
        const numTesouras = Math.ceil(profundidade / 4000) + 1;
        const materialPilares = (altura * 2) * numTesouras;
        const materialVigas = (largura + (diferencaAltura * 2)) * numTesouras * 2; 
        const materialTerças = (qtdTercasCalculada * 2) * profundidade;
        const numWebMembersPerTruss = 16;
        const avgWebLength = (diferencaAltura / 2);
        const materialWeb = (numWebMembersPerTruss * avgWebLength) * numTesouras * 2;
        const diagLateral = Math.sqrt(Math.pow(altura, 2) + Math.pow(4000, 2));
        const diagTelhado = Math.sqrt(Math.pow(largura/2, 2) + Math.pow(4000, 2));
        const materialBracing = (diagLateral * 8) + (diagTelhado * 8);
        const materialTerçasTotal = materialTerças + materialWeb + materialBracing;
        
        const pesoPilares = (materialPilares / 1000) * (perfilColunaSelecionado.pesoPorMetro || 0);
        const pesoVigas = (materialVigas / 1000) * (perfilVigaSelecionado.pesoPorMetro || 0);
        const pesoTercas = (materialTerçasTotal / 1000) * (perfilTercaSelecionado.pesoPorMetro || 0);
        pesoFinal = pesoPilares + pesoVigas + pesoTercas + pesoFixacao;
        
        const custoPilares = (materialPilares / 1000) * ((perfilColunaSelecionado.pesoPorMetro || 0) * 20);
        const custoVigas = (materialVigas / 1000) * ((perfilVigaSelecionado.pesoPorMetro || 0) * 20);
        const custoTercas = (materialTerçasTotal / 1000) * ((perfilTercaSelecionado.pesoPorMetro || 0) * 20);
        custoFinal = ((custoPilares + custoVigas + custoTercas) * multiplicadorMetal) + custoMaterialCobertura + custoFixacao;
      } else if (isTesoura) {
        const materialBanzos = largura + 2 * Math.sqrt(Math.pow(largura/2, 2) + Math.pow(altura, 2));
        const materialInternos = largura + 2 * altura;
        const pesoBanzos = (materialBanzos / 1000) * (perfilSelecionado.pesoPorMetro || 0);
        const pesoInternos = (materialInternos / 1000) * (perfilVigaSelecionado.pesoPorMetro || 0);
        pesoFinal = pesoBanzos + pesoInternos + pesoFixacao;
        const custoBanzos = (materialBanzos / 1000) * ((perfilSelecionado.pesoPorMetro || 0) * 20);
        const custoInternos = (materialInternos / 1000) * ((perfilVigaSelecionado.pesoPorMetro || 0) * 20);
        custoFinal = (custoBanzos + custoInternos) * multiplicadorMetal + custoFixacao;
      } else {
        const alturaTraseira = altura + diferencaAltura;
        const materialPilares = (altura * 2) + (alturaTraseira * 2) + (qtdColunasExtras * ((altura + alturaTraseira) / 2));
        const materialVigas = (largura * 2) + (profundidade * 2);
        const materialTerças = qtdTercas * largura;
        const pesoPilares = (materialPilares / 1000) * (perfilColunaSelecionado.pesoPorMetro || 0);
        const pesoVigas = (materialVigas / 1000) * (perfilVigaSelecionado.pesoPorMetro || 0);
        const pesoTercas = (materialTerças / 1000) * (perfilTercaSelecionado.pesoPorMetro || 0);
        pesoFinal = pesoPilares + pesoVigas + pesoTercas + pesoFixacao;
        const custoPilares = (materialPilares / 1000) * ((perfilColunaSelecionado.pesoPorMetro || 0) * 20);
        const custoVigas = (materialVigas / 1000) * ((perfilVigaSelecionado.pesoPorMetro || 0) * 20);
        const custoTercas = (materialTerças / 1000) * ((perfilTercaSelecionado.pesoPorMetro || 0) * 20);
        custoFinal = ((custoPilares + custoVigas + custoTercas) * multiplicadorMetal) + custoMaterialCobertura + custoFixacao;
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
      const custoFolha = (materialTotalMM / 1000) * ((perfilSelecionado.pesoPorMetro || 0) * 20);
      const custoBatente = (materialBatente / 1000) * ((perfilBatenteSelecionado.pesoPorMetro || 0) * 20);
      const custoTrilho = (materialTrilho / 1000) * ((perfilTrilhoSelecionado.pesoPorMetro || 0) * 20);
      const custoGuia = (materialGuia / 1000) * ((perfilGuiaSelecionado.pesoPorMetro || 0) * 20);
      const custoColunas = (materialColunas / 1000) * ((perfilColunaPortaoSelecionado.pesoPorMetro || 0) * 20);
      const custoPedestre = (materialPedestre / 1000) * ((perfilSelecionado.pesoPorMetro || 0) * 20);
      custoFinal = ((custoFolha + custoBatente + custoTrilho + custoGuia + custoColunas + custoPedestre) * multiplicadorMetal) + custoFixacao;
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
      let somaAbasC = 0; // Para bandeja metálica (comprimento)

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
      let desenvolvimentoC = 0; // Para bandeja metálica

      if (referenciaMedida === 'interna') {
        desenvolvimento = somaAbas;
        if (tipoProduto === 'bandeja_metalica') {
          desenvolvimentoC = somaAbasC;
        }
      } else {
        // Externa
        if (tipoProduto === 'bandeja_metalica') {
          // Bandeja tem 2 dobras em cada direção
          desenvolvimento = somaAbas - (2 * espessuraChapa);
          desenvolvimentoC = somaAbasC - (2 * espessuraChapa);
        } else {
          desenvolvimento = somaAbas - (qtdDobras * espessuraChapa);
        }
      }

      // Para bandeja metálica, o corte plano é uma chapa de (desenvolvimento) x (desenvolvimentoC)
      // Para os outros, é (desenvolvimento) x (profundidade)
      const comprimentoCorte = tipoProduto === 'bandeja_metalica' ? desenvolvimentoC : profundidade;
      
      listaCorte.push({
        nome: 'Corte Plano (Desenvolvimento)',
        qtd: 1,
        medida: tipoProduto === 'bandeja_metalica' 
          ? `${desenvolvimento.toFixed(1)} x ${desenvolvimentoC.toFixed(1)} mm`
          : `${desenvolvimento.toFixed(1)} x ${comprimentoCorte.toFixed(1)} mm`
      });

      // Cálculo de peso e custo (aproximado para chapa de aço carbono)
      // Densidade do aço = 7.85 g/cm³ = 7850 kg/m³
      const areaM2 = (desenvolvimento / 1000) * (comprimentoCorte / 1000);
      pesoFinal = areaM2 * (espessuraChapa / 1000) * 7850;
      custoFinal = (pesoFinal * 15) * multiplicadorMetal; // R$ 15/kg estimado * multiplicador
      materialTotalMM = desenvolvimento;
    }

    const areaTotal = (largura / 1000) * (altura / 1000);
    const arameMIG = areaTotal > 5 ? 2 : 0.5; // kg
    const tintaPrimer = areaTotal > 5 ? 1 : 0.25; // latas
    const tintaEsmalte = areaTotal > 5 ? 1 : 0.25; // latas

    return {
      nome: project.name,
      pecas: listaCorte,
      insumos: [
        { nome: 'Arame MIG', qtd: arameMIG, unidade: 'kg' },
        { nome: 'Primer Anticorrosivo', qtd: tintaPrimer, unidade: 'latas' },
        { nome: 'Esmalte Sintético', qtd: tintaEsmalte, unidade: 'latas' }
      ],
      custos: {
        material: custoFinal * 0.6, // Estimativa 60% material
        insumos: custoFinal * 0.1, // Estimativa 10% insumos
        maoDeObra: custoFinal * 0.2, // Estimativa 20% mão de obra
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
      areaCobertura,
      alturaGrade,
      larguraFolha,
      alturaFolha,
      alturaGradeFolha,
      qtdTercasCalculada,
      isGalpao,
      isTesoura,
      isCobertura
    };
  }, [
    tipoProduto, largura, altura, profundidade, quantidadeGrades, 
    perfilSelecionado, perfilColunaSelecionado, perfilVigaSelecionado, 
    perfilTercaSelecionado, perfilGuiaId, perfilBatenteId, 
    perfilColunaPortaoId, perfilTrilhoId, qtdTercas, 
    telhaSelecionadaId, inclinacaoPercentual, materialCobertura, 
    acabamento, temGuardaCorpo, ladoGuardaCorpo, materialDegrau, 
    fixacao, qtdColunasExtras, incluirPortaoPedestre, project.name,
    espessuraChapa, abaExtra, referenciaMedida
  ]);

  const {
    materialTotalMetros, vaoLivreCalculadoEmMM, numDegraus, espelho,
    pisada, comprimentoTotal, hipotenusa, angulo, qtdMontantes,
    materialGuardaCorpoMM, areaCobertura, alturaGrade, larguraFolha,
    alturaFolha, alturaGradeFolha, qtdTercasCalculada, pesoFinal,
    custoFinal, precoTotal, isGalpao, isTesoura, isCobertura
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
      listaCorte.push({ item: 'Colunas de Sustentação', quantidade: 2, medida: `${altura} mm` });
      listaCorte.push({ item: 'Travessa Superior (Batente)', quantidade: 1, medida: `${largura} mm` });
      listaCorte.push({ item: 'Folha - Horizontais', quantidade: 2, medida: `${larguraFolha} mm` });
      listaCorte.push({ item: 'Folha - Verticais', quantidade: 2, medida: `${alturaGradeFolha} mm` });
      if (quantidadeGrades > 0) {
        listaCorte.push({ item: 'Folha - Grades', quantidade: quantidadeGrades, medida: `${alturaGradeFolha} mm` });
      }
      if (incluirPortaoPedestre) {
        listaCorte.push({ item: 'Portão Pedestre - Horizontais', quantidade: 2, medida: `900 mm` });
        listaCorte.push({ item: 'Portão Pedestre - Verticais', quantidade: 2, medida: `2100 mm` });
      }
    } else if (tipoProduto === 'escada_reta') {
      listaCorte.push({ item: 'Vigas Laterais', quantidade: 2, medida: `${hipotenusa.toFixed(1)} mm (Ângulo: ${(angulo * 180 / Math.PI).toFixed(1)}°)` });
      listaCorte.push({ item: 'Degraus', quantidade: numDegraus, medida: `Pisada: ${pisada} mm, Espelho: ${espelho.toFixed(1)} mm` });
      
      if (temGuardaCorpo) {
        const qtdLados = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        listaCorte.push({ item: 'Corrimão Superior', quantidade: qtdLados, medida: `${hipotenusa.toFixed(1)} mm` });
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
        listaCorte.push({ item: 'Terças de Telhado', quantidade: qtdTercasCalculada * 2, medida: `${profundidade} mm` });
        
        // Detalhamento da Tesoura dentro do Galpão
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
          listaCorte.push({ item: 'Colunas de Reforço (Flambagem)', quantidade: qtdColunasExtras, medida: `Média: ${((altura + (altura + rise)) / 2).toFixed(1)} mm` });
        }
        listaCorte.push({ item: 'Vigas Principais', quantidade: 4, medida: `Largura: ${largura} mm, Profundidade: ${profundidade} mm` });
        listaCorte.push({ item: 'Terças', quantidade: qtdTercas, medida: `${largura} mm` });
      }
      
      if (materialCobertura === 'telha') {
        const telha = telhasDB.find(t => t.id === telhaSelecionadaId) || telhasDB[0];
        const numTelhasLargura = Math.ceil(profundidade / telha.larguraUtil);
        const comprimentoTelha = slopeLength + 100;
        listaCorte.push({ item: `Telhas (${telha.nome})`, quantidade: numTelhasLargura * (isGalpao ? 2 : 1), medida: `${comprimentoTelha.toFixed(1)} mm` });
      } else {
        listaCorte.push({ item: 'Cobertura', quantidade: 1, medida: `${areaCobertura.toFixed(2)} m² (${materialCobertura})` });
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
      alert("Você precisa estar logado para compartilhar projetos.");
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
      <HelpCircle size={14} className="text-slate-500 hover:text-indigo-500 cursor-help transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-slate-900/95 backdrop-blur-sm text-white text-[11px] rounded-xl shadow-xl z-50 leading-relaxed border border-white/10">
        {title && <div className="font-bold mb-1 text-indigo-300 uppercase text-[9px] tracking-wider">{title}</div>}
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900/95" />
      </div>
    </div>
  );

  // Componente de Seção de Configuração
  const ConfigSection = ({ title, icon: Icon, children, isOpen = true }: { title: string, icon: any, children: React.ReactNode, isOpen?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(isOpen);
    return (
      <div className="bg-slate-800/50 rounded border border-slate-700 overflow-visible shadow-xl">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between bg-slate-800 hover:bg-slate-750 transition-colors border-b border-slate-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded">
              <Icon size={14} />
            </div>
            <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">{title}</h3>
          </div>
          <ChevronRight size={14} className={`text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
        {isExpanded && <div className="p-5 space-y-5">{children}</div>}
      </div>
    );
  };

  // Componente de Input com Setas
  const DimensionInput = ({ label, value, onChange, min = 100, max = 10000, step = 10, info, title, hint }: { label: string, value: number, onChange: (val: number) => void, min?: number, max?: number, step?: number, info?: string, title?: string, hint?: React.ReactNode }) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
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
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 transition-all active:scale-95 flex items-center justify-center font-bold"
        >
          -
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={() => {
            if (value < min) onChange(min);
            if (value > max) onChange(max);
          }}
          className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-center font-mono text-sm text-white focus:border-blue-500 outline-none transition-all"
          min={min}
          max={max}
        />
        <button 
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 transition-all active:scale-95 flex items-center justify-center font-bold"
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
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
        // De Tesoura para Galpão: Altura da tesoura vira Inclinação
        finalInclinacao = (altura / (largura / 2)) * 100;
        setInclinacaoPercentual(finalInclinacao);
        // Se a altura era pequena (altura de tesoura), define um pé direito padrão
        if (altura < 3500) {
          finalAltura = 5000;
          setAltura(5000);
        }
        // Se a profundidade era de tesoura (100mm), define uma profundidade padrão para galpão
        if (profundidade < 1000) {
          finalProfundidade = 12000;
          setProfundidade(12000);
        }
      } else if ((tipoProduto === 'galpao' || tipoProduto === 'galpao_tesoura_personalizada') && novoTipo === 'tesoura') {
        // De Galpão para Tesoura: Inclinação vira Altura da tesoura
        finalAltura = Math.round((largura / 2) * (inclinacaoPercentual / 100));
        setAltura(finalAltura);
        // Tesoura isolada tem profundidade mínima (100mm)
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
    setActiveStep(1); // Avança automaticamente para o próximo passo
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
    <div className="h-full flex flex-col md:flex-row gap-0 bg-slate-950 relative overflow-hidden">
      <CheckoutPropostaModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />

      {/* Right Column: 3D Viewer - First on mobile */}
      <div className="w-full md:w-2/3 h-[400px] md:h-auto order-1 md:order-2 relative bg-slate-950">
        {/* Mini-Cart Icon - CAD Style */}
        <button 
          onClick={() => setIsCheckoutOpen(true)}
          className="absolute top-4 right-4 z-50 bg-slate-900/80 backdrop-blur-md text-white p-2 px-4 rounded border border-slate-700 flex items-center gap-3 transition-all hover:bg-slate-800 active:scale-95 group shadow-2xl"
        >
          <div className="relative">
            <ShoppingCart size={16} className="text-blue-400" />
            {state.carrinhoAtual.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">
                {state.carrinhoAtual.length}
              </span>
            )}
          </div>
          <span className="text-xs font-mono font-bold tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(state.carrinhoAtual.reduce((acc, item) => acc + (item.preco || 0), 0))}
          </span>
        </button>

        {/* Botão Adicionar ao Carrinho - CAD Style */}
        <div className="absolute bottom-6 left-6 right-6 z-40 max-w-md mx-auto">
          <button 
            onClick={handleAdicionarAoCarrinho}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded border border-blue-400/30 font-bold text-sm tracking-widest uppercase shadow-2xl transition-all flex items-center justify-center gap-3"
          >
            <ShoppingCart size={18} /> ADICIONAR AO CARRINHO
          </button>
        </div>

        <div className="absolute top-4 left-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur-md p-3 rounded border border-slate-700 shadow-2xl">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">PROJETO ATIVO</h3>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded border border-blue-500/30 text-blue-400">
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
                  ].find(i => i.id === tipoProduto);
                  return item ? <item.icon size={16} strokeWidth={2.5} /> : <Package size={16} />;
                })()}
              </div>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{tipoProduto.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

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
          fixacao={fixacao}
          tipoTesouraId={tipoTesouraId}
          tipoTelhado={tipoTelhado}
          colorBanzo={systemColors.banzo}
          colorMontante={systemColors.montante}
          colorDiagonal={systemColors.diagonal}
          colorTerca={systemColors.terca}
          colorColuna={systemColors.coluna}
          colorViga={systemColors.viga}
          colorFechamento={systemColors.fechamento}
        />
      </div>

      {/* Left Column: Controls - Second on mobile */}
      <div className="w-full md:w-1/3 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden order-2 md:order-1">
        {/* Stepper Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-white tracking-[0.2em] uppercase">Configurador</h2>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Passo {activeStep + 1} de {steps.length}</p>
            </div>
            <div className="p-2 bg-slate-800 rounded border border-slate-700 text-blue-400">
              <Settings size={16} />
            </div>
          </div>
          
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-800 -translate-y-1/2 z-0"></div>
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`relative z-10 flex flex-col items-center gap-2 group`}
              >
                <div className={`w-8 h-8 rounded flex items-center justify-center transition-all duration-300 border ${
                  activeStep === idx 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                    : activeStep > idx 
                      ? 'bg-slate-800 text-blue-400 border-slate-700' 
                      : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'
                }`}>
                  {activeStep > idx ? <Check size={14} /> : <step.icon size={14} />}
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${activeStep === idx ? 'text-blue-400' : 'text-slate-600'}`}>
                  {step.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Step Content Container */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 bg-slate-900">
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded border border-slate-700">
                <div className="flex items-center gap-3">
                  <Ruler className="text-blue-400" size={18} />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Exibir Medidas (Cotas)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={mostrarCotas}
                    onChange={(e) => setMostrarCotas(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded border border-slate-700">
                <div className="flex items-center gap-3">
                  <Settings className="text-blue-400" size={18} />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Exibir Nós (Gussets)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={mostrarNodes}
                    onChange={(e) => setMostrarNodes(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded border border-slate-700">
                <div className="flex items-center gap-3">
                  <Layers className="text-blue-400" size={18} />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Vista Explodida</span>
                </div>
                <button 
                  onClick={() => {
                    const target = explodedFactor > 0 ? 0 : 1;
                    setExplodedFactor(target);
                  }}
                  className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${explodedFactor > 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750'}`}
                >
                  {explodedFactor > 0 ? 'Recolher' : 'Explodir'}
                </button>
              </div>
            </div>
          )}

          {activeStep === 0 && (
            <div className="bg-slate-800 p-5 rounded border border-slate-700 shadow-xl">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 block flex items-center">
                01. SELECIONE O PRODUTO
                <Tooltip text="Escolha o tipo de estrutura que deseja configurar." title="Tipo de Projeto" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'quadro_simples', label: 'Quadro', icon: Square, desc: 'Grades e Quadros' },
                  { id: 'portao_basculante', label: 'Basculante', icon: DoorOpen, desc: 'Portão de Garagem' },
                  { id: 'portao_deslizante', label: 'Deslizante', icon: ArrowRightLeft, desc: 'Portão de Correr' },
                  { id: 'escada_reta', label: 'Escada Reta', icon: ChevronRight, desc: 'Escada Simples' },
                  { id: 'escada_l', label: 'Escada em L', icon: CornerDownRight, desc: 'Escada com Curva' },
                  { id: 'cobertura_pergolado', label: 'Cobertura', icon: Home, desc: 'Pergolado/Teto' },
                  { id: 'galpao_tesoura_personalizada', label: 'Galpão Pro', icon: Factory, desc: 'Tesoura Personalizada' },
                  { id: 'tesoura', icon: Hammer, label: 'Treliça', desc: 'Modelos de Tesoura' },
                  { id: 'chapa_cortada', label: 'Chapa Cortada', icon: Layers, desc: 'Corte Plano' },
                  { id: 'chapa_dobrada_l', label: 'Perfil L', icon: Layers, desc: 'Cantoneira Dobrada' },
                  { id: 'chapa_dobrada_u', label: 'Perfil U', icon: Layers, desc: 'U Simples Dobrado' },
                  { id: 'perfil_u_enrijecido', label: 'U Enrijecido', icon: Layers, desc: 'U com Abas' },
                  { id: 'chapa_dobrada_z', label: 'Perfil Z', icon: Layers, desc: 'Z Dobrado' },
                  { id: 'chapa_dobrada_cartola', label: 'Cartola', icon: Layers, desc: 'Perfil Ômega' },
                  { id: 'bandeja_metalica', label: 'Bandeja', icon: Package, desc: 'Bandeja Metálica' },
                ].map((item) => {
                  const isActive = tipoProduto === item.id;
                  const isProfile = item.id.startsWith('chapa_') || item.id === 'perfil_u_enrijecido' || item.id === 'bandeja_metalica';
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTipoProdutoChange(item.id as any)}
                      className={`flex flex-col gap-2 p-3 rounded border transition-all text-left group ${
                        isActive 
                          ? 'border-blue-500 bg-blue-600/10 text-blue-400 shadow-lg' 
                          : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <div className={`p-1.5 rounded w-fit transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'}`}>
                        {isProfile ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-full h-full stroke-current stroke-[3]">
                              {item.id === 'chapa_dobrada_l' && <path d="M6 4v12h12" fill="none" />}
                              {item.id === 'chapa_dobrada_u' && <path d="M6 4v12h12V4" fill="none" />}
                              {item.id === 'perfil_u_enrijecido' && <path d="M6 4v12h12V4M6 4h4M18 4h-4" fill="none" />}
                              {item.id === 'chapa_dobrada_z' && <path d="M6 4h8v8h8v4" fill="none" />}
                              {item.id === 'chapa_dobrada_cartola' && <path d="M4 16V8h4V4h8v4h4v8" fill="none" />}
                              {item.id === 'bandeja_metalica' && <path d="M4 16V8h16v8M4 8h16" fill="none" />}
                              {item.id === 'chapa_cortada' && <rect x="4" y="4" width="16" height="16" fill="none" />}
                            </svg>
                          </div>
                        ) : (
                          <item.icon size={16} strokeWidth={2.5} />
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold leading-tight uppercase tracking-wider">{item.label}</div>
                        <div className="text-[9px] opacity-50 font-medium">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO: DIMENSÕES PRINCIPAIS */}
          {activeStep === 1 && (
            <ConfigSection title="Dimensões Principais" icon={Ruler}>
              <DimensionInput 
                label={(() => {
                  if (tipoProduto === 'escada_reta') return 'Largura da Escada';
                  if (tipoProduto === 'tesoura') return 'Largura (Vão)';
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
                min={tipoProduto === 'escada_reta' ? 600 : (tipoProduto === 'tesoura' ? 2000 : (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 10 : 500))} 
                max={tipoProduto === 'escada_reta' ? 1500 : (tipoProduto === 'tesoura' || isGalpao ? 30000 : 10000)} 
                step={tipoProduto === 'escada_reta' ? 10 : (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 1 : 50)}
                info={tipoProduto === 'escada_reta' ? "Largura útil dos degraus." : (tipoProduto === 'tesoura' ? "Vão livre da tesoura." : "Medida em milímetros.")}
              />

              {tipoProduto !== 'chapa_cortada' && (
                <DimensionInput 
                  label={(() => {
                    if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') return 'Altura do Pé Direito';
                    if (tipoProduto === 'tesoura') return 'Altura da Tesoura';
                    if (isGalpao) return 'Pé Direito (Altura Coluna)';
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
                  info={tipoProduto === 'escada_reta' || tipoProduto === 'escada_l' ? "Altura total do chão até o nível superior." : (tipoProduto === 'tesoura' ? "Altura total da tesoura (da base até a cumeeira). Recomendado entre 10% e 30% do vão (ABNT)." : (isGalpao ? "Altura livre das colunas (pé direito)." : "Medida em milímetros."))}
                  hint={tipoProduto === 'tesoura' ? (() => {
                    const percentual = (altura / largura) * 100;
                    let status = '';
                    let colorClass = '';
                    if (percentual >= 10 && percentual <= 15) {
                      status = 'Ideal (Ótimo custo-benefício e estética)';
                      colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200';
                    } else if (percentual < 10) {
                      status = 'Muito Baixa (Risco de infiltração/deformação)';
                      colorClass = 'text-amber-600 bg-amber-50 border-amber-200';
                    } else if (percentual > 15 && percentual <= 25) {
                      status = 'Moderada (Padrão estrutural)';
                      colorClass = 'text-blue-600 bg-blue-50 border-blue-200';
                    } else {
                      status = 'Alta (Muito pontuda/Alto consumo)';
                      colorClass = 'text-rose-600 bg-rose-50 border-rose-200';
                    }
                    return (
                      <div className={`text-[10px] font-medium px-2 py-1 rounded border ${colorClass} flex justify-between items-center`}>
                        <span>Proporção: {percentual.toFixed(1)}% do vão</span>
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
                  info="Medida em milímetros."
                />
              )}

              {(tipoProduto === 'cobertura_pergolado' || isGalpao || tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                <DimensionInput 
                  label={(() => {
                    if (tipoProduto === 'bandeja_metalica') return 'Base C';
                    if (tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido') return 'Comprimento';
                    return 'Profundidade';
                  })()} 
                  value={profundidade} 
                  onChange={setProfundidade} 
                  min={tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 10 : 500} 
                  max={isGalpao ? 30000 : 12000} 
                  step={tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica' ? 1 : 50}
                  info={isGalpao ? "Comprimento total do galpão." : "Medida em milímetros."}
                />
              )}

            </ConfigSection>
          )}

          {/* SEÇÃO: CONFIGURAÇÕES ESPECÍFICAS */}
          {activeStep === 2 && (
            <ConfigSection title="Configurações Técnicas" icon={Settings}>
              {/* CHAPAS E DOBRAS */}
              {(tipoProduto.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Espessura da Chapa (Bitola)
                    </label>
                    <select
                      value={espessuraChapa}
                      onChange={(e) => setEspessuraChapa(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded p-3 font-mono focus:border-blue-500 outline-none transition-all"
                    >
                      {bitolasChapa.map((bitola) => (
                        <option key={bitola.id} value={bitola.value}>{bitola.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Referência da Medida
                      <Tooltip text="Externa: O desenvolvimento desconta a espessura nas dobras. Interna: O desenvolvimento é a soma exata das abas." />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReferenciaMedida('externa')}
                        className={`flex-1 py-2 px-3 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          referenciaMedida === 'externa'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        Externa
                      </button>
                      <button
                        onClick={() => setReferenciaMedida('interna')}
                        className={`flex-1 py-2 px-3 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          referenciaMedida === 'interna'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        Interna
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* QUADRO BÁSICO */}
              {tipoProduto === 'quadro_simples' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex justify-between items-center">
                      <span className="flex items-center">
                        Quantidade de Grades
                        <Tooltip text="Número de barras verticais internas para preenchimento do quadro." />
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
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Tipo de Montagem
                      <Tooltip text="Reto: barras cortadas em 90°. 45°: barras cortadas em meia-esquadria para acabamento superior." />
                    </label>
                    <div className="flex bg-slate-950 p-1 rounded border border-slate-800">
                      <button
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoMontagem === 'reto' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                        onClick={() => setTipoMontagem('reto')}
                      >
                        Corte Reto (90°)
                      </button>
                      <button
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoMontagem === 'meia-esquadria' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                        onClick={() => setTipoMontagem('meia-esquadria')}
                      >
                        Meia-Esquadria (45°)
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* PORTÕES */}
              {(tipoProduto === 'portao_basculante' || tipoProduto === 'portao_deslizante') && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
                      <span className="flex items-center">
                        Simulação de Abertura
                        <Tooltip text="Ajuste para visualizar como o portão se comporta ao abrir." />
                      </span>
                      <span className="text-blue-400 font-mono">{anguloAberturaGraus}°</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="90" 
                      step="1" 
                      value={anguloAberturaGraus} 
                      onChange={(e) => setAnguloAberturaGraus(Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
                      <span className="flex items-center">
                        Quantidade de Palitos
                        <Tooltip text="Número de barras de preenchimento da folha do portão." />
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
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </>
              )}

              {/* COBERTURA / PERGOLADO / GALPÃO / TESOURA */}
              {(tipoProduto === 'cobertura_pergolado' || isGalpao || tipoProduto === 'tesoura') && (
                <>
                  {(tipoProduto === 'cobertura_pergolado' || isGalpao) && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
                        <span className="flex items-center">
                          Inclinação (%)
                          <Tooltip text="Inclinação para escoamento de água. Recomendado 10% para telhas e 5% para vidro/policarbonato." />
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
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      {isGalpao && (
                        <div className="mt-2 space-y-2">
                          <div className="text-[10px] font-medium px-2 py-1 rounded border text-blue-400 bg-blue-500/10 border-blue-500/30 flex justify-between items-center">
                            <span>Altura da Tesoura:</span>
                            <span className="font-bold font-mono">{Math.round((largura / 2) * (inclinacaoPercentual / 100))} mm</span>
                          </div>
                          
                          {tipoProduto === 'galpao_tesoura_personalizada' && (
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Definir Altura Exata da Tesoura (mm)</label>
                              <input 
                                type="number" 
                                value={Math.round((largura / 2) * (inclinacaoPercentual / 100))} 
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
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        Tipo de Telhado
                        <Tooltip text="Uma Água: inclinação única. Invertido: inclinação para o centro (borboleta)." />
                      </label>
                      <div className="flex bg-slate-950 p-1 rounded border border-slate-800">
                        <button
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoTelhado === 'uma_agua' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                          onClick={() => setTipoTelhado('uma_agua')}
                        >
                          Uma Água
                        </button>
                        <button
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${tipoTelhado === 'invertido' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                          onClick={() => setTipoTelhado('invertido')}
                        >
                          Invertido
                        </button>
                      </div>
                    </div>
                  )}

                  {(isGalpao || tipoProduto === 'tesoura') && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        Modelo de Tesoura
                        <Tooltip 
                          title={tesourasDB.find(t => t.id === tipoTesouraId)?.nome || "Modelo de Tesoura"}
                          text={tesourasDB.find(t => t.id === tipoTesouraId)?.descricao || "Escolha um modelo de tesoura estrutural."} 
                        />
                      </label>
                      <select
                        value={tipoTesouraId}
                        onChange={(e) => setTipoTesouraId(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded text-sm font-mono text-white focus:border-blue-500 outline-none transition-all"
                      >
                        {tesourasDB.map((tesoura) => (
                          <option key={tesoura.id} value={tesoura.id}>{tesoura.nome}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-500 italic mt-1 uppercase tracking-wider">
                        {tesourasDB.find(t => t.id === tipoTesouraId)?.descricao}
                      </p>
                      {tipoProduto === 'galpao_tesoura_personalizada' && (
                        <button
                          onClick={() => handleTipoProdutoChange('tesoura')}
                          className="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700"
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
                      value={Math.round(altura + (largura / 2) * (inclinacaoPercentual / 100))} 
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Quantidade de Terças {isGalpao ? '(por água)' : ''}
                      <Tooltip text="Barras horizontais que sustentam a cobertura. Mais terças aumentam a resistência mas também o custo." />
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
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        Colunas Extras
                        <Tooltip text="Colunas adicionais para vãos muito grandes. O sistema sugere automaticamente a cada 3.5m." />
                      </label>
                      <button 
                        onClick={() => setAutoColunas(!autoColunas)}
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors ${autoColunas ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}
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
                      <Tooltip text="Inclui corrimão e montantes de segurança na escada." />
                    </label>
                  </div>

                  {temGuardaCorpo && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        Lados do Guarda-Corpo
                        <Tooltip text="Escolha em quais lados da escada o guarda-corpo será instalado." />
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
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                          Direção da Curva
                          <Tooltip text="Sentido da curva no patamar (visto de baixo para cima)." />
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${direcaoCurva === 'esquerda' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setDirecaoCurva('esquerda')}
                          >
                            Esquerda
                          </button>
                          <button
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${direcaoCurva === 'direita' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    {isCobertura ? 'Perfil dos Pilares' : (tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada') ? 'Perfil dos Banzos (Superior/Inferior)' : 'Perfil Principal'}
                    <Tooltip text="Selecione o perfil metálico principal da estrutura." />
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

              {/* CONFIGURAÇÕES DE PORTÃO DESLIZANTE */}
              {tipoProduto === 'portao_deslizante' && (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil do Trilho
                      <Tooltip text="Selecione o perfil metálico para o trilho inferior." />
                    </label>
                    <select
                      value={perfilTrilhoId}
                      onChange={(e) => setPerfilTrilhoId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisDB.filter(p => p.nome.toLowerCase().includes('redondo maciço') || p.nome.toLowerCase().includes('trilho')).map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil da Guia Superior
                      <Tooltip text="Selecione o perfil metálico para a guia superior." />
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil do Batente
                      <Tooltip text="Selecione o perfil metálico para o batente." />
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil das Colunas
                      <Tooltip text="Selecione o perfil metálico para as colunas de sustentação." />
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
                      Incluir Portão de Pedestre
                    </label>
                  </div>
                </>
              )}

              {/* CONFIGURAÇÕES DE TESOURA (MONTANTES E DIAGONAIS) */}
              {(tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada') && (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil Interno (Montantes)
                      <Tooltip text="Selecione o perfil metálico para os montantes verticais (interno) da tesoura." />
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil Interno (Diagonais)
                      <Tooltip text="Selecione o perfil metálico para as diagonais (interno) da tesoura." />
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                  Tipo de Entrega / Acabamento Final
                  <Tooltip text="Escolha se deseja apenas as peças cortadas, a estrutura montada sem pintura ou o produto final completo." />
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'pecas', label: 'Somente Peças (Kit para Montar)', icon: Package, desc: 'Peças cortadas e identificadas' },
                    { id: 'montado_sem_pintura', label: 'Montado sem Pintura', icon: Hammer, desc: 'Estrutura soldada em aço bruto' },
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
                      <div className={`p-2 rounded-lg ${tipoEntrega === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
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
                {!(tipoProduto?.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                    <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Layers size={14} />
                      Cores por Componente (Padrão ABNT)
                    </h4>
                    <p className="text-[10px] text-indigo-600 leading-tight">
                      Defina cores específicas para cada parte da estrutura para facilitar a identificação visual e montagem.
                    </p>
                  </div>
                )}

                {/* Cores Específicas por Produto - Agora Automáticas */}
                {!(tipoProduto?.startsWith('chapa_') || tipoProduto === 'perfil_u_enrijecido' || tipoProduto === 'bandeja_metalica') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-white" style={{ backgroundColor: systemColors.banzo }} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Banzo / Principal</p>
                        <p className="text-xs font-bold text-slate-700">Azul (Padrão)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-white" style={{ backgroundColor: systemColors.montante }} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Montantes</p>
                        <p className="text-xs font-bold text-slate-700">Verde Escuro (Padrão)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-white" style={{ backgroundColor: systemColors.diagonal }} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Diagonais</p>
                        <p className="text-xs font-bold text-slate-700">Verde (Padrão)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-white" style={{ backgroundColor: systemColors.terca }} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Terças</p>
                        <p className="text-xs font-bold text-slate-700">Amarelo (Padrão)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-white" style={{ backgroundColor: systemColors.coluna }} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Colunas</p>
                        <p className="text-xs font-bold text-slate-700">Vermelho (Padrão)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-white" style={{ backgroundColor: systemColors.viga }} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Vigas</p>
                        <p className="text-xs font-bold text-slate-700">Laranja (Padrão)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-200 my-6" />
              {/* PERFIL PRINCIPAL / BANZOS */}
              {!tipoProduto.startsWith('chapa_') && tipoProduto !== 'perfil_u_enrijecido' && tipoProduto !== 'bandeja_metalica' && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    {isCobertura ? 'Perfil dos Pilares' : (tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada') ? 'Perfil dos Banzos (Superior/Inferior)' : 'Perfil Principal'}
                    <Tooltip text="Selecione o perfil metálico principal da estrutura." />
                  </label>
                  <select
                    value={isCobertura ? perfilColunaId : perfilSelecionadoId}
                    onChange={(e) => isCobertura ? setPerfilColunaId(e.target.value) : setPerfilSelecionadoId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {(tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada' || tipoProduto === 'galpao') ? (
                      perfisViga.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))
                    ) : (
                      perfisQuadro.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* CONFIGURAÇÕES DE TESOURA (MONTANTES E DIAGONAIS) */}
              {(tipoProduto === 'tesoura' || tipoProduto === 'galpao_tesoura_personalizada') && (
                <>
                  {tipoProduto === 'tesoura' && (
                    <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white">
                          <Warehouse size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-indigo-900">Transformar em Galpão Pro 1</h4>
                          <p className="text-[10px] text-indigo-600 font-medium">Crie uma estrutura completa mantendo esta tesoura.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTipoProdutoChange('galpao_tesoura_personalizada' as any)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Gerar Galpão Pro 1
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil Interno (Montantes)
                      <Tooltip text="Selecione o perfil metálico para os montantes verticais (interno) da tesoura." />
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil Interno (Diagonais)
                      <Tooltip text="Selecione o perfil metálico para as diagonais (interno) da tesoura." />
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

                  {/* CORES DA TESOURA - Automáticas */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cor Banzos</label>
                      <div className="w-full h-8 rounded-lg border border-slate-200" style={{ backgroundColor: systemColors.banzo }} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cor Montantes</label>
                      <div className="w-full h-8 rounded-lg border border-slate-200" style={{ backgroundColor: systemColors.montante }} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cor Diagonais</label>
                      <div className="w-full h-8 rounded-lg border border-slate-200" style={{ backgroundColor: systemColors.diagonal }} />
                    </div>
                  </div>
                </>
              )}

              {/* CONFIGURAÇÕES DE GALPÃO (COLUNAS E TERÇAS) */}
              {isGalpao && (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil das Colunas
                      <Tooltip text="Selecione o perfil metálico para os pilares de sustentação do galpão." />
                    </label>
                    <select
                      value={perfilColunaId}
                      onChange={(e) => setPerfilColunaId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisColuna.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Perfil das Terças
                      <Tooltip text="Selecione o perfil metálico para as terças de cobertura." />
                    </label>
                    <select
                      value={perfilTercaId}
                      onChange={(e) => setPerfilTercaId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {perfisTerca.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* COBERTURA */}
              {(tipoProduto === 'cobertura_pergolado' || isGalpao) && (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                      Material da Cobertura
                      <Tooltip text="Escolha o material que irá cobrir a estrutura. Isso afeta o custo e o peso total." />
                    </label>
                    <select
                      value={materialCobertura}
                      onChange={(e) => setMaterialCobertura(e.target.value as any)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="vidro">Vidro Temperado 8mm</option>
                      <option value="policarbonato">Policarbonato Alveolar</option>
                      <option value="telha">Telhas Metálicas</option>
                      <option value="vazio">Sem Cobertura (Vazio)</option>
                    </select>
                  </div>

                  {materialCobertura === 'telha' && (
                    <div className="flex flex-col gap-2 mt-4">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        Modelo da Telha
                        <Tooltip text="Diferentes modelos de telhas possuem larguras úteis e preços variados." />
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

              {(tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    Material Base
                    <Tooltip text="Escolha o material da chapa metálica." />
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    Cor da Pintura / Acabamento
                    <Tooltip text="Escolha a cor e o tipo de acabamento da estrutura metálica." />
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    Método de Fixação
                    <Tooltip text="Sapata: base metálica parafusada no piso. Chumbado: pilar enterrado ou fixado com concreto." />
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
                      <p className="text-[10px] text-red-700 leading-relaxed font-medium">O vão livre excede 4.5m sem reforço. Adicione colunas extras.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Botões de Navegação */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
            <button
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeStep === 0 
                  ? 'text-slate-300 cursor-not-allowed' 
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
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95'
              }`}
            >
              Próximo
              <ChevronDown className="-rotate-90" size={16} />
            </button>
          </div>
        </div>

        {/* RELATÓRIO DE PRODUÇÃO */}
        <div className="bg-slate-900 rounded-xl p-3 shadow-lg border border-slate-800 mt-2">
          <button 
            onClick={() => setIsReportExpanded(!isReportExpanded)}
            className="flex items-center justify-between w-full gap-2 mb-2"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-indigo-500/20 rounded-lg">
                <FileText className="text-indigo-400" size={14} />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Relatório de Produção</h3>
            </div>
            <div className="text-slate-400">
              {isReportExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {isReportExpanded && (
            <>
              <div className="mb-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-400">Peso Estimado:</span>
                  <span className="text-xs font-bold text-indigo-400">{pesoFinal.toFixed(2)} Kg</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-400">Custo Material:</span>
                  <span className="text-xs font-bold text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoFinal)}
                  </span>
                </div>
                <div className="pt-1 border-t border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Valor Sugerido:</span>
                    <span className="text-sm font-black text-emerald-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoTotal)}
                    </span>
                  </div>
                </div>
              </div>
              
              <ul className="space-y-1 text-[10px] text-slate-300">
                <li className="flex justify-between items-center py-0.5 border-b border-slate-800">
                  <span className="text-slate-500 font-medium">Produto:</span>
                  <span className="font-bold text-white">{tipoProduto.replace('_', ' ').toUpperCase()}</span>
                </li>
                <li className="flex justify-between items-center py-0.5 border-b border-slate-800">
                  <span className="text-slate-500 font-medium">Acabamento:</span>
                  <span className="font-bold text-indigo-400">
                    {tipoEntrega === 'pecas' ? 'SOMENTE PEÇAS' : 
                     tipoEntrega === 'montado_sem_pintura' ? 'MONTADO (BRUTO)' : 
                     'MONTADO E PINTADO'}
                  </span>
                </li>
            
            {tipoProduto === 'quadro_simples' && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Barras Horizontais:</span>
                  <span className="font-mono font-bold text-white">2x {largura} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Barras Verticais:</span>
                  <span className="font-mono font-bold text-white">2x {alturaGrade} mm</span>
                </li>
                {quantidadeGrades > 0 && (
                  <li className="flex justify-between items-center">
                    <span className="text-slate-500">Grades Internas:</span>
                    <span className="font-mono font-bold text-white">{quantidadeGrades}x {alturaGrade} mm</span>
                  </li>
                )}
              </>
            )}

            {(tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Qtd. de Degraus:</span>
                  <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{numDegraus} un.</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Altura do Espelho:</span>
                  <span className="font-mono font-bold text-white">{espelho.toFixed(1)} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Pisada:</span>
                  <span className="font-mono font-bold text-white">{pisada} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Vigas Laterais:</span>
                  <span className="font-mono font-bold text-white">2x {hipotenusa.toFixed(1)} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Ângulo de Corte:</span>
                  <span className="font-mono font-bold text-white">{(angulo * 180 / Math.PI).toFixed(1)}°</span>
                </li>
                {temGuardaCorpo && (
                  <li className="flex justify-between items-center pt-2 border-t border-slate-800 text-blue-300">
                    <span className="font-bold uppercase text-[9px]">Guarda-Corpo:</span>
                    <span className="font-mono font-bold">{(materialGuardaCorpoMM / 1000).toFixed(2)} m</span>
                  </li>
                )}
              </>
            )}
            
            {tipoProduto === 'cobertura_pergolado' && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Terças:</span>
                  <span className="font-mono font-bold text-white">{qtdTercas}x {largura} mm</span>
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
                    <span className="text-slate-500">Área Cobertura:</span>
                    <span className="font-mono font-bold text-white">{areaCobertura.toFixed(2)} m²</span>
                  </li>
                )}
              </>
            )}

            {tipoProduto === 'tesoura' && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Modelo:</span>
                  <span className="font-mono font-bold text-white uppercase">{tipoTesouraId}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Largura (Vão):</span>
                  <span className="font-mono font-bold text-white">{largura} mm</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Altura:</span>
                  <span className="font-mono font-bold text-white">{altura} mm</span>
                </li>
                <li className="flex justify-between items-center text-blue-300 italic text-[9px]">
                  <span>* Inclui chapas de reforço (gussets) em todos os nós.</span>
                </li>
              </>
            )}

            {isGalpao && (
              <>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Tesouras (Perfil Duplo U):</span>
                  <span className="font-mono font-bold text-white">{Math.ceil(profundidade / 4000) + 1} un.</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500">Terças (Total):</span>
                  <span className="font-mono font-bold text-white">{qtdTercasCalculada * 2}x {profundidade} mm</span>
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
              <li className="flex justify-between items-center py-2 border-y border-slate-800">
                <span className="text-slate-500">Vão Livre (Tubos):</span>
                <span className="font-mono font-bold text-blue-400">{vaoLivreCalculadoEmMM.toFixed(1)} mm</span>
              </li>
            )}

            <li className="flex justify-between items-center pt-3 mt-1 border-t border-slate-700">
              <span className="text-white font-bold uppercase text-[10px]">Material Total:</span>
              <span className="text-xl font-mono font-black text-blue-400">{materialTotalMetros.toFixed(2)}m</span>
            </li>
          </ul>

          <div className="grid grid-cols-1 gap-3 mt-6">
            <button
              onClick={handleGerarPDF}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest rounded border border-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95"
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
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded border border-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Share2 size={18} />
              {isSaving ? 'Gerando...' : 'Compartilhar Projeto'}
            </button>
            <button
              onClick={handleAdicionarAoCarrinho}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 border border-blue-500"
            >
              <Check size={18} />
              🛒 Adicionar ao Orçamento
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
              className="mb-4 text-white hover:text-slate-300 font-bold"
            >
              Fechar
            </button>
            <PropostaComercial projectSummary={project} />
          </div>
        </div>
      )}
      </div>
      </div>
  );
};
