// src/services/trafegoService.ts
// Cliente HTTP para os endpoints /api/trafego/*

export type TrafegoClienteStatus = 'ativo' | 'pausado' | 'arquivado';

export interface TrafegoCliente {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string | null;
  cor_destaque?: string | null;
  status: TrafegoClienteStatus;
  fee_mensal?: number;
  responsavel?: string | null;
  email_contato?: string | null;
  telefone_contato?: string | null;
  observacoes?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export type TrafegoClienteInput = Partial<Omit<TrafegoCliente, 'id' | 'criado_em' | 'atualizado_em'>> & {
  nome: string;
};

const BASE = '/api/trafego/clientes';

export async function listarClientes(incluirArquivados = false): Promise<TrafegoCliente[]> {
  const url = incluirArquivados ? `${BASE}?incluirArquivados=1` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao listar clientes (${res.status})`);
  const json = await res.json();
  return Array.isArray(json.clientes) ? json.clientes : [];
}

export async function criarCliente(data: TrafegoClienteInput): Promise<TrafegoCliente> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Falha ao criar cliente');
  return json.cliente;
}

export async function atualizarCliente(id: string, data: Partial<TrafegoClienteInput>): Promise<TrafegoCliente> {
  const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Falha ao atualizar cliente');
  return json.cliente;
}

export async function arquivarCliente(id: string): Promise<void> {
  const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || 'Falha ao arquivar cliente');
  }
}
