import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID      = 'gen-lang-client-0908948294';
const DATABASE_ID     = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

function fromFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue  !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.doubleValue  !== undefined) obj[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
    else if (v.mapValue?.fields) obj[k] = fromFields(v.mapValue.fields);
    else obj[k] = null;
  }
  return obj;
}

function toFSValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string')  return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFSValue) } };
  if (typeof v === 'object')  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k,val]) => [k, toFSValue(val)])) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFSValue(v)]));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query;

  // GET /api/projects?id=xxx — busca projeto publico (VisualizadorPublico)
  if (req.method === 'GET' && id) {
    try {
      const docRes = await axios.get(`${BASE_URL}/projects/${id}?key=${FIREBASE_API_KEY}`);
      const data = fromFields(docRes.data.fields || {});
      if (!data.isPublic) return res.status(404).json({ error: 'Projeto nao encontrado ou indisponivel' });
      return res.status(200).json({ ok: true, project: data });
    } catch {
      return res.status(404).json({ error: 'Projeto nao encontrado ou indisponivel' });
    }
  }

  // GET /api/projects?action=clients
  if (req.method === 'GET' && action === 'clients') {
    try {
      const url = `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`;
      const r = await axios.post(url, { structuredQuery: { from: [{ collectionId: 'clients' }], limit: 200 } });
      const clients = (r.data || []).filter(d => d.document).map(d => ({ id: d.document.name.split('/').pop(), ...fromFields(d.document.fields) }));
      return res.status(200).json({ clients });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/projects?action=products
  if (req.method === 'GET' && action === 'products') {
    try {
      const url = `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`;
      const r = await axios.post(url, { structuredQuery: { from: [{ collectionId: 'products' }], limit: 200 } });
      const products = (r.data || []).filter(d => d.document).map(d => ({ id: d.document.name.split('/').pop(), ...fromFields(d.document.fields) }));
      return res.status(200).json({ products });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/projects — salva projeto, client ou proposal
  if (req.method === 'POST') {
    const { _collection, ...body } = req.body || {};
    const col = _collection || 'projects';
    try {
      const fields = toFields({ ...body, updated_at: Date.now() });
      const r = await axios.post(`${BASE_URL}/${col}?key=${FIREBASE_API_KEY}`, { fields });
      const docId = r.data.name.split('/').pop();
      return res.status(200).json({ ok: true, id: docId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
