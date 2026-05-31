// api/wc-pedidos.js — Lista de pedidos WC sincronizados
import { sb } from './_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}`);e.status=r.status;throw e;}return r.body;}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, id, status, loja_id } = req.query || {};
      if (id) {
        const arr = await sbBody(`/wc_pedidos?id=eq.${id}&select=*,wc_lojas(nome,url)`);
        return res.status(200).json(arr?.[0] || null);
      }
      const filters = [];
      if (cliente_id) filters.push(`cliente_agencia_id=eq.${cliente_id}`);
      if (status) filters.push(`status=eq.${status}`);
      if (loja_id) filters.push(`loja_id=eq.${loja_id}`);
      const qs = filters.length ? '?' + filters.join('&') + '&' : '?';
      const data = await sbBody(`/wc_pedidos${qs}order=data_pedido.desc&limit=300&select=*,wc_lojas(nome,url)`);
      return res.status(200).json(data || []);
    }
    if (req.method === 'PATCH') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {};
      const allowed = ['status','lead_id','proposta_id','notas_cliente'];
      const upd = {};
      for (const k of allowed) if (b[k] !== undefined) upd[k] = b[k];
      const r = await sbBody(`/wc_pedidos?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }
    return res.status(405).end();
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
