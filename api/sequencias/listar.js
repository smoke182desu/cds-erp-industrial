// api/sequencias/listar.js - lista/edita sequências de uma empresa
import { sb } from '../_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}: ${typeof r.body==='string'?r.body:JSON.stringify(r.body)}`);e.status=r.status;throw e;}return r.body;}

export default async function handler(req, res) {
  try {
    const cid = req.query?.cliente_agencia_id;
    if (req.method === 'GET') {
      if (!cid) return res.status(400).json({ error: 'cliente_agencia_id obrigatório' });
      const arr = await sbBody(`/sequencias_documentos?cliente_agencia_id=eq.${cid}&select=*`);
      return res.status(200).json(arr || []);
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      const b = req.body || {};
      if (!b.cliente_agencia_id || !b.tipo) return res.status(400).json({ error: 'cliente_agencia_id + tipo obrigatórios' });

      // Verifica se existe pra usar PATCH ou POST
      const existR = await sb(`/sequencias_documentos?cliente_agencia_id=eq.${b.cliente_agencia_id}&tipo=eq.${b.tipo}&select=tipo`);
      const exist = existR?.body?.[0];
      const allowed = ['prefixo','proximo_numero','formato','resetar_anualmente','ano_atual'];
      const data = {};
      for (const k of allowed) if (b[k] !== undefined) data[k] = b[k];

      if (exist) {
        const r = await sbBody(`/sequencias_documentos?cliente_agencia_id=eq.${b.cliente_agencia_id}&tipo=eq.${b.tipo}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' }, body: data,
        });
        return res.status(200).json(r?.[0]);
      } else {
        const r = await sbBody('/sequencias_documentos', {
          method: 'POST', headers: { Prefer: 'return=representation' },
          body: { cliente_agencia_id: b.cliente_agencia_id, tipo: b.tipo, ...data },
        });
        return res.status(201).json(r?.[0]);
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
