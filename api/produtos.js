// api/produtos.js — lista/busca do PHP/MySQL + sync WooCommerce → MySQL
import axios from 'axios';
import { phpFetch } from './_lib/php-api.js';

export const config = { maxDuration: 60 };

const WC_URL    = process.env.WC_URL    || '';
const WC_KEY    = process.env.WC_KEY    || '';
const WC_SECRET = process.env.WC_SECRET || '';

function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

async function listarProdutos() {
  const r = await phpFetch('produtos');
  if (!r.ok) throw new Error(`PHP API erro ${r.status}`);
  return r.json();
}

async function buscarProdutos(q, limit = 20) {
  const lista = await listarProdutos();
  const termos = _norm(q).split(' ').filter(t => t.length >= 2);
  if (!termos.length) return lista.slice(0, limit);
  const scored = lista.map(p => {
    const nN = _norm(p.nome); const sN = _norm(p.sku); const cN = _norm(p.categoria); const dN = _norm(p.descricao);
    let score = 0;
    for (const t of termos) {
      if (sN === t) score += 20;
      if (nN.includes(t)) score += 5;
      if (sN.includes(t)) score += 6;
      if (cN.includes(t)) score += 3;
      if (dN.includes(t)) score += 1;
    }
    return { p, score };
  });
  return scored.filter(s => s.score > 0).sort((a,b) => b.score-a.score).slice(0, limit).map(s => s.p);
}

async function fetchWooPage(page) {
  // HostGator strips Basic Auth headers — use query param auth instead
  const resp = await axios.get(`${WC_URL}/wp-json/wc/v3/products`, {
    params: { per_page: 100, page, status: 'publish', consumer_key: WC_KEY, consumer_secret: WC_SECRET },
    timeout: 15000,
  });
  return resp.data || [];
}

async function syncPage(page = 1) {
  if (!WC_URL || !WC_KEY) throw new Error('WC_URL e WC_KEY nao configurados.');
  const products = await fetchWooPage(page);
  for (const p of products) {
    await phpFetch('produtos', {
      method: 'POST',
      body: {
        wc_id: String(p.id),
        nome: p.name || '',
        sku: p.sku || '',
        preco: parseFloat(p.price||'0')||0,
        preco_regular: parseFloat(p.regular_price||'0')||0,
        preco_promocional: parseFloat(p.sale_price||'0')||0,
        estoque: p.stock_quantity||0,
        em_estoque: p.in_stock ? 1 : 0,
        status: p.status||'publish',
        categoria: p.categories?.[0]?.name||null,
        imagem: p.images?.[0]?.src||null,
        descricao: (p.short_description||'').replace(/<[^>]+>/g,''),
        permalink: p.permalink||null,
      },
    });
  }
  return { ok: true, page, sincronizados: products.length, hasMore: products.length === 100 };
}

async function syncAll() {
  if (!WC_URL || !WC_KEY) throw new Error('WC_URL e WC_KEY nao configurados.');
  let page = 1, total = 0;
  while (page <= 50) {
    const products = await fetchWooPage(page);
    if (!products.length) break;
    for (const p of products) {
      await phpFetch('produtos', {
        method: 'POST',
        body: { wc_id: String(p.id), nome: p.name||'', sku: p.sku||'', preco: parseFloat(p.price||'0')||0,
          preco_regular: parseFloat(p.regular_price||'0')||0, preco_promocional: parseFloat(p.sale_price||'0')||0,
          estoque: p.stock_quantity||0, em_estoque: p.in_stock?1:0, status: p.status||'publish',
          categoria: p.categories?.[0]?.name||null, imagem: p.images?.[0]?.src||null,
          descricao: (p.short_description||'').replace(/<[^>]+>/g,''), permalink: p.permalink||null },
      });
    }
    total += products.length;
    if (products.length < 100) break;
    page++;
  }
  return { ok: true, totalSincronizados: total };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      if (req.query.sync === 'all') return res.status(200).json(await syncAll());
      if (req.query.sync === '1')  return res.status(200).json(await syncPage(req.query.page ? parseInt(req.query.page,10) : 1));
      if (req.query.q) {
        const limit = Math.min(parseInt(req.query.limit||'20',10), 50);
        const produtos = await buscarProdutos(String(req.query.q), limit);
        return res.status(200).json({ ok: true, produtos, total: produtos.length, q: req.query.q });
      }
      const produtos = await listarProdutos();
      return res.status(200).json({ ok: true, produtos, total: produtos.length });
    }
    if (req.method === 'POST') {
      if (req.body?.syncAll) return res.status(200).json(await syncAll());
      return res.status(200).json(await syncPage(req.body?.page ? parseInt(req.body.page,10) : 1));
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[produtos] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
