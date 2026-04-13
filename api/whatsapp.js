import axios from 'axios';

// Configuracoes Firebase
const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = 'gen-lang-client-0908948294';
const DATABASE_ID      = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const WEBHOOK_SECRET   = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';

// Numero WhatsApp da empresa (ignora mensagens enviadas por ela mesma)
const NUMERO_EMPRESA = '5561993081396';

/**
 * Parseia payload de diferentes provedores WhatsApp.
 * Suporta: Z-API, Evolution API, Twilio, e formato generico.
 */
function parsearMensagem(body) {
  // ---------- Evolution API ----------
  if (body?.data?.key?.remoteJid) {
    const data    = body.data;
    const jid     = data.key.remoteJid || '';
    const phone   = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const nome    = data.pushName || data.key.remoteJid || 'Desconhecido';
    const texto   = data.message?.conversation
                 || data.message?.extendedTextMessage?.text
                 || data.message?.imageMessage?.caption
                 || '';
    const fromMe  = data.key?.fromMe === true;
    return { phone, nome, texto, fromMe };
  }

  // ---------- Z-API ----------
  if (body?.phone && (body?.text?.message !== undefined || body?.audio)) {
    const phone  = String(body.phone).replace(/\D/g, '');
    const nome   = body.senderName || body.chatName || phone;
    const texto  = body.text?.message || body.caption || '[midia]';
    const fromMe = body.fromMe === true;
    return { phone, nome, texto, fromMe };
  }

  // ---------- Twilio WhatsApp ----------
  if (body?.From && body?.Body) {
    const phone = String(body.From).replace('whatsapp:+', '').replace(/\D/g, '');
    const nome  = body.ProfileName || phone;
    const texto = body.Body;
    return { phone, nome, texto, fromMe: false };
  }

  // ---------- Formato generico ----------
  if (body?.phone || body?.telefone) {
    const phone = String(body.phone || body.telefone).replace(/\D/g, '');
    const nome  = body.name || body.nome || phone;
    const texto = body.message || body.mensagem || '';
    return { phone, nome, texto, fromMe: false };
  }

  return null;
}

async function salvarLeadFirestore(lead) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/leads?key=${FIREBASE_API_KEY}`;
  const payload = {
    fields: {
      nome:      { stringValue: lead.nome || '' },
      telefone:  { stringValue: lead.phone || '' },
      mensagem:  { stringValue: lead.texto || '' },
      origem:    { stringValue: 'whatsapp' },
      status:    { stringValue: 'novo' },
      criadoEm:  { timestampValue: new Date().toISOString() },
    }
  };
  const res = await axios.post(url, payload);
  return res.data.name.split('/').pop();
}

async function verificarLeadExistente(phone) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'leads' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'telefone' },
          op: 'EQUAL',
          value: { stringValue: phone }
        }
      },
      limit: 1,
    }
  };
  const res = await axios.post(url, query);
  return res.data?.some(r => r.document);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET para verificacao de webhook (alguns provedores enviam GET na ativacao)
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge || 'ok';
    return res.status(200).send(String(challenge));
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validacao de token (opcional via header ou query)
  const secret = req.headers['x-webhook-secret'] || req.query.secret;
  if (secret && secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body;
  console.log('[WhatsApp Webhook] payload:', JSON.stringify(body).substring(0, 300));

  // Parseia a mensagem do provedor
  const parsed = parsearMensagem(body);
  if (!parsed) {
    return res.status(200).json({ skip: true, reason: 'formato nao reconhecido' });
  }

  const { phone, nome, texto, fromMe } = parsed;

  // Ignora mensagens enviadas pela propria empresa
  if (fromMe || phone === NUMERO_EMPRESA) {
    return res.status(200).json({ skip: true, reason: 'mensagem propria' });
  }

  // Ignora se nao tem texto (sticker, localizacao, etc)
  if (!phone) {
    return res.status(200).json({ skip: true, reason: 'sem telefone' });
  }

  try {
    // Verifica se ja existe lead com esse telefone
    const jaExiste = await verificarLeadExistente(phone);
    if (jaExiste) {
      return res.status(200).json({ skip: true, reason: 'lead ja existe', phone });
    }

    // Cria o lead
    const id = await salvarLeadFirestore({ phone, nome, texto });
    console.log('[WhatsApp Webhook] Lead criado:', id, phone, nome);
    return res.status(201).json({ success: true, id, phone, nome });
  } catch (err) {
    console.error('[WhatsApp Webhook] Erro:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}
