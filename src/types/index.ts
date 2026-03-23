export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface Bend {
  id: string;
  angle: number;
  internalMeasure: boolean;
  externalDimension: number;
  internalDimension: number; // Calculated: externalDimension - thickness if internalMeasure is false
  thickness: number;
  description?: string;
}

export interface Weld {
  id: string;
  type: 'mig' | 'tig' | 'electrode';
  position: { x: number; y: number; z: number };
  targetId?: string; // ID of the component it's welding to
  connectionDetails?: string; // e.g., "3 pontos de intersecção, mais 1m de solda ponteada contínua"
  length?: number; // Length of weld in mm
  points?: number; // Number of spot welds
  description?: string;
}

export interface Component {
  id: string;
  name: string;
  width: number;
  height: number;
  quantity: number;
  material?: string;
  thickness?: number; // Added thickness for bending calculations
  description?: string;
  code?: string;
  color?: string;
  substitutes?: string[];
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  type?: 'L-Shape' | 'U-Profile' | 'Flat' | 'Trapezoid' | 'Bent' | 'RoundTube' | 'SquareTube' | 'RectangularTube' | 'Profile' | 'Hinge' | 'Parametric' | 'I-Beam' | 'C-Profile' | 'RoundBar' | 'RoundSolid' | 'Corrugated';
  cutType?: 'straight' | 'miter-start' | 'miter-end' | 'miter-both';
  miterAxis?: 'x' | 'y';
  invertCuts?: boolean;
  welds?: Weld[];
  bends?: Bend[]; // Added bends array
  details?: any;
}

export interface PlacedComponent extends Component {
  x: number;
  y: number;
  sheetIndex: number;
  rotated: boolean;
}

export interface Sheet {
  width: number;
  height: number;
  components: PlacedComponent[];
  usedArea: number;
}

export interface ProcessParameters {
  cuttingMethod: 'guillotine' | 'chop-saw';
  weldingType: 'mig' | 'tig' | 'electrode';
  weldingIntensity: 'low' | 'medium' | 'high';
  surfaceFinish: 'raw' | 'painted' | 'galvanized';
}

export interface LinearCut {
  id: number;
  pos: number; // Position of the cut on the bar
  description: string;
}

export interface Bar {
  id: string;
  length: number; // Total length (e.g., 6000mm)
  material: string; // e.g., "Tubo Quadrado 30x30mm"
  parts: {
    id: string;
    name: string;
    length: number;
    quantity: number;
    originalComponent?: Component;
  }[];
  cuts: LinearCut[];
  leftover: number;
}

export interface WeldConnectionLink {
  targetPartId: string;
  sourcePoint: 'L1' | 'L2' | 'L3' | 'L4' | 'R1' | 'R2' | 'R3' | 'R4';
  targetPoint: 'L1' | 'L2' | 'L3' | 'L4' | 'R1' | 'R2' | 'R3' | 'R4';
  type: 'point' | 'bead' | 'tack';
}

export interface WeldConnection {
  partId: string;
  points: {
    L1?: 'point' | 'bead' | 'tack';
    L2?: 'point' | 'bead' | 'tack';
    L3?: 'point' | 'bead' | 'tack';
    L4?: 'point' | 'bead' | 'tack';
    R1?: 'point' | 'bead' | 'tack';
    R2?: 'point' | 'bead' | 'tack';
    R3?: 'point' | 'bead' | 'tack';
    R4?: 'point' | 'bead' | 'tack';
  };
  links: WeldConnectionLink[];
}

