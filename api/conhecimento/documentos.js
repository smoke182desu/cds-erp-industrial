import { sb } from '../_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}`);e.status=r.status;throw e;}return r.body;}
const ALLOWED = ['titulo','tipo','conteudo_md','arquivo_url','arquivo_tipo','tags','ordem','ativo','metadata'];

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, id } = req.query || {};
      if (id) {
        const arr = await sbBody(`/conhecimento_documentos?id=eq.${id}&select=*`);
        return res.status(200).json(arr?.[0] || null);
      }
      if (!cliente_id) return res.status(400).json({ error: 'cliente_id obrigatório' });
      const arr = await sbBody(`/conhecimento_documentos?cliente_agencia_id=eq.${cliente_id}&order=ordem.asc,criado_em.desc&select=*`);
      return res.status(200).json(arr || []);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.cliente_agencia_id || !b.titulo) return res.status(400).json({ error: 'cliente_agencia_id + titulo obrigatórios' });
      const insert = { cliente_agencia_id: b.cliente_agencia_id };
      for (const k of ALLOWED) if (b[k] !== undefined) insert[k] = b[k];
      const r = await sbBody('/conhecimento_documentos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: insert });
      return res.status(201).json(r?.[0]);
    }
    if (req.method === 'PATCH') {
      const id = req.query?.id; if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {}; const upd = {};
      for (const k of ALLOWED) if (b[k] !== undefined) upd[k] = b[k];
      const r = await sbBody(`/conhecimento_documentos?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id; if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/conhecimento_documentos?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) { return res.status(err.status || 500).json({ error: err.message }); }
}
