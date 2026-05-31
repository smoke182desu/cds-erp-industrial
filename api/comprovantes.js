// api/comprovantes.js — CRUD comprovantes
import { sb } from './_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}: ${typeof r.body==='string'?r.body:JSON.stringify(r.body)}`);e.status=r.status;throw e;}return r.body;}
const ALLOWED = ['tipo','titulo','descricao','valor','data_pagamento','arquivo_url','arquivo_tipo','arquivo_tamanho','pedido_wc_id','lead_id','proposta_gerada_id','fatura_agencia_id','status','observacoes','metadata'];

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, id, status, tipo } = req.query || {};
      if (id) {
        const arr = await sbBody(`/comprovantes?id=eq.${id}&select=*,trafego_clientes(nome,cor_destaque),wc_pedidos(numero_wc,total,cliente_nome),faturas_agencia(competencia,valor_total)`);
        return res.status(200).json(arr?.[0] || null);
      }
      const filters = [];
      if (cliente_id) filters.push(`cliente_agencia_id=eq.${cliente_id}`);
      if (status) filters.push(`status=eq.${status}`);
      if (tipo) filters.push(`tipo=eq.${tipo}`);
      const qs = filters.length ? '?' + filters.join('&') + '&' : '?';
      const data = await sbBody(`/comprovantes${qs}order=criado_em.desc&limit=300&select=*,trafego_clientes(nome,cor_destaque),wc_pedidos(numero_wc,total,cliente_nome),faturas_agencia(competencia,valor_total)`);
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.cliente_agencia_id || !b.tipo) return res.status(400).json({ error: 'cliente_agencia_id + tipo obrigatórios' });
      const insert = { cliente_agencia_id: b.cliente_agencia_id };
      for (const k of ALLOWED) if (b[k] !== undefined) insert[k] = b[k];
      const r = await sbBody('/comprovantes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: insert });
      return res.status(201).json(r?.[0]);
    }
    if (req.method === 'PATCH') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {};
      const upd = {};
      for (const k of ALLOWED) if (b[k] !== undefined) upd[k] = b[k];
      if (upd.status === 'conferido' || upd.status === 'aprovado') {
        upd.conciliado_em = new Date().toISOString();
      }
      const r = await sbBody(`/comprovantes?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/comprovantes?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }
    return res.status(405).end();
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
