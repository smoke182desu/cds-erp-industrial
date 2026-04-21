// api/whatsapp.js — webhook handler, normaliza payload Evolution API e repassa para PHP/MySQL
import { phpFetch } from './_lib/php-api.js';

// Normaliza payload da Evolution API: extrai pushName, remoteJid, numero e isLid
// para que o backend PHP possa salvar o nome real do contato do WhatsApp.
function normalizarPayload(body) {
  if (!body || typeof body !== 'object') return body;
  try {
    const data = body.data || body;
    const key = data.key || {};
    const remoteJid = key.remoteJid || data.remoteJid || '';
    const pushName = data.pushName || data.notifyName || body.pushName || '';
    const isLid = typeof remoteJid === 'string' && remoteJid.endsWith('@lid');
    const numero = typeof remoteJid === 'string' ? remoteJid.split('@')[0] : '';
    return {
      ...body,
      _normalized: {
        pushName: pushName || null,
        remoteJid,
        numero,
        isLid,
        fromMe: !!key.fromMe,
        instance: body.instance || data.instance || null,
        event: body.event || null
      }
    };
  } catch (e) {
    return body;
  }
}

export default async function handler(req, res) {
  // Challenge GET (verificacao de webhook)
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge || 'ok';
    return res.status(200).send(String(challenge));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = normalizarPayload(req.body || {});
    const r = await phpFetch('webhook', { method: 'POST', body: payload });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('[whatsapp] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
