import { phpFetch } from './_lib/php-api.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const r = await phpFetch('leads');
      const data = await r.json();
      const leads = Array.isArray(data) ? data : (data.leads || []);
      return res.status(200).json(leads);
    }

    if (req.method === 'POST') {
      const r = await phpFetch('leads', { method: 'POST', body: req.body });
      const data = await r.json();
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      const r = await phpFetch('leads', { method: 'PUT', params: { id }, body: req.body });
      const data = await r.json();
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      const r = await phpFetch('leads', { method: 'DELETE', params: { id } });
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('leads proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
