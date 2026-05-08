// api/fotos.js — busca fotos de perfil dos contatos via Evolution API e salva em leads.foto_url
import { sb, selectAll } from './_lib/supabase.js';

const EVO_URL = String(process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app').trim().replace(/\s+$/,'').replace(/\/$/,'');
const EVO_KEY = String(process.env.EVOLUTION_API_KEY || '').trim();
const EVO_INSTANCE = String(process.env.EVOLUTION_INSTANCE_NAME || 'cdsind').trim();

async function fetchProfilePic(telefone) {
  const headers = { apikey: EVO_KEY, 'Content-Type': 'application/json' };
  const number = String(telefone).replace(/\D/g, '');
  if (!number) return null;
  try {
    const r = await fetch(`${EVO_URL}/chat/fetchProfilePictureUrl/${EVO_INSTANCE}`, {
      method: 'POST', headers,
      body: JSON.stringify({ number })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.profilePictureUrl || data?.profile_picture_url || null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!EVO_KEY) {
    return res.status(500).json({ error: 'EVOLUTION_API_KEY nao configurada' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
    const refazer = req.query.refazer === '1';

    // Busca todos os leads (com ou sem foto)
    const todos = await selectAll('leads', { orderBy: 'atualizado_em', limit: 300 });

    const target = refazer
      ? todos
      : todos.filter(l => !l.foto_url);

    const lista = target.slice(0, limit);

    const result = { totalCandidatos: target.length, processados: 0, atualizados: 0, semFoto: 0, errors: [] };

    for (const lead of lista) {
      if (!lead.telefone) continue;
      result.processados++;
      try {
        const fotoUrl = await fetchProfilePic(lead.telefone);
        if (fotoUrl) {
          await sb(`/leads?id=eq.${lead.id}`, {
            method: 'PATCH',
            body: { foto_url: fotoUrl }
          });
          result.atualizados++;
        } else {
          result.semFoto++;
        }
      } catch (e) {
        result.errors.push({ id: lead.id, err: e.message });
      }
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[fotos] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
