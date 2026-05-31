// api/trafego/audiencias.js
import { sb } from '../_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}`);e.status=r.status;throw e;}return r.body;}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id } = req.query || {};
      const qs = cliente_id ? `?cliente_agencia_id=eq.${cliente_id}&` : '?';
      const data = await sbBody(`/audiencias_trafego${qs}order=criado_em.desc&select=*`);
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.nome) return res.status(400).json({ error: 'nome obrigatório' });
      const saved = await sbBody('/audiencias_trafego', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: { cliente_agencia_id: b.cliente_agencia_id, nome: b.nome, descricao: b.descricao, spec: b.spec || {}, reach_estimado: b.reach_estimado, publica: !!b.publica },
      });
      return res.status(201).json(saved?.[0] || saved);
    }
    if (req.method === 'PATCH') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {};
      const upd = {}; ['nome','descricao','spec','reach_estimado','publica'].forEach(k=>{if(b[k]!==undefined) upd[k]=b[k];});
      const r = await sbBody(`/audiencias_trafego?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/audiencias_trafego?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
