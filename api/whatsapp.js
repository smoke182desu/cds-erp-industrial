import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = 'gen-lang-client-0908948294';
const DATABASE_ID      = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL         = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const NUMERO_EMPRESA   = (process.env.NUMERO_EMPRESA || '5561993081396').replace(/\D/g, '');

function str(v) { return { stringValue: String(v || '') }; }
function ts()   { return { timestampValue: new Date().toISOString() }; }

async function firestoreAdd(collection, fields) {
  const res = await axios.post(`${BASE_URL}/${collection}?key=${FIREBASE_API_KEY}`, { fields });
  return res.data.name.split('/').pop();
}

async function firestoreQuery(collection, field, value) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
      limit: 1,
    },
  };
  const res = await axios.post(url, body);
  return res.data?.find(r => r.document) || null;
}

// ---------- parsear mensagem de qualquer provedor ----------
function parsearMensagem(body) {

  // ── Z-API: mensagem RECEBIDA ──────────────────────────────────────────────
  // POST em /on-message-received  → body.phone = remetente, fromMe = false
  if (body.phone !== undefined && body.text?.message !== undefined) {
    return {
      telefone: String(body.phone).replace(/\D/g, ''),
      texto:    body.text.message,
      nome:     body.senderName || body.pushName || '',
      fromMe:   body.fromMe === true,
    };
  }

  // ── Z-API: mensagem ENVIADA pelo celular ─────────────────────────────────
  // POST em /on-message-sent ou /on-send-message
  // body.phone = destinatário, body.fromMe = true, body.text.message = texto
  if (body.fromMe === true && body.phone !== undefined) {
    const texto = body.text?.message || body.text || body.body || '';
    if (texto) {
      return {
        telefone: String(body.phone).replace(/\D/g, ''),  // destinatário = cliente
        texto:    String(texto),
        nome:     body.senderName || body.chatName || '',
        fromMe:   true,
      };
    }
  }

  // ── Z-API: formato alternativo com 'message' no raiz ─────────────────────
  if (body.phone !== undefined && typeof body.message === 'string') {
    return {
      telefone: String(body.phone).replace(/\D/g, ''),
      texto:    body.message,
      nome:     body.senderName || body.pushName || '',
      fromMe:   body.fromMe === true,
    };
  }

  // ── Evolution API: messages.upsert ────────────────────────────────────────
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
    if (!texto || jid.includes('@g.us')) return null; // ignora grupos
    return {
      telefone: tel,
      texto,
      nome:   body.data.pushName || '',
      fromMe,
    };
  }

  // ── Twilio ────────────────────────────────────────────────────────────────
  if (body.From !== undefined && body.Body !== undefined) {
    return {
      telefone: body.From.replace('whatsapp:', '').replace(/\D/g, ''),
      texto:    body.Body,
      nome:     body.ProfileName || '',
      fromMe:   false,
    };
  }

  // ── Genérico (fallback) ───────────────────────────────────────────────────
  const tel = (body.phone || body.from || body.telefone || '').toString().replace(/\D/g, '');
  const txt = body.message || body.text || body.body || body.mensagem || '';
  if (tel && txt) {
    return { telefone: tel, texto: txt, nome: body.name || body.nome || '', fromMe: body.fromMe === true };
  }
  return null;
}

// ---------- buscar ou criar lead ----------
async function obterLeadId(telefone, nome) {
  const existe = await firestoreQuery('leads', 'telefone', telefone);
  if (existe) return existe.document.name.split('/').pop();
  return firestoreAdd('leads', {
    nome:         str(nome || 'Lead WhatsApp'),
    telefone:     str(telefone),
    etapa:        str('lead_novo'),
    origem:       str('whatsapp'),
    criadoEm:     ts(),
    atualizadoEm: ts(),
  });
}

// ---------- salvar mensagem ----------
async function salvarMensagem(telefone, texto, tipo, leadId) {
  return firestoreAdd('mensagens', {
    telefone: str(telefone),
    leadId:   str(leadId || ''),
    texto:    str(texto),
    tipo:     str(tipo),   // 'entrada' (cliente) | 'saida' (vendedor)
    origem:   str('whatsapp'),
    criadoEm: ts(),
  });
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  // Challenge GET (verificação de webhook)
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

    // Determina o telefone do CLIENTE
    // Se fromMe=true: msg.telefone é o destinatário (= cliente)
    // Se fromMe=false: msg.telefone é o remetente (= cliente)
    // Em ambos os casos descartamos se for o próprio número da empresa
    const telefoneCliente = msg.telefone === NUMERO_EMPRESA ? null : msg.telefone;

    if (!telefoneCliente) {
      return res.status(200).json({ ok: true, msg: 'Mensagem interna ignorada' });
    }

    // Para mensagens saídas: registra mas não cria lead novo (lead é criado quando cliente entra em contato)
    let leadId;
    if (tipo === 'saida') {
      const existe = await firestoreQuery('leads', 'telefone', telefoneCliente);
      leadId = existe ? existe.document.name.split('/').pop() : null;
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
