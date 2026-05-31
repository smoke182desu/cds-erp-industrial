// api/posts/calendario.js — CRUD posts agendados + workflow aprovação
import { sb } from '../_lib/supabase.js';
import { randomBytes } from 'crypto';

async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}`);e.status=r.status;throw e;}return r.body;}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, mes, status, id } = req.query || {};
      if (id) {
        const arr = await sbBody(`/posts_calendario?id=eq.${id}&select=*,trafego_clientes(id,nome,slug,cor_destaque)`);
        return res.status(200).json(arr?.[0] || null);
      }
      const filters = [];
      if (cliente_id) filters.push(`cliente_agencia_id=eq.${cliente_id}`);
      if (status) filters.push(`status=eq.${status}`);
      if (mes) {
        // mes = '2026-05' → entre 1 e último dia
        const ano = mes.slice(0, 4), m = mes.slice(5, 7);
        filters.push(`agendado_para=gte.${ano}-${m}-01`);
        filters.push(`agendado_para=lt.${ano}-${String(+m + 1).padStart(2,'0')}-01`);
      }
      const qs = filters.length ? '?' + filters.join('&') + '&' : '?';
      const data = await sbBody(`/posts_calendario${qs}order=agendado_para.asc&select=*,trafego_clientes(id,nome,slug,cor_destaque)`);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.cliente_agencia_id || !b.titulo) return res.status(400).json({ error: 'cliente_agencia_id + titulo obrigatórios' });
      // Gera token único pra aprovação
      const token = randomBytes(16).toString('hex');
      const saved = await sbBody('/posts_calendario', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: {
          cliente_agencia_id: b.cliente_agencia_id,
          campanha_id: b.campanha_id || null,
          titulo: b.titulo,
          texto: b.texto || null,
          plataformas: b.plataformas || [],
          tipo: b.tipo || 'imagem',
          assets: b.assets || [],
          agendado_para: b.agendado_para || null,
          status: b.status || 'rascunho',
          token_aprovacao: token,
          metadata: b.metadata || {},
        },
      });
      return res.status(201).json(saved?.[0]);
    }

    if (req.method === 'PATCH') {
      const { id, token } = req.query || {};
      const b = req.body || {};
      if (!id && !token) return res.status(400).json({ error: 'id ou token obrigatório' });

      // Se veio por token, é uma ação pública de aprovação/rejeição (sem auth)
      if (token) {
        const arr = await sbBody(`/posts_calendario?token_aprovacao=eq.${token}&select=*`);
        const post = arr?.[0];
        if (!post) return res.status(404).json({ error: 'token inválido' });

        const acao = b.acao;
        if (acao === 'aprovar') {
          const r = await sbBody(`/posts_calendario?id=eq.${post.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' },
            body: { status: 'aprovado_cliente', aprovado_em: new Date().toISOString(), aprovado_por: b.nome_aprovador || 'cliente', comentarios_cliente: b.comentarios || null },
          });
          return res.status(200).json(r?.[0]);
        }
        if (acao === 'rejeitar') {
          const r = await sbBody(`/posts_calendario?id=eq.${post.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' },
            body: { status: 'rejeitado_cliente', comentarios_cliente: b.comentarios || null },
          });
          return res.status(200).json(r?.[0]);
        }
        if (acao === 'visualizar') {
          // Registra abertura
          await sbBody(`/posts_calendario?id=eq.${post.id}`, {
            method: 'PATCH', body: { link_aprovacao_aberto_em: new Date().toISOString() },
          });
        }
        return res.status(200).json(post);
      }

      // Edição autenticada
      const allowed = ['titulo','texto','plataformas','tipo','assets','agendado_para','status','comentarios_cliente','metadata','external_ids','publicado_em'];
      const upd = {}; for (const k of allowed) if (b[k] !== undefined) upd[k] = b[k];
      const r = await sbBody(`/posts_calendario?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/posts_calendario?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
