// api/whatsapp/send.js
import { sb } from '../_lib/supabase.js';
import { evolutionFetch } from '../_lib/evolution.js';

async function sbBody(path, opts) {
  const r = await sb(path, opts);
  if (!r.ok) { const e = new Error(`PostgREST ${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

function normalizarTelefone(tel) {
  let t = String(tel || '').replace(/\D/g, '');
  if (!t) return '';
  if (!t.startsWith('55')) t = '55' + t;
  return t;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { cliente_agencia_id, instancia_id, telefone, mensagem } = req.body || {};
    if (!telefone || !mensagem) return res.status(400).json({ error: 'telefone e mensagem obrigatorios' });

    let inst;
    if (instancia_id) {
      const r = await sbBody(`/whatsapp_instancias?id=eq.${instancia_id}&select=*`);
      inst = r?.[0];
    } else if (cliente_agencia_id) {
      const r = await sbBody(`/whatsapp_instancias?cliente_agencia_id=eq.${cliente_agencia_id}&status=eq.conectado&order=criado_em.desc&limit=1`);
      inst = r?.[0];
    }
    if (!inst) return res.status(404).json({ error: 'Nenhuma instancia conectada encontrada' });

    const numero = normalizarTelefone(telefone);
    const resp = await evolutionFetch(`/message/sendText/${inst.evolution_instance_name}`, {
      method: 'POST',
      body: JSON.stringify({ number: numero, text: mensagem }),
    });

    try {
      await sb('/mensagens', {
        method: 'POST',
        body: {
          cliente_agencia_id: inst.cliente_agencia_id,
          telefone: numero,
          conteudo: mensagem,
          direcao: 'saida',
          status: 'enviado',
          provider_message_id: resp?.key?.id,
          metadata: { evolution: resp },
        },
      });
    } catch (e) { /* mensagens table may have different schema */ }

    return res.status(200).json({ ok: true, evolution: resp });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
