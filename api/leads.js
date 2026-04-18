// api/leads.js — proxy para PHP/MySQL backend
import { phpFetch } from './_lib/php-api.js';

const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';

function cors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret, X-Erp-Create');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const params = req.query.id ? { id: req.query.id } : {};
      const r = await phpFetch('leads', { params });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      const r = await phpFetch('leads', { method: 'PUT', params: { id }, body: req.body || {} });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (req.method === 'POST') {
      const erpCreate = req.body?.erpCreate === true || req.headers['x-erp-create'] === '1';
      if (!erpCreate) {
        const secret = req.headers['x-webhook-secret'] || req.query.secret;
        if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
      }
      const r = await phpFetch('leads', { method: 'POST', body: req.body || {} });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[leads] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
