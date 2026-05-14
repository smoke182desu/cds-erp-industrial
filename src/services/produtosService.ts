// Servico de produtos WooCommerce - ERP CDS Industrial

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
    fotoUrl?: string;
    fotos?: string[];
    descricao: string;
    permalink: string;
    tipo: string;
    sincronizadoEm: string;
}

const API_BASE = '/api';

// Busca todos os produtos do Supabase
export async function buscarProdutos(): Promise<Produto[]> {
    const res = await fetch(`${API_BASE}/produtos`);
    const data = await res.json();
    return (data.produtos || []) as Produto[];
}

// Busca produtos por termo (autocomplete)
export async function searchProdutos(q: string, limit = 20): Promise<Produto[]> {
    if (!q || q.trim().length < 2) return [];
    const url = `${API_BASE}/produtos?q=${encodeURIComponent(q.trim())}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.produtos || []) as Produto[];
}

// Sincroniza todos os produtos do WooCommerce em lotes de 5 paginas (500 produtos por chamada)
// Chama a API repetidamente ate sincronizar tudo, evitando timeout do Vercel
export async function sincronizarProdutos(
    onProgress?: (sincronizados: number, total: number) => void
  ): Promise<{ ok: boolean; totalSincronizados?: number; error?: string }> {
    let page = 1;
    let totalSincronizados = 0;
    let totalPages = 1;
    const BATCH = 5;

  try {
        do {
                const url = `${API_BASE}/produtos?sync=batch&page=${page}&batch=${BATCH}`;
                const res = await fetch(url);
                if (!res.ok) {
                          const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
                          return { ok: false, error: err.error || `HTTP ${res.status}` };
                }
                const data = await res.json();
                if (!data.ok) return { ok: false, error: data.error || 'Erro na sincronizacao' };

                totalPages = data.totalPages || 1;
                totalSincronizados += data.sincronizados || 0;
                page = data.nextPage || (data.endPage + 1);

                if (onProgress) {
                          const produtosEstimados = totalPages * 100;
                          onProgress(totalSincronizados, produtosEstimados);
                }

                if (!data.hasMore) break;
        } while (page <= totalPages);

      return { ok: true, totalSincronizados };
  } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        return { ok: false, error: msg };
  }
}

// Formata preco em BRL
export function fmtPreco(v?: number): string {
    if (!v) return '-';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
