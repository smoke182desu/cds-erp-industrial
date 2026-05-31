// api/faturas/index.js
import { sb } from './_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}: ${JSON.stringify(r.body)}`);e.status=r.status;throw e;}return r.body;}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, status, competencia } = req.query || {};
      const filters = [];
      if (cliente_id) filters.push(`cliente_agencia_id=eq.${cliente_id}`);
      if (status) filters.push(`status=eq.${status}`);
      if (competencia) filters.push(`competencia=eq.${competencia}`);
      const qs = filters.length ? '?' + filters.join('&') + '&' : '?';
      // join com empresa
      const data = await sbBody(`/faturas_agencia${qs}order=competencia.desc,criado_em.desc&select=*,trafego_clientes(id,nome,slug,cor_destaque,responsavel)`);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      // Pode ser uma fatura única OU disparar gerar_faturas_mes
      const b = req.body || {};
      if (b.acao === 'gerar_mes') {
        const r = await sb('/rpc/gerar_faturas_mes', {
          method: 'POST',
          body: b.competencia ? { p_mes: b.competencia } : {},
        });
        return res.status(200).json({ resultado: r.body, ok: r.ok });
      }
      const saved = await sbBody('/faturas_agencia', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: b,
      });
      return res.status(201).json(saved?.[0]);
    }

    if (req.method === 'PATCH') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {};
      const allowed = ['data_vencimento','valor_fee','valor_extras','valor_total','descricao','status','forma_pagamento','data_pagamento','link_pagamento','observacoes','numero_fatura','metadata'];
      const upd = {};
      for (const k of allowed) if (b[k] !== undefined) upd[k] = b[k];
      // Quando marca como paga, grava data_pagamento se não veio
      if (upd.status === 'paga' && !upd.data_pagamento) upd.data_pagamento = new Date().toISOString().slice(0, 10);
      const r = await sbBody(`/faturas_agencia?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/faturas_agencia?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
