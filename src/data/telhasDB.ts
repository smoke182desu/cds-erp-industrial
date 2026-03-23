export interface TelhaData {
  id: string;
  nome: string;
  larguraTotal: number; // mm
  larguraUtil: number; // mm
  sobreposicaoLateral: number; // mm
  sobreposicaoLongitudinal: number; // mm
  precoPorMetroLinear: number;
  pesoPorMetroLinear: number;
  tipo: 'galvanizada' | 'sanduiche';
}

export const telhasDB: TelhaData[] = [
  {
    id: 'telha_galvanizada_trap_40',
    nome: 'Telha Galvanizada Trapezoidal 40',
    larguraTotal: 1050,
    larguraUtil: 980,
    sobreposicaoLateral: 70,
    sobreposicaoLongitudinal: 200,
    precoPorMetroLinear: 45.00,
    pesoPorMetroLinear: 4.5,
    tipo: 'galvanizada',
  },
  {
    id: 'telha_sanduiche_trap_40',
    nome: 'Telha Sanduíche (Termoacústica) 40mm',
    larguraTotal: 1050,
    larguraUtil: 980,
    sobreposicaoLateral: 70,
    sobreposicaoLongitudinal: 200,
    precoPorMetroLinear: 120.00,
    pesoPorMetroLinear: 10.5,
    tipo: 'sanduiche',
  },
];