export interface ProjectState {
  id: string;
  name: string;
  version: number;
  dimensions: Dimensions;
  material: string;
  components: Component[];
  processParameters: ProcessParameters;
  cutPlan?: Sheet[];
  linearCutPlan?: Bar[]; // Added linear cut plan
  weldConfig?: any;
  weldConnections?: WeldConnection[];
  tipoProduto?: string;
  fixacao?: 'chumbado' | 'sapata_parafuso';
  perfilTercaId?: string;
  perfilColunaId?: string;
  perfilVigaId?: string;
  perfilDiagonalId?: string;
  perfilTrilhoId?: string;
  perfilGuiaId?: string;
  perfilBatenteId?: string;
  perfilColunaPortaoId?: string;
  perfilQuadroId?: string;
  perfilCaixaId?: string;
  perfilTravessaId?: string;
  perfilBracoId?: string;
  perfilMontanteId?: string;
  perfilGradeId?: string;
  incluirPortaoPedestre?: boolean;
  qtdColunasExtras?: number;
  inclinacaoPercentual?: number;
  tipoTesouraId?: string; // Adicionado
  tipoTelhado?: 'uma_agua' | 'duas_aguas' | 'invertido';
  tipoChegada?: 'Abaixo' | 'Nivelado';
  colorBanzo?: string;
  colorMontante?: string;
  colorDiagonal?: string;
  colorTerca?: string;
  colorColuna?: string;
  colorViga?: string;
  colorFechamento?: string;
  materialCobertura?: 'vidro' | 'policarbonato' | 'telha' | 'vazio';
  materialCoberturaRampa?: string;
  perfilQuadroRampaId?: string;
  telhaSelecionadaId?: string;
  qtdTercas?: number;
  acabamento?: string;
  mostrarCotas?: boolean;
  mostrarNodes?: boolean;
  explodedFactor?: number;
  quantidadeGrades?: number;
  tipoMontagem?: 'reto' | 'meia-esquadria';
  tipoEntrega?: 'pecas' | 'montado_sem_pintura' | 'montado_com_pintura';
  espessuraChapa?: number;
  abaExtra?: number;
  referenciaMedida?: 'interna' | 'externa';
  temPintura?: boolean;
  anguloAberturaGraus?: number;
  alturaPatamar?: number;
  direcaoCurva?: 'esquerda' | 'direita';
  temGuardaCorpo?: boolean;
  ladoGuardaCorpo?: 'esquerdo' | 'direito' | 'ambos';
  materialDegrau?: string;
  autoColunas?: boolean;
  lastModified: number;
  message?: string;
  serviceDescription?: string; // Detailed manufacturing roadmap and technical notes
  prints?: string[];
  consumables?: { name: string; quantity: number; unit: string }[];
  ncm?: string;
  cfop?: string;
  taxStatus?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  tipo: 'PF' | 'PJ' | 'GOV';
  documento: string; // CPF or CNPJ or UASG
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento?: string;
  orgao?: string; // For GOV
  razaoSocial?: string; // For PJ
  inscricaoEstadual?: string; // For PJ
  endereco?: string; // Legacy/Full address string
  funnelStage?: 'Prospecção' | 'Qualificação' | 'Apresentação' | 'Negociação' | 'Fechamento' | 'Pós-venda';
  dores?: string[];
  mensagens?: ChatMessage[];
}

export interface Proposta {
  id: string;
  clienteId: string;
  clienteNome?: string;
  items: any[];
  total: number;
  status: 'Em Negociação' | 'Proposta Enviada' | 'Ganha' | 'Perdida' | 'Aprovada/Produção' | 'Rascunho';
  data: string;
}

export interface OrdemServico {
  id: string;
  propostaId: string;
  clienteNome: string;
  itens: any[];
  dataEntrega: string;
  status: 'Fila de Produção' | 'Corte e Dobra' | 'Solda e Montagem' | 'Pintura e Acabamento' | 'Expedição/Pronto';
}

export interface Receita {
  id: string;
  propostaId: string;
  valor: number;
  status: 'Pendente' | 'Recebido';
  data: string;
}

export interface TransacaoFinanceira {
  id: string;
  tipo: 'RECEITA' | 'DESPESA';
  descricao: string;
  valor: number;
  dataVencimento: string;
  status: 'PENDENTE' | 'PAGO';
  origem: string;
}

export interface Faturamento {
  id: string;
  propostaId: string;
  chaveNFe?: string;
  status: 'Aguardando' | 'Emitida' | 'Erro';
}
