// _lib/php-api.js — helper para chamar o backend PHP MySQL
export const PHP_API = 'https://cdsind.com.br/erp-api/api.php';
export const PHP_KEY = 'cds-erp-2026-secure-key';

export function phpHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', 'X-Api-Key': PHP_KEY, ...extra };
}

export async function phpFetch(endpoint, { method = 'GET', params = {}, body } = {}) {
  const url = new URL(PHP_API);
  url.searchParams.set('endpoint', endpoint);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const opts = { method, headers: phpHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(url.toString(), opts);
}
