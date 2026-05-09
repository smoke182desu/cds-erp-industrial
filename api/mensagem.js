// api/mensagem.js — mensagens via Evolution API + salva no Supabase (Postgres)
import axios from 'axios';
import { sb, selectAll, insert } from './_lib/supabase.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';
const TABLE = 'mensagens';

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
    };
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
          
          // Busca mensagens pelo telefone, ordenadas por data de criação
          const r = await sb(`/${TABLE}?telefone=eq.${encodeURIComponent(telefone)}&order=criado_em.asc&limit=500`);
          if (!r.ok) {
            console.error('[mensagem] GET erro:', r.status, JSON.stringify(r.body).slice(0, 200));
            return res.status(500).json({ error: 'Erro ao buscar mensagens' });
          }
          const rows = Array.isArray(r.body) ? r.body : [];
          const mapped = rows.map(mapMensagem);
          return res.status(200).json(mapped);
    }

    if (req.method === 'POST') {
          const { telefone, mensagem, texto: textoBody, leadId } = req.body || {};
          const textoEnviar = textoBody || mensagem;
          if (!telefone || !textoEnviar) {
                  return res.status(400).json({ error: 'telefone e mensagem obrigatorios' });
          }
          const numero = String(telefone).replace(/\D/g, '');

          // 1. Envia via Evolution API
          const evoRes = await axios.post(
                    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
            { number: numero, text: textoEnviar },
            { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
          );

          // 2. Salva no Supabase (colunas: telefone, texto, tipo, remetente, criado_em)
          const saved = await insert(TABLE, {
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
