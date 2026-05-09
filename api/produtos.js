import axios from 'axios';
import { selectAll, upsertByField } from './_lib/supabase.js';

const WC_URL = process.env.WOOCOMMERCE_URL || process.env.WC_URL || '';
const WC_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.WC_KEY || '';
const WC_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.WC_SECRET || '';
const TABLE = 'produtos';

function mapProduto(p) {
      const estoqueNum = Number(p.estoque ?? p.estoque_atual ?? 0) || 0;
      return {
              id: p.id || '',
              wcId: p.woocommerce_id || (p.wc_product_id != null ? String(p.wc_product_id) : '') || p.wc_id || '',
              nome: p.nome || '',
              sku: p.sku || '',
              preco: Number(p.preco || p.preco_base || 0) || 0,
              precoRegular: Number(p.preco_regular || 0) || 0,
              precoPromocional: Number(p.preco_promocional || 0) || 0,
              estoque: estoqueNum,
              gerenciarEstoque: false,
              emEstoque: p.em_estoque === 1 || p.em_estoque === true || (p.em_estoque == null && estoqueNum > 0) || estoqueNum > 0,
              status: p.status || 'publish',
              categoria: p.categoria || '',
              imagem: Array.isArray(p.imagens) && p.imagens[0] ? String(p.imagens[0]) : '',
              descricao: p.descricao || '',
              permalink: '',
              tipo: 'simple',
              origem: p.origem || (p.woocommerce_id ? 'woocommerce' : 'manual'),
              sincronizadoEm: p.atualizado_em || p.criado_em || '',
      };
}

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
              preco: parseFloat(p.price || '0') || 0,
              preco_regular: parseFloat(p.regular_price || '0') || 0,
              preco_promocional: parseFloat(p.sale_price || '0') || 0,
              estoque: p.stock_quantity || 0,
              em_estoque: p.in_stock ? 1 : 0,
              status: p.status || 'publish',
              categoria: (p.categories || []).map(c => c.name).join(', '),
              descricao: (p.short_description || '').replace(/<[^>]*>/g, '').substring(0, 500),
              woocommerce_id: String(p.id),
              origem: 'woocommerce'
      }));
      const result = await upsertByField(TABLE, bulk, 'woocommerce_id');
      return {
              ok: true,
              page,
              sincronizados: Array.isArray(result) ? result.length : (result ? 1 : 0),
              totalPages,
              hasMore: page < totalPages
      };
}

// Sincroniza um lote de paginas (startPage ate startPage+batchSize-1)
// Retorna quantas paginas foram sincronizadas e se ainda ha mais
async function syncBatch(startPage = 1, batchSize = 5) {
      if (!WC_URL || !WC_KEY) throw new Error('WC_URL e WC_KEY nao configurados.');
      const first = await fetchWooPage(startPage);
      const totalPages = first.totalPages;
      const endPage = Math.min(startPage + batchSize - 1, totalPages);
      let totalSincronizados = 0;

  // processa a primeira pagina (ja buscada)
  const bulk0 = first.products.map(p => ({
          wc_id: String(p.id),
          nome: p.name || '',
          sku: p.sku || '',
          preco: parseFloat(p.price || '0') || 0,
          preco_regular: parseFloat(p.regular_price || '0') || 0,
          preco_promocional: parseFloat(p.sale_price || '0') || 0,
          estoque: p.stock_quantity || 0,
          em_estoque: p.in_stock ? 1 : 0,
          status: p.status || 'publish',
          categoria: (p.categories || []).map(c => c.name).join(', '),
          descricao: (p.short_description || '').replace(/<[^>]*>/g, '').substring(0, 500),
          woocommerce_id: String(p.id),
          origem: 'woocommerce'
  }));
      const r0 = await upsertByField(TABLE, bulk0, 'woocommerce_id');
      totalSincronizados += Array.isArray(r0) ? r0.length : (r0 ? 1 : 0);

  for (let p = startPage + 1; p <= endPage; p++) {
          const r = await syncPage(p);
          totalSincronizados += r.sincronizados;
  }

  return {
          ok: true,
          startPage,
          endPage,
          totalPages,
          sincronizados: totalSincronizados,
          hasMore: endPage < totalPages,
          nextPage: endPage < totalPages ? endPage + 1 : null
  };
}

export default async function handler(req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Key');
      if (req.method === 'OPTIONS') return res.status(200).end();

  try {
          // sync=1&page=N  -> sincroniza uma pagina especifica
        if (req.query.sync === '1') {
                  const page = parseInt(req.query.page) || 1;
                  const result = await syncPage(page);
                  return res.json(result);
        }

        // sync=batch&page=N&batch=5 -> sincroniza lote de paginas (padrao 5 por vez)
        if (req.query.sync === 'batch' || req.query.sync === 'all') {
                  const startPage = parseInt(req.query.page) || 1;
                  const batchSize = parseInt(req.query.batch) || 5;
                  const result = await syncBatch(startPage, batchSize);
                  return res.json(result);
        }

        // Lista produtos do Supabase (com search opcional)
        const q = (req.query.q || '').toString().trim().toLowerCase();
          const limit = parseInt(req.query.limit) || 20000;
          let data = await selectAll(TABLE, { orderBy: 'nome', limit: 20000 });
          if (q) {
                    data = data.filter(p =>
                                (p.nome || '').toLowerCase().includes(q) ||
                                (p.sku || '').toLowerCase().includes(q) ||
                                (p.categoria || '').toLowerCase().includes(q)
                                             );
          }
          const produtos = data.slice(0, limit).map(mapProduto);
          return res.json({ produtos, total: produtos.length });
  } catch (e) {
          console.error('[produtos] erro:', e.message);
          return res.status(500).json({ error: e.message });
  }
}

export const config = { maxDuration: 60 };
