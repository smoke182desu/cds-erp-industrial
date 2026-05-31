// api/_lib/evolution.js
// Helper para chamar a Evolution API com a chave global.

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://127.0.0.1:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

export async function evolutionFetch(path, opts = {}) {
  if (!EVOLUTION_API_KEY) {
    throw new Error('EVOLUTION_API_KEY ausente no .env');
  }
  const url = `${EVOLUTION_URL.replace(/\/$/, '')}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY,
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err = new Error(`Evolution ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'instancia';
}
