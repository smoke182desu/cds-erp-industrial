// api/_lib/cache.js
// Cache compartilhado via Upstash Redis (REST API)
// Fallback para cache em memoria se env vars nao configuradas.
//
// Uso:
//   import { cacheGet, cacheSet, cacheDel, withCacheSWR } from './_lib/cache.js';
//   const leads = await withCacheSWR('leads:all', 30, 86400, async () => { ... });

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const HAS_REDIS = !!(REDIS_URL && REDIS_TOKEN);

// Fallback: cache em memoria local (compatibilidade sem Redis)
const MEM_CACHE = new Map();

// ---------- Helpers REST Upstash ----------
async function redisCmd(args) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const j = await res.json();
  return j.result;
}

// ---------- API publica ----------

// Pega valor + timestamp do cache. Retorna null se nao existe.
// Formato armazenado: { data, ts }
export async function cacheGet(key) {
  if (!HAS_REDIS) {
    const entry = MEM_CACHE.get(key);
    return entry ? entry : null;
  }
  try {
    const raw = await redisCmd(['GET', key]);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[cache] GET falhou p/ ${key}:`, err.message);
    return null;
  }
}

// Salva valor no cache com TTL de expiracao fisica (em segundos).
// A gente mantem o ts dentro do valor pra controle SWR proprio.
export async function cacheSet(key, data, ttlSeconds = 86400) {
  const entry = { data, ts: Date.now() };
  if (!HAS_REDIS) {
    MEM_CACHE.set(key, entry);
    // simula expiracao
    setTimeout(() => MEM_CACHE.delete(key), ttlSeconds * 1000).unref?.();
    return;
  }
  try {
    await redisCmd(['SET', key, JSON.stringify(entry), 'EX', String(ttlSeconds)]);
  } catch (err) {
    console.warn(`[cache] SET falhou p/ ${key}:`, err.message);
    // fallback: pelo menos salva em memoria
    MEM_CACHE.set(key, entry);
  }
}

// Remove chave do cache (invalidacao explicita).
export async function cacheDel(key) {
  MEM_CACHE.delete(key);
  if (!HAS_REDIS) return;
  try {
    await redisCmd(['DEL', key]);
  } catch (err) {
    console.warn(`[cache] DEL falhou p/ ${key}:`, err.message);
  }
}

// Flag em memoria pra evitar revalidacoes concorrentes do mesmo recurso
// dentro da mesma instancia Vercel (nao e exato cross-instance, mas reduz muito).
const REVALIDANDO = new Set();

// Stale-While-Revalidate generico.
//   key: string unica do recurso
//   freshSeconds: quanto tempo o cache e considerado fresco
//   staleSeconds: expiracao fisica no Redis (normalmente 24h)
//   loader: funcao async que busca os dados frescos
export async function withCacheSWR(key, freshSeconds, staleSeconds, loader) {
  const entry = await cacheGet(key);
  const agora = Date.now();

  // Cache fresco: retorna direto
  if (entry && entry.data && (agora - entry.ts < freshSeconds * 1000)) {
    return entry.data;
  }

  // Cache stale: dispara revalidacao em background e retorna o stale
  if (entry && entry.data) {
    if (!REVALIDANDO.has(key)) {
      REVALIDANDO.add(key);
      Promise.resolve()
        .then(() => loader())
        .then((fresh) => {
          if (fresh) return cacheSet(key, fresh, staleSeconds);
        })
        .catch((err) => console.warn(`[cache] revalidate ${key} falhou:`, err.message))
        .finally(() => REVALIDANDO.delete(key));
    }
    return entry.data;
  }

  // Cache vazio: busca sincronamente, salva e retorna
  try {
    const fresh = await loader();
    if (fresh) await cacheSet(key, fresh, staleSeconds);
    return fresh;
  } catch (err) {
    // Se falhou e tem stale ANTIGO, serve mesmo expirado (defesa contra quota)
    if (entry && entry.data) return entry.data;
    throw err;
  }
}

export { HAS_REDIS };
