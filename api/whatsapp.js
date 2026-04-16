import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = 'gen-lang-client-0908948294';
const DATABASE_ID      = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL         = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const NUMERO_EMPRESA   = '5561993081396';

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
  // Z-API
  if (body.phone !== undefined && body.text?.message !== undefined) {
    return {
      telefone: String(body.phone).replace(/\D/g, ''),
      texto:    body.text.message,
      nome:     body.senderName || body.pushName || '',
      fromMe:   body.fromMe === true,
    };
  }
  // Evolution API
  if (body.data?.key?.remoteJid !== undefined) {
    const jid = body.data.key.remoteJid;
    const tel = jid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    return {
      telefone: tel,
      texto:    body.data.message?.conversation || body.data.message?.extendedTextMessage?.text || '',
      nome:     body.data.pushName || '',
      fromMe:   body.data.key?.fromMe === true,
    };
  }
  // Twilio
  if (body.From !== undefined && body.Body !== undefined) {
    return {
      telefone: body.From.replace('whatsapp:', '').replace(/\D/g, ''),
      texto:    body.Body,
      nome:     body.ProfileName || '',
      fromMe:   false,
    };
  }
  // Genérico
  const tel = (body.phone || body.from || body.telefone || '').toString().replace(/\D/g, '');
  const txt = body.message || body.text || body.body || body.mensagem || '';
  if (tel && txt) return { telefone: tel, texto: txt, nome: body.name || body.nome || '', fromMe: false };
  return null;
}

// ---------- buscar ou criar lead ----------
async function obterLeadId(telefone, nome) {
  const existe = await firestoreQuery('leads', 'telefone', telefone);
  if (existe) return existe.document.name.split('/').pop();
  // cria se não existir
  return firestoreAdd('leads', {
    nome:         str(nome || 'Lead WhatsApp'),
    telefone:     str(telefone),
    etapa:        str('lead_novo'),
    origem:       str('whatsapp'),
    criadoEm:     ts(),
    atualizadoEm: ts(),
  });
}

// ---------- salvar mensagem no histórico ----------
async function salvarMensagem(telefone, texto, tipo, leadId) {
  return firestoreAdd('mensagens', {
    telefone: str(telefone),
    leadId:   str(leadId || ''),
    texto:    str(texto),
    tipo:     str(tipo),           // 'entrada' (cliente) | 'saida' (vendedor)
    origem:   str('whatsapp'),
    criadoEm: ts(),
  });
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  // Verificação webhook GET (challenge)
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge || 'ok';
    return res.status(200).send(String(challenge));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const msg = parsearMensagem(req.body);
    if (!msg || !msg.texto || !msg.telefone) {
      return res.status(200).json({ ok: true, msg: 'Sem dados de mensagem' });
    }

    // Determina tipo: mensagem enviada pelo vendedor = 'saida', recebida do cliente = 'entrada'
    const tipo = msg.fromMe ? 'saida' : 'entrada';

    // Telefone do contato:
    // - fromMe=true: a mensagem foi enviada PARA o número msg.telefone (o cliente)
    // - fromMe=false: a mensagem veio DO número msg.telefone (o cliente)
    // Em ambos os casos, o telefone que indexamos é o do cliente, não o da empresa
    const telefoneCliente = msg.telefone === NUMERO_EMPRESA
      ? null  // caso raro: mensagem para si mesmo, ignora
      : msg.telefone;

    if (!telefoneCliente) {
      return res.status(200).json({ ok: true, msg: 'Mensagem própria ignorada' });
    }

    // Para mensagens 'saida' (fromMe), só cria lead se já existir — não queremos criar lead
    // para toda mensagem que o vendedor envia para um número novo
    let leadId;
    if (tipo === 'saida') {
      const existe = await firestoreQuery('leads', 'telefone', telefoneCliente);
      leadId = existe ? existe.document.name.split('/').pop() : null;
      // Se não há lead para esse contato ainda, ainda assim salvamos a mensagem
      // pois quando o cliente responder, o lead será criado e vinculará pelo telefone
    } else {
      // mensagem 'entrada': garante lead existe
      leadId = await obterLeadId(telefoneCliente, msg.nome);
    }

    // Salva a mensagem com o tipo correto
    await salvarMensagem(telefoneCliente, msg.texto, tipo, leadId || '');

    return res.status(200).json({ ok: true, tipo, leadId });
  } catch (err) {
    console.error('[whatsapp] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
