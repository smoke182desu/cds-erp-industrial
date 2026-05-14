// api/whatsapp.js — webhook handler, normaliza payload Evolution API e salva no Supabase
import { insert, selectAll, update, upsertByField } from './_lib/supabase.js';

function soDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function variantesTelefone(valor) {
  const d = soDigitos(valor);
  const variantes = new Set();
  if (!d) return [];
  variantes.add(d);

  if (d.startsWith('55')) {
    const ddi = d.slice(0, 2);
    const ddd = d.slice(2, 4);
    const local = d.slice(4);
    if (ddd.length === 2 && local.length === 9) {
      variantes.add(`${ddi}${ddd}${local.slice(1)}`);
      if (local[0] !== '9') variantes.add(`${ddi}${ddd}9${local.slice(1)}`);
    }
    if (ddd.length === 2 && local.length === 8) {
      variantes.add(`${ddi}${ddd}9${local}`);
    }
  }

  return [...variantes];
}

async function upsertLeadPorTelefone(payload) {
  for (const tel of variantesTelefone(payload.telefone)) {
    const existentes = await selectAll('leads', { filters: { telefone: `eq.${tel}` }, limit: 1 });
    if (existentes[0]?.id) {
      return await update('leads', 'id', existentes[0].id, {
        ...payload,
        telefone: existentes[0].telefone || payload.telefone
      });
    }
  }
  return await upsertByField('leads', payload, 'telefone');
}

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';

function evolutionBaseUrl() {
  return String(EVOLUTION_API_URL || '').trim().replace(/\/$/, '');
}

