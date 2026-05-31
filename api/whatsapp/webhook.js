// api/whatsapp/webhook.js — recebe eventos do Evolution + auto-cria lead

import { sb } from '../_lib/supabase.js';

function normalizeTelefone(jid) {
  if (!jid) return '';
  return jid.split('@')[0].replace(/[^0-9]/g, '');
}

function extrairTexto(m) {
  const msg = m?.message || {};
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    (msg.imageMessage ? '[imagem]' : '') ||
    (msg.audioMessage ? '[áudio]' : '') ||
    (msg.videoMessage ? '[vídeo]' : '') ||
    (msg.documentMessage ? '[documento]' : '') ||
    (msg.stickerMessage ? '[sticker]' : '') ||
    ''
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.status(200).json({ received: true });

  const ev = req.body || {};
  const event = String(ev.event || ev.type || '').toLowerCase().replace(/\./g, '_');
  const instanceName = ev.instance || ev.instanceName;
  if (!event || !instanceName) return;

  let inst;
  try {
    const r = await sb(`/whatsapp_instancias?evolution_instance_name=eq.${encodeURIComponent(instanceName)}&select=*`);
    inst = r?.body?.[0];
  } catch (e) { console.error('[wh-webhook] lookup', e.message); return; }
  if (!inst) { console.warn('[wh-webhook] instancia desconhecida:', instanceName); return; }

  try {
    if (event === 'qrcode_updated') {
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
    } else if (event === 'connection_update') {
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
          body: { status: 'desconectado', ultimo_desconectado_em: new Date().toISOString() },
        });
      }
    } else if (event === 'messages_upsert') {
      const msgs = ev?.data?.messages || (Array.isArray(ev?.data) ? ev.data : [ev?.data]);
      for (const m of (msgs || []).filter(Boolean)) {
        const key = m.key || {};
        const fromMe = !!key.fromMe;
        const remoteJid = key.remoteJid || '';

        // Pula grupos
        if (remoteJid.endsWith('@g.us')) continue;

        const telefone = normalizeTelefone(remoteJid);
        if (!telefone) continue;

        const texto = extrairTexto(m);
        if (!texto) continue;

        const pushName = m.pushName || '';
        const providerMessageId = key.id || m.id;
        const tipo = fromMe ? 'saida' : 'entrada';
        const criado_em = new Date((m.messageTimestamp || Date.now() / 1000) * 1000).toISOString();

        // 1) Grava mensagem
        try {
          await sb('/mensagens', {
            method: 'POST',
            body: {
              cliente_agencia_id: inst.cliente_agencia_id,
              telefone,
              texto,
              tipo,
              remetente: pushName,
              instancia: instanceName,
              criado_em,
              provider_message_id: providerMessageId,
              payload_bruto: m,
            },
          });
        } catch (e) { /* duplicate provider_message_id ignored */ }

        // 2) Cria/atualiza lead — só pra números reais (não LID anonimizado)
        const ehLidAnonimizado = remoteJid.endsWith('@lid');
        try {
          const existsRes = await sb(`/leads?telefone=eq.${telefone}&select=id`);
          const existe = existsRes?.body?.[0];

          if (existe) {
            // Atualiza última mensagem
            await sb(`/leads?id=eq.${existe.id}`, {
              method: 'PATCH',
              body: {
                ultima_mensagem: texto,
                atualizado_em: criado_em,
                ...(pushName && !fromMe ? { contato_nome: pushName } : {}),
              },
            });
          } else {
            // Cria novo lead
            const nome = ehLidAnonimizado
              ? `Contato (LID ${telefone.substr(0, 6)}…)`
              : (pushName || `+${telefone}`);
            await sb('/leads', {
              method: 'POST',
              body: {
                telefone,
                nome,
                contato_nome: !fromMe ? pushName : '',
                ultima_mensagem: texto,
                origem: 'whatsapp',
                etapa: 'lead_novo',
                cliente_agencia_id: inst.cliente_agencia_id,
                criado_em,
                atualizado_em: criado_em,
              },
            });
          }
        } catch (e) { /* schema variations */ }
      }
    }
  } catch (err) {
    console.error('[wh-webhook]', event, err.message);
  }
}
