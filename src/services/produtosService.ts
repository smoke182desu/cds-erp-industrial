// Serviço de produtos WooCommerce ↔ Firestore

export interface Produto {
  id: string;
  wcId: string;
  nome: string;
  sku: string;
  preco: number;
  precoRegular: number;
  precoPromocional?: number;
  estoque: number;
  gerenciarEstoque?: boolean;
  emEstoque?: boolean;
  status: string;
  categoria: string;
  imagem: string;
  descricao: string;
  permalink: string;
  tipo: string;
  sincronizadoEm: string;
}

const API_BASE = '/api';

// ---------- buscar produtos do cache Firestore ----------
export async function buscarProdutos(): Promise<Produto[]> {
  const res = await fetch(`${API_BASE}/produtos`);
  const data = await res.json();
  return (data.produtos || []) as Produto[];
}

// ---------- sincronizar WooCommerce → Firestore (todos os produtos) ----------
export async function sincronizarProdutos(): Promise<{ ok: boolean; totalSincronizados?: number; sincronizados?: number; error?: string }> {
  const res = await fetch(`${API_BASE}/produtos?sync=all`);
  return res.json();
}

// ---------- formatar preço BR ----------
export function fmtPreco(v?: number): string {
  if (!v) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
