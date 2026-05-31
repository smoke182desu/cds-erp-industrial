// api/trafego/campanhas.js
// CRUD de campanhas por cliente_agencia_id
import { sb } from '../_lib/supabase.js';

async function sbBody(path, opts) {
  const r = await sb(path, opts);
  if (!r.ok) { const e = new Error(`PostgREST ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body)}`); e.status = r.status; throw e; }
  return r.body;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, status, id } = req.query || {};
      if (id) {
        const arr = await sbBody(`/campanhas_trafego?id=eq.${id}&select=*`);
        return res.status(200).json(arr?.[0] || null);
      }
      const filters = [];
      if (cliente_id) filters.push(`cliente_agencia_id=eq.${cliente_id}`);
      if (status) filters.push(`status=eq.${status}`);
      const qs = filters.length ? '?' + filters.join('&') + '&' : '?';
      const data = await sbBody(`/campanhas_trafego${qs}order=criado_em.desc&select=*`);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.cliente_agencia_id) return res.status(400).json({ error: 'cliente_agencia_id obrigatório' });
      if (!b.nome) return res.status(400).json({ error: 'nome obrigatório' });
      if (!b.objetivo) return res.status(400).json({ error: 'objetivo obrigatório' });

      const saved = await sbBody('/campanhas_trafego', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
          cliente_agencia_id: b.cliente_agencia_id,
          nome: b.nome,
          objetivo: b.objetivo,
          plataformas: b.plataformas || [],
          orcamento_diario: b.orcamento_diario || null,
          orcamento_total: b.orcamento_total || null,
          data_inicio: b.data_inicio || null,
          data_fim: b.data_fim || null,
          audiencia_id: b.audiencia_id || null,
          audiencia_spec: b.audiencia_spec || {},
          status: b.status || 'rascunho',
          briefing_md: b.briefing_md || null,
          metadata: b.metadata || {},
        },
      });
      return res.status(201).json(saved?.[0] || saved);
    }

    if (req.method === 'PATCH') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {};
      const allowed = ['nome','objetivo','plataformas','orcamento_diario','orcamento_total','data_inicio','data_fim','audiencia_id','audiencia_spec','status','briefing_md','metadata','metricas_cache','external_ids','publicado_em','ultimo_sync_em'];
      const update = {};
      for (const k of allowed) if (b[k] !== undefined) update[k] = b[k];
      if (!Object.keys(update).length) return res.status(400).json({ error: 'sem campos pra atualizar' });
      const updated = await sbBody(`/campanhas_trafego?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: update,
      });
      return res.status(200).json(updated?.[0] || updated);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/campanhas_trafego?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
