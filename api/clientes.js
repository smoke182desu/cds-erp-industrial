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

async function runQuery(collectionId, limit = 200, extraWhere) {
  const url = `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`;
  const sq = { from: [{ collectionId }], limit };
  if (extraWhere) sq.where = extraWhere;
  const res = await axios.post(url, { structuredQuery: sq });
  return (res.data || [])
    .filter(r => r.document)
    .map(r => ({ id: r.document.name.split('/').pop(), ...fromFields(r.document.fields) }));
}

async function addDoc(collectionId, data) {
  const fields = toFields({ ...data, criadoEm: new Date().toISOString() });
  const res = await axios.post(`${BASE_URL}/${collectionId}?key=${FIREBASE_API_KEY}`, { fields });
  return res.data.name.split('/').pop();
}

async function patchDoc(collectionId, docId, data) {
  const fields = toFields({ ...data, atualizadoEm: new Date().toISOString() });
  const paths = Object.keys(fields).join(',');
  await axios.patch(
    `${BASE_URL}/${collectionId}/${docId}?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=${paths}`,
    { fields }
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const clientes = await runQuery('clientes', 500);
      return res.status(200).json({ clientes });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { telefone, nome, email, empresa, origem, ...rest } = req.body || {};
    try {
      if (telefone) {
        const where = { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: String(telefone) } } };
        const existing = await runQuery('clientes', 1, where);
        if (existing.length) {
          await patchDoc('clientes', existing[0].id, { nome: nome || existing[0].nome, email: email || existing[0].email, empresa: empresa || existing[0].empresa });
          return res.status(200).json({ clienteId: existing[0].id, updated: true });
        }
      }
      const clienteId = await addDoc('clientes', { telefone, nome, email, empresa, origem: origem || 'manual', ...rest });
      return res.status(200).json({ clienteId, created: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
