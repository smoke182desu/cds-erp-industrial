export interface CorMaterial {
  id: string;
  nome: string;
  hex: string;
  descricao: string;
}

export const coresDB: CorMaterial[] = [
  { id: 'vermelho_1', nome: 'Vermelho 1', hex: '#ef4444', descricao: 'Perfil Estrutural Pesado' },
  { id: 'vermelho_2', nome: 'Vermelho 2', hex: '#dc2626', descricao: 'Perfil Estrutural Médio' },
  { id: 'vermelho_3', nome: 'Vermelho 3', hex: '#991b1b', descricao: 'Perfil Estrutural Leve' },
  
  { id: 'azul_1', nome: 'Azul 1', hex: '#3b82f6', descricao: 'Banzo Superior' },
  { id: 'azul_2', nome: 'Azul 2', hex: '#2563eb', descricao: 'Banzo Inferior' },
  { id: 'azul_3', nome: 'Azul 3', hex: '#1e40af', descricao: 'Contraventamento' },
  
  { id: 'verde_1', nome: 'Verde 1', hex: '#22c55e', descricao: 'Diagonal Principal' },
  { id: 'verde_2', nome: 'Verde 2', hex: '#16a34a', descricao: 'Diagonal Secundária' },
  { id: 'verde_3', nome: 'Verde 3', hex: '#166534', descricao: 'Montante' },
  
  { id: 'amarelo_1', nome: 'Amarelo 1', hex: '#eab308', descricao: 'Terça de Cobertura' },
  { id: 'amarelo_2', nome: 'Amarelo 2', hex: '#ca8a04', descricao: 'Terça de Fechamento' },
  
  { id: 'laranja_1', nome: 'Laranja 1', hex: '#f97316', descricao: 'Viga Mestra' },
  { id: 'laranja_2', nome: 'Laranja 2', hex: '#ea580c', descricao: 'Viga Secundária' },
  
  { id: 'cinza_1', nome: 'Cinza 1', hex: '#64748b', descricao: 'Acabamento / Calha' },
  { id: 'cinza_2', nome: 'Cinza 2', hex: '#475569', descricao: 'Suportes Diversos' },
  { id: 'cinza_3', nome: 'Cinza 3', hex: '#1e293b', descricao: 'Base / Chapa de Piso' },
];
