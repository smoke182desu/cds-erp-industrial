// api/_lib/cache.js
// Cache em memoria para serverless (warm instances ~5-15min).
// Extraido de assistente-vendas.js para reuso.

const PROMPT_VERSION = 'momento-conversa-v7-funil-perfil';

const cache = new Map();
const CACHE_TTL = 180000; // 3 minutos

function getCacheKey(telefone, mensagens = []) {
  const ultima = mensagens[mensagens.length - 1] || {};
  return `assistente_${PROMPT_VERSION}_${telefone}_${mensagens.length}_${ultima.tipo || ''}_${ultima.criadoEm || ''}_${ultima.texto || ''}`;
}

export function getCache(telefone, mensagens) {
  const key = getCacheKey(telefone, mensagens);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

export function setCache(telefone, mensagens, data) {
  cache.set(getCacheKey(telefone, mensagens), { data, ts: Date.now() });
  evictOldest();
}

export function getCacheByKey(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

export function setCacheByKey(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, ts: Date.now() });
  evictOldest();
}

function evictOldest() {
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}
