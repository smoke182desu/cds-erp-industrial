// src/services/apiClient.ts
// Fetch wrapper que injeta automaticamente cliente_agencia_id quando há empresa ativa.
// Substitui chamadas `fetch('/api/...')` por `apiFetch('/api/...')`.

const STORAGE_KEY = 'trafego.clienteAtivoId';

function getClienteAtivoId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch { return null; }
}

function injetarClienteAgencia(url: string, clienteId: string | null): string {
  if (!clienteId) return url;
  // Só injeta em URLs /api/* (não em externos)
  if (!url.startsWith('/api/')) return url;
  // Se já tem cliente_agencia_id ou cliente_id no query, não sobrescreve
  if (url.includes('cliente_agencia_id=') || url.includes('cliente_id=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cliente_agencia_id=${clienteId}`;
}

export async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const clienteId = getClienteAtivoId();

  // Pra GETs: injeta como query param
  const method = (init?.method || 'GET').toUpperCase();
  let finalUrl = url;
  if (method === 'GET' || method === 'DELETE') {
    finalUrl = injetarClienteAgencia(url, clienteId);
  }

  // Pra POST/PATCH/PUT: injeta no body JSON se tiver cliente_id ativo e o body não tiver
  let finalInit = init;
  if ((method === 'POST' || method === 'PATCH' || method === 'PUT') && clienteId && url.startsWith('/api/')) {
    if (init?.body && typeof init.body === 'string') {
      try {
        const parsed = JSON.parse(init.body);
        if (parsed && typeof parsed === 'object' && !parsed.cliente_agencia_id && !parsed.cliente_id) {
          parsed.cliente_agencia_id = clienteId;
          finalInit = { ...init, body: JSON.stringify(parsed) };
        }
      } catch { /* body não é JSON, ignora */ }
    }
    // Também adiciona header pra endpoints que filtram por header
    finalInit = {
      ...finalInit,
      headers: {
        ...finalInit?.headers,
        'X-Cliente-Agencia-Id': clienteId,
      },
    };
  } else if (clienteId) {
    finalInit = {
      ...init,
      headers: {
        ...init?.headers,
        'X-Cliente-Agencia-Id': clienteId,
      },
    };
  }

  return fetch(finalUrl, finalInit);
}

// Helper que retorna JSON direto
export async function apiGet<T = any>(url: string): Promise<T> {
  const r = await apiFetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
