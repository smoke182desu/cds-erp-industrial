// api/lib/firestore.js
// Modulo compartilhado Firebase Admin SDK
// Usa FIREBASE_SERVICE_ACCOUNT env var para autenticar (plano Blaze)
// Isso evita a quota de 50k leituras/dia do "free tier database" da REST API publica

import admin from 'firebase-admin';

const PROJECT_ID = 'gen-lang-client-0908948294';
const DATABASE_ID = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';

// Inicializa Firebase Admin (singleton - reutiliza entre invocacoes)
if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error('[firestore] Erro ao parsear FIREBASE_SERVICE_ACCOUNT:', e.message);
      credential = admin.credential.applicationDefault();
    }
  } else {
    credential = admin.credential.applicationDefault();
  }
  admin.initializeApp({ credential, projectId: PROJECT_ID });
}

// Firestore com database ID especifico (nao e o default)
const db = admin.firestore();
db.settings({ databaseId: DATABASE_ID, ignoreUndefinedProperties: true });

// ---------- Helpers compatíveis com o formato antigo ----------

// Adicionar documento a uma colecao (retorna o ID)
export async function firestoreAdd(collection, data) {
  const ref = await db.collection(collection).add({
    ...data,
    criadoEm: data.criadoEm || admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

// Query simples: buscar 1 documento onde field == value
export async function firestoreQuery(collection, field, value) {
  const snap = await db.collection(collection)
    .where(field, '==', value)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

// Listar todos os documentos de uma colecao
export async function firestoreList(collection, orderBy = 'criadoEm', direction = 'desc', limit = 300) {
  const snap = await db.collection(collection)
    .orderBy(orderBy, direction)
    .limit(limit)
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Atualizar campos de um documento
export async function firestoreUpdate(collection, docId, data) {
  await db.collection(collection).doc(docId).update({
    ...data,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
  });
  return docId;
}

// Obter um documento por ID
export async function firestoreGet(collection, docId) {
  const doc = await db.collection(collection).doc(docId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// Deletar um documento
export async function firestoreDelete(collection, docId) {
  await db.collection(collection).doc(docId).delete();
  return docId;
}

// Query com multiplos filtros
export async function firestoreQueryMulti(collection, filters, orderBy, direction = 'desc', limit = 100) {
  let query = db.collection(collection);
  for (const { field, op, value } of filters) {
    query = query.where(field, op, value);
  }
  if (orderBy) query = query.orderBy(orderBy, direction);
  query = query.limit(limit);
  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Incrementar contador (para codigos sequenciais como CLI-0001)
export async function firestoreIncrement(collection, docId, field) {
  const ref = db.collection(collection).doc(docId);
  const doc = await ref.get();
  const atual = doc.exists ? (doc.data()[field] || 0) : 0;
  const proximo = Number(atual) + 1;
  await ref.set({ [field]: proximo }, { merge: true });
  return proximo;
}

// Exporta o db e admin para uso direto quando necessario
export { db, admin };
export default db;
