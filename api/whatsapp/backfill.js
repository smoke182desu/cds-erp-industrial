// api/whatsapp/backfill.js
// Importa mensagens antigas do WhatsApp (backfill) apos reconectar.
// Usa a Evolution API para buscar chats e mensagens e salva no banco.
import { sb } from '../_lib/supabase.js';
import { evolutionFetch } from '../_lib/evolution.js';

async function sbBody(path, opts) {
  const r = await sb(path, opts);
  if (!r.ok) { const e = new Error(`PostgREST ${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

function soDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function variantesTelefone(valor) {
  const d = soDigitos(valor);
  const variantes = new Set();
  if (!d) return [];
  variantes.add(d);
  if (d.startsWith('55')) {
    const ddi = d.slice(0, 2);
    const ddd = d.slice(2, 4);
    const local = d.slice(4);
    if (ddd.length === 2 && local.length === 9) {
      variantes.add(`${ddi}${ddd}${local.slice(1)}`);
      if (local[0] !== '9') variantes.add(`${ddi}${ddd}9${local.slice(1)}`);
    }
    if (ddd.length === 2 && local.length === 8) {
      variantes.add(`${ddi}${ddd}9${local}`);
    }
  }
  return [...variantes];
}

async function upsertLeadPorTelefone(payload) {
  for (const tel of variantesTelefone(payload.telefone)) {
    const existentes = await sbBody(`/leads?telefone=eq.${tel}&select=id&limit=1`);
    if (existentes[0]?.id) {
      await sb(`/leads?id=eq.${existentes[0].id}`, {
        method: 'PATCH',
        body: { ...payload, telefone: existentes[0].telefone || payload.telefone },
      });
      return;
    }
  }
  await sb('/leads', { method: 'POST', body: payload }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { id, dias = 30, maxChats = 200, maxMsgs = 100 } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id da instancia obrigatorio' });

    const instArr = await sbBody(`/whatsapp_instancias?id=eq.${id}&select=*`);
    if (!instArr?.[0]) return res.status(404).json({ error: 'instancia nao encontrada' });
    const inst = instArr[0];
    const instanceName = inst.evolution_instance_name;

    const results = {
      instanceName,
      processedChats: 0,
      totalMessages: 0,
      importedMessages: 0,
      leadsCreated: 0,
      errors: [],
    };

    // Busca todos os chats
    const chats = await evolutionFetch(`/chat/findChats/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!Array.isArray(chats)) {
      return res.status(200).json({ ok: true, ...results, note: 'nenhum chat encontrado' });
    }

    results.totalChats = chats.length;
    const cutoff = Date.now() - (dias * 24 * 60 * 60 * 1000);
    const limited = chats.slice(0, maxChats);

    for (const chat of limited) {
      const remoteJid = chat.remoteJid || chat.id;
      if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast') || remoteJid.includes('@lid') || remoteJid.startsWith('0@')) continue;

      results.processedChats++;
      const numero = remoteJid.split('@')[0];
      if (!/^\d{10,15}$/.test(numero)) continue;
      const pushName = chat.pushName || chat.name || '';

      try {
        const mData = await evolutionFetch(`/chat/findMessages/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({ where: { key: { remoteJid } }, limit: maxMsgs }),
        });

        let msgs = mData.messages?.records || mData.records || (Array.isArray(mData) ? mData : []);
        msgs = msgs.filter(m => {
          const ts = m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now();
          return ts >= cutoff;
        });
        if (!msgs.length) continue;

        results.totalMessages += msgs.length;
        const rows = msgs.map(m => {
          const key = m.key || {};
          const message = m.message || {};
          const texto = message.conversation || message.extendedTextMessage?.text || m.content || m.text || '';
          const ts = m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
          return {
            cliente_agencia_id: inst.cliente_agencia_id,
            telefone: numero,
            texto,
            tipo: key.fromMe ? 'saida' : 'entrada',
            remetente: key.fromMe ? 'CDS' : (m.pushName || pushName || numero),
            instancia: instanceName,
            criado_em: ts,
          };
        }).filter(r => r.texto.trim());

        if (rows.length) {
          const batchRes = await sb(`/mensagens`, { method: 'POST', body: rows });
          if (batchRes.ok) results.importedMessages += rows.length;
          else results.errors.push({ numero, status: batchRes.status });

          const lastMsg = rows[rows.length - 1];
          await upsertLeadPorTelefone({
            telefone: numero,
            nome: pushName || numero,
            etapa: 'lead_novo',
            ultima_mensagem: lastMsg.texto || '',
            criado_em: lastMsg.criado_em,
            atualizado_em: lastMsg.criado_em,
          });
          results.leadsCreated++;
        }
      } catch (e) {
        results.errors.push({ numero, err: e.message });
      }
    }

    return res.status(200).json({ ok: true, ...results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
