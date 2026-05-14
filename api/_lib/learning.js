// api/_lib/learning.js
// Sistema de aprendizado IA — experimentos A/B e insights globais.
// Extraido de assistente-vendas.js para reuso.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bgwnbsuzvmmulafiodrm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const MIN_USOS_PARA_INSIGHT = 8;
const TAXA_SUCESSO_POSITIVO = 0.55;
const TAXA_SUCESSO_NEGATIVO = 0.25;

export async function registrarUso(body) {
  const { lead_id, telefone, variant_id = 'A', label, mensagem, etapa, tecnica } = body;
  if (!lead_id || !label) return { ok: false, erro: 'lead_id e label obrigatorios' };
  const { data, error } = await supabaseClient.from('ia_experimentos').insert({
    lead_id, telefone: telefone || '', variant_id,
    label_sugestao: label, mensagem_sugestao: mensagem || '',
    etapa_no_momento: etapa || '', tecnica_usada: tecnica || '',
    usada: true, resultado: 'pendente',
  }).select('id').single();
  if (error) throw error;
  consolidarLazy(label, etapa).catch(() => {});
  return { ok: true, experimento_id: data?.id };
}

export async function registrarResultado(body) {
  const { lead_id, experimento_id, resultado } = body;
  if (!lead_id && !experimento_id) return { ok: false };
  if (experimento_id) {
    await supabaseClient.from('ia_experimentos').update({ resultado, atualizado_em: new Date().toISOString() }).eq('id', experimento_id);
  } else {
    await supabaseClient.from('ia_experimentos').update({ resultado, atualizado_em: new Date().toISOString() }).eq('lead_id', lead_id).eq('resultado', 'pendente').order('criado_em', { ascending: false }).limit(1);
  }
  return { ok: true };
}

export async function buscarInsights(contexto = '') {
  try {
    let query = supabaseClient.from('ia_insights_globais').select('tipo, contexto, insight, confianca, usos, sucessos').gte('confianca', 40).gte('usos', 3).order('confianca', { ascending: false }).limit(12);
    if (contexto) query = query.or(`contexto.ilike.%${contexto}%,contexto.is.null`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[learning] buscarInsights falhou:', err.message);
    return [];
  }
}

export async function buscarInsightsGlobais(etapa) {
  try {
    const { data, error } = await supabaseClient
      .from('ia_insights_globais')
      .select('tipo, contexto, insight, confianca')
      .gte('confianca', 40)
      .gte('usos', 3)
      .order('confianca', { ascending: false })
      .limit(10);
    if (error) throw error;
    const relevantes = (data || []).sort((a, b) => {
      const aRel = a.contexto?.includes(etapa) ? 1 : 0;
      const bRel = b.contexto?.includes(etapa) ? 1 : 0;
      return bRel - aRel;
    });
    return relevantes;
  } catch {
    return [];
  }
}

async function consolidarLazy(label, etapa) {
  const contextoKey = etapa ? `label:${label};etapa:${etapa}` : `label:${label}`;
  const { data: exps, error } = await supabaseClient.from('ia_experimentos').select('variant_id, usada, resultado').eq('label_sugestao', label).eq('etapa_no_momento', etapa || '').eq('usada', true);
  if (error || !exps || exps.length < MIN_USOS_PARA_INSIGHT) return;
  const total = exps.length;
  const sucessos = exps.filter(e => e.resultado === 'etapa_avancou' || e.resultado === 'resposta_recebida').length;
  const taxa = sucessos / total;
  let tipo, insight;
  if (taxa >= TAXA_SUCESSO_POSITIVO) {
    tipo = 'tecnica_efetiva';
    insight = `Sugestoes com label "${label}" no contexto "${etapa || 'geral'}" tiveram ${Math.round(taxa * 100)}% de taxa de sucesso (${sucessos}/${total} usos resultaram em avanco). Giorno deve priorizar esse estilo de abordagem.`;
  } else if (taxa <= TAXA_SUCESSO_NEGATIVO) {
    tipo = 'abordagem_falhou';
    insight = `Sugestoes com label "${label}" no contexto "${etapa || 'geral'}" tiveram apenas ${Math.round(taxa * 100)}% de sucesso (${sucessos}/${total}). Giorno deve evitar esse padrao e tentar abordagem diferente.`;
  } else { return; }
  const confianca = Math.min(95, 40 + Math.round(taxa * 60));
  const { data: existente } = await supabaseClient.from('ia_insights_globais').select('id').eq('tipo', tipo).eq('contexto', contextoKey).maybeSingle();
  if (existente) {
    await supabaseClient.from('ia_insights_globais').update({ insight, confianca, usos: total, sucessos, atualizado_em: new Date().toISOString() }).eq('id', existente.id);
  } else {
    await supabaseClient.from('ia_insights_globais').insert({ tipo, contexto: contextoKey, insight, confianca, usos: total, sucessos });
  }
}
