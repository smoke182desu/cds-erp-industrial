// api/trafego/criativos.js
import { sb } from '../_lib/supabase.js';

async function sbBody(path, opts) {
  const r = await sb(path, opts);
  if (!r.ok) { const e = new Error(`PostgREST ${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { campanha_id, cliente_id, id } = req.query || {};
      if (id) {
        const arr = await sbBody(`/criativos_trafego?id=eq.${id}&select=*`);
        return res.status(200).json(arr?.[0] || null);
      }
      const filters = [];
      if (campanha_id) filters.push(`campanha_id=eq.${campanha_id}`);
      if (cliente_id) filters.push(`cliente_agencia_id=eq.${cliente_id}`);
      const qs = filters.length ? '?' + filters.join('&') + '&' : '?';
      const data = await sbBody(`/criativos_trafego${qs}order=criado_em.desc&select=*`);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.campanha_id) return res.status(400).json({ error: 'campanha_id obrigatório' });
      if (!b.cliente_agencia_id) return res.status(400).json({ error: 'cliente_agencia_id obrigatório' });
      if (!b.tipo) return res.status(400).json({ error: 'tipo obrigatório' });
      const saved = await sbBody('/criativos_trafego', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
          campanha_id: b.campanha_id,
          cliente_agencia_id: b.cliente_agencia_id,
          tipo: b.tipo,
          headline: b.headline || null,
          texto_principal: b.texto_principal || null,
          descricao: b.descricao || null,
          cta: b.cta || null,
          link_destino: b.link_destino || null,
          assets: b.assets || [],
          variacao: b.variacao || null,
          status: b.status || 'rascunho',
          fonte: b.fonte || 'manual',
          metadata: b.metadata || {},
        },
      });
      return res.status(201).json(saved?.[0] || saved);
    }

    if (req.method === 'PATCH') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {};
      const allowed = ['tipo','headline','texto_principal','descricao','cta','link_destino','assets','variacao','status','metricas','external_ids','metadata'];
      const update = {};
      for (const k of allowed) if (b[k] !== undefined) update[k] = b[k];
      const updated = await sbBody(`/criativos_trafego?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: update,
      });
      return res.status(200).json(updated?.[0] || updated);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/criativos_trafego?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
