import { ProjectState, Component } from '../types';

export const calculatePartWeight = (comp: Component) => {
  // Density of steel: ~7.85 g/cm³ = 0.00000785 kg/mm³
  const density = 0.00000785;
  const thickness = 2.0; // Assuming 2mm for now
  let volume = 0;
  const dimW = comp.width;
  const dimH = comp.height;
  const dimD = (comp as any).dimD || 20;

  switch (comp.type) {
    case 'L-Shape':
      volume = (dimH + dimD) * dimW * thickness;
      break;
    case 'U-Profile':
    case 'Bent':
    case 'Profile':
      volume = (dimH + 2 * dimD) * dimW * thickness;
      break;
    case 'Trapezoid':
       const top = comp.details?.top || dimW;
       const bottom = comp.details?.bottom || dimW;
       volume = ((top + bottom) / 2) * dimH * thickness;
       break;
    case 'RoundTube':
      const R = dimW / 2;
      const r = R - thickness;
      volume = Math.PI * dimH * (R * R - r * r);
      break;
    case 'SquareTube':
      const W = dimW;
      const w = W - 2 * thickness;
      volume = dimH * (W * W - w * w);
      break;
    case 'RectangularTube':
      const W_rect = dimW;
      const D_rect = dimD || dimW;
      const w_rect = W_rect - 2 * thickness;
      const d_rect = D_rect - 2 * thickness;
      volume = dimH * (W_rect * D_rect - w_rect * d_rect);
      break;
    case 'Hinge':
      volume = Math.PI * Math.pow(dimW / 2, 2) * dimH + dimW * dimH * 2;
      break;
    case 'Flat':
    default:
      volume = dimW * dimH * thickness;
      break;
  }

  return (volume * density).toFixed(2);
};

export const calculateWeight = (project: ProjectState) => {
  // Chapa 14 (1.9mm) ~ 15kg/m2
  let totalAreaMm2 = 0;
  
  if (project.components && project.components.length > 0) {
    project.components.forEach(c => {
      totalAreaMm2 += (c.width * c.height) * c.quantity;
    });
  } else {
    // Fallback to box estimation if no components
    totalAreaMm2 = (project.dimensions.width * project.dimensions.height * 2 + 
                  project.dimensions.width * project.dimensions.depth + 
                  project.dimensions.depth * project.dimensions.height * 2);
  }
  
  const areaM2 = totalAreaMm2 / 1000000;
  return (areaM2 * 15).toFixed(2);
};

export const generateInitialProject = (): ProjectState => ({
  id: crypto.randomUUID(),
  name: 'Tesoura Metálica Padrão',
  version: 1,
  tipoProduto: 'tesoura',
  dimensions: {
    width: 6000,
    height: 600,
    depth: 100,
  },
  inclinacaoPercentual: 10,
  materialCobertura: 'telha',
  telhaSelecionadaId: 'telha_galvanizada_trap_40',
  perfilColunaId: 'perfil_u_100x40x2',
  perfilVigaId: 'perfil_u_75x40x2',
  perfilDiagonalId: 'perfil_u_75x40x2',
  perfilTercaId: 'metalon50x30x1.5',
  qtdTercas: 6,
  qtdColunasExtras: 0,
  acabamento: 'preto_fosco',
  fixacao: 'sapata_parafuso',
  material: 'perfil_u_100x40x2',
  mostrarCotas: true,
  mostrarNodes: true,
  colorBanzo: '#2563eb', // Blue
  colorMontante: '#dc2626', // Red
  colorDiagonal: '#16a34a', // Green
  components: [],
  processParameters: {
    cuttingMethod: 'chop-saw',
    weldingType: 'mig',
    weldingIntensity: 'medium',
    surfaceFinish: 'painted'
  },
  lastModified: Date.now(),
});
