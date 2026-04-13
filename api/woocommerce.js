import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID      = 'gen-lang-client-0908948294';
const DATABASE_ID     = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const WC_SECRET       = process.env.WC_WEBHOOK_SECRET || 'cds-wc-secret';
const BASE_URL        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// ---------- helpers Firestore ----------
async function firestoreAdd(collection, fields) {
  const res = await axios.post(`${BASE_URL}/${collection}?key=${FIREBASE_API_KEY}`, { fields });
  return res.data.name.split('/').pop();
}

async function firestoreUpdate(collection, docId, fields) {
  const fieldPaths = Object.keys(fields).join(',');
  await axios.patch(
    `${BASE_URL}/${collection}/${docId}?updateMask.fieldPaths=${fieldPaths}&key=${FIREBASE_API_KEY}`,
    { fields }
  );
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

// ---------- helpers campo Firestore ----------
function str(v)  { return { stringValue: String(v || '') }; }
function num(v)  { return { doubleValue: Number(v || 0) }; }
function bool(v) { return { booleanValue: Boolean(v) }; }
function ts()    { return { timestampValue: new Date().toISOString() }; }

// ---------- upsert cliente ----------
async function upsertCliente(data) {
  const { nome, email, telefone, empresa } = data;
  const tel = (telefone || '').replace(/\D/g, '');

  if (tel) {
    const existe = await firestoreQuery('clientes', 'telefone', tel);
    if (existe) return existe.document.name.split('/').pop();
  }
  if (email) {
    const existe = await firestoreQuery('clientes', 'email', email);
    if (existe) return existe.document.name.split('/').pop();
  }

  return firestoreAdd('clientes', {
    nome:       str(nome || 'Cliente WooCommerce'),
    email:      str(email),
    telefone:   str(tel),
    empresa:    str(empresa),
    tipo:       str('pre_cadastro'),
    origem:     str('woocommerce'),
    criadoEm:   ts(),
    atualizadoEm: ts(),
  });
}

// ---------- upsert lead ----------
async function upsertLead(data) {
  const { nome, email, telefone, etapa, origem, pedidoId, valor, observacoes, clienteId } = data;
  const tel = (telefone || '').replace(/\D/g, '');

  if (tel) {
    const existe = await firestoreQuery('leads', 'telefone', tel);
    if (existe) {
      const id = existe.document.name.split('/').pop();
      // avança etapa se a nova for mais à frente
      const etapas = ['lead_novo','contato_feito','qualificado','proposta_enviada','negociacao','fechado_ganho'];
      const atualEtapa = existe.document.fields?.etapa?.stringValue || 'lead_novo';
      const etapaFinal = etapas.indexOf(etapa) > etapas.indexOf(atualEtapa) ? etapa : atualEtapa;
      await firestoreUpdate('leads', id, {
        etapa:       str(etapaFinal),
        pedidoId:    str(pedidoId),
        valor:       num(valor),
        atualizadoEm: ts(),
      });
      return id;
    }
  }

  return firestoreAdd('leads', {
    nome:        str(nome || 'Cliente WooCommerce'),
    email:       str(email),
    telefone:    str(tel),
    etapa:       str(etapa || 'qualificado'),
    origem:      str(origem || 'woocommerce'),
    pedidoId:    str(pedidoId),
    valor:       num(valor),
    observacoes: str(observacoes),
    clienteId:   str(clienteId),
    criadoEm:    ts(),
    atualizadoEm: ts(),
  });
}

// ---------- parsear evento WooCommerce ----------
function parsearEvento(body, topic) {
  // topic: woocommerce/order.created | order.updated | customer.created | etc.
  const isOrder    = topic?.includes('order');
  const isCustomer = topic?.includes('customer');

  if (isOrder) {
    const b = body;
    const billing = b.billing || {};
    const nome   = `${billing.first_name || ''} ${billing.last_name || ''}`.trim();
    const email  = billing.email || '';
    const fone   = billing.phone || '';
    const valor  = parseFloat(b.total || '0');
    const status = b.status || '';

    // mapa de status WooCommerce → etapa CRM
    const mapaEtapa = {
      pending:    'proposta_enviada',
      processing: 'negociacao',
      completed:  'fechado_ganho',
      on_hold:    'qualificado',
      cancelled:  'fechado_perdido',
      refunded:   'fechado_perdido',
      failed:     'qualificado',
    };

    return {
      tipo: 'pedido',
      nome, email,
      telefone: fone,
      pedidoId: String(b.id || ''),
      valor,
      etapa: mapaEtapa[status] || 'qualificado',
      origem: 'woocommerce',
      observacoes: `Pedido WC #${b.id} | Status: ${status} | Total: R$ ${valor}`,
    };
  }

  if (isCustomer) {
    const b = body;
    const nome = `${b.first_name || ''} ${b.last_name || ''}`.trim();
    return {
      tipo: 'cadastro',
      nome,
      email: b.email || '',
      telefone: b.billing?.phone || '',
      pedidoId: '',
      valor: 0,
      etapa: 'lead_novo',
      origem: 'woocommerce',
      observacoes: `Cadastro WC ID: ${b.id}`,
    };
  }

  return null;
}

// ---------- handler principal ----------
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'woocommerce-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const topic  = req.headers['x-wc-webhook-topic'] || req.body?.topic || '';
    const evento = parsearEvento(req.body, topic);

    if (!evento) {
      return res.status(200).json({ ok: true, msg: 'Evento ignorado' });
    }

    const clienteId = await upsertCliente(evento);
    const leadId    = await upsertLead({ ...evento, clienteId });

    return res.status(200).json({ ok: true, leadId, clienteId, tipo: evento.tipo });
  } catch (err) {
    console.error('[woocommerce] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
