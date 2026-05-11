// api/ia-aprendizado.js
// Memoria global do sistema de IA — experimentos A/B + insights aprendidos
//
// GET  /api/ia-aprendizado                 → top insights globais para injetar no prompt
// POST /api/ia-aprendizado                 → registra uso de sugestao (com job lazy de consolidacao)
// POST /api/ia-aprendizado?acao=resultado  → registra resultado do experimento

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const MIN_USOS_PARA_INSIGHT = 8; // minimo de usos antes de consolidar insight
const TAXA_SUCESSO_POSITIVO = 0.55; // acima disso: insight positivo
const TAXA_SUCESSO_NEGATIVO = 0.25; // abaixo disso: insight negativo

// ── Buscar top insights para injetar no prompt ────────────────────────────────
async function buscarInsightsGlobais(contexto = '') {
  try {
    let query = supabase
      .from('ia_insights_globais')
      .select('tipo, contexto, insight, confianca, usos, sucessos')
      .gte('confianca', 40)
      .gte('usos', 3)
      .order('confianca', { ascending: false })
      .limit(12);

    if (contexto) {
      query = query.or(`contexto.ilike.%${contexto}%,contexto.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[ia-aprendizado] buscarInsightsGlobais falhou:', err.message);
    return [];
  }
}

// ── Registrar uso de sugestao ─────────────────────────────────────────────────
async function registrarUso(body) {
  const {
    lead_id, telefone, variant_id = 'A',
    label, mensagem, etapa, tecnica,
  } = body;

  if (!lead_id || !label) return { ok: false, erro: 'lead_id e label obrigatorios' };

  const { data, error } = await supabase
    .from('ia_experimentos')
    .insert({
      lead_id,
      telefone: telefone || '',
      variant_id,
      label_sugestao: label,
      mensagem_sugestao: mensagem || '',
      etapa_no_momento: etapa || '',
      tecnica_usada: tecnica || '',
      usada: true,
      resultado: 'pendente',
    })
    .select('id')
    .single();

  if (error) throw error;

  // Job lazy: consolidar insights se tiver dados suficientes
  consolidarInsightsLazy(label, etapa).catch(() => {});

  return { ok: true, experimento_id: data?.id };
}

// ── Registrar resultado de um experimento ─────────────────────────────────────
async function registrarResultado(body) {
  const { lead_id, experimento_id, resultado } = body;
  if (!lead_id && !experimento_id) return { ok: false };

  // Atualiza o experimento mais recente deste lead se nao tiver id especifico
  if (experimento_id) {
    await supabase
      .from('ia_experimentos')
      .update({ resultado, atualizado_em: new Date().toISOString() })
      .eq('id', experimento_id);
  } else {
    await supabase
      .from('ia_experimentos')
      .update({ resultado, atualizado_em: new Date().toISOString() })
      .eq('lead_id', lead_id)
      .eq('resultado', 'pendente')
      .order('criado_em', { ascending: false })
      .limit(1);
  }

  return { ok: true };
}

// ── Job lazy de consolidacao de insights ─────────────────────────────────────
// Roda apos cada POST, sem bloquear resposta
async function consolidarInsightsLazy(label, etapa) {
  const contextoKey = etapa ? `label:${label};etapa:${etapa}` : `label:${label}`;

  const { data: exps, error } = await supabase
    .from('ia_experimentos')
    .select('variant_id, usada, resultado')
    .eq('label_sugestao', label)
    .eq('etapa_no_momento', etapa || '')
    .eq('usada', true);

  if (error || !exps || exps.length < MIN_USOS_PARA_INSIGHT) return;

  const total = exps.length;
  const sucessos = exps.filter(e =>
    e.resultado === 'etapa_avancou' || e.resultado === 'resposta_recebida'
  ).length;
  const taxa = sucessos / total;

  let tipo, insight;
  if (taxa >= TAXA_SUCESSO_POSITIVO) {
    tipo = 'tecnica_efetiva';
    insight = `Sugestoes com label "${label}" no contexto "${etapa || 'geral'}" tiveram ${Math.round(taxa * 100)}% de taxa de sucesso (${sucessos}/${total} usos resultaram em avanco). Giorno deve priorizar esse estilo de abordagem.`;
  } else if (taxa <= TAXA_SUCESSO_NEGATIVO) {
    tipo = 'abordagem_falhou';
    insight = `Sugestoes com label "${label}" no contexto "${etapa || 'geral'}" tiveram apenas ${Math.round(taxa * 100)}% de sucesso (${sucessos}/${total}). Giorno deve evitar esse padrao e tentar abordagem diferente.`;
  } else {
    return; // dados insuficientes para insight definitivo
  }

  const confianca = Math.min(95, 40 + Math.round(taxa * 60));

  // Upsert: atualiza se ja existe insight para esse contexto+tipo
  const { data: existente } = await supabase
    .from('ia_insights_globais')
    .select('id, usos, sucessos')
    .eq('tipo', tipo)
    .eq('contexto', contextoKey)
    .maybeSingle();

  if (existente) {
    await supabase
      .from('ia_insights_globais')
      .update({
        insight,
        confianca,
        usos: total,
        sucessos,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', existente.id);
  } else {
    await supabase
      .from('ia_insights_globais')
      .insert({ tipo, contexto: contextoKey, insight, confianca, usos: total, sucessos });
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const contexto = req.query.contexto || '';
      const insights = await buscarInsightsGlobais(contexto);
      return res.status(200).json({ insights });
    }

    if (req.method === 'POST') {
      const acao = req.query.acao || '';
      const body = req.body || {};

      if (acao === 'resultado') {
        const result = await registrarResultado(body);
        return res.status(200).json(result);
      }

      // Registro padrao: uso de sugestao
      const result = await registrarUso(body);
      return res.status(result.ok ? 200 : 400).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[ia-aprendizado]', req.method, err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
