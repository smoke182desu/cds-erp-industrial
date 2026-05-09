// api/propostas.js — CRUD de propostas no Supabase
import { sb, selectAll, insert, update } from './_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // --- GET: listar propostas ---
    if (req.method === 'GET') {
      const { status } = req.query || {};
      const filters = {};
      if (status && status !== 'todas') {
        filters.status = `eq.${status}`;
      }
      const rows = await selectAll('propostas', {
        orderBy: 'criado_em',
        limit: 500,
        filters,
      });
      return res.status(200).json(rows);
    }

    // --- POST: criar proposta ---
    if (req.method === 'POST') {
      const body = req.body || {};
      const {
        telefone,
        nome_cliente,
        empresa,
        itens,
        valor_total,
        status: statusProp,
        observacoes,
        lead_id,
      } = body;

      if (!nome_cliente && !telefone) {
        return res.status(400).json({ error: 'nome_cliente ou telefone obrigatorio' });
      }

      const data = {
        telefone: telefone || null,
        nome_cliente: nome_cliente || '',
        empresa: empresa || null,
        itens: JSON.stringify(Array.isArray(itens) ? itens : []),
        valor_total: valor_total || 0,
        status: statusProp || 'rascunho',
        observacoes: observacoes || null,
        lead_id: lead_id || null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };

      const saved = await insert('propostas', data);
      return res.status(200).json({ ok: true, proposta: saved });
    }

    // --- PATCH: atualizar status ---
    if (req.method === 'PATCH') {
      const { id, status: novoStatus, observacoes } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });

      const updates = { atualizado_em: new Date().toISOString() };
      if (novoStatus) updates.status = novoStatus;
      if (observacoes !== undefined) updates.observacoes = observacoes;

      const updated = await update('propostas', 'id', id, updates);
      return res.status(200).json({ ok: true, proposta: updated });
    }

    return res.status(405).json({ error: 'Metodo nao permitido' });
  } catch (e) {
    console.error('[propostas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
