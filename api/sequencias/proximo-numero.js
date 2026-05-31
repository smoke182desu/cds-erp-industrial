// api/sequencias/proximo-numero.js
// POST { cliente_agencia_id, tipo } → { numero: 'CDS-0001' }
// Atômico (usa função plpgsql gerar_proximo_numero)
import { sb } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { cliente_agencia_id, tipo } = req.body || {};
    if (!cliente_agencia_id) return res.status(400).json({ error: 'cliente_agencia_id obrigatório' });
    if (!tipo) return res.status(400).json({ error: 'tipo obrigatório (proposta, pedido, os, nfe, etc)' });

    // PostgREST RPC via /rpc/gerar_proximo_numero
    const r = await sb('/rpc/gerar_proximo_numero', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: { p_cliente_agencia: cliente_agencia_id, p_tipo: tipo },
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: 'Erro ao gerar número', body: r.body });
    }
    // PostgREST RPC retorna a string direto
    const numero = typeof r.body === 'string' ? r.body : r.body?.gerar_proximo_numero || r.body;
    return res.status(200).json({ numero });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
