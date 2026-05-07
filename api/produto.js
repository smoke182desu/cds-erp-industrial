// api/produto.js — CRUD de produto unitario no Supabase
import { selectAll, insert, update, remove, upsertByField } from './_lib/supabase.js';

const TABLE = 'produtos';

export const config = { maxDuration: 30 };

// Validações básicas fiscais
function validar(produto) {
  const erros = [];
  if (!produto.nome?.trim()) erros.push('nome obrigatorio');
  if (produto.ncm && !/^\d{8}$/.test(String(produto.ncm).replace(/\D/g, ''))) erros.push('NCM deve ter 8 digitos');
  if (produto.cfopDentro && !/^\d{4}$/.test(String(produto.cfopDentro))) erros.push('CFOP dentro deve ter 4 digitos');
  if (produto.cfopFora && !/^\d{4}$/.test(String(produto.cfopFora))) erros.push('CFOP fora deve ter 4 digitos');
  if (produto.ean && produto.ean !== 'SEM GTIN' && !/^\d{8}$|^\d{12,14}$/.test(produto.ean)) erros.push('EAN invalido');
  return erros;
}

// Defaults para MEI (CSOSN 102, PIS/COFINS isento)
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

function normalizar(p) {
  const nc = { ...p };
  if (nc.ncm) nc.ncm = String(nc.ncm).replace(/\D/g, '').padStart(8, '0').slice(0, 8);
  if (nc.cfopDentro) nc.cfopDentro = String(nc.cfopDentro).replace(/\D/g, '').slice(0, 4);
  if (nc.cfopFora) nc.cfopFora = String(nc.cfopFora).replace(/\D/g, '').slice(0, 4);
  if (nc.sku) nc.sku = String(nc.sku).trim().toUpperCase();
  return nc;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const id = req.query.id || req.body?.id;

    // GET /api/produto - listar todos ou buscar um
    if (req.method === 'GET') {
      if (id) {
        const data = await selectAll(TABLE, { filters: { id: `eq.${id}` } });
        if (!data.length) return res.status(404).json({ error: 'nao encontrado' });
        return res.status(200).json({ ok: true, produto: data[0] });
      }
      const products = await selectAll(TABLE, { orderBy: 'nome', limit: 300 });
      return res.status(200).json({ ok: true, produtos: products, total: products.length });
    }

    // POST /api/produto - criar ou atualizar (upsert inteligente)
    if (req.method === 'POST') {
      const body = req.body || {};
      const normalized = normalizar(body);
      const product = aplicarDefaultsMEI(normalized);

      const erros = validar(product);
      if (erros.length) return res.status(400).json({ error: 'validacao', erros });

      const now = new Date().toISOString();
      const payload = {
        ...product,
        updated_at: now,
      };
      if (!id) payload.created_at = now;

      // Upsert baseado no ID se fornecido, ou SKU se fornecido
      let conflictField = 'id';
      if (!id && payload.sku) conflictField = 'sku';
      if (!id && payload.woocommerce_id) conflictField = 'woocommerce_id';

      const saved = await upsertByField(TABLE, payload, conflictField);
      return res.status(200).json({ ok: true, id: saved?.id, produto: saved });
    }

    // PUT /api/produto?id=xxx - atualizar explicitamente
    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      const body = req.body || {};
      const product = normalizar(body);
      product.updated_at = new Date().toISOString();
      
      const updated = await update(TABLE, 'id', id, product);
      return res.status(200).json({ ok: true, id, produto: updated });
    }

    // DELETE /api/produto?id=xxx
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await remove(TABLE, 'id', id);
      return res.status(200).json({ ok: true, id, deletado: true });
    }

    return res.status(405).json({ error: 'metodo nao permitido' });
  } catch (err) {
    console.error('[produto] erro:', err?.message);
    return res.status(500).json({ error: err.message });
  }
}
