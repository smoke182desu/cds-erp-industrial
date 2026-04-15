import axios from 'axios';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = { maxDuration: 60 };

function getDb() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT nao configurado no Vercel.');
    const serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  const databaseId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
  return getFirestore(undefined, databaseId);
}

const WC_URL = process.env.WC_URL || '';
const WC_KEY = process.env.WC_KEY || '';
const WC_SECRET = process.env.WC_SECRET || '';

const BATCH_SIZE = 400;

function clean(v) {
  if (v === null || v === undefined) return '';
  return v;
}

async function firestoreGetAll() {
  const db = getDb();
  const snap = await db.collection('produtos').limit(500).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function writeBatch(products) {
  const db = getDb();
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const slice = products.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const p of slice) {
      const ref = db.collection('produtos').doc(`wc_${p.id}`);
      batch.set(ref, {
        wcId: String(p.id || ''),
        nome: clean(p.name),
        sku: clean(p.sku),
        preco: parseFloat(p.price || '0') || 0,
        precoRegular: parseFloat(p.regular_price || '0') || 0,
        precoPromocional: parseFloat(p.sale_price || '0') || 0,
        estoque: p.stock_quantity || 0,
        gerenciarEstoque: !!p.manage_stock,
        emEstoque: !!p.in_stock,
        status: clean(p.status),
        categoria: clean(p.categories?.[0]?.name),
        imagem: clean(p.images?.[0]?.src),
        descricao: (p.short_description || '').replace(/<[^>]+>/g, ''),
        permalink: clean(p.permalink),
        tipo: clean(p.type) || 'simple',
        sincronizadoEm: new Date().toISOString(),
      }, { merge: true });
    }
    await batch.commit();
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
  try {
    if (req.method === 'GET') {
      if (req.query.sync === '1') {
        const total = await sincronizarWooCommerce();
        const produtos = await firestoreGetAll();
        return res.status(200).json({ ok: true, sincronizados: total, produtos });
      }
      const produtos = await firestoreGetAll();
      return res.status(200).json({ ok: true, produtos, total: produtos.length });
    }
    if (req.method === 'POST') {
      const total = await sincronizarWooCommerce();
      return res.status(200).json({ ok: true, sincronizados: total });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[produtos] erro:', err?.response?.status, err?.response?.data || err.message, err.stack);
    return res.status(500).json({ error: err.message, detail: err?.response?.data });
  }
}
