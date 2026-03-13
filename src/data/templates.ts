import { ProjectState } from '../types';

export const generateTableTemplate = (): ProjectState => ({
  id: crypto.randomUUID(),
  name: 'Mesa de Escritório Industrial',
  version: 1,
  dimensions: { width: 1200, height: 750, depth: 600 },
  material: 'chapa-14',
  components: [
    { id: 'tampo', name: 'Tampo', width: 1200, height: 600, quantity: 1, type: 'Flat' },
    { id: 'perna1', name: 'Perna Esquerda', width: 50, height: 750, quantity: 1, type: 'SquareTube' },
    { id: 'perna2', name: 'Perna Direita', width: 50, height: 750, quantity: 1, type: 'SquareTube' },
  ],
  processParameters: { cuttingMethod: 'chop-saw', weldingType: 'mig', weldingIntensity: 'medium', surfaceFinish: 'painted' },
  lastModified: Date.now(),
});

export const generateShelfTemplate = (): ProjectState => ({
  id: crypto.randomUUID(),
  name: 'Estante Industrial 4 Prateleiras',
  version: 1,
  dimensions: { width: 1000, height: 1800, depth: 400 },
  material: 'chapa-14',
  components: [
    { id: 'prat1', name: 'Prateleira 1', width: 1000, height: 400, quantity: 1, type: 'Flat' },
    { id: 'prat2', name: 'Prateleira 2', width: 1000, height: 400, quantity: 1, type: 'Flat' },
    { id: 'prat3', name: 'Prateleira 3', width: 1000, height: 400, quantity: 1, type: 'Flat' },
    { id: 'prat4', name: 'Prateleira 4', width: 1000, height: 400, quantity: 1, type: 'Flat' },
    { id: 'coluna1', name: 'Coluna Frontal Esq', width: 40, height: 1800, quantity: 1, type: 'SquareTube' },
    { id: 'coluna2', name: 'Coluna Frontal Dir', width: 40, height: 1800, quantity: 1, type: 'SquareTube' },
    { id: 'coluna3', name: 'Coluna Traseira Esq', width: 40, height: 1800, quantity: 1, type: 'SquareTube' },
    { id: 'coluna4', name: 'Coluna Traseira Dir', width: 40, height: 1800, quantity: 1, type: 'SquareTube' },
  ],
  processParameters: { cuttingMethod: 'chop-saw', weldingType: 'mig', weldingIntensity: 'medium', surfaceFinish: 'painted' },
  lastModified: Date.now(),
});

export const generateBenchTemplate = (): ProjectState => ({
  id: crypto.randomUUID(),
  name: 'Bancada de Trabalho Reforçada',
  version: 1,
  dimensions: { width: 1500, height: 900, depth: 700 },
  material: 'chapa-12',
  components: [
    { id: 'tampo', name: 'Tampo Reforçado', width: 1500, height: 700, quantity: 1, type: 'Flat' },
    { id: 'perna1', name: 'Perna 1', width: 80, height: 900, quantity: 1, type: 'SquareTube' },
    { id: 'perna2', name: 'Perna 2', width: 80, height: 900, quantity: 1, type: 'SquareTube' },
    { id: 'perna3', name: 'Perna 3', width: 80, height: 900, quantity: 1, type: 'SquareTube' },
    { id: 'perna4', name: 'Perna 4', width: 80, height: 900, quantity: 1, type: 'SquareTube' },
  ],
  processParameters: { cuttingMethod: 'chop-saw', weldingType: 'mig', weldingIntensity: 'high', surfaceFinish: 'raw' },
  lastModified: Date.now(),
});

export const generateShedTemplate = (): ProjectState => ({
  id: crypto.randomUUID(),
  name: 'Galpão Simples Estrutura Metálica',
  version: 1,
  dimensions: { width: 5000, height: 3000, depth: 3000 },
  material: 'chapa-14',
  components: [
    { id: 'coluna1', name: 'Coluna 1', width: 100, height: 3000, quantity: 1, type: 'RectangularTube' },
    { id: 'coluna2', name: 'Coluna 2', width: 100, height: 3000, quantity: 1, type: 'RectangularTube' },
    { id: 'coluna3', name: 'Coluna 3', width: 100, height: 3000, quantity: 1, type: 'RectangularTube' },
    { id: 'coluna4', name: 'Coluna 4', width: 100, height: 3000, quantity: 1, type: 'RectangularTube' },
    { id: 'viga1', name: 'Viga Teto', width: 5000, height: 100, quantity: 2, type: 'RectangularTube' },
  ],
  processParameters: { cuttingMethod: 'chop-saw', weldingType: 'mig', weldingIntensity: 'high', surfaceFinish: 'galvanized' },
  lastModified: Date.now(),
});
