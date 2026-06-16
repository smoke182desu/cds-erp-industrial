// api/whatsapp/instancias.js
import { sb } from '../_lib/supabase.js';
import { evolutionFetch, slugify } from '../_lib/evolution.js';

async function sbBody(path, opts) {
  const r = await sb(path, opts);
  if (!r.ok) {
    const err = new Error(`PostgREST ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body)}`);
    err.status = r.status;
    throw err;
  }
  return r.body;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const clienteId = req.query?.cliente_id;
      const path = clienteId
        ? `/whatsapp_instancias?cliente_agencia_id=eq.${clienteId}&order=criado_em.desc`
        : `/whatsapp_instancias?order=criado_em.desc`;
      const data = await sbBody(path);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { cliente_agencia_id, nome_instancia } = req.body || {};
      if (!cliente_agencia_id) return res.status(400).json({ error: 'cliente_agencia_id obrigatorio' });

      const clienteArr = await sbBody(`/trafego_clientes?id=eq.${cliente_agencia_id}&select=nome,slug`);
      if (!clienteArr?.[0]) return res.status(404).json({ error: 'cliente_agencia nao encontrado' });
      const cliente = clienteArr[0];

      const base = slugify(nome_instancia || cliente.slug || cliente.nome);
      const suffix = Math.random().toString(36).slice(2, 6);
      const instanceName = `${base}-${suffix}`;

      const webhookGlobal = process.env.WEBHOOK_GLOBAL_URL_PUBLIC || 'https://erp.cdsind.com.br/api/whatsapp/webhook';
      const evoResp = await evolutionFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: {
            url: webhookGlobal,
            byEvents: false,
            events: ['QRCODE_UPDATED','CONNECTION_UPDATE','MESSAGES_UPSERT','MESSAGES_UPDATE','SEND_MESSAGE'],
          },
        }),
      });

      // Ativa syncFullHistory pra buscar msgs antigas ao conectar
      try {
        await evolutionFetch(`/settings/set/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({
            rejectCall: false,
            msgCall: '',
            groupsIgnore: false,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false,
            syncFullHistory: true,
          }),
        });
      } catch (e) {
        console.error('[instancias] erro ao setar syncFullHistory:', e.message);
      }

      const saved = await sbBody('/whatsapp_instancias', {
        method: 'POST',
        body: {
          cliente_agencia_id,
          evolution_instance_name: instanceName,
          status: 'aguardando_qr',
          qr_code_base64: evoResp?.qrcode?.base64 || null,
          metadata: { evolution_response: evoResp },
        },
      });

      return res.status(201).json(saved?.[0] || saved);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });

      const inst = await sbBody(`/whatsapp_instancias?id=eq.${id}&select=evolution_instance_name`);
      if (!inst?.[0]) return res.status(404).json({ error: 'instancia nao encontrada' });

      try { await evolutionFetch(`/instance/logout/${inst[0].evolution_instance_name}`, { method: 'DELETE' }); } catch (e) {}
      try { await evolutionFetch(`/instance/delete/${inst[0].evolution_instance_name}`, { method: 'DELETE' }); } catch (e) {}

      await sb(`/whatsapp_instancias?id=eq.${id}`, { method: 'DELETE' });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[whatsapp/instancias]', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
