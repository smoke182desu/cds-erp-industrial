// api/mensagem.js — mensagens via Evolution API + salva no PHP/MySQL
import axios from 'axios';
import { phpFetch } from './_lib/php-api.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';

// Mapeia campos do MySQL para o formato esperado pelo frontend
function mapMensagem(row) {
    return {
          id: String(row.id),
          telefone: (row.remote_jid || '').replace('@s.whatsapp.net', ''),
          texto: row.conteudo || '',
          tipo: row.tipo || 'entrada',
          origem: 'whatsapp',
          leadId: row.lead_id || '',
          criadoEm: row.criado_em || new Date().toISOString(),
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
        const { telefone } = req.query;
        if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });
        try {
                const r = await phpFetch('mensagens', { params: { telefone } });
                const data = await r.json();
                // Mapeia array de mensagens do MySQL para formato frontend
          const mapped = Array.isArray(data) ? data.map(mapMensagem) : [];
                return res.status(200).json(mapped);
        } catch (err) {
                return res.status(500).json({ error: err.message });
        }
  }

  if (req.method === 'POST') {
        const { telefone, mensagem, texto: textoBody, leadId } = req.body || {};
        const textoEnviar = textoBody || mensagem;
        if (!telefone || !textoEnviar) {
                return res.status(400).json({ error: 'telefone e mensagem obrigatorios' });
        }
        const numero = String(telefone).replace(/\D/g, '');

      try {
              // Envia via Evolution API
          const evoRes = await axios.post(
                    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
            { number: numero, text: textoEnviar },
            { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
                  );

          // Salva no MySQL via PHP
          const r = await phpFetch('mensagens', {
                    method: 'POST',
                    body: {
                                telefone,
                                texto: textoEnviar,
                                lead_id: leadId || null,
                                tipo: 'saida',
                                origem: 'whatsapp',
                                message_id: evoRes.data?.key?.id || null,
                    },
          });
              const saved = await r.json();
              return res.status(200).json({ ok: true, id: saved?.id || null });
      } catch (err) {
              console.error('[mensagem] erro:', err.response?.data || err.message);
              return res.status(500).json({ ok: false, error: err.message });
      }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
