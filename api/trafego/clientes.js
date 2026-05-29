// api/trafego/clientes.js
// CRUD dos clientes (tenants) do modulo Trafego Pago.
// Sprint 1: lista, cria, atualiza, arquiva.
import { selectAll, insert, update, remove } from '../_lib/supabase.js';

const TABLE = 'trafego_clientes';

function slugify(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function normalizarPayload(body) {
  const out = {};
  const campos = ['nome', 'slug', 'logo_url', 'cor_destaque', 'status', 'responsavel', 'email_contato', 'telefone_contato', 'observacoes'];
  for (const k of campos) {
    if (body[k] !== undefined) out[k] = body[k] === null ? null : String(body[k]).trim();
  }
  if (body.fee_mensal !== undefined) out.fee_mensal = Number(body.fee_mensal) || 0;
  return out;
}

async function listar(req) {
  const incluirArquivados = req.query?.incluirArquivados === '1';
  const filters = {};
  if (!incluirArquivados) filters.status = 'neq.arquivado';
  const rows = await selectAll(TABLE, { orderBy: 'criado_em', limit: 500, filters });
  return rows;
}

async function criar(body) {
  if (!body?.nome) throw new Error('nome obrigatorio');
  const payload = normalizarPayload(body);
  if (!payload.slug) payload.slug = slugify(payload.nome);
  if (!payload.status) payload.status = 'ativo';
  if (!payload.cor_destaque) payload.cor_destaque = '#6366f1';
  const row = await insert(TABLE, payload);
  return row;
}

async function atualizar(id, body) {
  if (!id) throw new Error('id obrigatorio');
  const payload = normalizarPayload(body);
  if (Object.keys(payload).length === 0) throw new Error('nada para atualizar');
  const row = await update(TABLE, 'id', id, payload);
  return row;
}

async function arquivar(id) {
  if (!id) throw new Error('id obrigatorio');
  await update(TABLE, 'id', id, { status: 'arquivado' });
  return { id, status: 'arquivado' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const clientes = await listar(req);
      return res.status(200).json({ clientes });
    }
    if (req.method === 'POST') {
      const row = await criar(req.body || {});
      return res.status(201).json({ cliente: row });
    }
    if (req.method === 'PUT') {
      const id = req.query?.id;
      const row = await atualizar(id, req.body || {});
      return res.status(200).json({ cliente: row });
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id;
      const result = await arquivar(id);
      return res.status(200).json(result);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[trafego/clientes]', req.method, err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
