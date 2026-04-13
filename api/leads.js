import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = 'gen-lang-client-0908948294';
const DATABASE_ID      = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const WEBHOOK_SECRET   = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';
const BASE_URL         = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// ---------- helpers Firestore ----------
async function firestoreAdd(collection, fields) {
  const res = await axios.post(`${BASE_URL}/${collection}?key=${FIREBASE_API_KEY}`, { fields });
  return res.data.name.split('/').pop();
}

async function firestoreQuery(collection, field, value) {
  const url  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
      limit: 1,
    }
  };
  const res = await axios.post(url, body);
  return res.data?.find(r => r.document) || null;
}

// ---------- pre-cadastro no CRM ----------
async function criarPreCadastro(lead) {
  // evita duplicatas por telefone
  if (lead.telefone) {
    const existe = await firestoreQuery('clientes', 'telefone', lead.telefone);
    if (existe) return existe.document.name.split('/').pop();
  }
  return firestoreAdd('clientes', {
    nome:       { stringValue: lead.nome     || '' },
    email:      { stringValue: lead.email    || '' },
    telefone:   { stringValue: lead.telefone || '' },
    empresa:    { stringValue: lead.empresa  || '' },
    tipo:       { stringValue: 'pre_cadastro' },
    origem:     { stringValue: lead.origem   || 'site' },
    criadoEm:   { timestampValue: new Date().toISOString() },
  });
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-webhook-secret'] || req.query.secret;
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const {
    nome, email, telefone, mensagem,
    origem  = 'site',
    empresa = '',
    etapa   = 'lead_novo',
    valor   = 0,
    pedidoId = '',
  } = req.body;

  if (!nome && !telefone) return res.status(400).json({ error: 'Nome ou telefone obrigatorios' });

  try {
    // 1. Pre-cadastro no CRM
    const clienteId = await criarPreCadastro({ nome, email, telefone, empresa, origem });

    // 2. Cria o lead no funil
    const leadId = await firestoreAdd('leads', {
      nome:       { stringValue: nome      || '' },
      email:      { stringValue: email     || '' },
      telefone:   { stringValue: telefone  || '' },
      mensagem:   { stringValue: mensagem  || '' },
      empresa:    { stringValue: empresa   || '' },
      origem:     { stringValue: origem },
      etapa:      { stringValue: etapa },
      valor:      { doubleValue: Number(valor) || 0 },
      pedidoId:   { stringValue: pedidoId  || '' },
      clienteId:  { stringValue: clienteId || '' },
      observacoes:{ stringValue: '' },
      criadoEm:   { timestampValue: new Date().toISOString() },
      atualizadoEm:{ timestampValue: new Date().toISOString() },
    });

    return res.status(201).json({ success: true, leadId, clienteId });
  } catch (error) {
    console.error('Leads error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao salvar lead' });
  }
}
