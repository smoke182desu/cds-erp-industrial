import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID      = 'gen-lang-client-0908948294';
const DATABASE_ID     = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// ---------- helpers Firestore ----------
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

function str(v)  { return { stringValue: String(v || '') }; }
function num(v)  { return { doubleValue: Number(v || 0) }; }
function ts()    { return { timestampValue: new Date().toISOString() }; }

// ---------- upsert cliente ----------
async function upsertCliente(data) {
  const tel = (data.telefone || '').replace(/\D/g, '');
  if (tel) {
    const existe = await firestoreQuery('clientes', 'telefone', tel);
    if (existe) return existe.document.name.split('/').pop();
  }
  if (data.email) {
    const existe = await firestoreQuery('clientes', 'email', data.email);
    if (existe) return existe.document.name.split('/').pop();
  }
  return firestoreAdd('clientes', {
    nome:        str(data.nome || 'Lead Calculadora'),
    email:       str(data.email),
    telefone:    str(tel),
    empresa:     str(data.empresa),
    tipo:        str('pre_cadastro'),
    origem:      str('calculadora'),
    criadoEm:    ts(),
    atualizadoEm: ts(),
  });
}

// ---------- upsert lead ----------
async function upsertLead(data) {
  const tel = (data.telefone || '').replace(/\D/g, '');
  if (tel) {
    const existe = await firestoreQuery('leads', 'telefone', tel);
    if (existe) return existe.document.name.split('/').pop();
  }
  return firestoreAdd('leads', {
    nome:        str(data.nome || 'Lead Calculadora'),
    email:       str(data.email),
    telefone:    str(tel),
    etapa:       str('lead_novo'),
    origem:      str('calculadora'),
    observacoes: str(data.observacoes),
    clienteId:   str(data.clienteId),
    criadoEm:    ts(),
    atualizadoEm: ts(),
  });
}

// ---------- parsear payload da calculadora ----------
// A calculadora de escadas envia um form-post ou JSON com os dados do orçamento
// Aceita múltiplos formatos: form-data, JSON e query params
function parsearPayload(body, query) {
  const d = { ...query, ...body };

  // campos possíveis vindos do plugin calculadora-escadas-4-0-woocommerce
  const nome     = d.nome      || d.name      || d.cliente    || '';
  const email    = d.email     || d.mail       || '';
  const telefone = d.telefone  || d.phone      || d.celular    || d.whatsapp || '';
  const empresa  = d.empresa   || d.company    || '';

  // dados técnicos da escada (para observações)
  const tipo     = d.tipo_escada || d.tipo     || d.escada_tipo || '';
  const largura  = d.largura   || d.width      || '';
  const altura   = d.altura    || d.height     || '';
  const degraus  = d.degraus   || d.steps      || '';
  const material = d.material  || '';
  const valor    = parseFloat(d.valor_total || d.total || d.preco || '0');

  const partes = [];
  if (tipo)     partes.push(`Tipo: ${tipo}`);
  if (material) partes.push(`Material: ${material}`);
  if (largura)  partes.push(`Largura: ${largura}m`);
  if (altura)   partes.push(`Altura: ${altura}m`);
  if (degraus)  partes.push(`Degraus: ${degraus}`);
  if (valor)    partes.push(`Estimativa: R$ ${valor.toFixed(2)}`);

  const observacoes = `Orçamento calculadora de escadas\n${partes.join(' | ')}`;

  return { nome, email, telefone, empresa, observacoes, valor };
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  // verificação CORS / preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET' && !req.query.nome && !req.query.email) {
    return res.status(200).json({ ok: true, service: 'calculadora-webhook' });
  }

  try {
    const data = parsearPayload(req.body || {}, req.query || {});

    if (!data.nome && !data.email && !data.telefone) {
      return res.status(400).json({ error: 'Dados insuficientes (nome, email ou telefone obrigatório)' });
    }

    const clienteId = await upsertCliente(data);
    const leadId    = await upsertLead({ ...data, clienteId });

    return res.status(200).json({ ok: true, leadId, clienteId });
  } catch (err) {
    console.error('[calculadora] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
