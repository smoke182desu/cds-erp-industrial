// api/mensagem.js — mensagens via Evolution API + salva no Supabase (Postgres)
// Suporta texto e midia (imagem/video/documento via base64)
import axios from 'axios';
import { sb, insert } from './_lib/supabase.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';
const TABLE = 'mensagens';

// Aumenta limite de body para suportar base64 de imagens (~4MB)
export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

// Mapeia campos do Supabase para o formato esperado pelo frontend
function mapMensagem(row) {
  return {
    id: String(row.id),
    telefone: (row.telefone || row.remote_jid || '').replace('@s.whatsapp.net', ''),
    texto: row.texto || row.conteudo || '',
    tipo: row.tipo || 'entrada',
    origem: row.origem || 'whatsapp',
    leadId: row.lead_id || row.leadId || '',
    criadoEm: row.criado_em || row.created_at || new Date().toISOString(),
    mediaUrl: row.media_url || undefined,
    mediaType: row.media_type || undefined,
  };
}

// Detecta mediatype a partir do mimetype
function detectMediaType(mimetype) {
  if (!mimetype) return 'document';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
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

      const r = await sb(`/${TABLE}?telefone=eq.${encodeURIComponent(telefone)}&order=criado_em.asc&limit=500`);
      if (!r.ok) {
        console.error('[mensagem] GET erro:', r.status, JSON.stringify(r.body).slice(0, 200));
        return res.status(500).json({ error: 'Erro ao buscar mensagens' });
      }
      const rows = Array.isArray(r.body) ? r.body : [];
      return res.status(200).json(rows.map(mapMensagem));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { telefone, media, fileName, mimetype, caption } = body;

      if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });
      const numero = String(telefone).replace(/\D/g, '');

      // --- Envio de MIDIA (base64 no campo media) ---
      if (media) {
        const mediaType = detectMediaType(mimetype);

        // Envia via Evolution API sendMedia
        await axios.post(
          `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`,
          {
            number: numero,
            mediatype: mediaType,
            mimetype: mimetype || 'application/octet-stream',
            caption: caption || '',
            media: media, // data:mime;base64,... ou URL publica
            fileName: fileName || 'arquivo',
          },
          { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' }, timeout: 60000 }
        );

        // Salva no Supabase
        const saved = await salvarMensagem({
          telefone,
          texto: caption || `[${mediaType}] ${fileName || 'arquivo'}`,
          tipo: 'saida',
          remetente: 'CDS Industrial',
          criado_em: new Date().toISOString(),
          media_type: mediaType,
        });

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

      return res.status(200).json({ ok: true, id: saved?.id || null });
    }

    return res.status(405).json({ error: 'Metodo nao permitido' });
  } catch (err) {
    console.error('[mensagem] erro:', err.response?.data || err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
