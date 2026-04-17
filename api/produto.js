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
  if (produto.ncm && !/^\d{8}$/.test(String(produto.ncm).replace(/\D/g, ''))) erros.push('NCM deve ter 8 digitos');
  if (produto.cfopDentro && !/^\d{4}$/.test(String(produto.cfopDentro))) erros.push('CFOP dentro deve ter 4 digitos');
  if (produto.cfopFora && !/^\d{4}$/.test(String(produto.cfopFora))) erros.push('CFOP fora deve ter 4 digitos');
  if (produto.ean && produto.ean !== 'SEM GTIN' && !/^\d{8}$|^\d{12,14}$/.test(produto.ean)) erros.push('EAN invalido');
  return erros;
}

// Defaults para MEI (CSOSN 102, PIS/COFINS isento)
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

// Normaliza string para comparação (sem acento, minúsculo, só alfanumérico)
function makeSearchTokens(nome = '', sku = '', categoria = '') {
  return [...new Set(
    `${nome} ${sku} ${categoria}`
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2)
  )];
}

function normStr(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Busca produto existente no catálogo por SKU ou nome similar
async function buscarProdutoExistente(db, produto) {
  const col = db.collection('produtos');

  // 1. Busca por SKU exato
  if (produto.sku) {
    const docId = docIdFor(produto);
    if (docId) {
      const snap = await col.doc(docId).get();
      if (snap.exists) return { id: snap.id, ...snap.data() };
    }
    // Busca por campo sku
    const bySku = await col.where('sku', '==', produto.sku).limit(1).get();
    if (!bySku.empty) {
      const doc = bySku.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  }

  // 2. Busca por nome exato (case insensitive)
  if (produto.nome) {
    const nomeNorm = normStr(produto.nome);
    // Busca os primeiros 200 produtos e faz matching no servidor
    const snap = await col.limit(200).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.nome) continue;
      const existNorm = normStr(data.nome);
      // Match exato ou um contém o outro (produto sob medida pode ter nome ligeiramente diferente)
      if (existNorm === nomeNorm ||
          existNorm.includes(nomeNorm) ||
          nomeNorm.includes(existNorm)) {
        return { id: doc.id, ...data };
      }
    }
  }

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

    // GET /api/produto - listar todos ou buscar um
    if (req.method === 'GET') {
      if (id) {
        const snap = await col.doc(id).get();
        if (!snap.exists) return res.status(404).json({ error: 'nao encontrado' });
        return res.status(200).json({ ok: true, produto: { id: snap.id, ...snap.data() } });
      }
      // GET sem id → listar todos (útil para catálogo)
      const snap = await col.orderBy('nome').limit(300).get();
      const produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok: true, produtos, total: produtos.length });
    }

    // POST /api/produto - criar ou atualizar se já existir no catálogo
    if (req.method === 'POST') {
      const body = req.body || {};
      const produtoRaw = normalizar(body);
      const produto = aplicarDefaultsMEI(produtoRaw);

      const erros = validar(produto);
      if (erros.length) return res.status(400).json({ error: 'validacao', erros });

      const now = new Date().toISOString();

      // Buscar se já existe no catálogo (por SKU ou nome similar)
      const existente = await buscarProdutoExistente(db, produto);

      if (existente) {
        // Produto já existe — atualiza com novos dados (merge inteligente)
        const docId = existente.id;
        const atualizado = {
          ...existente,
          // Atualiza apenas campos fiscais e de preço se veio preenchido no request
          ...(produto.preco > 0 && { preco: produto.preco }),
          ...(produto.precoRegular > 0 && { precoRegular: produto.precoRegular }),
          ...(produto.ncm && { ncm: produto.ncm }),
          ...(produto.unidade && produto.unidade !== 'UN' && { unidade: produto.unidade }),
          ...(produto.descricao && { descricao: produto.descricao }),
          ...(produto.categoria && { categoria: produto.categoria }),
          // Sempre aplica defaults MEI se não tinha
          csosnIcms: existente.csosnIcms || produto.csosnIcms,
          cstPis: existente.cstPis || produto.cstPis,
          cstCofins: existente.cstCofins || produto.cstCofins,
          cfopDentro: existente.cfopDentro || produto.cfopDentro,
          cfopFora: existente.cfopFora || produto.cfopFora,
          atualizadoEm: now,
          // Preserva SKU existente se não veio um novo
          sku: produto.sku || existente.sku,
        };

        await col.doc(docId).set(atualizado, { merge: true });
        return res.status(200).json({
          ok: true,
          id: docId,
          produto: atualizado,
          atualizado: true,
          msg: `Produto "${existente.nome}" atualizado no catálogo existente`,
        });
      }

      // Produto novo — cria normalmente
      let docId = id || docIdFor(produto);
      if (!docId) {
        // Sem SKU: gera ID baseado no nome
        const nomeSlug = normStr(produto.nome).replace(/\s+/g, '_').slice(0, 40);
        docId = `manual_${nomeSlug}_${Date.now()}`;
      }

      const data = {
        ...produto,
        origem: produto.origem || 'manual',
        searchTokens: makeSearchTokens(produto.nome, produto.sku, produto.categoria),
        criadoEm: now,
        atualizadoEm: now,
      };
      await col.doc(docId).set(data, { merge: true });
      return res.status(201).json({ ok: true, id: docId, produto: data, criado: true });
    }

    // PUT /api/produto?id=xxx - atualizar explicitamente
    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      const body = req.body || {};
      const produto = normalizar(body);
      const snapAtual = await col.doc(id).get();
      const atual = snapAtual.exists ? snapAtual.data() : {};
      const erros = validar({ ...atual, ...produto });
      if (erros.length) return res.status(400).json({ error: 'validacao', erros });
      produto.atualizadoEm = new Date().toISOString();
      produto.searchTokens = makeSearchTokens(produto.nome, produto.sku, produto.categoria);
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
