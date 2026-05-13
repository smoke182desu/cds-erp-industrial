// api/mensagem.js — mensagens via Evolution API + salva no Supabase (Postgres)
// Suporta texto e midia (imagem/video/documento via base64)
import axios from 'axios';
import { sb, insert, upsertByField } from './_lib/supabase.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';
const TABLE = 'mensagens';

// Aumenta limite de body para suportar base64 de imagens (~4MB)
export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

// Mapeia campos do Supabase para o formato esperado pelo frontend
function inferMediaType(row) {
  // 1. Coluna explícita
  if (row.media_type) return row.media_type;

  // 2. Texto contém marcador de mídia
  const texto = String(row.texto || row.conteudo || '').toLowerCase().trim();
  if (/^\[?(image|video|audio|document|sticker|media)\]?$/i.test(texto)) {
    const match = texto.replace(/[\[\]]/g, '');
    if (match === 'media' || match === 'sticker') return 'image';
    return match;
  }
  if (texto.includes('[image]') || texto.includes('imagem')) return 'image';
  if (texto.includes('[video]')) return 'video';
  if (texto.includes('[audio]')) return 'audio';
  if (texto.includes('[document]')) return 'document';

  // 3. payload_bruto contém mensagem de mídia do WhatsApp/Evolution
  const payload = row.payload_bruto;
  if (payload && typeof payload === 'object') {
    const data = payload.data || payload;
    const message = data?.message || payload?.message || {};
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'image';
    // Evolution API v2 pode ter mediaType direto
    if (data.mediaType) return data.mediaType;
  }

  // 4. media_url presente é sinal de mídia
  if (row.media_url) return 'image';

  return undefined;
}

function mapMensagem(row) {
  const mediaType = inferMediaType(row);
  return {
    id: String(row.id),
    telefone: (row.telefone || row.remote_jid || '').replace('@s.whatsapp.net', ''),
    texto: row.texto || row.conteudo || '',
    tipo: row.tipo || 'entrada',
    origem: row.origem || 'whatsapp',
    leadId: row.lead_id || row.leadId || '',
    criadoEm: row.timestamp_msg || row.criado_em || row.created_at || new Date().toISOString(),
    mediaUrl: mediaType ? `/api/media?id=${encodeURIComponent(row.id)}` : undefined,
    mediaType,
  };
}

function tempoMensagem(row) {
  const raw = row?.timestamp_msg || row?.criado_em || row?.created_at || row?.criadoEm || '';
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function ordenarMensagens(rows) {
  return [...rows].sort((a, b) => tempoMensagem(a) - tempoMensagem(b));
}

// Detecta mediatype a partir do mimetype
function detectMediaType(mimetype) {
  if (!mimetype) return 'document';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

function normalizarMediaBase64(media, mimetype) {
  const text = String(media || '').trim();
  const match = text.match(/^data:([^;]+);base64,(.+)$/);
  const mime = match?.[1] || mimetype || 'application/octet-stream';
  const rawBase64 = (match?.[2] || text).replace(/^base64:/, '').replace(/\s/g, '');
  return {
    mimetype: mime,
    rawBase64,
    dataUrl: `data:${mime};base64,${rawBase64}`,
  };
}

function extensaoPorMime(mimetype, mediaType) {
  const mime = String(mimetype || '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg')) return mediaType === 'audio' ? 'mp3' : 'mpeg';
  if (mime.includes('ogg')) return 'ogg';
  return mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'pdf';
}

function sanitizarFileName(fileName, mimetype, mediaType) {
  const ext = extensaoPorMime(mimetype, mediaType);
  const baseOriginal = String(fileName || `arquivo.${ext}`).split(/[\\/]/).pop() || `arquivo.${ext}`;
  const ascii = baseOriginal.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let clean = ascii.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!clean) clean = `arquivo.${ext}`;
  if (!clean.toLowerCase().endsWith(`.${ext}`)) clean += `.${ext}`;
  return clean.slice(0, 120);
}

function evolutionErroDetalhado(err) {
  const data = err.response?.data;
  const msg = data?.response?.message || data?.message || data?.error || data;
  if (Array.isArray(msg)) return msg.join(' | ');
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object') return JSON.stringify(msg).slice(0, 300);
  return err.message || 'Erro desconhecido';
}

async function postarMediaMultipart({ numero, mediaType, mimetype, caption, mediaInfo, fileName }) {
  if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('FormData indisponivel no runtime');
  }

  const form = new FormData();
  form.append('number', numero);
  form.append('mediatype', mediaType);
  form.append('mimetype', mimetype);
  form.append('caption', caption || '');
  form.append('fileName', fileName);
  form.append('media', new Blob([Buffer.from(mediaInfo.rawBase64, 'base64')], { type: mimetype }), fileName);

  const resp = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_API_KEY },
    body: form,
  });
  const text = await resp.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!resp.ok) {
    const msg = typeof data === 'string' ? data : data?.response?.message || data?.message || data?.error || JSON.stringify(data);
    const e = new Error(`multipart ${resp.status}: ${String(msg || 'erro sem detalhe').slice(0, 300)}`);
    e.response = { status: resp.status, data };
    throw e;
  }

  return { data, status: resp.status };
}

