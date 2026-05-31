// api/ordens.js
// CRUD de Ordens de Serviço + suporte a pedidos externos (WooCommerce)
// Tabela: ordens_servico
import { selectAll, insert, update, remove, sb, upsertByField } from './_lib/supabase.js';
import { requireBearer } from './_lib/auth.js';

const TABLE = 'ordens_servico';

const ETAPAS_VALIDAS = [
  'fila', 'corte', 'dobra', 'solda_montagem', 'pintura',
  'embalagem', 'transporte', 'entregue', 'pos_venda', 'concluido'
];

const ORIGENS_EXTERNAS = new Set(['woocommerce', 'shopify', 'mercadolivre']);

function isOrigemExterna(req) {
  if (req.headers?.authorization) return true;
  const o = String(req.body?.origem || '').toLowerCase();
  return ORIGENS_EXTERNAS.has(o);
}

function corsOrigin(req) {
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.includes('*') || allowed.length === 0) return '*';
  const origin = req.headers?.origin || '';
  return allowed.includes(origin) ? origin : allowed[0];
}

function normalizar(os) {
  return {
    id: os.id,
    numero: os.numero,
    propostaId: os.proposta_id,
    clienteId: os.cliente_id,
    clienteNome: os.cliente_nome || '',
    clienteEmail: os.cliente_email || '',
    itens: Array.isArray(os.itens) ? os.itens : [],
    valorTotal: Number(os.valor_total) || 0,
    etapa: os.etapa || 'fila',
    dataEntrega: os.data_entrega,
    observacoes: os.observacoes || '',
    origem: os.origem || null,
    pedidoExternoId: os.pedido_externo_id || null,
    enderecoEntrega: os.endereco_entrega || null,
    metadata: os.metadata || {},
    clienteAgenciaId: os.cliente_agencia_id || null,
    etapaAtualizadaEm: os.etapa_atualizada_em,
    historicoEtapas: Array.isArray(os.historico_etapas) ? os.historico_etapas : [],
    criadoEm: os.criado_em,
    atualizadoEm: os.atualizado_em,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      if (req.query.id) {
        const r = await sb(`/${TABLE}?id=eq.${encodeURIComponent(req.query.id)}&limit=1`);
        if (!r.ok) return res.status(500).json({ error: 'erro buscando OS' });
        const row = Array.isArray(r.body) && r.body[0] ? normalizar(r.body[0]) : null;
        return res.status(200).json(row);
      }
      const filters = {};
      if (req.query.etapa) filters.etapa = `eq.${req.query.etapa}`;
      if (req.query.cliente_id) filters.cliente_id = `eq.${req.query.cliente_id}`;
      if (req.query.origem) filters.origem = `eq.${req.query.origem}`;
      if (req.query.cliente_agencia_id) filters.cliente_agencia_id = `eq.${req.query.cliente_agencia_id}`;
      const rows = await selectAll(TABLE, {
        orderBy: 'criado_em',
        limit: 1000,
        filters,
      });
      return res.status(200).json(rows.map(normalizar));
    }

    // POST cria nova OS
    if (req.method === 'POST') {
      const body = req.body || {};
      const externa = isOrigemExterna(req);

      // Auth obrigatória para origens externas
      if (externa && !requireBearer(req, res)) return;

      // Idempotência por (origem, pedido_externo_id)
      const origem = body.origem || null;
      const pedidoExternoId = body.pedidoExternoId || body.pedido_externo_id || null;
      if (origem && pedidoExternoId) {
        const existRes = await sb(
          `/${TABLE}?origem=eq.${encodeURIComponent(origem)}` +
          `&pedido_externo_id=eq.${encodeURIComponent(String(pedidoExternoId))}&limit=1`
        );
        if (existRes.ok && Array.isArray(existRes.body) && existRes.body[0]) {
          return res.status(200).json({
            ...normalizar(existRes.body[0]),
            _duplicate: true,
          });
        }
      }

      const payload = {
        proposta_id: body.propostaId || body.proposta_id || null,
        cliente_id: body.clienteId || body.cliente_id || null,
        cliente_nome: body.clienteNome || body.cliente_nome || (body.cliente?.nome || ''),
        cliente_email: body.clienteEmail || body.cliente_email || (body.cliente?.email || null),
        itens: body.itens || [],
        valor_total: Number(body.valorTotal || body.valor_total || body.valor) || 0,
        etapa: body.etapa && ETAPAS_VALIDAS.includes(body.etapa) ? body.etapa : 'fila',
        data_entrega: body.dataEntrega || body.data_entrega || body.dataVencimento || null,
        observacoes: body.observacoes || body.descricao || '',
        origem,
        pedido_externo_id: pedidoExternoId ? String(pedidoExternoId) : null,
        endereco_entrega: body.enderecoEntrega || body.endereco_entrega || body.cliente?.endereco || null,
        metadata: body.metadata || (externa ? { raw: body } : {}),
        cliente_agencia_id: body.clienteAgenciaId || body.cliente_agencia_id || null,
      };
      try {
        const inserted = await insert(TABLE, payload);
        return res.status(201).json(normalizar(inserted));
      } catch (err) {
        const msg = String(err.message || '');
        if (msg.includes('uq_ordens_origem_pedido_externo') || msg.includes('23505')) {
          const r = await sb(
            `/${TABLE}?origem=eq.${encodeURIComponent(origem)}` +
            `&pedido_externo_id=eq.${encodeURIComponent(String(pedidoExternoId))}&limit=1`
          );
          if (r.ok && r.body?.[0]) {
            return res.status(200).json({ ...normalizar(r.body[0]), _duplicate: true });
          }
        }
        throw err;
      }
    }

    if (req.method === 'PATCH') {
      const externa = isOrigemExterna(req);
      if (externa && !requireBearer(req, res)) return;

      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });

      if (req.query.etapa) {
        if (!ETAPAS_VALIDAS.includes(req.query.etapa)) {
          return res.status(400).json({ error: `etapa invalida. Use: ${ETAPAS_VALIDAS.join(', ')}` });
        }
        const updated = await update(TABLE, 'id', id, { etapa: req.query.etapa });
        return res.status(200).json(normalizar(updated));
      }

      const body = req.body || {};
      const patch = {};
      if (body.clienteNome !== undefined) patch.cliente_nome = String(body.clienteNome);
      if (body.itens !== undefined) patch.itens = body.itens;
      if (body.valorTotal !== undefined) patch.valor_total = Number(body.valorTotal) || 0;
      if (body.etapa !== undefined && ETAPAS_VALIDAS.includes(body.etapa)) patch.etapa = body.etapa;
      if (body.dataEntrega !== undefined) patch.data_entrega = body.dataEntrega;
      if (body.observacoes !== undefined) patch.observacoes = String(body.observacoes);
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nada para atualizar' });

      const updated = await update(TABLE, 'id', id, patch);
      return res.status(200).json(normalizar(updated));
    }

    if (req.method === 'DELETE') {
      if (req.headers?.authorization) {
        return res.status(403).json({ error: 'DELETE nao permitido para integracoes externas' });
      }
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await remove(TABLE, 'id', id);
      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: 'Metodo nao permitido' });
  } catch (err) {
    console.error('[ordens]', req.method, 'erro:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export const ETAPAS = ETAPAS_VALIDAS;
