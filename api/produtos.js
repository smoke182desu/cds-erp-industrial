import axios from 'axios';
import { phpFetch } from './_lib/php-api.js';

const WC_URL = process.env.WC_URL || 'https://lojamgincorporadora.com.br';
const WC_KEY = process.env.WC_KEY || 'ck_2e4e7c0f24b4915bd4ba0e5a84e7e929e26d7197';
const WC_SECRET = process.env.WC_SECRET || 'cs_f0cbc8cd0b20aa7a5e9aed546aaaf3b4c74cb83a';

async function fetchWooPage(page = 1) {
  const url = WC_URL + '/wp-json/wc/v3/products?per_page=100&page=' + page
    + '&consumer_key=' + WC_KEY + '&consumer_secret=' + WC_SECRET;
  const { data, headers } = await axios.get(url, { timeout: 30000 });
  return { products: data, totalPages: parseInt(headers['x-wp-totalpages'] || '1') };
}

async function syncPage(page = 1) {
  if (!WC_URL || !WC_KEY) throw new Error('WC_URL e WC_KEY nao configurados.');
  const { products, totalPages } = await fetchWooPage(page);
  const bulk = products.map(p => ({
    wc_id: String(p.id),
    nome: p.name || '',
    sku: p.sku || '',
    preco: parseFloat(p.price||'0')||0,
    preco_regular: parseFloat(p.regular_price||'0')||0,
    preco_promocional: parseFloat(p.sale_price||'0')||0,
    estoque: p.stock_quantity||0,
    em_estoque: p.in_stock ? 1 : 0,
    status: p.status || 'publish',
    categoria: (p.categories||[]).map(c=>c.name).join(', '),
    descricao: (p.short_description||'').replace(/<[^>]*>/g,'').substring(0,500),
    woocommerce_id: String(p.id)
  }));
  const phpRes = await phpFetch('produtos', { method: 'POST', body: { bulk } });
  const result = await phpRes.json().catch(() => ({}));
  return { ok: true, page, sincronizados: result.imported || bulk.length, totalPages, hasMore: page < totalPages };
}

async function syncAll() {
  const first = await fetchWooPage(1);
  const totalPages = first.totalPages;
  let total = 0;
  for (let p = 1; p <= totalPages; p++) {
    const r = await syncPage(p);
    total += r.sincronizados;
  }
  return { ok: true, totalPages, totalSincronizados: total };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.query.sync === '1') {
      const page = parseInt(req.query.page) || 1;
      const result = await syncPage(page);
      return res.json(result);
    }
    if (req.query.sync === 'all') {
      const result = await syncAll();
      return res.json(result);
    }
    const phpRes = await phpFetch('produtos');
    const data = await phpRes.json();
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export const config = { maxDuration: 60 };