function fotoUrlValida(valor) {
  const url = String(valor || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

function extrairFotoPerfil(data) {
  return fotoUrlValida(
    data?.profilePictureUrl
    || data?.profile_picture_url
    || data?.profilePicUrl
    || data?.picture
    || data?.url
    || data?.data?.profilePictureUrl
    || data?.data?.profile_picture_url
    || data?.data?.profilePicUrl
    || data?.data?.picture
    || data?.data?.url
  );
}

async function buscarFotoPerfilWhatsApp(telefone, instance) {
  const numbers = variantesTelefone(telefone);
  if (!numbers.length || !EVOLUTION_API_KEY || !evolutionBaseUrl()) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  const instanceToUse = String(instance || EVOLUTION_INSTANCE || 'cdsind').trim();
  const headers = { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

  try {
    for (const number of numbers) {
      for (const payload of [{ number }, { number: `${number}@s.whatsapp.net` }]) {
        const r = await fetch(`${evolutionBaseUrl()}/chat/fetchProfilePictureUrl/${instanceToUse}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!r.ok) continue;
        const data = await r.json().catch(() => null);
        const foto = extrairFotoPerfil(data);
        if (foto) return foto;
      }
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('[whatsapp] foto perfil falhou:', err.message);
  } finally {
    clearTimeout(timeout);
  }
  return '';
}

// Identifica se um JID é um LID (Linked ID anônimo) ou outro tipo não-pessoal
function jidEhInvalido(jid) {
  if (!jid || typeof jid !== 'string') return true;
  return jid.includes('@lid')
    || jid.includes('@g.us')
    || jid.includes('@broadcast')
    || jid.includes('@newsletter')
    || jid.startsWith('0@');
}

// Tenta extrair o número de telefone real (E.164 sem '+'), ignorando LIDs.
// Ordem de preferência segue convenções da Baileys/Evolution API moderna.
function extrairNumeroReal(key, data, body) {
  const candidatos = [
    data.senderPn,           // sender phone number (Baileys novo)
    key.senderPn,
    key.participantPn,       // participant phone number (em grupos/comunidades)
    data.participantPn,
    key.remoteJidAlt,        // JID alternativo
    data.remoteJidAlt,
    body.senderPn,
    // só usa participant/remoteJid se NÃO for LID/grupo
    !jidEhInvalido(key.participant) ? key.participant : null,
    !jidEhInvalido(key.remoteJid) ? key.remoteJid : null,
    !jidEhInvalido(data.remoteJid) ? data.remoteJid : null,
  ];
  for (const c of candidatos) {
    if (!c || typeof c !== 'string') continue;
    if (jidEhInvalido(c)) continue;
    const numero = c.split('@')[0].replace(/\D/g, '');
    if (/^\d{8,15}$/.test(numero)) return numero;
  }
  return null;
}

async function normalizarPayload(body) {
  if (!body || typeof body !== 'object') return body;
  try {
    const data = body.data || body;
    const key = data.key || {};
    const message = data.message || {};

    const numero = extrairNumeroReal(key, data, body);
    const remoteJid = key.remoteJid || data.remoteJid || '';
    const pushName = data.pushName || data.notifyName || body.pushName || '';
    const fotoUrl = data.profilePictureUrl
      || data.profilePicUrl
      || data.profile_picture_url
      || data.senderProfilePicture
      || data.senderPicture
      || data.contact?.profilePictureUrl
      || body.profilePictureUrl
      || '';

    // Texto da mensagem (suporta varios formatos da Evolution API)
    const reaction = message.reactionMessage || message.reaction;
    const texto = message.conversation
      || message.extendedTextMessage?.text
      || message.imageMessage?.caption
      || message.videoMessage?.caption
      || message.documentMessage?.caption
      || data.content
      || data.text
      || (reaction?.text ? `Voce reagiu com ${reaction.text}` : '')
      || '';

    // Midia: extrai URL e tipo se presente
    let mediaUrl = null;
    let mediaType = null;
    
    // Tenta pegar o base64 direto do payload
    const base64Payload = data.message?.base64 || message?.base64 || data.base64 || body.base64;

    if (message.imageMessage) {
      mediaType = 'image';
      const mime = message.imageMessage.mimetype || 'image/jpeg';
      mediaUrl = base64Payload ? `data:${mime};base64,${base64Payload}` : (message.imageMessage.url || data.mediaUrl || null);
    } else if (message.videoMessage) {
      mediaType = 'video';
      const mime = message.videoMessage.mimetype || 'video/mp4';
      mediaUrl = base64Payload ? `data:${mime};base64,${base64Payload}` : (message.videoMessage.url || data.mediaUrl || null);
    } else if (message.documentMessage) {
      mediaType = 'document';
      const mime = message.documentMessage.mimetype || 'application/pdf';
      mediaUrl = base64Payload ? `data:${mime};base64,${base64Payload}` : (message.documentMessage.url || data.mediaUrl || null);
    } else if (message.audioMessage) {
      mediaType = 'audio';
      const mime = message.audioMessage.mimetype || 'audio/ogg';
      mediaUrl = base64Payload ? `data:${mime};base64,${base64Payload}` : (message.audioMessage.url || data.mediaUrl || null);
    } else if (message.stickerMessage) {
      mediaType = 'image';
      const mime = message.stickerMessage.mimetype || 'image/webp';
      mediaUrl = base64Payload ? `data:${mime};base64,${base64Payload}` : (message.stickerMessage.url || data.mediaUrl || null);
    }
    // Fallback: Evolution API v2 pode enviar mediaUrl no data diretamente
    if (!mediaUrl && data.mediaUrl) {
      mediaUrl = data.mediaUrl;
      if (!mediaType) mediaType = data.mediaType || 'image';
    }
    if (!mediaType && data.mediaType) mediaType = data.mediaType;
    if (!mediaType && data.messageType && String(data.messageType).toLowerCase().includes('image')) mediaType = 'image';

    // Se não veio o base64 no webhook, mas é uma mídia e não temos um URL válido publicamente, vamos tentar buscar da Evolution API
    if (mediaType && !base64Payload && data.message && EVOLUTION_API_URL && (!mediaUrl || mediaUrl.includes('mmg.whatsapp.net'))) {
      try {
        const instanceToUse = body.instance || data.instance || process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';
        const res = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceToUse}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify({ message: data.message })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.base64) {
             const finalMime = json.mimetype || 'application/octet-stream';
             mediaUrl = `data:${finalMime};base64,${json.base64}`;
          }
        }
      } catch (err) {
        console.error('[whatsapp] erro ao buscar base64 da midia:', err.message);
      }
    }

    // Normaliza para ms: Evolution pode enviar segundos ou milliseconds
    const ts = data.messageTimestamp || Math.floor(Date.now() / 1000);
    const tsMs = ts > 1e12 ? ts : ts * 1000;

    return {
      pushName: pushName || null,
      remoteJid,
      numero,
      texto: texto || (mediaType ? `[${mediaType}]` : ''),
      fromMe: !!key.fromMe,
      instance: body.instance || data.instance || null,
      event: body.event || null,
      timestamp: tsMs,
      ehLid: jidEhInvalido(remoteJid),
      mediaUrl,
      mediaType,
      fotoUrl,
    };
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'] || req.query.challenge || 'ok';
    return res.status(200).send(String(challenge));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const norm = await normalizarPayload(body);

    if (!norm) {
      return res.status(200).json({ ok: true, skipped: 'payload invalido' });
    }
    if (!norm.texto && !norm.mediaUrl && !norm.mediaType) {
      return res.status(200).json({ ok: true, skipped: 'sem conteudo visivel' });
    }

    // Sem número real (só LID): salvamos só a mensagem com o LID,
    // mas NÃO criamos lead novo — evita gerar leads "Aguardando identificação" zumbis.
    if (!norm.numero) {
      const lidPuro = (norm.remoteJid || '').split('@')[0].replace(/\D/g, '');
      if (lidPuro) {
        const mensagemCriadaEm = new Date(norm.timestamp).toISOString();
        const msgData = {
          telefone: lidPuro,
          texto: norm.texto,
          tipo: norm.fromMe ? 'saida' : 'entrada',
          remetente: norm.pushName,
          instancia: norm.instance,
          payload_bruto: body,
          criado_em: mensagemCriadaEm,
          timestamp_msg: mensagemCriadaEm
        };
        if (norm.mediaUrl) { msgData.media_url = norm.mediaUrl; msgData.media_type = norm.mediaType; }
        await insert('mensagens', msgData).catch(async (err) => {
          if (err.message?.includes('PGRST204')) {
            delete msgData.media_url; delete msgData.media_type; delete msgData.timestamp_msg;
            return insert('mensagens', msgData).catch(() => {});
          }
        });
      }
      return res.status(200).json({ ok: true, skipped: 'sem numero real (LID)' });
    }

    // 1. Salva a mensagem
    const mensagemCriadaEm = new Date(norm.timestamp).toISOString();
    const msgData = {
      telefone: norm.numero,
      texto: norm.texto,
      tipo: norm.fromMe ? 'saida' : 'entrada',
      remetente: norm.pushName,
      instancia: norm.instance,
      payload_bruto: body,
      criado_em: mensagemCriadaEm,
      timestamp_msg: mensagemCriadaEm
    };
    if (norm.mediaUrl) { msgData.media_url = norm.mediaUrl; msgData.media_type = norm.mediaType; }
    await insert('mensagens', msgData).catch(async (err) => {
      if (err.message?.includes('PGRST204')) {
        delete msgData.media_url; delete msgData.media_type; delete msgData.timestamp_msg;
        return insert('mensagens', msgData);
      }
      throw err;
    });

    // 2. Se for mensagem de entrada, garante que o lead existe (Upsert)
    if (!norm.fromMe) {
      const fotoPerfil = fotoUrlValida(norm.fotoUrl) || await buscarFotoPerfilWhatsApp(norm.numero, norm.instance);
      const leadPayload = {
        telefone: norm.numero,
        nome: norm.pushName || norm.numero,
        etapa: 'lead_novo',
        ultima_mensagem: norm.texto,
        atualizado_em: mensagemCriadaEm
      };
      if (fotoPerfil) leadPayload.foto_url = fotoPerfil;
      await upsertLeadPorTelefone(leadPayload, 'telefone');
    }

    return res.status(200).json({ ok: true, numero: norm.numero });
  } catch (err) {
    console.error('[whatsapp] erro:', err.message);
    // 200 mesmo no erro pra Evolution não reentregar infinito
    return res.status(200).json({ error: err.message });
  }
}
