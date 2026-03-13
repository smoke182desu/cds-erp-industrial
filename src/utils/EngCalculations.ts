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
