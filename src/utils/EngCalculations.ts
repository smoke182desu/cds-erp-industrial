export const DENSIDADE_ACO = 7850; // kg/m³
export const MODULO_ELASTICIDADE = 200e9; // Pa (N/m²)

export interface PropriedadesPerfil {
  area: number; // m²
  massaLinear: number; // kg/m
  ix: number; // m⁴ (Momento de Inércia Eixo X)
  iy: number; // m⁴ (Momento de Inércia Eixo Y)
}

export function calcularPropriedadesMetalon(largura: number, altura: number, espessura: number): PropriedadesPerfil {
  // Converte mm para m
  const b = largura / 1000;
  const h = altura / 1000;
  const e = espessura / 1000;

  const bi = b - 2 * e;
  const hi = h - 2 * e;

  const area = (b * h) - (bi * hi);
  const massaLinear = area * DENSIDADE_ACO;

  const ix = (b * Math.pow(h, 3) / 12) - (bi * Math.pow(hi, 3) / 12);
  const iy = (h * Math.pow(b, 3) / 12) - (hi * Math.pow(bi, 3) / 12);

  return { area, massaLinear, ix, iy };
}

export function calcularPropriedadesPerfilU(largura: number, abas: number, espessura: number, enrijecedor: number = 0): PropriedadesPerfil {
  // Converte mm para m
  const b = abas / 1000;
  const h = largura / 1000; // A "largura" do perfil U é a altura da alma
  const e = espessura / 1000;
  const c = enrijecedor / 1000;

  // Aproximação simplificada da área
  const area = (h * e) + 2 * ((b - e) * e) + 2 * (c * e);
  const massaLinear = area * DENSIDADE_ACO;

  // Aproximação do momento de inércia Ix (eixo forte)
  // Alma
  const ixAlma = (e * Math.pow(h, 3)) / 12;
  // Abas (teorema dos eixos paralelos)
  const areaAba = (b - e) * e;
  const distAba = (h - e) / 2;
  const ixAbas = 2 * ((b - e) * Math.pow(e, 3) / 12 + areaAba * Math.pow(distAba, 2));
  // Enrijecedores (se houver)
  let ixEnr = 0;
  if (c > 0) {
    const areaEnr = c * e;
    const distEnr = (h - c) / 2;
    ixEnr = 2 * ((e * Math.pow(c, 3)) / 12 + areaEnr * Math.pow(distEnr, 2));
  }

  const ix = ixAlma + ixAbas + ixEnr;
  
  // Iy (eixo fraco) - simplificado
  const iy = (2 * e * Math.pow(b, 3) / 12) + (h * Math.pow(e, 3) / 12);

  return { area, massaLinear, ix, iy };
}

export function verificarFlecha(vão: number, cargaDistribuida: number, ix: number): { flecha: number, limite: number, aprovado: boolean } {
  // vão em m, cargaDistribuida em N/m, ix em m⁴
  // Flecha máxima L/250 (NBR 8800)
  const limite = vão / 250;
  
  // Flecha real (viga biapoiada com carga uniformemente distribuída)
  // delta = (5 * q * L^4) / (384 * E * I)
  const flecha = (5 * cargaDistribuida * Math.pow(vão, 4)) / (384 * MODULO_ELASTICIDADE * ix);

  return {
    flecha,
    limite,
    aprovado: flecha <= limite
  };
}

export interface PortaoBOM {
  quadroFixo: { item: string; qtd: string; unit: string }[];
  folhaMovel: { item: string; qtd: string; unit: string }[];
  kitCinematico: { item: string; qtd: string; unit: string }[];
  sistemaContrapeso: { item: string; qtd: string; unit: string }[];
  pesos: {
    folha: string;
    contrapesoTotal: string;
    totalEstimado: string;
  };
  notas: string[];
}

/**
 * Cálculos para Portão Basculante
 * @param L Largura em mm
 * @param A Altura em mm
 * @param revestimento Tipo de revestimento
 */
export const calcularPortaoBasculante = (L: number, A: number, revestimento: string = 'chapa'): PortaoBOM => {
  const L_m = L / 1000;
  const A_m = A / 1000;
  const L_util = L_m - 0.30; // Desconto das caixas laterais (150mm cada lado)

  // 1. Tubos e Perfis (em metros lineares)
  const metalonFolha = (2 * A_m) + (3 * L_util);
  const metalonBandeira = L_util;
  const chapaCaixa = 2 * A_m;
  const perfilTrilho = 2 * A_m;
  const metalonBraco = 2 * (A_m * 0.30);

  // 2. Área Revestimento (em m²)
  const areaRevestimento = L_util * A_m;

  // 3. Cálculos de Pesos (kg)
  // Densidades: Metalon 50x50x1.5 = 2.2 kg/m. Chapa U 150 = 6.0 kg/m. Revestimento (Chapa 20) = 7.5 kg/m². Metalon Braco = 1.4 kg/m.
  const pesoFolha = (metalonFolha * 2.2) + (areaRevestimento * 7.5);
  const pesoContrapesoTotal = pesoFolha * 0.96; // 48% de cada lado
  const pesoEstruturaFixa = (chapaCaixa * 6.0) + (metalonBandeira * 1.5);
  const pesoBracos = metalonBraco * 1.4;

  return {
    quadroFixo: [
      { item: 'Caixas de Contrapeso (U 150x150)', qtd: chapaCaixa.toFixed(2), unit: 'm' },
      { item: 'Guia Superior (Bandeira 50x30)', qtd: metalonBandeira.toFixed(2), unit: 'm' },
      { item: 'Trilhos Roldana (U 2")', qtd: perfilTrilho.toFixed(2), unit: 'm' },
      { item: 'Tampas das Caixas', qtd: '4.00', unit: 'un' }
    ],
    folhaMovel: [
      { item: 'Estrutura Metalon 50x50', qtd: metalonFolha.toFixed(2), unit: 'm' },
      { item: `Revestimento (${revestimento})`, qtd: areaRevestimento.toFixed(2), unit: 'm²' }
    ],
    kitCinematico: [
      { item: 'Braços Estabilizadores (40x20)', qtd: metalonBraco.toFixed(2), unit: 'm' },
      { item: 'Roldanas Principais 4"', qtd: '2.00', unit: 'un' },
      { item: 'Roldanas Guia Cabo', qtd: '2.00', unit: 'un' },
      { item: 'Cabo de Aço 3/16"', qtd: ((A_m * 2.5) * 2).toFixed(2), unit: 'm' },
      { item: 'Clips para Cabo', qtd: '6.00', unit: 'un' },
      { item: 'Pinos de Giro 5/8"', qtd: '4.00', unit: 'un' }
    ],
    sistemaContrapeso: [
      { item: 'Estojos de Contrapeso', qtd: '2.00', unit: 'un' },
      { item: 'Carga de Ferro/Chumbo (Total)', qtd: pesoContrapesoTotal.toFixed(2), unit: 'kg' }
    ],
    pesos: {
      folha: pesoFolha.toFixed(2),
      contrapesoTotal: pesoContrapesoTotal.toFixed(2),
      totalEstimado: (pesoFolha + pesoEstruturaFixa + pesoBracos).toFixed(2)
    },
    notas: [
      'Cálculo baseado em caixas de 150mm',
      'Contrapeso deve ser 48% do peso da folha em cada lado',
      'Balanceamento dinâmico deve ser verificado na instalação'
    ]
  };
};
