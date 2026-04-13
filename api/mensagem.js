import axios from 'axios';

const FIREBASE_API_KEY  = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID        = 'gen-lang-client-0908948294';
const DATABASE_ID       = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL          = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const ZAPI_INSTANCE_ID  = process.env.ZAPI_INSTANCE_ID  || '';
const ZAPI_TOKEN        = process.env.ZAPI_TOKEN        || '';
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || '';

function str(v) { return { stringValue: String(v || '') }; }
function ts()   { return { timestampValue: new Date().toISOString() }; }

async function firestoreAdd(collection, fields) {
  const res = await axios.post(`${BASE_URL}/${collection}?key=${FIREBASE_API_KEY}`, { fields });
  return res.data.name.split('/').pop();
}

async function buscarMensagens(telefone) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'mensagens' }],
      where: { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: telefone } } },
      limit: 200,
    },
  };
  const res = await axios.post(url, body);
  return (res.data || [])
    .filter(r => r.document)
    .map(r => {
      const f = r.document.fields || {};
      return {
        id:       r.document.name.split('/').pop(),
        texto:    f.texto?.stringValue    || '',
        tipo:     f.tipo?.stringValue     || 'entrada',
        origem:   f.origem?.stringValue   || '',
        leadId:   f.leadId?.stringValue   || '',
        criadoEm: f.criadoEm?.timestampValue || f.criadoEm?.stringValue || '',
      };
    })
    .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/mensagem?telefone=55619...
  if (req.method === 'GET') {
    const telefone = (req.query.telefone || '').replace(/\D/g, '');
    if (!telefone) return res.status(400).json({ error: 'telefone required' });
    try {
      const mensagens = await buscarMensagens(telefone);
      return res.status(200).json({ ok: true, mensagens });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/mensagem  { telefone, mensagem, leadId }
  if (req.method === 'POST') {
    const { telefone, mensagem, leadId } = req.body || {};
    if (!telefone || !mensagem) {
      return res.status(400).json({ error: 'telefone e mensagem sao obrigatorios' });
    }
    const tel   = telefone.replace(/\D/g, '');
    const telWA = tel.startsWith('55') ? tel : `55${tel}`;

    try {
      // Enviar via Z-API
      if (ZAPI_INSTANCE_ID && ZAPI_TOKEN) {
        await axios.post(
          `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
          { phone: telWA, message: mensagem },
          { headers: { 'Content-Type': 'application/json', ...(ZAPI_CLIENT_TOKEN ? { 'Client-Token': ZAPI_CLIENT_TOKEN } : {}) } }
        );
      }

      // Salvar no Firestore
      const id = await firestoreAdd('mensagens', {
        telefone: str(tel),
        leadId:   str(leadId || ''),
        texto:    str(mensagem),
        tipo:     str('saida'),
        origem:   str('erp'),
        criadoEm: ts(),
      });

      return res.status(200).json({ ok: true, id });
    } catch (err) {
      console.error('[mensagem] erro:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
