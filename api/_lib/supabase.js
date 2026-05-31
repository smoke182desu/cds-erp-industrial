// api/_lib/supabase.js
// Helper compartilhado para PostgREST (Supabase)
// Substituiu phpFetch quando o backend HostGator/MySQL foi descontinuado.
// Usa fetch puro (sem dependencia npm). Service role key bypassa RLS.

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';


// Path prefix do REST API. Supabase usa /rest/v1, PostgREST puro usa /.
// Permite apontar para PostgREST self-hosted setando SUPABASE_PATH_PREFIX=
const SUPABASE_PATH_PREFIX =
  process.env.SUPABASE_PATH_PREFIX !== undefined
    ? process.env.SUPABASE_PATH_PREFIX
    : '/rest/v1';

export const SUPABASE_OK = !!(SUPABASE_URL && SUPABASE_KEY);

// Faz request HTTP a PostgREST.
// path: ex. "/leads?id=eq.123"  body: objeto JSON  method: GET|POST|PATCH|DELETE
export async function sb(path, opts = {}) {
  if (!SUPABASE_OK) {
    throw new Error('Supabase env vars ausentes (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)');
  }
  const url = `${SUPABASE_URL.replace(/\/$/, '')}${SUPABASE_PATH_PREFIX}${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': opts.prefer || 'return=representation',
    ...(opts.headers || {}),
  };
  const init = { method: opts.method || 'GET', headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const r = await fetch(url, init);
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}

// SELECT generico com fallback (se a coluna order nao existe, refaz sem ordem)
export async function selectAll(table, { orderBy, limit = 300, filters = {} } = {}) {
  let qs = 'select=*';
  for (const [k, v] of Object.entries(filters)) {
    qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
  }
  qs += `&limit=${limit}`;
  const tries = [];
  if (orderBy) {
    tries.push(`${qs}&order=${orderBy}.desc`);
    tries.push(`${qs}&order=created_at.desc`);
  }
  tries.push(qs);
  for (const q of tries) {
    const r = await sb(`/${table}?${q}`);
    if (r.ok) return Array.isArray(r.body) ? r.body : [];
    if (r.status !== 400) {
      console.warn(`[supabase] SELECT ${table} status ${r.status}:`, JSON.stringify(r.body).slice(0, 150));
      return [];
    }
  }
  return [];
}

export async function insert(table, data) {
  const r = await sb(`/${table}`, { method: 'POST', body: data });
  if (!r.ok) throw new Error(`insert ${table} ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  const out = Array.isArray(r.body) ? r.body[0] : r.body;
  return out;
}

export async function upsertByField(table, data, conflictField) {
  const r = await sb(`/${table}?on_conflict=${conflictField}`, {
    method: 'POST',
    body: data,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  if (!r.ok) throw new Error(`upsert ${table} ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  const out = Array.isArray(r.body) ? r.body[0] : r.body;
  return out;
}

export async function update(table, filterField, filterValue, data) {
  const r = await sb(
    `/${table}?${filterField}=eq.${encodeURIComponent(filterValue)}`,
    { method: 'PATCH', body: data }
  );
  if (!r.ok) throw new Error(`update ${table} ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return Array.isArray(r.body) ? r.body[0] : r.body;
}

export async function remove(table, filterField, filterValue) {
  const r = await sb(`/${table}?${filterField}=eq.${encodeURIComponent(filterValue)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`delete ${table} ${r.status}`);
  return true;
}

export default { sb, selectAll, insert, upsertByField, update, remove, SUPABASE_OK };
