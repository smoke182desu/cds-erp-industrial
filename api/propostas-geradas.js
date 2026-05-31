// api/propostas-geradas/index.js
import { sb } from './_lib/supabase.js';
import { randomBytes } from 'crypto';

async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}: ${typeof r.body==='string'?r.body:JSON.stringify(r.body)}`);e.status=r.status;throw e;}return r.body;}

const ALLOWED = ['template_id','numero_documento','cliente_nome','cliente_contato','cliente_telefone','cliente_email','cliente_cnpj','titulo','introducao_md','conteudo_md','itens','condicoes_md','observacoes','valor_total','desconto','valor_final','cor_destaque','status','data_validade','data_enviada','data_visualizada','data_resposta','comentarios_cliente','metadata'];

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { cliente_id, id, status, token } = req.query || {};
      if (id) {
        const arr = await sbBody(`/propostas_geradas?id=eq.${id}&select=*,trafego_clientes(nome,cor_destaque)`);
        return res.status(200).json(arr?.[0] || null);
      }
      if (token) {
        const arr = await sbBody(`/propostas_geradas?token_publico=eq.${token}&select=*,trafego_clientes(nome,cor_destaque)`);
        return res.status(200).json(arr?.[0] || null);
      }
      const filters = [];
      if (cliente_id) filters.push(`cliente_agencia_id=eq.${cliente_id}`);
      if (status) filters.push(`status=eq.${status}`);
      const qs = filters.length ? '?' + filters.join('&') + '&' : '?';
      const data = await sbBody(`/propostas_geradas${qs}order=criado_em.desc&limit=300&select=*,trafego_clientes(nome,cor_destaque)`);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.cliente_agencia_id) return res.status(400).json({ error: 'cliente_agencia_id obrigatório' });
      if (!b.titulo) return res.status(400).json({ error: 'titulo obrigatório' });

      // gera próximo número da empresa
      let numero = b.numero_documento;
      if (!numero) {
        try {
          const nr = await sb('/rpc/gerar_proximo_numero', { method: 'POST', body: { p_cliente_agencia: b.cliente_agencia_id, p_tipo: 'proposta' } });
          numero = typeof nr.body === 'string' ? nr.body : null;
        } catch { numero = null; }
      }

      const token = randomBytes(16).toString('hex');
      const insert = { cliente_agencia_id: b.cliente_agencia_id, numero_documento: numero, token_publico: token };
      for (const k of ALLOWED) if (b[k] !== undefined) insert[k] = b[k];

      if (!insert.valor_final && insert.valor_total) insert.valor_final = (Number(insert.valor_total) || 0) - (Number(insert.desconto) || 0);

      const r = await sbBody('/propostas_geradas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: insert });
      return res.status(201).json(r?.[0]);
    }

    if (req.method === 'PATCH') {
      const { id, token } = req.query || {};
      const b = req.body || {};

      // Action by token (sem auth) — aprovar/rejeitar
      if (token) {
        const arr = await sbBody(`/propostas_geradas?token_publico=eq.${token}&select=id`);
        const p = arr?.[0];
        if (!p) return res.status(404).json({ error: 'Token inválido' });
        const acao = b.acao;
        if (acao === 'visualizar') {
          await sb(`/propostas_geradas?id=eq.${p.id}`, { method: 'PATCH', body: { data_visualizada: new Date().toISOString(), status: 'visualizada' } });
          return res.status(200).json({ ok: true });
        }
        if (acao === 'aprovar') {
          const r = await sbBody(`/propostas_geradas?id=eq.${p.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' },
            body: { status: 'aprovada', data_resposta: new Date().toISOString(), comentarios_cliente: b.comentarios || null },
          });
          return res.status(200).json(r?.[0]);
        }
        if (acao === 'rejeitar') {
          const r = await sbBody(`/propostas_geradas?id=eq.${p.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' },
            body: { status: 'rejeitada', data_resposta: new Date().toISOString(), comentarios_cliente: b.comentarios || null },
          });
          return res.status(200).json(r?.[0]);
        }
        return res.status(400).json({ error: 'acao inválida' });
      }

      // Edição autenticada
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const upd = {};
      for (const k of ALLOWED) if (b[k] !== undefined) upd[k] = b[k];
      // Marca data_enviada se virou enviada
      if (upd.status === 'enviada' && !upd.data_enviada) upd.data_enviada = new Date().toISOString();
      const r = await sbBody(`/propostas_geradas?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd });
      return res.status(200).json(r?.[0]);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sb(`/propostas_geradas?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
