import axios from 'axios';
import { selectAll, upsertByField, insert, update, remove } from './_lib/supabase.js';

const WC_URL = process.env.WOOCOMMERCE_URL || process.env.WC_URL || '';
const WC_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.WC_KEY || '';
const WC_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.WC_SECRET || '';
const TABLE = 'produtos';

function numero(valor, fallback = 0) {
      const n = Number(String(valor ?? '').replace(',', '.'));
      return Number.isFinite(n) ? n : fallback;
}

function textoSemHtml(valor, limite = 500) {
      return String(valor || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, limite);
}

function urlImagem(valor) {
      const url = String(valor || '').trim();
      if (!url) return '';
      if (/^(https?:|data:image\/)/i.test(url)) return url;
      return '';
}

function urlsUnicas(urls) {
      const vistos = new Set();
      return (urls || [])
        .map(urlImagem)
        .filter(Boolean)
        .filter(url => {
              if (vistos.has(url)) return false;
              vistos.add(url);
              return true;
        });
}

function imagensWoo(p) {
      return urlsUnicas((p.images || p.imagens || []).map(img => (
            typeof img === 'string' ? img : (img?.src || img?.url || img?.source_url)
      )));
}

function imagensProduto(p) {
      return urlsUnicas([
            p.imagem,
            p.foto_url,
            p.image_url,
            ...(Array.isArray(p.imagens) ? p.imagens : []),
            ...(Array.isArray(p.fotos) ? p.fotos : []),
      ]);
}

function payloadWoo(p) {
      const imgs = imagensWoo(p);
      const preco = numero(p.price || p.regular_price || p.sale_price || 0);
      const estoque = numero(p.stock_quantity ?? 0);
      const wcId = String(p.id || '');
      const wcProductId = Number(p.id);
      return {
              wc_id: wcId,
              wc_product_id: Number.isFinite(wcProductId) ? wcProductId : null,
              nome: p.name || '',
              sku: p.sku || null,
              preco,
              preco_base: preco,
              preco_regular: numero(p.regular_price || p.price || 0),
              preco_promocional: numero(p.sale_price || 0),
              estoque,
              estoque_atual: estoque,
              em_estoque: p.in_stock ? 1 : 0,
              status: p.status || 'publish',
              categoria: (p.categories || []).map(c => c.name).filter(Boolean).join(', '),
              descricao: textoSemHtml(p.short_description || p.description || '', 800),
              imagens: imgs,
              foto_url: imgs[0] || null,
              fotos: imgs.slice(1),
              woocommerce_id: wcId,
              origem: 'woocommerce',
              atualizado_em: new Date().toISOString(),
      };
}

function payloadCrudProduto(p) {
  const imgs = urlsUnicas([
    p.imagem,
    p.fotoUrl,
    p.foto_url,
    ...(Array.isArray(p.imagens) ? p.imagens : []),
    ...(Array.isArray(p.fotos) ? p.fotos : []),
  ]);
  const wcId = p.woocommerce_id || p.wcId || p.wc_id || p.wc_product_id || '';
  const payload = {
    nome: String(p.nome || '').trim(),
    sku: p.sku ? String(p.sku).trim().toUpperCase() : null,
    categoria: p.categoria || null,
    descricao: p.descricao || null,
    preco: numero(p.preco ?? p.preco_base ?? 0),
    preco_base: numero(p.preco ?? p.preco_base ?? 0),
    preco_regular: numero(p.precoRegular ?? p.preco_regular ?? p.preco ?? 0),
    preco_promocional: numero(p.precoPromocional ?? p.preco_promocional ?? 0),
    preco_custo: numero(p.custo ?? p.preco_custo ?? 0),
    estoque: numero(p.estoque ?? p.estoque_atual ?? 0),
    estoque_atual: numero(p.estoque ?? p.estoque_atual ?? 0),
    estoque_minimo: numero(p.estoqueMinimo ?? p.estoque_minimo ?? 0),
    em_estoque: p.emEstoque === false || p.em_estoque === false ? 0 : 1,
    status: p.status || (p.emEstoque === false ? 'draft' : 'publish'),
    ativo: p.ativo ?? p.status !== 'draft',
    origem: p.origem || (wcId ? 'woocommerce' : 'manual'),
    peso: p.peso != null ? numero(p.peso) : null,
    imagens: imgs,
    foto_url: imgs[0] || null,
    fotos: imgs.slice(1),
  };

  if (wcId) {
    payload.woocommerce_id = String(wcId);
    payload.wc_id = String(wcId);
    const wcProductId = Number(wcId);
    if (Number.isFinite(wcProductId)) payload.wc_product_id = wcProductId;
  }

  return payload;
}

