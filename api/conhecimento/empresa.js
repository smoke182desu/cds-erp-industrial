// api/conhecimento/empresa.js — upsert 1:1 com trafego_clientes
import { sb } from '../_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`PostgREST ${r.status}: ${typeof r.body==='string'?r.body:JSON.stringify(r.body)}`);e.status=r.status;throw e;}return r.body;}

const CAMPOS = [
  'missao','visao','valores','tom_voz','personalidade_marca','proposta_valor','slogan','historia',
  'segmento','industria','ticket_medio','sazonalidade','geografia',
  'icp_perfil','icp_dor','icp_objetivo','icp_objecoes','icp_jornada',
  'diferenciais','beneficios_principais','garantias','prova_social',
  'paleta_cores','fonte_marca','logo_url','guidelines_url',
  'objetivos_negocio','metas_marketing','palavras_chave','hashtags_marca','evitar_palavras',
  'historico_aprendido','metadata',
];

export default async function handler(req, res) {
  try {
    const cid = req.query?.cliente_id;
    if (!cid) return res.status(400).json({ error: 'cliente_id obrigatório' });

    if (req.method === 'GET') {
      const arr = await sbBody(`/conhecimento_empresa?cliente_agencia_id=eq.${cid}&select=*`);
      return res.status(200).json(arr?.[0] || { cliente_agencia_id: cid });
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const b = req.body || {};
      const upd = {};
      for (const k of CAMPOS) if (b[k] !== undefined) upd[k] = b[k];

      const exist = await sbBody(`/conhecimento_empresa?cliente_agencia_id=eq.${cid}&select=cliente_agencia_id`);
      if (exist?.[0]) {
        const r = await sbBody(`/conhecimento_empresa?cliente_agencia_id=eq.${cid}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' }, body: upd,
        });
        return res.status(200).json(r?.[0]);
      }
      const r = await sbBody('/conhecimento_empresa', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: { cliente_agencia_id: cid, ...upd },
      });
      return res.status(201).json(r?.[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
