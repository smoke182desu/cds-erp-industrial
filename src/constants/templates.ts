import { ProjectState, Component } from '../types';

export type ProjectCategory = 
  | 'Estruturas Metálicas e Coberturas'
  | 'Segurança e Fechamento de Áreas'
  | 'Estruturas Arquitetônicas e Acessos'
  | 'Esquadrias de Aço'
  | 'Mobiliário e Serralheria Artística'
  | 'Utilidades Domésticas e Urbanas';

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'Estruturas Metálicas e Coberturas',
  'Segurança e Fechamento de Áreas',
  'Estruturas Arquitetônicas e Acessos',
  'Esquadrias de Aço',
  'Mobiliário e Serralheria Artística',
  'Utilidades Domésticas e Urbanas'
];

export interface Template {
  id: string;
  name: string;
  description: string;
  category: ProjectCategory;
  icon: string; // Lucide icon name
  project: Partial<ProjectState>;
}

export const PROJECT_TEMPLATES: Template[] = [
  // 1. Estruturas Metálicas e Coberturas
  {
    id: 'galpao-pro-1',
    name: 'Galpão Pro 1',
    description: 'Galpão estruturado com tesouras personalizadas de alta performance.',
    category: 'Estruturas Metálicas e Coberturas',
    icon: 'Hammer',
    project: {
      name: 'Galpão Pro 1',
      tipoProduto: 'galpao_tesoura_personalizada',
      dimensions: { width: 12000, height: 6000, depth: 30000 },
      inclinacaoPercentual: 20,
      material: 'viga-i-w200',
      tipoTesouraId: 'howe',
      perfilColunaId: 'viga-i-w200',
      perfilVigaId: 'perfil_u_enrijecido_150x60',
      perfilTercaId: 'perfil_u_enrijecido_100x40',
      qtdTercas: 12,
      qtdColunasExtras: 6,
      components: []
    }
  },
  {
    id: 'shed-simple',
    name: 'Galpão Simples (Gaiola)',
    description: 'Estrutura básica de galpão com pórticos e terças.',
    category: 'Estruturas Metálicas e Coberturas',
    icon: 'Warehouse',
    project: {
      name: 'Galpão 10x20m',
      tipoProduto: 'galpao',
      dimensions: { width: 10000, height: 6000, depth: 20000 },
      inclinacaoPercentual: 15,
      material: 'viga-i',
      components: [
        // Pórticos
        { id: 'p1-col-l', name: 'Pilar P1 Esq', type: 'I-Beam', width: 200, height: 6000, quantity: 1, thickness: 6, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Viga I W200' },
        { id: 'p1-col-r', name: 'Pilar P1 Dir', type: 'I-Beam', width: 200, height: 6000, quantity: 1, thickness: 6, position: { x: 9800, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Viga I W200' },
        { id: 'purlin-1', name: 'Terça 1', type: 'C-Profile', width: 100, height: 20000, quantity: 1, thickness: 2, position: { x: 2000, y: 6500, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Perfil C 100x40' },
        { id: 'brace-1', name: 'Contraventamento', type: 'RoundBar', width: 16, height: 5000, quantity: 1, thickness: 0, position: { x: 0, y: 3000, z: 5000 }, rotation: { x: 0.5, y: 0, z: 0 }, material: 'Barra Redonda 5/8"' },
        { id: 'base-plate-1', name: 'Chapa Base', type: 'Flat', width: 300, height: 300, quantity: 4, thickness: 12, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Chapa A36 1/2"' },
      ]
    }
  },
  {
    id: 'shed-small',
    name: 'Pequeno Galpão',
    description: 'Galpão compacto com estrutura metálica, ideal para pequenas oficinas ou depósitos.',
    category: 'Estruturas Metálicas e Coberturas',
    icon: 'Warehouse',
    project: {
      name: 'Pequeno Galpão 6x10m',
      tipoProduto: 'galpao',
      dimensions: { width: 6000, height: 4000, depth: 10000 },
      inclinacaoPercentual: 10,
      material: 'tubo-100x100',
      components: [
        // Pilares (Tubo 100x100)
        { id: 'col-1', name: 'Pilar 1', type: 'SquareTube', width: 100, height: 4000, quantity: 1, thickness: 3, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        { id: 'col-2', name: 'Pilar 2', type: 'SquareTube', width: 100, height: 4000, quantity: 1, thickness: 3, position: { x: 5900, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        { id: 'col-3', name: 'Pilar 3', type: 'SquareTube', width: 100, height: 4000, quantity: 1, thickness: 3, position: { x: 0, y: 0, z: 9900 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        { id: 'col-4', name: 'Pilar 4', type: 'SquareTube', width: 100, height: 4000, quantity: 1, thickness: 3, position: { x: 5900, y: 0, z: 9900 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        
        // Terças (Perfil U 4")
        { id: 'purlin-1', name: 'Terça 1', type: 'U-Profile', width: 100, height: 10000, quantity: 1, thickness: 3, position: { x: 1500, y: 4500, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Perfil U 4"' },
        { id: 'purlin-2', name: 'Terça 2', type: 'U-Profile', width: 100, height: 10000, quantity: 1, thickness: 3, position: { x: 4500, y: 4500, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Perfil U 4"' },
        
        // Chapa Base
        { id: 'base-plate-1', name: 'Chapa Base', type: 'Flat', width: 200, height: 200, quantity: 4, thickness: 10, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Chapa A36 3/8"' },
      ]
    }
  },

  {
    id: 'truss-fink',
    name: 'Tesoura Fink',
    description: 'Tesoura tipo Fink, ideal para telhados residenciais e comerciais leves.',
    category: 'Estruturas Metálicas e Coberturas',
    icon: 'Triangle',
    project: {
      name: 'Tesoura Fink 10m',
      tipoProduto: 'tesoura',
      tipoTesouraId: 'fink',
      dimensions: { width: 10000, height: 1000, depth: 100 },
      material: 'cantoneira',
      components: []
    }
  },
  {
    id: 'truss-howe',
    name: 'Tesoura Howe',
    description: 'Tesoura tipo Howe, com montantes tracionados e diagonais comprimidas.',
    category: 'Estruturas Metálicas e Coberturas',
    icon: 'Triangle',
    project: {
      name: 'Tesoura Howe 12m',
      tipoProduto: 'tesoura',
      tipoTesouraId: 'howe',
      dimensions: { width: 12000, height: 1200, depth: 100 },
      material: 'cantoneira',
      components: []
    }
  },
  {
    id: 'truss-pratt',
    name: 'Tesoura Pratt',
    description: 'Tesoura tipo Pratt, com montantes comprimidos e diagonais tracionadas.',
    category: 'Estruturas Metálicas e Coberturas',
    icon: 'Triangle',
    project: {
      name: 'Tesoura Pratt 15m',
      tipoProduto: 'tesoura',
      tipoTesouraId: 'pratt',
      dimensions: { width: 15000, height: 1500, depth: 100 },
      material: 'cantoneira',
      components: []
    }
  },
  // 2. Segurança e Fechamento de Áreas
  {
    id: 'gate-sliding',
    name: 'Portão de Correr',
    description: 'Portão deslizante com estrutura tubular e fechamento em chapa.',
    category: 'Segurança e Fechamento de Áreas',
    icon: 'DoorOpen',
    project: {
      name: 'Portão Deslizante 3x2.2m',
      tipoProduto: 'portao_deslizante',
      dimensions: { width: 3000, height: 2200, depth: 50 },
      material: 'tubo-50x30',
      components: [
        { id: 'frame-top', name: 'Quadro Sup', type: 'RectangularTube', width: 30, height: 3000, quantity: 1, thickness: 1.5, position: { x: 0, y: 2150, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Tubo 50x30' },
        { id: 'frame-bot', name: 'Quadro Inf', type: 'RectangularTube', width: 30, height: 3000, quantity: 1, thickness: 1.5, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Tubo 50x30' },
        { id: 'frame-left', name: 'Quadro Esq', type: 'RectangularTube', width: 30, height: 2200, quantity: 1, thickness: 1.5, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 50x30' },
        { id: 'frame-right', name: 'Quadro Dir', type: 'RectangularTube', width: 30, height: 2200, quantity: 1, thickness: 1.5, position: { x: 2950, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 50x30' },
        
        // Novos componentes
        { id: 'roller-1', name: 'Roldana', type: 'RoundTube', width: 50, height: 50, quantity: 2, thickness: 0, position: { x: 100, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Roldana 2"' },
        { id: 'guide-1', name: 'Guia Superior', type: 'Flat', width: 50, height: 200, quantity: 1, thickness: 4, position: { x: 1500, y: 2200, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 2"' },
        { id: 'lock-1', name: 'Fechadura', type: 'Flat', width: 50, height: 100, quantity: 1, thickness: 2, position: { x: 2900, y: 1100, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Fechadura Aço' },
      ]
    }
  },
  {
    id: 'fence-panel',
    name: 'Painel de Grade',
    description: 'Módulo de grade para muros ou cercamentos.',
    category: 'Segurança e Fechamento de Áreas',
    icon: 'Fence',
    project: {
      name: 'Grade 2x1m',
      tipoProduto: 'quadro_simples',
      dimensions: { width: 2000, height: 1000, depth: 30 },
      material: 'ferro-chato',
      components: [
        { id: 'bar-top', name: 'Barra Sup', type: 'Flat', width: 2000, height: 30, quantity: 1, thickness: 4, position: { x: 0, y: 970, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Barra Chata 1.1/4"' },
        { id: 'bar-bot', name: 'Barra Inf', type: 'Flat', width: 2000, height: 30, quantity: 1, thickness: 4, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Barra Chata 1.1/4"' },
        { id: 'vert-1', name: 'Vertical 1', type: 'RoundTube', width: 15, height: 1000, quantity: 1, thickness: 1.5, position: { x: 100, y: 0, z: 7.5 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 5/8"' },
        
        // Novos componentes
        { id: 'post-1', name: 'Poste', type: 'SquareTube', width: 50, height: 1200, quantity: 2, thickness: 2, position: { x: -50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 50x50' },
        { id: 'fastener-1', name: 'Parafuso', type: 'Flat', width: 10, height: 10, quantity: 8, thickness: 0, position: { x: 0, y: 100, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Parafuso 1/2"' },
      ]
    }
  },

  // 3. Estruturas Arquitetônicas e Acessos
  {
    id: 'stair-straight',
    name: 'Escada Reta',
    description: 'Escada metálica com viga central e degraus em chapa xadrez.',
    category: 'Estruturas Arquitetônicas e Acessos',
    icon: 'TrendingUp',
    project: {
      name: 'Escada Reta 15 Degraus',
      tipoProduto: 'escada_reta',
      dimensions: { width: 900, height: 2800, depth: 4000 },
      material: 'viga-u',
      components: [
        { id: 'stringer-l', name: 'Viga Lateral Esq', type: 'U-Profile', width: 200, height: 4500, quantity: 1, thickness: 4, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0.6, y: 0, z: 0 }, material: 'Viga U 8"' },
        { id: 'stringer-r', name: 'Viga Lateral Dir', type: 'U-Profile', width: 200, height: 4500, quantity: 1, thickness: 4, position: { x: 850, y: 0, z: 0 }, rotation: { x: 0.6, y: 0, z: 0 }, material: 'Viga U 8"' },
        { id: 'step-1', name: 'Degrau 1', type: 'Flat', width: 850, height: 280, quantity: 1, thickness: 3, position: { x: 25, y: 180, z: 250 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Chapa Xadrez' },
        
        // Novos componentes
        { id: 'handrail-1', name: 'Corrimão', type: 'RoundTube', width: 30, height: 4000, quantity: 2, thickness: 2, position: { x: 0, y: 1000, z: 0 }, rotation: { x: 0.6, y: 0, z: 0 }, material: 'Tubo 1.1/4"' },
        { id: 'base-plate-stair', name: 'Chapa Base', type: 'Flat', width: 200, height: 200, quantity: 2, thickness: 8, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Chapa A36 5/16"' },
      ]
    }
  },
  {
    id: 'mezzanine',
    name: 'Mezanino',
    description: 'Estrutura de piso elevado com vigas e pilares.',
    category: 'Estruturas Arquitetônicas e Acessos',
    icon: 'Layers',
    project: {
      name: 'Mezanino 5x5m',
      tipoProduto: 'cobertura_pergolado',
      dimensions: { width: 5000, height: 3000, depth: 5000 },
      material: 'viga-i',
      components: [
        { id: 'col-1', name: 'Pilar 1', type: 'SquareTube', width: 100, height: 3000, quantity: 1, thickness: 3, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        { id: 'col-2', name: 'Pilar 2', type: 'SquareTube', width: 100, height: 3000, quantity: 1, thickness: 3, position: { x: 4900, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        { id: 'col-3', name: 'Pilar 3', type: 'SquareTube', width: 100, height: 3000, quantity: 1, thickness: 3, position: { x: 0, y: 0, z: 4900 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        { id: 'col-4', name: 'Pilar 4', type: 'SquareTube', width: 100, height: 3000, quantity: 1, thickness: 3, position: { x: 4900, y: 0, z: 4900 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 100x100' },
        { id: 'beam-main-1', name: 'Viga Mestra 1', type: 'I-Beam', width: 200, height: 5000, quantity: 1, thickness: 6, position: { x: 0, y: 3000, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Viga I W200' },
        
        // Novos componentes
        { id: 'joist-1', name: 'Viga Secundária', type: 'I-Beam', width: 150, height: 5000, quantity: 4, thickness: 5, position: { x: 0, y: 3000, z: 1000 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Viga I W150' },
        { id: 'deck-1', name: 'Piso', type: 'Flat', width: 5000, height: 5000, quantity: 1, thickness: 5, position: { x: 0, y: 3150, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Chapa Xadrez' },
        { id: 'brace-mez', name: 'Contraventamento', type: 'RoundBar', width: 16, height: 2000, quantity: 4, thickness: 0, position: { x: 0, y: 1500, z: 0 }, rotation: { x: 0.7, y: 0, z: 0 }, material: 'Barra Redonda 5/8"' },
      ]
    }
  },

  // 4. Esquadrias de Aço
  {
    id: 'window-frame',
    name: 'Janela Basculante',
    description: 'Estrutura para janela basculante em perfil L.',
    category: 'Esquadrias de Aço',
    icon: 'AppWindow',
    project: {
      name: 'Janela 60x60cm',
      tipoProduto: 'quadro_simples',
      dimensions: { width: 600, height: 600, depth: 40 },
      material: 'cantoneira',
      components: [
        { id: 'frame-top', name: 'Marco Sup', type: 'L-Shape', width: 25, height: 600, quantity: 1, thickness: 3, position: { x: 0, y: 575, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Cantoneira 1"' },
        { id: 'frame-bot', name: 'Marco Inf', type: 'L-Shape', width: 25, height: 600, quantity: 1, thickness: 3, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Cantoneira 1"' },
        { id: 'frame-l', name: 'Marco Esq', type: 'L-Shape', width: 25, height: 600, quantity: 1, thickness: 3, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 1"' },
        { id: 'frame-r', name: 'Marco Dir', type: 'L-Shape', width: 25, height: 600, quantity: 1, thickness: 3, position: { x: 575, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 1"' },
        
        // Novos componentes
        { id: 'hinge-1', name: 'Dobradiça', type: 'Flat', width: 30, height: 50, quantity: 2, thickness: 2, position: { x: 0, y: 300, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Aço Inox' },
        { id: 'latch-1', name: 'Fecho', type: 'Flat', width: 30, height: 50, quantity: 1, thickness: 2, position: { x: 575, y: 300, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Aço Inox' },
      ]
    }
  },

  // 5. Mobiliário e Serralheria Artística
  {
    id: 'shelf-industrial',
    name: 'Estante Industrial',
    description: 'Estante robusta com 4 prateleiras e estrutura em metalon.',
    category: 'Mobiliário e Serralheria Artística',
    icon: 'Library',
    project: {
      name: 'Estante Industrial Padrão',
      tipoProduto: 'quadro_simples',
      dimensions: { width: 1000, height: 2000, depth: 400 },
      material: 'chapa-14',
      components: [
        // 4 Colunas (Pés)
        { id: 'col-1', name: 'Coluna Frontal Esq', type: 'L-Shape', width: 40, height: 2000, quantity: 1, thickness: 2, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 1.1/2"' },
        { id: 'col-2', name: 'Coluna Frontal Dir', type: 'L-Shape', width: 40, height: 2000, quantity: 1, thickness: 2, position: { x: 960, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 1.1/2"' },
        { id: 'col-3', name: 'Coluna Traseira Esq', type: 'L-Shape', width: 40, height: 2000, quantity: 1, thickness: 2, position: { x: 0, y: 0, z: 360 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 1.1/2"' },
        { id: 'col-4', name: 'Coluna Traseira Dir', type: 'L-Shape', width: 40, height: 2000, quantity: 1, thickness: 2, position: { x: 960, y: 0, z: 360 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 1.1/2"' },
        
        // 4 Prateleiras (MDF ou Chapa)
        { id: 'shelf-1', name: 'Prateleira Base', type: 'Flat', width: 1000, height: 400, quantity: 1, thickness: 15, position: { x: 0, y: 100, z: 0 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'MDF 15mm' },
        { id: 'shelf-2', name: 'Prateleira Meio 1', type: 'Flat', width: 1000, height: 400, quantity: 1, thickness: 15, position: { x: 0, y: 700, z: 0 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'MDF 15mm' },
        { id: 'shelf-3', name: 'Prateleira Meio 2', type: 'Flat', width: 1000, height: 400, quantity: 1, thickness: 15, position: { x: 0, y: 1300, z: 0 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'MDF 15mm' },
        { id: 'shelf-4', name: 'Prateleira Topo', type: 'Flat', width: 1000, height: 400, quantity: 1, thickness: 15, position: { x: 0, y: 1900, z: 0 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'MDF 15mm' },
        
        // Novos componentes
        { id: 'brace-shelf', name: 'Contraventamento', type: 'Flat', width: 40, height: 1000, quantity: 2, thickness: 2, position: { x: 0, y: 500, z: 0 }, rotation: { x: 0.8, y: 0, z: 0 }, material: 'Barra Chata 1"' },
        { id: 'fastener-shelf', name: 'Parafuso', type: 'Flat', width: 10, height: 10, quantity: 16, thickness: 0, position: { x: 0, y: 100, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Parafuso 1/4"' },
      ]
    }
  },
  {
    id: 'workbench-heavy',
    name: 'Bancada de Trabalho',
    description: 'Mesa de trabalho pesada com tampo de madeira e estrutura tubular.',
    category: 'Mobiliário e Serralheria Artística',
    icon: 'Hammer',
    project: {
      name: 'Bancada Heavy Duty',
      tipoProduto: 'quadro_simples',
      dimensions: { width: 1500, height: 900, depth: 700 },
      material: 'chapa-12',
      components: [
        // Pés (Tubo Quadrado 50x50)
        { id: 'leg-1', name: 'Pé Frontal Esq', type: 'SquareTube', width: 50, height: 880, quantity: 1, thickness: 2, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 50x50 #14' },
        { id: 'leg-2', name: 'Pé Frontal Dir', type: 'SquareTube', width: 50, height: 880, quantity: 1, thickness: 2, position: { x: 1450, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 50x50 #14' },
        { id: 'leg-3', name: 'Pé Traseiro Esq', type: 'SquareTube', width: 50, height: 880, quantity: 1, thickness: 2, position: { x: 0, y: 0, z: 650 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 50x50 #14' },
        { id: 'leg-4', name: 'Pé Traseiro Dir', type: 'SquareTube', width: 50, height: 880, quantity: 1, thickness: 2, position: { x: 1450, y: 0, z: 650 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 50x50 #14' },

        // Travessas Superiores (Quadro do Tampo)
        { id: 'beam-top-front', name: 'Travessa Sup Frontal', type: 'RectangularTube', width: 30, height: 1400, quantity: 1, thickness: 2, position: { x: 50, y: 850, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Tubo 50x30 #14' },
        { id: 'beam-top-back', name: 'Travessa Sup Traseira', type: 'RectangularTube', width: 30, height: 1400, quantity: 1, thickness: 2, position: { x: 50, y: 850, z: 650 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Tubo 50x30 #14' },
        { id: 'beam-top-left', name: 'Travessa Sup Esq', type: 'RectangularTube', width: 30, height: 600, quantity: 1, thickness: 2, position: { x: 0, y: 850, z: 50 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'Tubo 50x30 #14' },
        { id: 'beam-top-right', name: 'Travessa Sup Dir', type: 'RectangularTube', width: 30, height: 600, quantity: 1, thickness: 2, position: { x: 1450, y: 850, z: 50 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'Tubo 50x30 #14' },

        // Tampo
        { id: 'top', name: 'Tampo de Madeira', type: 'Flat', width: 1500, height: 700, quantity: 1, thickness: 30, position: { x: 0, y: 880, z: 0 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'Painel Teca 30mm' },
        
        // Novos componentes
        { id: 'brace-bench', name: 'Contraventamento', type: 'Flat', width: 40, height: 800, quantity: 2, thickness: 2, position: { x: 0, y: 400, z: 0 }, rotation: { x: 0.7, y: 0, z: 0 }, material: 'Barra Chata 1.1/2"' },
        { id: 'fastener-bench', name: 'Parafuso', type: 'Flat', width: 10, height: 10, quantity: 20, thickness: 0, position: { x: 0, y: 100, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Parafuso 1/2"' },
      ]
    }
  },
  {
    id: 'tool-panel',
    name: 'Painel de Ferramentas',
    description: 'Quadro de parede com chapa perfurada.',
    category: 'Mobiliário e Serralheria Artística',
    icon: 'Grid',
    project: {
      name: 'Painel Perfurado',
      tipoProduto: 'quadro_simples',
      dimensions: { width: 2000, height: 1000, depth: 50 },
      material: 'chapa-14',
      components: [
        // Quadro Externo (Miter Cut)
        { id: 'frame-top', name: 'Quadro Superior', type: 'SquareTube', width: 30, height: 2000, quantity: 1, thickness: 1.5, position: { x: 0, y: 970, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, cutType: 'miter-both', material: 'Tubo 30x30' },
        { id: 'frame-bottom', name: 'Quadro Inferior', type: 'SquareTube', width: 30, height: 2000, quantity: 1, thickness: 1.5, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, cutType: 'miter-both', material: 'Tubo 30x30' },
        { id: 'frame-left', name: 'Quadro Esquerdo', type: 'SquareTube', width: 30, height: 1000, quantity: 1, thickness: 1.5, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, cutType: 'miter-both', material: 'Tubo 30x30' },
        { id: 'frame-right', name: 'Quadro Direito', type: 'SquareTube', width: 30, height: 1000, quantity: 1, thickness: 1.5, position: { x: 1970, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, cutType: 'miter-both', material: 'Tubo 30x30' },

        // Chapa Perfurada
        { id: 'sheet', name: 'Chapa Perfurada', type: 'Flat', width: 1940, height: 940, quantity: 1, thickness: 1, position: { x: 30, y: 30, z: 15 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Chapa Perfurada #20' },
        
        // Novos componentes
        { id: 'mount-1', name: 'Suporte Parede', type: 'Flat', width: 50, height: 50, quantity: 4, thickness: 4, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Cantoneira 1"' },
      ]
    }
  },
  {
    id: 'box-frame',
    name: 'Caixa/Moldura Simples',
    description: 'Estrutura cúbica básica para testes ou bases.',
    category: 'Mobiliário e Serralheria Artística',
    icon: 'Box',
    project: {
      name: 'Cubo Estrutural',
      tipoProduto: 'quadro_simples',
      dimensions: { width: 500, height: 500, depth: 500 },
      material: 'chapa-14',
      components: [
        // 4 Colunas
        { id: 'c1', name: 'Coluna 1', type: 'SquareTube', width: 30, height: 500, quantity: 1, thickness: 1.5, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 30x30' },
        { id: 'c2', name: 'Coluna 2', type: 'SquareTube', width: 30, height: 500, quantity: 1, thickness: 1.5, position: { x: 470, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 30x30' },
        { id: 'c3', name: 'Coluna 3', type: 'SquareTube', width: 30, height: 500, quantity: 1, thickness: 1.5, position: { x: 0, y: 0, z: 470 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 30x30' },
        { id: 'c4', name: 'Coluna 4', type: 'SquareTube', width: 30, height: 500, quantity: 1, thickness: 1.5, position: { x: 470, y: 0, z: 470 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 30x30' },
        
        // Travessas Topo
        { id: 't1', name: 'Travessa Topo F', type: 'SquareTube', width: 30, height: 440, quantity: 1, thickness: 1.5, position: { x: 30, y: 470, z: 0 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Tubo 30x30' },
        { id: 't2', name: 'Travessa Topo T', type: 'SquareTube', width: 30, height: 440, quantity: 1, thickness: 1.5, position: { x: 30, y: 470, z: 470 }, rotation: { x: 0, y: 0, z: 1.57 }, material: 'Tubo 30x30' },
        { id: 't3', name: 'Travessa Topo E', type: 'SquareTube', width: 30, height: 440, quantity: 1, thickness: 1.5, position: { x: 0, y: 470, z: 30 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'Tubo 30x30' },
        { id: 't4', name: 'Travessa Topo D', type: 'SquareTube', width: 30, height: 440, quantity: 1, thickness: 1.5, position: { x: 470, y: 470, z: 30 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'Tubo 30x30' },
        
        // Novos componentes
        { id: 'gusset-box', name: 'Cantoneira Reforço', type: 'Flat', width: 50, height: 50, quantity: 8, thickness: 3, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Chapa A36 1/8"' },
      ]
    }
  },

  // 6. Utilidades Domésticas e Urbanas
  {
    id: 'trash-bin',
    name: 'Lixeira de Calçada',
    description: 'Cesto de lixo elevado com suporte para calçada.',
    category: 'Utilidades Domésticas e Urbanas',
    icon: 'Trash2',
    project: {
      name: 'Lixeira Padrão',
      tipoProduto: 'quadro_simples',
      dimensions: { width: 600, height: 1200, depth: 400 },
      material: 'ferro-chato',
      components: [
        { id: 'post', name: 'Pedestal', type: 'RoundTube', width: 50, height: 1200, quantity: 1, thickness: 2, position: { x: 275, y: 0, z: 200 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Tubo 2"' },
        { id: 'basket-base', name: 'Base Cesto', type: 'Flat', width: 600, height: 400, quantity: 1, thickness: 4, position: { x: 0, y: 1000, z: 0 }, rotation: { x: 1.57, y: 0, z: 0 }, material: 'Tela Moeda' },
        
        // Novos componentes
        { id: 'hinge-trash', name: 'Dobradiça', type: 'Flat', width: 30, height: 50, quantity: 2, thickness: 2, position: { x: 0, y: 1000, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Aço Inox' },
        { id: 'latch-trash', name: 'Fecho', type: 'Flat', width: 30, height: 50, quantity: 1, thickness: 2, position: { x: 300, y: 1000, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, material: 'Aço Inox' },
      ]
    }
  }
];
