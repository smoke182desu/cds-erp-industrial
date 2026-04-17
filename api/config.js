import axios from 'axios';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0908948294';
const DATABASE_ID      = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL         = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// Converte objeto JS para campos Firestore
function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean')      fields[k] = { booleanValue: v };
    else if (typeof v === 'number')  fields[k] = { doubleValue: v };
    else                             fields[k] = { stringValue: String(v) };
  }
  return fields;
}

// Converte campos Firestore para objeto JS
function fromFields(fields = {}) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue  !== undefined) obj[k] = v.stringValue;
    else if (v.doubleValue  !== undefined) obj[k] = Number(v.doubleValue);
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
  }
  return obj;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const col = req.query.col || 'config';
  const docId = req.query.doc;
  if (!docId) return res.status(400).json({ error: 'doc obrigatorio' });

  const url = `${BASE_URL}/${col}/${docId}?key=${FIREBASE_API_KEY}`;

  try {
    // GET — ler documento
    if (req.method === 'GET') {
      try {
        const r = await axios.get(url);
        return res.status(200).json({ ok: true, data: fromFields(r.data.fields) });
      } catch (e) {
        if (e.response?.status === 404) return res.status(200).json({ ok: true, data: null });
        throw e;
      }
    }

    // POST / PATCH — salvar documento (merge)
    if (req.method === 'POST' || req.method === 'PATCH') {
      const body = req.body || {};
      const fields = toFields(body);
      const fieldPaths = Object.keys(fields).join(',');
      const patchUrl = `${url}&updateMask.fieldPaths=${fieldPaths}`;
      await axios.patch(patchUrl, { fields });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'metodo nao permitido' });
  } catch (err) {
    console.error('[config] erro:', err.response?.data || err.message);
    return res.status(500).json({ error: err.message });
  }
}
