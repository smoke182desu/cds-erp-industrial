// api/templates/proposta.js — CRUD templates de proposta
import { sb } from '../_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}: ${typeof r.body==='string'?r.body:JSON.stringify(r.body)}`);e.status=r.status;throw e;}return r.body;}

const ALLOWED = ['nome','categoria','descricao','introducao_md','conteudo_md','itens_padrao','condicoes_md','cor_destaque','duracao_validade_dias','ativo','global','cliente_agencia_id','metadata'];

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, id, categoria } = req.query || {};
      if (id) {
        const arr = await sbBody(`/templates_proposta?id=eq.${id}&select=*`);
        return res.status(200).json(arr?.[0] || null);
      }
      // Lista: globais + da empresa
      const filters = ['ativo=eq.true'];
      if (cliente_id) {
        filters.push(`or=(global.eq.true,cliente_agencia_id.eq.${cliente_id})`);
      } else {
        filters.push('global=eq.true');
      }
      if (categoria) filters.push(`categoria=eq.${categoria}`);
      const qs = '?' + filters.join('&') + '&order=global.desc,nome.asc&select=*';
      const data = await sbBody(`/templates_proposta${qs}`);
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.nome) return res.status(400).json({ error: 'nome obrigatório' });
      const insert = {};
      for (const k of ALLOWED) if (b[k] !== undefined) insert[k] = b[k];
      const r = await sbBody('/templates_proposta', { method: 'POST', headers: { Prefer: 'return=representation' }, body: insert });
      return res.status(201).json(r?.[0]);
    }
    if (req.method === 'PATCH') {
      const id = req.query?.id; if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const b = req.body || {}; const upd = {};
      for (const k of ALLOWED) if (b[k] !== undefined) upd[k] = b[k];
      const r = await sbBody(`/templates_proposta?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id; if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/templates_proposta?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
