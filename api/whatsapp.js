// api/whatsapp.js — webhook handler, repassa para PHP/MySQL
import { phpFetch } from './_lib/php-api.js';

export default async function handler(req, res) {
  // Challenge GET (verificacao de webhook)
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge || 'ok';
    return res.status(200).send(String(challenge));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const r = await phpFetch('webhook', { method: 'POST', body: req.body || {} });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('[whatsapp] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
