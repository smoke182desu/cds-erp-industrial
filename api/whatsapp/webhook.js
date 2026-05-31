// api/whatsapp/webhook.js
import { sb } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.status(200).json({ received: true });

  const ev = req.body || {};
  const event = ev.event || ev.type;
  const instanceName = ev.instance || ev.instanceName;
  if (!event || !instanceName) return;

  let inst;
  try {
    const r = await sb(`/whatsapp_instancias?evolution_instance_name=eq.${encodeURIComponent(instanceName)}&select=*`);
    inst = r?.body?.[0];
  } catch (e) { console.error('[wh-webhook] lookup', e.message); }
  if (!inst) { console.warn('[wh-webhook] instancia desconhecida:', instanceName); return; }

  try {
    const evt = String(event).toLowerCase().replace(/\./g, '_');

    if (evt === 'qrcode_updated') {
      const qr = ev?.data?.qrcode?.base64 || ev?.qrcode?.base64;
      if (qr) {
        await sb(`/whatsapp_instancias?id=eq.${inst.id}`, {
          method: 'PATCH',
          body: {
            qr_code_base64: qr,
            qr_code_expires_at: new Date(Date.now() + 60_000).toISOString(),
            status: 'conectando',
          },
        });
      }
    } else if (evt === 'connection_update') {
      const state = ev?.data?.state || ev?.state;
      if (state === 'open') {
        await sb(`/whatsapp_instancias?id=eq.${inst.id}`, {
          method: 'PATCH',
          body: {
            status: 'conectado',
            ultimo_conectado_em: new Date().toISOString(),
            telefone: ev?.data?.wuid?.split('@')[0] || ev?.data?.profilePhoneNumber || inst.telefone,
            qr_code_base64: null,
          },
        });
      } else if (state === 'close' || state === 'closing') {
        await sb(`/whatsapp_instancias?id=eq.${inst.id}`, {
          method: 'PATCH',
          body: {
            status: 'desconectado',
            ultimo_desconectado_em: new Date().toISOString(),
          },
        });
      }
    } else if (evt === 'messages_upsert') {
      const msgs = ev?.data?.messages || (Array.isArray(ev?.data) ? ev.data : [ev?.data]);
      for (const m of (msgs || []).filter(Boolean)) {
        if (m.key?.fromMe) continue;
        const remoteJid = m.key?.remoteJid || '';
        const telefone = remoteJid.split('@')[0];
        const conteudo = m.message?.conversation || m.message?.extendedTextMessage?.text || '[midia]';
        try {
          await sb('/mensagens', {
            method: 'POST',
            body: {
              cliente_agencia_id: inst.cliente_agencia_id,
              telefone,
              conteudo,
              direcao: 'entrada',
              status: 'recebida',
              provider_message_id: m.key?.id,
              metadata: { evolution_message: m },
            },
          });
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('[wh-webhook] handler', event, err.message);
  }
}
