// api/whatsapp/qr.js
import { sb } from '../_lib/supabase.js';
import { evolutionFetch } from '../_lib/evolution.js';

async function sbBody(path, opts) {
  const r = await sb(path, opts);
  if (!r.ok) { const e = new Error(`PostgREST ${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id obrigatorio' });

    const inst = await sbBody(`/whatsapp_instancias?id=eq.${id}&select=*`);
    if (!inst?.[0]) return res.status(404).json({ error: 'instancia nao encontrada' });
    const i = inst[0];

    let qr = null;
    try {
      const r = await evolutionFetch(`/instance/connect/${i.evolution_instance_name}`);
      qr = r?.base64 || r?.qrcode?.base64 || null;
      if (qr) {
        await sb(`/whatsapp_instancias?id=eq.${id}`, {
          method: 'PATCH',
          body: {
            qr_code_base64: qr,
            qr_code_expires_at: new Date(Date.now() + 60_000).toISOString(),
            status: 'conectando',
          },
        });
      }
    } catch (e) {
      console.error('[whatsapp/qr]', e.message);
    }

    return res.status(200).json({
      id,
      status: i.status,
      qr_code_base64: qr || i.qr_code_base64,
      telefone: i.telefone,
      evolution_instance_name: i.evolution_instance_name,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
