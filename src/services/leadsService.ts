// ---------- Tipos do funil CRM ----------
export type EtapaFunil =
  | 'lead_novo'
  | 'contato_feito'
  | 'qualificado'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado_ganho'
  | 'fechado_perdido';

export type LeadOrigem = 'site' | 'whatsapp' | 'woocommerce' | 'calculadora' | 'manual';

export const ETAPAS_FUNIL: { id: EtapaFunil; label: string; cor: string; descricao: string }[] = [
  { id: 'lead_novo',        label: 'Novo Lead',         cor: '#6366f1', descricao: 'Lead recem captado' },
  { id: 'contato_feito',    label: 'Contato Feito',     cor: '#0ea5e9', descricao: 'Primeiro contato realizado' },
  { id: 'qualificado',      label: 'Qualificado',       cor: '#f59e0b', descricao: 'Lead validado e com potencial' },
  { id: 'proposta_enviada', label: 'Proposta Enviada',  cor: '#8b5cf6', descricao: 'Proposta comercial enviada' },
  { id: 'negociacao',       label: 'Em Negociacao',     cor: '#ec4899', descricao: 'Negociacao em andamento' },
  { id: 'fechado_ganho',    label: 'Fechado OK',        cor: '#10b981', descricao: 'Venda concluida com sucesso' },
  { id: 'fechado_perdido',  label: 'Perdido',           cor: '#ef4444', descricao: 'Oportunidade perdida' },
];

export const ORIGEM_LABELS: Record<LeadOrigem, string> = {
  site:        'Site',
  whatsapp:    'WhatsApp',
  woocommerce: 'WooCommerce',
  calculadora: 'Calculadora',
  manual:      'Manual',
};

export interface Lead {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  mensagem?: string;
  origem: LeadOrigem;
  etapa: EtapaFunil;
  valor?: number;
  pedidoId?: string;
  clienteId?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm?: string;
  totalMensagens?: number;
  ultimaMensagem?: string;
  ultimaHora?: string;
}

// ---------- buscar leads via REST ----------
// Mapeia registro snake_case do MySQL pra shape camelCase que o CRM espera
function mapLeadFromDB(row: any): Lead {
  return {
    id: String(row.id ?? ''),
    nome: row.nome ?? '',
    email: row.email ?? undefined,
    telefone: row.telefone ?? undefined,
    empresa: row.empresa ?? undefined,
    mensagem: row.mensagem ?? row.observacoes ?? undefined,
    origem: (row.origem ?? 'manual') as LeadOrigem,
    etapa: (row.etapa || row.status_funil || 'lead_novo') as EtapaFunil,
    valor: parseFloat(row.valor || row.valor_estimado) || undefined,
    pedidoId: row.pedidoId ?? row.pedido_id ?? undefined,
    clienteId: row.clienteId ?? row.cliente_id ?? row.woocommerce_customer_id ?? undefined,
    observacoes: row.observacoes ?? undefined,
    criadoEm: row.criadoEm ?? row.criado_em ?? new Date().toISOString(),
    atualizadoEm: row.atualizadoEm ?? row.atualizado_em ?? undefined,
    totalMensagens: parseInt(row.total_mensagens || row.totalMensagens) || 0,
    ultimaMensagem: row.ultima_mensagem || row.ultimaMensagem || undefined,
    ultimaHora: row.ultima_hora || row.ultimaHora || undefined,
  };
}

async function buscarLeadsREST(): Promise<Lead[]> {
  const res = await fetch('/api/leads');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // /api/leads returns a raw array; fall back to {leads:[]} shape for compat
  const rows = Array.isArray(data) ? data : (data.leads || []);
  return rows.map(mapLeadFromDB);
}

// ---------- subscribe leads: REST imediato + polling 20s ----------
export function subscribeLeads(callback: (leads: Lead[]) => void): () => void {
  let cancelled = false;

  const fetchAndCallback = () => {
    buscarLeadsREST()
      .then(leads => { if (!cancelled) callback(leads); })
      .catch(() => {});
  };

  fetchAndCallback();
  const interval = setInterval(fetchAndCallback, 20000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

// ---------- buscar leads (uma vez) ----------
export async function buscarLeads(): Promise<Lead[]> {
  return buscarLeadsREST();
}

// ---------- buscar leads por etapa ----------
export async function buscarLeadsPorEtapa(etapa: EtapaFunil): Promise<Lead[]> {
  const todos = await buscarLeadsREST();
  return todos.filter(l => l.etapa === etapa);
}

// ---------- proximo codigo de cliente ----------
async function proximoCodigoCliente(): Promise<number> {
  try {
    const getRes = await fetch('/api/config?col=config&doc=cliente_counter');
    const getData = await getRes.json();
    const atual = getData.data?.numero || 0;
    const proximo = atual + 1;
    await fetch('/api/config?col=config&doc=cliente_counter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: proximo }),
    });
    return proximo;
  } catch {
    return Date.now() % 10000;
  }
}

// ---------- salvar/atualizar cliente via REST ----------
export async function salvarCliente(lead: Partial<Lead>): Promise<string> {
  if (!lead.telefone) return '';
  try {
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefone: lead.telefone,
        nome: lead.nome || '',
        email: lead.email || '',
        empresa: lead.empresa || '',
        origem: lead.origem || 'manual',
      }),
    });
    const data = await res.json();
    return data.clienteId || '';
  } catch {
    return '';
  }
}

// ---------- adicionar lead via REST ----------
export async function adicionarLead(data: Omit<Lead, 'id' | 'criadoEm'>): Promise<string> {
  const clienteId = await salvarCliente(data);
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, clienteId, erpCreate: true }),
    });
    const json = await res.json();
    return json.leadId || '';
  } catch {
    return '';
  }
}

// ---------- atualizar lead via REST ----------
export async function atualizarLead(id: string, data: Partial<Omit<Lead, 'id'>>): Promise<void> {
  await fetch(`/api/leads?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ---------- mover etapa via REST ----------
export async function moverEtapa(id: string, etapa: EtapaFunil): Promise<void> {
  await fetch(`/api/leads?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapa }),
  });
}

// ---------- buscar clientes via REST ----------
export async function buscarClientes() {
  try {
    const res = await fetch('/api/clientes');
    const data = await res.json();
    return data.clientes || [];
  } catch {
    return [];
  }
}
