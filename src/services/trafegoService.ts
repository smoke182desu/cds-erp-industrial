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

// ============================================================
// Contas conectadas (Meta, Google, TikTok, etc.) por cliente
// ============================================================

export type TrafegoContaStatus = 'ativo' | 'expirado' | 'desconectado' | 'erro';

export interface TrafegoConta {
  id: string;
  clienteId: string;
  plataforma: string;
  accountId: string;
  accountName?: string | null;
  status: TrafegoContaStatus;
  expiresAt?: string | null;
  syncUltimoEm?: string | null;
  erroUltimo?: string | null;
  scopes?: string[];
  metadata?: Record<string, any>;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface TrafegoContaInput {
  plataforma: string;
  account_id: string;
  account_name?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  status?: TrafegoContaStatus;
  metadata?: Record<string, any>;
}

const CONTAS_BASE = '/api/trafego/contas';

export async function listarContas(clienteId: string): Promise<TrafegoConta[]> {
  const res = await fetch(`${CONTAS_BASE}?cliente_id=${encodeURIComponent(clienteId)}`);
  if (!res.ok) throw new Error(`Falha ao listar contas (${res.status})`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

export async function criarConta(clienteId: string, data: TrafegoContaInput): Promise<TrafegoConta> {
  const res = await fetch(CONTAS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cliente-Id': clienteId },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Falha ao criar conta');
  return json;
}

export async function atualizarConta(id: string, data: Partial<TrafegoContaInput>): Promise<TrafegoConta> {
  const camelCaseData: any = {};
  if (data.account_name !== undefined) camelCaseData.accountName = data.account_name;
  if (data.access_token !== undefined) camelCaseData.accessToken = data.access_token;
  if (data.refresh_token !== undefined) camelCaseData.refreshToken = data.refresh_token;
  if (data.expires_at !== undefined) camelCaseData.expiresAt = data.expires_at;
  if (data.status !== undefined) camelCaseData.status = data.status;
  if (data.metadata !== undefined) camelCaseData.metadata = data.metadata;

  const res = await fetch(`${CONTAS_BASE}?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(camelCaseData),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Falha ao atualizar conta');
  return json;
}

export async function removerConta(id: string): Promise<void> {
  const res = await fetch(`${CONTAS_BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || 'Falha ao remover conta');
  }
}
