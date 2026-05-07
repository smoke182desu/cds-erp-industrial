// api/whatsapp.js — webhook handler, normaliza payload Evolution API e salva no Supabase
import { insert, upsertByField } from './_lib/supabase.js';

function normalizarPayload(body) {
  if (!body || typeof body !== 'object') return body;
  try {
    const data = body.data || body;
    const key = data.key || {};
    const message = data.message || {};
    
    const remoteJid = key.remoteJid || data.remoteJid || '';
    const pushName = data.pushName || data.notifyName || body.pushName || '';
    const numero = typeof remoteJid === 'string' ? remoteJid.split('@')[0] : '';
    
    // Texto da mensagem (suporta varios formatos da Evolution API)
    const texto = message.conversation 
      || message.extendedTextMessage?.text 
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
      timestamp: data.messageTimestamp || Math.floor(Date.now() / 1000)
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
    
    if (!norm || !norm.numero) {
      return res.status(200).json({ ok: true, skipped: 'Payload invalido ou sem numero' });
    }

    // 1. Salva a mensagem
    await insert('mensagens', {
      telefone: norm.numero,
      texto: norm.texto,
      tipo: norm.fromMe ? 'saida' : 'entrada',
      remetente: norm.pushName,
      instancia: norm.instance,
      payload_bruto: body,
      criado_em: new Date(norm.timestamp * 1000).toISOString()
    });

    // 2. Se for mensagem de entrada, garante que o lead existe (Upsert)
    if (!norm.fromMe && norm.pushName) {
      await upsertByField('leads', 'telefone', {
        telefone: norm.numero,
        nome: norm.pushName,
        etapa: 'lead_novo',
        ultima_mensagem: norm.texto,
        atualizado_em: new Date().toISOString()
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[whatsapp] erro:', err.message);
    // Retornamos 200 mesmo no erro para nao fazer a Evolution API repetir o webhook infinitamente
    return res.status(200).json({ error: err.message });
  }
}
