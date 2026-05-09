// api/whatsapp.js — webhook handler, normaliza payload Evolution API e salva no Supabase
import { insert, upsertByField } from './_lib/supabase.js';

// Identifica se um JID é um LID (Linked ID anônimo) ou outro tipo não-pessoal
function jidEhInvalido(jid) {
  if (!jid || typeof jid !== 'string') return true;
  return jid.includes('@lid')
    || jid.includes('@g.us')
    || jid.includes('@broadcast')
    || jid.includes('@newsletter')
    || jid.startsWith('0@');
}

// Tenta extrair o número de telefone real (E.164 sem '+'), ignorando LIDs.
// Ordem de preferência segue convenções da Baileys/Evolution API moderna.
function extrairNumeroReal(key, data, body) {
  const candidatos = [
    data.senderPn,           // sender phone number (Baileys novo)
    key.senderPn,
    key.participantPn,       // participant phone number (em grupos/comunidades)
    data.participantPn,
    key.remoteJidAlt,        // JID alternativo
    data.remoteJidAlt,
    body.senderPn,
    // só usa participant/remoteJid se NÃO for LID/grupo
    !jidEhInvalido(key.participant) ? key.participant : null,
    !jidEhInvalido(key.remoteJid) ? key.remoteJid : null,
    !jidEhInvalido(data.remoteJid) ? data.remoteJid : null,
  ];
  for (const c of candidatos) {
    if (!c || typeof c !== 'string') continue;
    if (jidEhInvalido(c)) continue;
    const numero = c.split('@')[0].replace(/\D/g, '');
    if (/^\d{8,15}$/.test(numero)) return numero;
  }
  return null;
}

function normalizarPayload(body) {
  if (!body || typeof body !== 'object') return body;
  try {
    const data = body.data || body;
    const key = data.key || {};
    const message = data.message || {};

    const numero = extrairNumeroReal(key, data, body);
    const remoteJid = key.remoteJid || data.remoteJid || '';
    const pushName = data.pushName || data.notifyName || body.pushName || '';

    // Texto da mensagem (suporta vários formatos da Evolution API)
    const texto = message.conversation
      || message.extendedTextMessage?.text
      || message.imageMessage?.caption
      || message.videoMessage?.caption
      || message.documentMessage?.caption
      || data.content
      || data.text
      || '';

    return {
      pushName: pushName || null,
      remoteJid,
      numero,
      texto,
      fromMe: !!key.fromMe,
      instance: body.instance || data.instance || null,
      event: body.event || null,
      // Normaliza para ms: Evolution pode enviar segundos ou milliseconds
      timestamp: (() => { const ts = data.messageTimestamp || Math.floor(Date.now() / 1000); return ts > 1e12 ? ts : ts * 1000; })(),
      ehLid: jidEhInvalido(remoteJid),
    };
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge || 'ok';
    return res.status(200).send(String(challenge));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const norm = normalizarPayload(body);

    if (!norm) {
      return res.status(200).json({ ok: true, skipped: 'payload invalido' });
    }

    // Sem número real (só LID): salvamos só a mensagem com o LID,
    // mas NÃO criamos lead novo — evita gerar leads "Aguardando identificação" zumbis.
    if (!norm.numero) {
      const lidPuro = (norm.remoteJid || '').split('@')[0].replace(/\D/g, '');
      if (lidPuro) {
        await insert('mensagens', {
          telefone: lidPuro,
          texto: norm.texto,
          tipo: norm.fromMe ? 'saida' : 'entrada',
          remetente: norm.pushName,
          instancia: norm.instance,
          payload_bruto: body,
          criado_em: new Date(norm.timestamp).toISOString()
        }).catch(() => {});
      }
      return res.status(200).json({ ok: true, skipped: 'sem numero real (LID)' });
    }

    // 1. Salva a mensagem
    await insert('mensagens', {
      telefone: norm.numero,
      texto: norm.texto,
      tipo: norm.fromMe ? 'saida' : 'entrada',
      remetente: norm.pushName,
      instancia: norm.instance,
      payload_bruto: body,
      criado_em: new Date(norm.timestamp).toISOString()
    });

    // 2. Se for mensagem de entrada, garante que o lead existe (Upsert)
    if (!norm.fromMe) {
      await upsertByField('leads', {
        telefone: norm.numero,
        nome: norm.pushName || norm.numero,
        etapa: 'lead_novo',
        ultima_mensagem: norm.texto,
        atualizado_em: new Date().toISOString()
      }, 'telefone');
    }

    return res.status(200).json({ ok: true, numero: norm.numero });
  } catch (err) {
    console.error('[whatsapp] erro:', err.message);
    // 200 mesmo no erro pra Evolution não reentregar infinito
    return res.status(200).json({ error: err.message });
  }
}
