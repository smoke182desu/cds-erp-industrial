// api/ordens.js
// CRUD de Ordens de Servico + movimentacao de etapa Kanban
// Tabela: ordens_servico
import { selectAll, insert, update, remove, sb } from './_lib/supabase.js';

const TABLE = 'ordens_servico';

const ETAPAS_VALIDAS = [
  'fila', 'corte', 'dobra', 'solda_montagem', 'pintura',
  'embalagem', 'transporte', 'entregue', 'pos_venda', 'concluido'
];

function normalizar(os) {
  return {
    id: os.id,
    numero: os.numero,
    propostaId: os.proposta_id,
    clienteId: os.cliente_id,
    clienteNome: os.cliente_nome || '',
    itens: Array.isArray(os.itens) ? os.itens : [],
    valorTotal: Number(os.valor_total) || 0,
    etapa: os.etapa || 'fila',
    dataEntrega: os.data_entrega,
    observacoes: os.observacoes || '',
    etapaAtualizadaEm: os.etapa_atualizada_em,
    historicoEtapas: Array.isArray(os.historico_etapas) ? os.historico_etapas : [],
    criadoEm: os.criado_em,
    atualizadoEm: os.atualizado_em,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET /api/ordens                  → lista todas
    // GET /api/ordens?etapa=corte      → filtra por etapa
    // GET /api/ordens?id=...           → busca uma
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
      const rows = await selectAll(TABLE, {
        orderBy: 'criado_em',
        limit: 1000,
        filters,
      });
      return res.status(200).json(rows.map(normalizar));
    }

    // POST /api/ordens → cria nova OS
    if (req.method === 'POST') {
      const body = req.body || {};
      const payload = {
        proposta_id: body.propostaId || body.proposta_id || null,
        cliente_id: body.clienteId || body.cliente_id || null,
        cliente_nome: body.clienteNome || body.cliente_nome || '',
        itens: body.itens || [],
        valor_total: Number(body.valorTotal || body.valor_total) || 0,
        etapa: body.etapa && ETAPAS_VALIDAS.includes(body.etapa) ? body.etapa : 'fila',
        data_entrega: body.dataEntrega || body.data_entrega || null,
        observacoes: body.observacoes || '',
      };
      const inserted = await insert(TABLE, payload);
      return res.status(201).json(normalizar(inserted));
    }

    // PATCH /api/ordens?id=...&etapa=corte  → move OS para nova etapa
    // PATCH /api/ordens?id=...              → atualiza campos arbitrarios (body)
    if (req.method === 'PATCH') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });

      // Move de etapa (atalho)
      if (req.query.etapa) {
        if (!ETAPAS_VALIDAS.includes(req.query.etapa)) {
          return res.status(400).json({ error: `etapa invalida. Use: ${ETAPAS_VALIDAS.join(', ')}` });
        }
        const updated = await update(TABLE, 'id', id, { etapa: req.query.etapa });
        return res.status(200).json(normalizar(updated));
      }

      // Update generico
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

    // DELETE /api/ordens?id=...
    if (req.method === 'DELETE') {
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
