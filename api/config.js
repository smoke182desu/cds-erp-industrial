// api/config.js — proxy para PHP/MySQL backend (config)
import { phpFetch } from './_lib/php-api.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const col = req.query.col || 'config';
  const doc = req.query.doc;
  if (!doc) return res.status(400).json({ error: 'doc obrigatorio' });

  try {
    if (req.method === 'GET') {
      const r = await phpFetch('config', { params: { collection: col, doc } });
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = {}; }
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const r = await phpFetch('config', {
        method: 'POST',
        params: { collection: col, doc },
        body: req.body || {},
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(405).json({ error: 'metodo nao permitido' });
  } catch (err) {
    console.error('[config] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
