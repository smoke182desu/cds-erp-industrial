// api/leads-leitura.js
// Persiste estado de "lido" por lead no Supabase
// GET  /api/leads-leitura           → { lidos: { [lead_id]: ultima_leitura_em } }
// GET  /api/leads-leitura?id=X      → { lead_id, ultima_leitura_em }
// POST /api/leads-leitura           → body { lead_id, ultima_hora } → upsert

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const TABLE = 'leads_leitura';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const id = req.query.id;

      if (id) {
        // Retorna leitura de um lead específico
        const { data, error } = await supabase
          .from(TABLE)
          .select('lead_id, ultima_leitura_em')
          .eq('lead_id', id)
          .maybeSingle();
        if (error) throw error;
        return res.status(200).json(data || { lead_id: id, ultima_leitura_em: null });
      }

      // Retorna todos os lidos como mapa { lead_id → ultima_leitura_em }
      const { data, error } = await supabase
        .from(TABLE)
        .select('lead_id, ultima_leitura_em');
      if (error) throw error;

      const lidos = {};
      for (const row of data || []) {
        lidos[row.lead_id] = row.ultima_leitura_em;
      }
      return res.status(200).json({ lidos });
    }

    if (req.method === 'POST') {
      const { lead_id, ultima_hora } = req.body || {};
      if (!lead_id) return res.status(400).json({ error: 'lead_id obrigatorio' });

      const agora = ultima_hora || new Date().toISOString();

      const { error } = await supabase
        .from(TABLE)
        .upsert(
          { lead_id, ultima_leitura_em: agora, atualizado_em: new Date().toISOString() },
          { onConflict: 'lead_id' }
        );
      if (error) throw error;

      return res.status(200).json({ ok: true, lead_id, ultima_leitura_em: agora });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[leads-leitura]', req.method, err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
