export interface TesouraData {
  id: string;
  nome: string;
  descricao: string;
}

export const tesourasDB: TesouraData[] = [
  { id: 'pratt', nome: 'Pratt', descricao: 'Tesoura clássica com montantes verticais e diagonais.' },
  { id: 'howe', nome: 'Howe', descricao: 'Tesoura com montantes verticais e diagonais invertidas.' },
  { id: 'fink', nome: 'Fink', descricao: 'Tesoura Fink clássica.' },
  { id: 'warren', nome: 'Warren', descricao: 'Tesoura Warren com diagonais em zig-zag.' },
];
