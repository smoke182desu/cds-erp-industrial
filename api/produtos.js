import axios from 'axios';

export const config = { maxDuration: 60 };

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID = 'gen-lang-client-0908948294';
const DATABASE_ID = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const WC_URL = process.env.WC_URL || '';
const WC_KEY = process.env.WC_KEY || '';
const WC_SECRET = process.env.WC_SECRET || '';

// Batch pequeno + delay + retry respeita quota da Firebase API key
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;
const MAX_RETRIES = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function str(v) { return { stringValue: String(v || '') }; }
function num(v) { return { doubleValue: Number(v || 0) }; }
function bool(v) { return { booleanValue: Boolean(v) }; }
function ts() { return { timestampValue: new Date().toISOString() }; }

// Retry com backoff exponencial em caso de 429 (RESOURCE_EXHAUSTED)
async function firestoreSet(docId, fields) {
  let attempt = 0;
  while (true) {
    try {
      await axios.patch(`${BASE_URL}/produtos/${docId}?key=${FIREBASE_API_KEY}`, { fields }, { timeout: 8000 });
      return;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429 && attempt < MAX_RETRIES) {
        const wait = 500 * Math.pow(2, attempt);
        console.log(`[produtos] 429 retry em ${wait}ms (tentativa ${attempt + 1})`);
        await sleep(wait);
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

async function firestoreGetAll() {
  const res = await axios.get(`${BASE_URL}/produtos?pageSize=200&key=${FIREBASE_API_KEY}`, { timeout: 8000 });
  return (res.data.documents || []).map(d => {
    const f = d.fields || {};
    const id = d.name.split('/').pop();
    const get = (k, fallback = '') =>
      f[k]?.stringValue ?? f[k]?.doubleValue ?? f[k]?.booleanValue ?? fallback;
    return {
      id, wcId: get('wcId'), nome: get('nome'), sku: get('sku'),
      preco: get('preco', 0), precoRegular: get('precoRegular', 0),
      estoque: get('estoque', 0), status: get('status'),
      categoria: get('categoria'), imagem: get('imagem'),
      descricao: get('descricao'), permalink: get('permalink'),
      sincronizadoEm: get('sincronizadoEm'),
    };
  });
}

async function writeBatch(products) {
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const slice = products.slice(i, i + BATCH_SIZE);
    await Promise.all(slice.map(p => firestoreSet(`wc_${p.id}`, {
      wcId: str(String(p.id)), nome: str(p.name), sku: str(p.sku || ''),
      preco: num(parseFloat(p.price || '0')),
      precoRegular: num(parseFloat(p.regular_price || '0')),
      precoPromocional: num(parseFloat(p.sale_price || '0')),
      estoque: num(p.stock_quantity || 0),
      gerenciarEstoque: bool(p.manage_stock),
      emEstoque: bool(p.in_stock),
      status: str(p.status),
      categoria: str(p.categories?.[0]?.name || ''),
      imagem: str(p.images?.[0]?.src || ''),
      descricao: str((p.short_description || '').replace(/<[^>]+>/g, '')),
      permalink: str(p.permalink || ''),
      tipo: str(p.type || 'simple'),
      sincronizadoEm: ts(),
    })));
    if (i + BATCH_SIZE < products.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
}

async function sincronizarWooCommerce() {
  if (!WC_URL || !WC_KEY) throw new Error('WC_URL e WC_KEY nao configurados.');
  let page = 1, total = 0, hasMore = true;
  const t0 = Date.now();
  while (hasMore) {
    const resp = await axios.get(`${WC_URL}/wp-json/wc/v3/products`, {
      params: { per_page: 100, page, status: 'publish' },
      auth: { username: WC_KEY, password: WC_SECRET },
      timeout: 15000,
    });
    const products = resp.data;
    if (!products.length) break;
    await writeBatch(products);
    total += products.length;
    console.log(`[produtos] pg${page}: +${products.length} (total ${total}) em ${Date.now() - t0}ms`);
    hasMore = products.length === 100;
    page++;
  }
  return total;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      if (req.query.sync === '1') {
        const total = await sincronizarWooCommerce();
        const produtos = await firestoreGetAll();
        return res.status(200).json({ ok: true, sincronizados: total, produtos });
      }
      const produtos = await firestoreGetAll();
      return res.status(200).json({ ok: true, produtos, total: produtos.length });
    } catch (err) {
      console.error('[produtos] erro:', err?.response?.status, err?.response?.data || err.message);
      return res.status(500).json({ error: err.message, detail: err?.response?.data });
    }
  }

  if (req.method === 'POST') {
    try {
      const total = await sincronizarWooCommerce();
      return res.status(200).json({ ok: true, sincronizados: total });
    } catch (err) {
      console.error('[produtos] erro:', err?.response?.status, err?.response?.data || err.message);
      return res.status(500).json({ error: err.message, detail: err?.response?.data });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
