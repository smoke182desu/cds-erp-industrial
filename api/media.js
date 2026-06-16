import axios from 'axios';
import { sb } from './_lib/supabase.js';

const EVOLUTION_API_URL = String(process.env.EVOLUTION_URL || process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080').trim().replace(/\/$/,'');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function pickBase64(data) {
  const candidates = [
    data?.base64,
    data?.data?.base64,
    data?.response?.base64,
    data?.file?.base64,
    data?.media?.base64,
  ].filter(Boolean);

  for (const value of candidates) {
    const text = String(value);
    const parsed = parseDataUrl(text);
    if (parsed) return parsed;
    if (text.length > 100) {
      return {
        mime: data?.mimetype || data?.mimeType || data?.data?.mimetype || 'application/octet-stream',
        buffer: Buffer.from(text.replace(/^base64:/, ''), 'base64'),
      };
    }
  }
  return null;
}

function buildEvolutionPayloads(payloadBruto) {
  const data = payloadBruto?.data || payloadBruto || {};
  const key = data.key || payloadBruto?.key || {};
  const message = data.message || payloadBruto?.message || {};
  const id = key.id || data.id || payloadBruto?.id;
  const compactKey = {
    ...(id ? { id } : {}),
    ...(key.remoteJid ? { remoteJid: key.remoteJid } : {}),
    ...(typeof key.fromMe === 'boolean' ? { fromMe: key.fromMe } : {}),
  };

  const payloads = [];
  if (Object.keys(compactKey).length) {
    payloads.push({ key: compactKey, convertToMp4: false });
    payloads.push({ key: compactKey, message, convertToMp4: false });
    payloads.push({ message: { key: compactKey }, convertToMp4: false });
    payloads.push({ message: { key: compactKey, message }, convertToMp4: false });
  }
  if (key.id || Object.keys(message).length) {
    payloads.push({ key, message, convertToMp4: false });
    payloads.push({ message: { key, message }, convertToMp4: false });
  }
  if (data.key || data.message) {
    payloads.push({ message: data, convertToMp4: false });
  }
  return payloads;
}

async function baixarViaEvolution(payloadBruto) {
  if (!EVOLUTION_API_KEY) return null;

  const payloads = buildEvolutionPayloads(payloadBruto);
  for (const payload of payloads) {
    try {
      const resp = await axios.post(
        `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
        payload,
        { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      const media = pickBase64(resp.data);
      if (media?.buffer?.length) return media;
    } catch {
      // Tenta o proximo formato aceito pela Evolution.
    }
  }
  return null;
}

async function baixarUrlDireta(url) {
  if (!/^https?:\/\//i.test(String(url || ''))) return null;
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'CDS-ERP/1.0' },
  });
  return {
    mime: resp.headers['content-type'] || 'application/octet-stream',
    buffer: Buffer.from(resp.data),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo nao permitido' });

  try {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id obrigatorio' });

    const r = await sb(`/mensagens?id=eq.${encodeURIComponent(id)}&select=id,texto,media_url,media_type,payload_bruto&limit=1`);
    const row = Array.isArray(r.body) ? r.body[0] : null;
    if (!r.ok || !row) return res.status(404).json({ error: 'Midia nao encontrada' });

    let media = parseDataUrl(row.media_url);
    if (!media) media = await baixarViaEvolution(row.payload_bruto);
    if (!media && row.media_url) media = await baixarUrlDireta(row.media_url);

    if (!media?.buffer?.length) {
      return res.status(404).json({ error: 'Midia indisponivel' });
    }

    res.setHeader('Content-Type', media.mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.status(200).send(media.buffer);
  } catch (err) {
    console.error('[media] erro:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro ao carregar midia' });
  }
}
