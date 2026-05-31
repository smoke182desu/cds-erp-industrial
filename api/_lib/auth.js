// api/_lib/auth.js — Bearer Token auth para chamadas externas (WooCommerce, etc.)
function getAllowedKeys() {
  const single = (process.env.INTEGRACAO_API_KEY || "").trim();
  const many = (process.env.INTEGRACAO_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const set = new Set(many);
  if (single) set.add(single);
  return set;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Valida o header Authorization: Bearer <token>.
 * Retorna true se autenticado. Caso contrário, ja escreve 401 e retorna false.
 */
export function requireBearer(req, res) {
  const allowed = getAllowedKeys();
  if (allowed.size === 0) {
    console.warn("[auth] INTEGRACAO_API_KEY não configurada — endpoint sem auth!");
    return true;
  }
  const raw = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(raw));
  if (!m) {
    res.status(401).json({ error: "Authorization Bearer token requerido" });
    return false;
  }
  const token = m[1].trim();
  for (const k of allowed) {
    if (timingSafeEqual(token, k)) return true;
  }
  res.status(401).json({ error: "Bearer token invalido" });
  return false;
}

export default { requireBearer };
