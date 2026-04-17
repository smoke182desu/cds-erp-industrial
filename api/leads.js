// api/leads.js
// CRUD de leads para o funil CRM
// MIGRADO para Firebase Admin SDK para evitar quota 50k/dia da REST API publica

import { firestoreAdd, firestoreQuery, firestoreList, firestoreUpdate, firestoreIncrement } from './_lib/firestore.js';
import { withCacheSWR, cacheDel } from './_lib/cache.js';

const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';

// ---------- contador sequencial de clientes ----------
async function proximoCodigoCliente() {
  const proximo = await firestoreIncrement('config', 'cliente_counter', 'numero');
  return proximo;
}

// ---------- pre-cadastro no CRM (com numeracao) ----------
async function criarPreCadastro(lead) {
  if (lead.telefone) {
    const existe = await firestoreQuery('clientes', 'telefone', lead.telefone);
    if (existe) return existe.id;
  }

  const codigo = await proximoCodigoCliente();
  const codigoFormatado = 'CLI-' + String(codigo).padStart(4, '0');

  return firestoreAdd('clientes', {
    codigo: codigo,
    codigoFormatado: codigoFormatado,
    nome: lead.nome || '',
    email: lead.email || '',
    telefone: lead.telefone || '',
    empresa: lead.empresa || '',
    tipo: 'pre_cadastro',
    origem: lead.origem || 'site',
    criadoEm: new Date(),
  });
}

// ---------- listar todos os leads ----------
async function listarLeadsDoFirestore() {
  const leads = await firestoreList('leads', 'criadoEm', 'desc', 300);
  return leads.map(d => ({
    id: d.id,
    nome: d.nome || '',
    email: d.email || '',
    telefone: d.telefone || '',
    empresa: d.empresa || '',
    mensagem: d.mensagem || '',
    origem: d.origem || 'manual',
    etapa: d.etapa || 'lead_novo',
    valor: Number(d.valor) || 0,
    pedidoId: d.pedidoId || '',
    clienteId: d.clienteId || '',
    observacoes: d.observacoes || '',
    criadoEm: d.criadoEm?.toDate?.() ? d.criadoEm.toDate().toISOString() : (d.criadoEm || ''),
    atualizadoEm: d.atualizadoEm?.toDate?.() ? d.atualizadoEm.toDate().toISOString() : (d.atualizadoEm || ''),
  }));
}

// ---------- Cache SWR compartilhado (Upstash Redis + fallback memoria) ----------
// Fresco 30s — stale serve por 24h mesmo se Firestore cair/quota estourar.
// Invalidacao explicita ao criar/atualizar lead.
const CACHE_KEY = 'leads:all';
const FRESH_S = 30;
const STALE_S = 24 * 60 * 60;

async function listarLeads() {
  return withCacheSWR(CACHE_KEY, FRESH_S, STALE_S, listarLeadsDoFirestore);
}

async function invalidarCacheLeads() {
  await cacheDel(CACHE_KEY);
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - listar leads
  if (req.method === 'GET') {
    try {
      const leads = await listarLeads();
      return res.status(200).json({ ok: true, leads, total: leads.length });
    } catch (err) {
      console.error('[leads GET] erro:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // PUT - atualizar lead
  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id obrigatorio' });

    try {
      const body = req.body || {};
      const updates = {};
      const allowedFields = ['nome', 'email', 'telefone', 'empresa', 'etapa', 'origem', 'observacoes', 'mensagem', 'pedidoId'];

      for (const field of allowedFields) {
        if (body[field] !== undefined) updates[field] = String(body[field]);
      }
      if (body.valor !== undefined) updates.valor = Number(body.valor) || 0;

      await firestoreUpdate('leads', id, updates);
      await invalidarCacheLeads();
      return res.status(200).json({ ok: true, id });
    } catch (err) {
      console.error('[leads PUT] erro:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // POST - criar lead
  const erpCreate = req.body?.erpCreate === true || req.headers['x-erp-create'] === '1';
  if (!erpCreate) {
    const secret = req.headers['x-webhook-secret'] || req.query.secret;
    if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { nome, email, telefone, mensagem, origem = 'site', empresa = '', etapa = 'lead_novo', valor = 0, pedidoId = '' } = req.body;

  if (!nome && !telefone) return res.status(400).json({ error: 'Nome ou telefone obrigatorios' });

  try {
    const clienteId = await criarPreCadastro({ nome, email, telefone, empresa, origem });

    const leadId = await firestoreAdd('leads', {
      nome: nome || '',
      email: email || '',
      telefone: telefone || '',
      mensagem: mensagem || '',
      empresa: empresa || '',
      origem: origem,
      etapa: etapa,
      valor: Number(valor) || 0,
      pedidoId: pedidoId || '',
      clienteId: clienteId || '',
      observacoes: '',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });

    invalidarCacheLeads();
    return res.status(201).json({ success: true, leadId, clienteId });
  } catch (error) {
    console.error('Leads error:', error.message);
    return res.status(500).json({ error: 'Erro ao salvar lead' });
  }
}
