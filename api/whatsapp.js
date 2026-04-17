// api/whatsapp.js
// Webhook handler para mensagens WhatsApp (Z-API, Evolution API, Twilio)
// MIGRADO para Firebase Admin SDK para evitar quota 50k/dia da REST API publica

import { firestoreAdd, firestoreQuery } from './lib/firestore.js';

const NUMERO_EMPRESA = (process.env.NUMERO_EMPRESA || '5561993081396').replace(/\D/g, '');

// ---------- parsear mensagem de qualquer provedor ----------
function parsearMensagem(body) {
  // Z-API: mensagem RECEBIDA
  if (body.phone !== undefined && body.text?.message !== undefined) {
    return {
      telefone: String(body.phone).replace(/\D/g, ''),
      texto: body.text.message,
      nome: body.senderName || body.pushName || '',
      fromMe: body.fromMe === true,
    };
  }

  // Z-API: mensagem ENVIADA pelo celular
  if (body.fromMe === true && body.phone !== undefined) {
    const texto = body.text?.message || body.text || body.body || '';
    if (texto) {
      return {
        telefone: String(body.phone).replace(/\D/g, ''),
        texto: String(texto),
        nome: body.senderName || body.chatName || '',
        fromMe: true,
      };
    }
  }

  // Z-API: formato alternativo
  if (body.phone !== undefined && typeof body.message === 'string') {
    return {
      telefone: String(body.phone).replace(/\D/g, ''),
      texto: body.message,
      nome: body.senderName || body.pushName || '',
      fromMe: body.fromMe === true,
    };
  }

  // Evolution API: messages.upsert
  if (body.data?.key?.remoteJid !== undefined) {
    const jid = body.data.key.remoteJid;
    const tel = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');
    const fromMe = body.data.key?.fromMe === true;
    const texto =
      body.data.message?.conversation ||
      body.data.message?.extendedTextMessage?.text ||
      body.data.message?.imageMessage?.caption ||
      body.data.message?.videoMessage?.caption ||
      '';
    if (!texto || jid.includes('@g.us')) return null;
    return { telefone: tel, texto, nome: body.data.pushName || '', fromMe };
  }

  // Twilio
  if (body.From !== undefined && body.Body !== undefined) {
    return {
      telefone: body.From.replace('whatsapp:', '').replace(/\D/g, ''),
      texto: body.Body,
      nome: body.ProfileName || '',
      fromMe: false,
    };
  }

  // Generico (fallback)
  const tel = (body.phone || body.from || body.telefone || '').toString().replace(/\D/g, '');
  const txt = body.message || body.text || body.body || body.mensagem || '';
  if (tel && txt) {
    return { telefone: tel, texto: txt, nome: body.name || body.nome || '', fromMe: body.fromMe === true };
  }
  return null;
}

// ---------- buscar ou criar lead (Admin SDK) ----------
async function obterLeadId(telefone, nome) {
  const existe = await firestoreQuery('leads', 'telefone', telefone);
  if (existe) return existe.id;

  return firestoreAdd('leads', {
    nome: nome || 'Lead WhatsApp',
    telefone: telefone,
    etapa: 'lead_novo',
    origem: 'whatsapp',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });
}

// ---------- salvar mensagem (Admin SDK) ----------
async function salvarMensagem(telefone, texto, tipo, leadId) {
  return firestoreAdd('mensagens', {
    telefone: telefone,
    leadId: leadId || '',
    texto: texto,
    tipo: tipo, // 'entrada' | 'saida'
    origem: 'whatsapp',
    criadoEm: new Date(),
  });
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  // Challenge GET (verificacao de webhook)
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge || 'ok';
    return res.status(200).send(String(challenge));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const msg = parsearMensagem(req.body);
    if (!msg || !msg.texto?.trim() || !msg.telefone) {
      return res.status(200).json({ ok: true, msg: 'Sem dados de mensagem' });
    }

    const tipo = msg.fromMe ? 'saida' : 'entrada';
    const telefoneCliente = msg.telefone === NUMERO_EMPRESA ? null : msg.telefone;
    if (!telefoneCliente) {
      return res.status(200).json({ ok: true, msg: 'Mensagem interna ignorada' });
    }

    let leadId;
    if (tipo === 'saida') {
      const existe = await firestoreQuery('leads', 'telefone', telefoneCliente);
      leadId = existe ? existe.id : null;
    } else {
      leadId = await obterLeadId(telefoneCliente, msg.nome);
    }

    await salvarMensagem(telefoneCliente, msg.texto, tipo, leadId || '');
    return res.status(200).json({ ok: true, tipo, leadId, telefone: telefoneCliente });
  } catch (err) {
    console.error('[whatsapp] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
