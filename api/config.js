// api/config.js — proxy para Supabase (config)
import { selectAll, upsertByField } from './_lib/supabase.js';

const TABLE = 'configs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const col = req.query.col || req.query.collection || 'config';
  const doc = req.query.doc;
  if (!doc) return res.status(400).json({ error: 'doc obrigatorio' });

  try {
    if (req.method === 'GET') {
      const data = await selectAll(TABLE, { 
        filters: { 
          collection: `eq.${col}`,
          key: `eq.${doc}`
        }
      });
      const result = data[0]?.data || data[0]?.value || {};
      return res.status(200).json({ ok: true, data: result });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const payload = {
        collection: col,
        key: doc,
        data: req.body || {}
      };
      // Upsert baseado na combinacao de collection e key (exige constraint unique no Supabase)
      // Se nao houver constraint, o helper vai falhar. 
      // Fallback: tentar usar 'key' como conflict field se for unico globalmente.
      const result = await upsertByField(TABLE, payload, 'key');
      return res.status(200).json({ ok: true, data: result });
    }

    return res.status(405).json({ error: 'metodo nao permitido' });
  } catch (err) {
    console.error('[config] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
