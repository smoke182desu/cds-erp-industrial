// api/leads.js
// CRUD de leads para o funil CRM
// Backend: Firebase Admin SDK + cache Upstash Redis (SWR)
// Volta para Firestore apos PHP/MySQL ter sido descontinuado.
// Mantem formatarLead (isLID, telefone BR, pushName fallback) e formato de retorno
// compativel com o frontend atual (array direto).

import {
  firestoreAdd,
  firestoreQuery,
  firestoreList,
  firestoreUpdate,
  firestoreDelete,
  firestoreIncrement,
} from './_lib/firestore.js';
import { withCacheSWR, cacheDel } from './_lib/cache.js';

const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';
const CACHE_KEY = 'leads:all';
const FRESH_S = 30;
const STALE_S = 24 * 60 * 60;

// ----------------------------------------------------------------------
// Helpers de identificacao / formatacao
// ----------------------------------------------------------------------

// Detecta se string e um LID do WhatsApp (ID anonimo da Meta 2024-2025).
// LIDs chegam via Evolution API em 'remoteJid' quando a Meta anonimiza o contato.
function isLID(digits) {
  if (digits.length >= 15) return true;
  if (digits.length >= 14 && !digits.startsWith('55') && !digits.startsWith('1')) return true;
  return false;
}

function formatarLead(lead) {
  let nome = lead.nome || '';
  const tel = lead.telefone || '';
  const pushName =
    lead.contato_nome || lead.push_name || lead.pushName || lead.nome_contato || '';

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

// ----------------------------------------------------------------------
// Acesso a dados (Firestore + SWR)
// ----------------------------------------------------------------------

async function listarLeadsDoFirestore() {
  const leads = await firestoreList('leads', 'criadoEm', 'desc', 300);
  return leads.map((d) => ({
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
    contato_nome: d.contato_nome || d.pushName || d.push_name || '',
    criadoEm: d.criadoEm?.toDate?.() ? d.criadoEm.toDate().toISOString() : (d.criadoEm || ''),
    atualizadoEm: d.atualizadoEm?.toDate?.()
      ? d.atualizadoEm.toDate().toISOString()
      : (d.atualizadoEm || ''),
  }));
}

async function listarLeads() {
  return withCacheSWR(CACHE_KEY, FRESH_S, STALE_S, listarLeadsDoFirestore);
}

async function invalidarCacheLeads() {
  await cacheDel(CACHE_KEY);
}

async function proximoCodigoCliente() {
  return firestoreIncrement('config', 'cliente_counter', 'numero');
}

async function criarPreCadastro(lead) {
  if (lead.telefone) {
    const existe = await firestoreQuery('clientes', 'telefone', lead.telefone);
    if (existe) return existe.id;
  }
  const codigo = await proximoCodigoCliente();
  const codigoFormatado = 'CLI-' + String(codigo).padStart(4, '0');
  return firestoreAdd('clientes', {
    codigo,
    codigoFormatado,
    nome: lead.nome || '',
    email: lead.email || '',
    telefone: lead.telefone || '',
    empresa: lead.empresa || '',
    tipo: 'pre_cadastro',
    origem: lead.origem || 'site',
    criadoEm: new Date(),
  });
}

// ----------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret, X-Erp-Create');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // --- GET: listar leads (formato array direto, compativel com frontend atual) ---
    if (req.method === 'GET') {
      const leads = await listarLeads();
      return res.status(200).json(leads.map(formatarLead));
    }

    // --- POST: criar lead ---
    if (req.method === 'POST') {
      const erpCreate = req.body?.erpCreate === true || req.headers['x-erp-create'] === '1';
      if (!erpCreate) {
        const secret = req.headers['x-webhook-secret'] || req.query.secret;
        if (secret !== WEBHOOK_SECRET) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      const {
        nome,
        email,
        telefone,
        mensagem,
        origem = 'site',
        empresa = '',
        etapa = 'lead_novo',
        valor = 0,
        pedidoId = '',
      } = req.body || {};

      if (!nome && !telefone) {
        return res.status(400).json({ error: 'Nome ou telefone obrigatorios' });
      }

      const clienteId = await criarPreCadastro({ nome, email, telefone, empresa, origem });

      const leadId = await firestoreAdd('leads', {
        nome: nome || '',
        email: email || '',
        telefone: telefone || '',
        mensagem: mensagem || '',
        empresa: empresa || '',
        origem,
        etapa,
        valor: Number(valor) || 0,
        pedidoId: pedidoId || '',
        clienteId: clienteId || '',
        observacoes: '',
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      });

      invalidarCacheLeads();
      return res.status(201).json({ success: true, leadId, clienteId });
    }

    // --- PUT: atualizar lead ---
    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });

      const body = req.body || {};
      const updates = {};
      const allowed = [
        'nome', 'email', 'telefone', 'empresa',
        'etapa', 'origem', 'observacoes', 'mensagem', 'pedidoId',
      ];
      for (const f of allowed) {
        if (body[f] !== undefined) updates[f] = String(body[f]);
      }
      if (body.valor !== undefined) updates.valor = Number(body.valor) || 0;

      await firestoreUpdate('leads', id, updates);
      await invalidarCacheLeads();
      return res.status(200).json({ ok: true, id });
    }

    // --- DELETE: remover lead ---
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await firestoreDelete('leads', id);
      await invalidarCacheLeads();
      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[leads]', req.method, 'erro:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
