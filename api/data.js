// api/data.js
// Dispatcher unificado para endpoints CRUD (reduz contagem de funcoes Vercel Hobby).
// Responde por rewrites do vercel.json:
//   /api/clientes      -> /api/data?resource=clientes
//   /api/projects      -> /api/data?resource=projects
//   /api/calculadora   -> /api/data?resource=calculadora

import axios from 'axios';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID      = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0908948294';
const DATABASE_ID     = process.env.FIREBASE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// -------------------- helpers Firestore REST --------------------
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

// -------------------- handler: clientes --------------------
async function handleClientes(req, res) {
  if (req.method === 'GET') {
    const clientes = await runQuery('clientes', 500);
    return res.status(200).json({ clientes });
  }
  if (req.method === 'POST') {
    const { telefone, nome, email, empresa, origem, ...rest } = req.body || {};
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
  }
  return res.status(405).json({ error: 'Metodo nao permitido' });
}

// -------------------- handler: projects --------------------
async function handleProjects(req, res) {
  const { id, action } = req.query;

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

  if (req.method === 'GET' && action === 'clients') {
    const url = `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`;
    const r = await axios.post(url, { structuredQuery: { from: [{ collectionId: 'clients' }], limit: 200 } });
    const clients = (r.data || []).filter(d => d.document).map(d => ({ id: d.document.name.split('/').pop(), ...fromFields(d.document.fields) }));
    return res.status(200).json({ clients });
  }

  if (req.method === 'GET' && action === 'products') {
    const url = `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`;
    const r = await axios.post(url, { structuredQuery: { from: [{ collectionId: 'products' }], limit: 200 } });
    const products = (r.data || []).filter(d => d.document).map(d => ({ id: d.document.name.split('/').pop(), ...fromFields(d.document.fields) }));
    return res.status(200).json({ products });
  }

  if (req.method === 'POST') {
    const { _collection, ...body } = req.body || {};
    const col = _collection || 'projects';
    const fields = toFields({ ...body, updated_at: Date.now() });
    const r = await axios.post(`${BASE_URL}/${col}?key=${FIREBASE_API_KEY}`, { fields });
    const docId = r.data.name.split('/').pop();
    return res.status(200).json({ ok: true, id: docId });
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

// -------------------- handler: calculadora (webhook plugin escadas) --------------------
function str(v)  { return { stringValue: String(v || '') }; }
function ts()    { return { timestampValue: new Date().toISOString() }; }

async function firestoreQueryLegacy(collection, field, value) {
  const url = `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`;
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

async function firestoreAddLegacy(collection, fields) {
  const res = await axios.post(`${BASE_URL}/${collection}?key=${FIREBASE_API_KEY}`, { fields });
  return res.data.name.split('/').pop();
}

async function upsertClienteCalc(data) {
  const tel = (data.telefone || '').replace(/\D/g, '');
  if (tel) {
    const existe = await firestoreQueryLegacy('clientes', 'telefone', tel);
    if (existe) return existe.document.name.split('/').pop();
  }
  if (data.email) {
    const existe = await firestoreQueryLegacy('clientes', 'email', data.email);
    if (existe) return existe.document.name.split('/').pop();
  }
  return firestoreAddLegacy('clientes', {
    nome:         str(data.nome || 'Lead Calculadora'),
    email:        str(data.email),
    telefone:     str(tel),
    empresa:      str(data.empresa),
    tipo:         str('pre_cadastro'),
    origem:       str('calculadora'),
    criadoEm:     ts(),
    atualizadoEm: ts(),
  });
}

async function upsertLeadCalc(data) {
  const tel = (data.telefone || '').replace(/\D/g, '');
  if (tel) {
    const existe = await firestoreQueryLegacy('leads', 'telefone', tel);
    if (existe) return existe.document.name.split('/').pop();
  }
  return firestoreAddLegacy('leads', {
    nome:         str(data.nome || 'Lead Calculadora'),
    email:        str(data.email),
    telefone:     str(tel),
    etapa:        str('lead_novo'),
    origem:       str('calculadora'),
    observacoes:  str(data.observacoes),
    clienteId:    str(data.clienteId),
    criadoEm:     ts(),
    atualizadoEm: ts(),
  });
}

function parsearPayloadCalc(body, query) {
  const d = { ...query, ...body };
  const nome     = d.nome      || d.name      || d.cliente    || '';
  const email    = d.email     || d.mail      || '';
  const telefone = d.telefone  || d.phone     || d.celular    || d.whatsapp || '';
  const empresa  = d.empresa   || d.company   || '';
  const tipo     = d.tipo_escada || d.tipo    || d.escada_tipo || '';
  const largura  = d.largura   || d.width     || '';
  const altura   = d.altura    || d.height    || '';
  const degraus  = d.degraus   || d.steps     || '';
  const material = d.material  || '';
  const valor    = parseFloat(d.valor_total || d.total || d.preco || '0');

  const partes = [];
  if (tipo)     partes.push(`Tipo: ${tipo}`);
  if (material) partes.push(`Material: ${material}`);
  if (largura)  partes.push(`Largura: ${largura}m`);
  if (altura)   partes.push(`Altura: ${altura}m`);
  if (degraus)  partes.push(`Degraus: ${degraus}`);
  if (valor)    partes.push(`Estimativa: R$ ${valor.toFixed(2)}`);

  const observacoes = `Orcamento calculadora de escadas\n${partes.join(' | ')}`;
  return { nome, email, telefone, empresa, observacoes, valor };
}

async function handleCalculadora(req, res) {
  if (req.method === 'GET' && !req.query.nome && !req.query.email) {
    return res.status(200).json({ ok: true, service: 'calculadora-webhook' });
  }
  const data = parsearPayloadCalc(req.body || {}, req.query || {});
  if (!data.nome && !data.email && !data.telefone) {
    return res.status(400).json({ error: 'Dados insuficientes (nome, email ou telefone obrigatorio)' });
  }
  const clienteId = await upsertClienteCalc(data);
  const leadId    = await upsertLeadCalc({ ...data, clienteId });
  return res.status(200).json({ ok: true, leadId, clienteId });
}

// -------------------- dispatcher principal --------------------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const resource = String(req.query.resource || '').toLowerCase();

  try {
    if (resource === 'clientes')    return await handleClientes(req, res);
    if (resource === 'projects')    return await handleProjects(req, res);
    if (resource === 'calculadora') return await handleCalculadora(req, res);
    return res.status(400).json({ error: 'resource invalido (use clientes|projects|calculadora)' });
  } catch (err) {
    console.error(`[data] erro (${resource}):`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
