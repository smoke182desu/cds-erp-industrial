// api/whatsapp/disconnect.js
// Desconecta uma instancia do WhatsApp sem apagar ela, permitindo reconectar depois.
import { sb } from '../_lib/supabase.js';
import { evolutionFetch } from '../_lib/evolution.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id obrigatorio' });

    const inst = await sb(`/whatsapp_instancias?id=eq.${id}&select=*`);
    if (!inst.ok || !inst.body?.[0]) return res.status(404).json({ error: 'instancia nao encontrada' });
    const i = inst.body[0];

    // Logout na Evolution API
    try {
      await evolutionFetch(`/instance/logout/${i.evolution_instance_name}`, { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 404) console.error('[disconnect] logout error:', e.message);
    }

    // Atualiza status no banco
    await sb(`/whatsapp_instancias?id=eq.${id}`, {
      method: 'PATCH',
      body: {
        status: 'desconectado',
        qr_code_base64: null,
        qr_code_expires_at: null,
        ultimo_desconectado_em: new Date().toISOString(),
      },
    });

    return res.status(200).json({ ok: true, status: 'desconectado' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
