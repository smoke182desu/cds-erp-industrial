import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = { maxDuration: 30 };

function getDb() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT nao configurado.');
    const serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
    initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const databaseId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
  return getFirestore(undefined, databaseId);
}

// Validações básicas fiscais
function validar(produto) {
  const erros = [];
  if (!produto.nome?.trim()) erros.push('nome obrigatorio');
  if (!produto.sku?.trim()) erros.push('sku obrigatorio');
  if (produto.ncm && !/^\d{8}$/.test(String(produto.ncm).replace(/\D/g, ''))) erros.push('NCM deve ter 8 digitos');
  if (produto.cfopDentro && !/^\d{4}$/.test(String(produto.cfopDentro))) erros.push('CFOP dentro deve ter 4 digitos');
  if (produto.cfopFora && !/^\d{4}$/.test(String(produto.cfopFora))) erros.push('CFOP fora deve ter 4 digitos');
  if (produto.ean && produto.ean !== 'SEM GTIN' && !/^\d{8}$|^\d{12,14}$/.test(produto.ean)) erros.push('EAN invalido');
  return erros;
}

// Defaults pra MEI (CSOSN 102, PIS/COFINS isento)
function aplicarDefaultsMEI(p) {
  return {
    origemMercadoria: '0',
    csosnIcms: '102',
    aliqIcms: 0,
    cstPis: '49',
    aliqPis: 0,
    cstCofins: '49',
    aliqCofins: 0,
    unidade: 'UN',
    cfopDentro: '5102',
    cfopFora: '6102',
    gerenciarEstoque: true,
    emEstoque: true,
    estoque: 0,
    preco: 0,
    precoRegular: 0,
    custo: 0,
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

function docIdFor(p) {
  if (p.wcId) return `wc_${p.wcId}`;
  if (p.sku) return `sku_${p.sku.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDb();
    const col = db.collection('produtos');
    const id = req.query.id || req.body?.id;

    // GET /api/produto?id=xxx - buscar um
    if (req.method === 'GET') {
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      const snap = await col.doc(id).get();
      if (!snap.exists) return res.status(404).json({ error: 'nao encontrado' });
      return res.status(200).json({ ok: true, produto: { id: snap.id, ...snap.data() } });
    }

    // POST /api/produto - criar
    if (req.method === 'POST') {
      const body = req.body || {};
      const produto = aplicarDefaultsMEI(normalizar(body));
      const erros = validar(produto);
      if (erros.length) return res.status(400).json({ error: 'validacao', erros });
      const docId = id || docIdFor(produto);
      if (!docId) return res.status(400).json({ error: 'precisa de sku ou wcId' });
      const now = new Date().toISOString();
      const data = {
        ...produto,
        origem: produto.origem || 'manual',
        criadoEm: now,
        atualizadoEm: now,
      };
      await col.doc(docId).set(data, { merge: true });
      return res.status(201).json({ ok: true, id: docId, produto: data });
    }

    // PUT /api/produto?id=xxx - atualizar
    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      const body = req.body || {};
      const produto = normalizar(body);
      const erros = validar({ ...await col.doc(id).get().then(s => s.data() || {}), ...produto });
      if (erros.length) return res.status(400).json({ error: 'validacao', erros });
      produto.atualizadoEm = new Date().toISOString();
      await col.doc(id).set(produto, { merge: true });
      const snap = await col.doc(id).get();
      return res.status(200).json({ ok: true, id, produto: { id, ...snap.data() } });
    }

    // DELETE /api/produto?id=xxx
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await col.doc(id).delete();
      return res.status(200).json({ ok: true, id, deletado: true });
    }

    return res.status(405).json({ error: 'metodo nao permitido' });
  } catch (err) {
    console.error('[produto] erro:', err?.message, err?.stack);
    return res.status(500).json({ error: err.message });
  }
}
