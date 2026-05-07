// api/leads.js
// CRUD de leads para o funil CRM
import { selectAll, insert, update, remove } from './_lib/supabase.js';

const TABLE = 'leads';
const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';

// ---------- LID detection / formatacao de nome ----------
function isLID(digits) {
  if (digits.length >= 15) return true;
  if (digits.length >= 14 && !digits.startsWith('55') && !digits.startsWith('1')) return true;
  return false;
}

function formatarLead(lead) {
  let nome = lead.nome || '';
  const tel = lead.telefone || '';
  const pushName =
    lead.contato_nome ||
    lead.push_name ||
    lead.pushName ||
    lead.nome_contato ||
    '';

  const nomeDigits = nome.replace(/^\+/, '');

  if (/^\d{10,}$/.test(nomeDigits)) {
    if (nomeDigits.startsWith('55') && nomeDigits.length >= 12 && nomeDigits.length <= 13) {
      const ddd = nomeDigits.substring(2, 4);
      const num = nomeDigits.substring(4);
      nome = '(' + ddd + ') ' + num.substring(0, num.length - 4) + '-' + num.substring(num.length - 4);
    } else if (isLID(nomeDigits)) {
      nome = pushName && pushName.trim() ? pushName.trim() : 'Aguardando identificacao';
    } else {
      nome = '+' + nomeDigits;
    }
  } else if ((!nome || !nome.trim()) && pushName) {
    nome = pushName.trim();
  }

  return { ...lead, nome, telefone: tel };
}

// Normaliza saida: aceita Postgres snake_case e camelCase mistos.
function normalizar(lead) {
  return {
    id: lead.id,
    nome: lead.nome || '',
    email: lead.email || '',
    telefone: lead.telefone || '',
    empresa: lead.empresa || '',
    mensagem: lead.mensagem || '',
    origem: lead.origem || 'manual',
    etapa: lead.etapa || 'lead_novo',
    valor: Number(lead.valor) || 0,
    pedidoId: lead.pedidoId ?? lead.pedido_id ?? '',
    clienteId: lead.clienteId ?? lead.cliente_id ?? '',
    observacoes: lead.observacoes || '',
    contato_nome: lead.contato_nome || lead.push_name || lead.pushName || '',
    criadoEm: lead.criadoEm ?? lead.criado_em ?? lead.created_at ?? '',
    atualizadoEm: lead.atualizadoEm ?? lead.atualizado_em ?? lead.updated_at ?? '',
  };
}

// ---------- CRUD ----------
async function listarLeads() {
  try {
    const data = await selectAll(TABLE, { orderBy: 'criado_em', limit: 300 });
    return data;
  } catch (err) {
    console.warn('[leads] select falhou:', err.message);
    return [];
  }
}

async function inserirLead(data) {
  const payload = {
    nome: data.nome || '',
    email: data.email || '',
    telefone: data.telefone || '',
    mensagem: data.mensagem || '',
    empresa: data.empresa || '',
    origem: data.origem || 'site',
    etapa: data.etapa || 'lead_novo',
    valor: Number(data.valor) || 0,
    pedido_id: data.pedidoId || '',
    cliente_id: data.clienteId || '',
    observacoes: data.observacoes || '',
  };
  const inserted = await insert(TABLE, payload);
  return inserted?.id;
}

async function atualizarLead(id, body) {
  const updates = {};
  const allowed = ['nome', 'email', 'telefone', 'empresa', 'etapa', 'origem', 'observacoes', 'mensagem'];
  for (const f of allowed) {
    if (body[f] !== undefined) updates[f] = String(body[f]);
  }
  if (body.valor !== undefined) updates.valor = Number(body.valor) || 0;
  if (body.pedidoId !== undefined) updates.pedido_id = String(body.pedidoId);
  
  await update(TABLE, 'id', id, updates);
  return id;
}

async function deletarLead(id) {
  await remove(TABLE, 'id', id);
  return id;
}

// ---------- handler ----------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret, X-Erp-Create');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const raw = await listarLeads();
      const leads = raw.map(normalizar).map(formatarLead);
      return res.status(200).json(leads);
    }

    if (req.method === 'POST') {
      const erpCreate = req.body?.erpCreate === true || req.headers['x-erp-create'] === '1';
      if (!erpCreate) {
        const secret = req.headers['x-webhook-secret'] || req.query.secret;
        if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
      }
      const body = req.body || {};
      if (!body.nome && !body.telefone) {
        return res.status(400).json({ error: 'Nome ou telefone obrigatorios' });
      }
      const leadId = await inserirLead(body);
      return res.status(201).json({ success: true, leadId });
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await atualizarLead(id, req.body || {});
      return res.status(200).json({ ok: true, id });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await deletarLead(id);
      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[leads]', req.method, 'erro:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
