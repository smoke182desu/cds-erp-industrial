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

// ---------- contador sequencial de clientes ----------
async function proximoCodigoCliente() {
  const counterUrl = `${BASE_URL}/config/cliente_counter?key=${FIREBASE_API_KEY}`;
  let atual = 0;
  try {
    const snap = await axios.get(counterUrl);
    atual = snap.data?.fields?.numero?.integerValue || 0;
  } catch { /* documento ainda nao existe */ }
  const proximo = Number(atual) + 1;
  await axios.patch(`${counterUrl}&updateMask.fieldPaths=numero`, {
    fields: { numero: { integerValue: String(proximo) } }
  });
  return proximo;
}

// ---------- pre-cadastro no CRM (com numeracao) ----------
async function criarPreCadastro(lead) {
  // evita duplicatas por telefone
  if (lead.telefone) {
    const existe = await firestoreQuery('clientes', 'telefone', lead.telefone);
    if (existe) return existe.document.name.split('/').pop();
  }
  const codigo = await proximoCodigoCliente();
  const codigoFormatado = 'CLI-' + String(codigo).padStart(4, '0');
  return firestoreAdd('clientes', {
    codigo:           { integerValue: String(codigo) },
    codigoFormatado:  { stringValue: codigoFormatado },
    nome:             { stringValue: lead.nome     || '' },
    email:            { stringValue: lead.email    || '' },
    telefone:         { stringValue: lead.telefone || '' },
    empresa:          { stringValue: lead.empresa  || '' },
    tipo:             { stringValue: 'pre_cadastro' },
    origem:           { stringValue: lead.origem   || 'site' },
    criadoEm:         { timestampValue: new Date().toISOString() },
  });
}

// ---------- listar todos os leads via REST ----------
async function listarLeads() {
  const url = `${BASE_URL}/leads?key=${FIREBASE_API_KEY}&pageSize=300`;
  const res = await axios.get(url);
  return (res.data.documents || []).map(d => {
    const f = d.fields || {};
    const s = k => f[k]?.stringValue  ?? '';
    const n = k => parseFloat(f[k]?.doubleValue ?? f[k]?.integerValue ?? 0);
    const t = k => f[k]?.timestampValue ?? '';
    return {
      id:           d.name.split('/').pop(),
      nome:         s('nome'),
      email:        s('email'),
      telefone:     s('telefone'),
      empresa:      s('empresa'),
      mensagem:     s('mensagem'),
      origem:       s('origem') || 'manual',
      etapa:        s('etapa')  || 'lead_novo',
      valor:        n('valor'),
      pedidoId:     s('pedidoId'),
      clienteId:    s('clienteId'),
      observacoes:  s('observacoes'),
      criadoEm:     t('criadoEm'),
      atualizadoEm: t('atualizadoEm'),
    };
  }).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — listar leads para o funil (sem autenticação necessária)
  if (req.method === 'GET') {
    try {
      const leads = await listarLeads();
      return res.status(200).json({ ok: true, leads, total: leads.length });
    } catch (err) {
      console.error('[leads GET] erro:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // PUT — atualizar lead (etapa, campos) — chamado pelo frontend/kanban
  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id obrigatorio' });
    try {
      const body = req.body || {};
      const fields = {};
      const map = { nome:'stringValue', email:'stringValue', telefone:'stringValue',
        empresa:'stringValue', etapa:'stringValue', origem:'stringValue',
        observacoes:'stringValue', mensagem:'stringValue', pedidoId:'stringValue' };
      for (const [k, type] of Object.entries(map)) {
        if (body[k] !== undefined) fields[k] = { [type]: String(body[k]) };
      }
      if (body.valor !== undefined) fields.valor = { doubleValue: Number(body.valor) || 0 };
      fields.atualizadoEm = { timestampValue: new Date().toISOString() };

      const fieldPaths = Object.keys(fields).join(',');
      const url = `${BASE_URL}/leads/${id}?updateMask.fieldPaths=${fieldPaths}&key=${FIREBASE_API_KEY}`;
      await axios.patch(url, { fields });
      return res.status(200).json({ ok: true, id });
    } catch (err) {
      console.error('[leads PUT] erro:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Criação interna via ERP não precisa de secret
  const erpCreate = req.body?.erpCreate === true || req.headers['x-erp-create'] === '1';
  if (!erpCreate) {
    const secret = req.headers['x-webhook-secret'] || req.query.secret;
    if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  }

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
    // 1. Pre-cadastro no CRM (com codigo sequencial CLI-XXXX)
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
