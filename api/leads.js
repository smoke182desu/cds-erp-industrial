// api/leads.js
// CRUD de leads para o funil CRM
import { selectAll, insert, update, remove } from './_lib/supabase.js';

const TABLE = 'leads';
const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';

const NOMES_INVALIDOS = ['cds', 'cds industrial', 'cds ind', 'cdsind'];
function ehNomeInvalido(nome) {
  if (!nome) return true;
  const n = String(nome).trim().toLowerCase();
  return NOMES_INVALIDOS.includes(n);
}

function isLID(digits) {
  if (digits.length >= 15) return true;
  if (digits.length >= 14 && !digits.startsWith('55') && !digits.startsWith('1')) return true;
  if (digits.length >= 12 && !digits.startsWith('55') && !digits.startsWith('1')) return true;
  if (digits.startsWith('55') && digits.length > 13) return true;
  if (digits.startsWith('1') && digits.length > 11) return true;
  return false;
}

function formatarTelefoneWA(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.substring(2, 4);
    const num = d.substring(4);
    if (num.length === 9) {
      return `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    return `+55 ${ddd} ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  if (d.startsWith('1') && d.length === 11) {
    return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  }
  return `+${d}`;
}

function formatarLead(lead) {
  if (lead.etapa === 'lid_oculto') {
    return { ...lead, __ocultar: true };
  }
  let nome = lead.nome || '';
  const tel = lead.telefone || '';
  const pushName = lead.contato_nome || lead.push_name || lead.pushName || lead.nome_contato || '';
  const nomeDigits = nome.replace(/^\+/, '').replace(/\D/g, '');
  const telDigits = String(tel).replace(/\D/g, '');

  if (isLID(telDigits) && (!pushName || ehNomeInvalido(pushName)) && (!nome || ehNomeInvalido(nome) || /^[\d\s+()\-]+$/.test(nome))) {
    return { ...lead, nome: '', telefone: tel, __ocultar: true };
  }
  if (ehNomeInvalido(nome)) {
    if (pushName && pushName.trim() && !ehNomeInvalido(pushName)) nome = pushName.trim();
    else if (telDigits) {
      if (isLID(telDigits)) return { ...lead, nome: '', telefone: tel, __ocultar: true };
      nome = formatarTelefoneWA(telDigits);
    } else return { ...lead, nome: '', telefone: tel, __ocultar: true };
  } else if (nome && /^[\d\s+()\-]+$/.test(nome)) {
    if (isLID(nomeDigits)) {
      if (pushName && pushName.trim() && !ehNomeInvalido(pushName)) nome = pushName.trim();
      else return { ...lead, nome: '', telefone: tel, __ocultar: true };
    } else if (nomeDigits.length >= 10) nome = formatarTelefoneWA(nomeDigits);
  } else if (!nome || !nome.trim()) {
    if (pushName && pushName.trim() && !ehNomeInvalido(pushName)) nome = pushName.trim();
    else if (telDigits) {
      if (isLID(telDigits)) return { ...lead, nome: '', telefone: tel, __ocultar: true };
      nome = formatarTelefoneWA(telDigits);
    }
  }
  return { ...lead, nome, telefone: tel };
}

function normalizar(lead) {
  return {
    id: lead.id,
    nome: lead.nome || '',
    email: lead.email || '',
    telefone: lead.telefone || '',
    empresa: lead.empresa || '',
    mensagem: lead.mensagem || '',
    ultima_mensagem: lead.ultima_mensagem || lead.ultimaMensagem || '',
    foto_url: lead.foto_url || lead.fotoUrl || lead.profile_pic_url || '',
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

async function listarLeads() {
  try {
    const data = await selectAll(TABLE, { orderBy: 'atualizado_em', limit: 300 });
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
  for (const f of allowed) if (body[f] !== undefined) updates[f] = String(body[f]);
  if (body.valor !== undefined) updates.valor = Number(body.valor) || 0;
  if (body.pedidoId !== undefined) updates.pedido_id = String(body.pedidoId);
  await update(TABLE, 'id', id, updates);
  return id;
}

async function deletarLead(id) {
  await remove(TABLE, 'id', id);
  return id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret, X-Erp-Create');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      const raw = await listarLeads();
      const incluirOcultos = req.query.incluirOcultos === '1';
      const leads = raw
        .map(normalizar)
        .map(formatarLead)
        .filter(l => incluirOcultos ? true : !l.__ocultar)
        .map(l => { delete l.__ocultar; return l; });
      return res.status(200).json(leads);
    }
    if (req.method === 'POST') {
      const erpCreate = req.body?.erpCreate === true || req.headers['x-erp-create'] === '1';
      if (!erpCreate) {
        const secret = req.headers['x-webhook-secret'] || req.query.secret;
        if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
      }
      const body = req.body || {};
      if (!body.nome && !body.telefone) return res.status(400).json({ error: 'Nome ou telefone obrigatorios' });
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