async function enviarMediaEvolution({ numero, mediaType, mimetype, caption, mediaInfo, fileName }) {
  const url = `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
  const headers = { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' };
  const timeout = 60000;
  const commonV2 = {
    number: numero,
    mediatype: mediaType,
    mimetype,
    caption: caption || '',
    fileName,
  };
  const commonV1 = {
    number: numero,
    mediaMessage: {
      mediaType,
      fileName,
      caption: caption || '',
    },
    options: { delay: 1200, presence: 'composing' },
  };

  const tentativas = [
    { nome: 'multipart-file', run: () => postarMediaMultipart({ numero, mediaType, mimetype, caption, mediaInfo, fileName }) },
    { nome: 'v2-base64', run: () => axios.post(url, { ...commonV2, media: mediaInfo.rawBase64 }, { headers, timeout }) },
    { nome: 'v2-dataurl', run: () => axios.post(url, { ...commonV2, media: mediaInfo.dataUrl }, { headers, timeout }) },
    { nome: 'v1-base64', run: () => axios.post(url, { ...commonV1, mediaMessage: { ...commonV1.mediaMessage, media: mediaInfo.rawBase64 } }, { headers, timeout }) },
    { nome: 'v1-dataurl', run: () => axios.post(url, { ...commonV1, mediaMessage: { ...commonV1.mediaMessage, media: mediaInfo.dataUrl } }, { headers, timeout }) },
  ];

  let lastErr;
  for (const tentativa of tentativas) {
    try {
      return await tentativa.run();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      console.warn(`[mensagem] sendMedia ${tentativa.nome} falhou:`, status, evolutionErroDetalhado(err));
      if (status === 401 || status === 403) break;
    }
  }

  const detail = evolutionErroDetalhado(lastErr || new Error('Falha desconhecida'));
  const e = new Error(`Evolution recusou a midia: ${detail}`);
  e.status = lastErr?.response?.status || 500;
  throw e;
}

// Salva mensagem no Supabase com fallback se colunas de midia nao existirem
async function salvarMensagem(data) {
  try {
    return await insert(TABLE, data);
  } catch (err) {
    if (err.message?.includes('PGRST204')) {
      delete data.media_url;
      delete data.media_type;
      return await insert(TABLE, data);
    }
    throw err;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { telefone } = req.query;
      if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });

      const telOriginal = String(telefone);
      const telDigitos = telOriginal.replace(/\D/g, '');
      let r = await sb(`/${TABLE}?telefone=eq.${encodeURIComponent(telDigitos)}&order=criado_em.asc&limit=500`);
      if (r.ok && Array.isArray(r.body) && r.body.length === 0 && telOriginal !== telDigitos) {
        r = await sb(`/${TABLE}?telefone=eq.${encodeURIComponent(telOriginal)}&order=criado_em.asc&limit=500`);
      }
      if (!r.ok) {
        console.error('[mensagem] GET erro:', r.status, JSON.stringify(r.body).slice(0, 200));
        return res.status(500).json({ error: 'Erro ao buscar mensagens' });
      }
      const rows = Array.isArray(r.body) ? r.body : [];
      return res.status(200).json(ordenarMensagens(rows).map(mapMensagem));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { telefone, media, fileName, mimetype, caption } = body;

      if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });
      const numero = String(telefone).replace(/\D/g, '');

      // --- Envio de MIDIA (base64 no campo media) ---
      if (media) {
        const mediaInfo = normalizarMediaBase64(media, mimetype);
        const mediaType = detectMediaType(mediaInfo.mimetype);
        const safeFileName = sanitizarFileName(fileName, mediaInfo.mimetype, mediaType);

        if (!mediaInfo.rawBase64 || mediaInfo.rawBase64.length < 20) {
          return res.status(400).json({ ok: false, error: 'midia invalida ou vazia' });
        }

        const evoResp = await enviarMediaEvolution({
          numero,
          mediaType,
          mimetype: mediaInfo.mimetype,
          caption,
          mediaInfo,
          fileName: safeFileName,
        });

        // Salva no Supabase
        const saved = await salvarMensagem({
          telefone,
          texto: caption || `[${mediaType}] ${safeFileName}`,
          tipo: 'saida',
          remetente: 'CDS Industrial',
          criado_em: new Date().toISOString(),
          payload_bruto: evoResp.data || null,
          media_url: mediaInfo.dataUrl,
          media_type: mediaType,
        });

        // Atualiza ultima_mensagem do lead
        await upsertByField('leads', {
          telefone,
          ultima_mensagem: caption || `[${mediaType}]`,
          atualizado_em: new Date().toISOString(),
        }, 'telefone').catch(() => {});

        return res.status(200).json({ ok: true, id: saved?.id || null, mediaType });
      }

      // --- Envio de TEXTO ---
      const textoEnviar = body.texto || body.mensagem;
      if (!textoEnviar) return res.status(400).json({ error: 'mensagem obrigatoria' });

      await axios.post(
        `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
        { number: numero, text: textoEnviar },
        { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
      );

      const saved = await salvarMensagem({
        telefone,
        texto: textoEnviar,
        tipo: 'saida',
        remetente: 'CDS Industrial',
        criado_em: new Date().toISOString(),
      });

      // Atualiza ultima_mensagem do lead
      await upsertByField('leads', {
        telefone,
        ultima_mensagem: textoEnviar,
        atualizado_em: new Date().toISOString(),
      }, 'telefone').catch(() => {});

      return res.status(200).json({ ok: true, id: saved?.id || null });
    }

    return res.status(405).json({ error: 'Metodo nao permitido' });
  } catch (err) {
    console.error('[mensagem] erro:', err.response?.data || err.message);
    const status = err.status || err.response?.status || 500;
    return res.status(status >= 400 && status < 500 ? status : 500).json({ ok: false, error: err.message });
  }
}