function mapProduto(p) {
      const estoqueNum = Number(p.estoque ?? p.estoque_atual ?? 0) || 0;
      const imgs = imagensProduto(p);
      const emEstoque = p.em_estoque == null
        ? estoqueNum > 0
        : p.em_estoque === 1 || p.em_estoque === true;
      return {
              id: p.id || '',
              wcId: p.woocommerce_id || (p.wc_product_id != null ? String(p.wc_product_id) : '') || p.wc_id || '',
              nome: p.nome || '',
              sku: p.sku || '',
              preco: Number(p.preco || p.preco_base || 0) || 0,
              precoRegular: Number(p.preco_regular || 0) || 0,
              precoPromocional: Number(p.preco_promocional || 0) || 0,
              custo: Number(p.preco_custo || 0) || 0,
              estoque: estoqueNum,
              estoqueMinimo: Number(p.estoque_minimo || 0) || 0,
              gerenciarEstoque: false,
              emEstoque,
              status: p.status || 'publish',
              categoria: p.categoria || '',
              imagem: imgs[0] || '',
              fotoUrl: imgs[0] || '',
              fotos: imgs,
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
      const bulk = products.map(payloadWoo);
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
  const bulk0 = first.products.map(payloadWoo);
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

// ── CRUD de produto unitario (consolidado de produto.js) ────────────────────

function validarProduto(p) {
  const erros = [];
  if (!p.nome?.trim()) erros.push('nome obrigatorio');
  if (p.ncm && !/^\d{8}$/.test(String(p.ncm).replace(/\D/g, ''))) erros.push('NCM deve ter 8 digitos');
  return erros;
}

function aplicarDefaultsMEI(p) {
  return {
    origem_mercadoria: p.origemMercadoria || '0',
    csosn_icms: p.csosnIcms || '102',
    aliq_icms: Number(p.aliqIcms) || 0,
    cst_pis: p.cstPis || '49',
    aliq_pis: Number(p.aliqPis) || 0,
    cst_cofins: p.cstCofins || '49',
    aliq_cofins: Number(p.aliqCofins) || 0,
    unidade: p.unidade || 'UN',
    cfop_dentro: p.cfopDentro || '5102',
    cfop_fora: p.cfopFora || '6102',
    gerenciar_estoque: p.gerenciarEstoque ?? true,
    em_estoque: p.emEstoque ?? true,
    estoque: Number(p.estoque) || 0,
    preco: Number(p.preco) || 0,
    preco_regular: Number(p.precoRegular) || 0,
    custo: Number(p.custo) || 0,
    ...p,
  };
}

function normalizarProduto(p) {
  const nc = { ...p };
  if (nc.ncm) nc.ncm = String(nc.ncm).replace(/\D/g, '').padStart(8, '0').slice(0, 8);
  if (nc.cfopDentro) nc.cfopDentro = String(nc.cfopDentro).replace(/\D/g, '').slice(0, 4);
  if (nc.cfopFora) nc.cfopFora = String(nc.cfopFora).replace(/\D/g, '').slice(0, 4);
  if (nc.sku) nc.sku = String(nc.sku).trim().toUpperCase();
  return nc;
}

async function handleProdutoCrud(req, res) {
  const id = req.query.id || req.body?.id;
  if (req.method === 'GET') {
    if (id) {
      const data = await selectAll(TABLE, { filters: { id: `eq.${id}` } });
      if (!data.length) return res.status(404).json({ error: 'nao encontrado' });
      return res.status(200).json({ ok: true, produto: data[0] });
    }
    const products = await selectAll(TABLE, { orderBy: 'nome', limit: 300 });
    return res.status(200).json({ ok: true, produtos: products, total: products.length });
  }
  if (req.method === 'POST') {
    const normalized = aplicarDefaultsMEI(normalizarProduto(req.body || {}));
    const erros = validarProduto(normalized);
    if (erros.length) return res.status(400).json({ error: 'validacao', erros });
    const payload = { ...payloadCrudProduto(normalized), atualizado_em: new Date().toISOString() };
    if (!id) payload.criado_em = new Date().toISOString();
    let conflictField = 'id';
    if (!id && payload.sku) conflictField = 'sku';
    if (!id && payload.woocommerce_id) conflictField = 'woocommerce_id';
    const saved = await upsertByField(TABLE, payload, conflictField);
    return res.status(200).json({ ok: true, id: saved?.id, produto: saved });
  }
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'id obrigatorio' });
    const normalized = aplicarDefaultsMEI(normalizarProduto(req.body || {}));
    const erros = validarProduto(normalized);
    if (erros.length) return res.status(400).json({ error: 'validacao', erros });
    const product = { ...payloadCrudProduto(normalized), atualizado_em: new Date().toISOString() };
    const updated = await update(TABLE, 'id', id, product);
    return res.status(200).json({ ok: true, id, produto: updated });
  }
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id obrigatorio' });
    await remove(TABLE, 'id', id);
    return res.status(200).json({ ok: true, id, deletado: true });
  }
  return res.status(405).json({ error: 'metodo nao permitido' });
}

export default async function handler(req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Key');
      if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // CRUD unitario (consolidado de produto.js)
    if (req.query.crud === '1') {
      return await handleProdutoCrud(req, res);
    }

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
