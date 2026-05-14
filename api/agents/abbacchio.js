// api/agents/abbacchio.js
// Leone Abbacchio — Gestor de Marketing & Trafego IA
// Analisa cenario, define estrategia, sugere campanhas, metas e KPIs.

import { chamarIA, parseIAResponse } from '../_lib/ai-fallback.js';
import { emitEvent } from '../_lib/events.js';
import { insert } from '../_lib/supabase.js';

const CONHECIMENTO_BASE = `CDS Industrial - fabrica metalica em Brasilia/DF. Vendedor: Jean.
Produtos: chapas dobradas, pecas em metalon/tubo/chapa, pes de mesa, carrinhos, tampas para casas de maquinas, containers de lixo, escadas/rampas (ABNT/NR+ART), bancadas e projetos sob encomenda.
PIX 7% OFF | cupom 1COMPRA 5% OFF | Entrega Brasil todo + Munck 14t.
Site: cdsind.com.br | WhatsApp: (61) 99308-1396
Facebook: facebook.com/cdsind (5.581 curtidas) | Instagram: @cds.industrial (1.399 seguidores)
OLX: olx.com.br/perfil/clark-jean-martins-genu-46f3e185`;

function buildSystemPrompt() {
  return `Voce e Leone Abbacchio, Gestor de Marketing e Trafego IA da CDS Industrial.
Seu papel: estrategista de marketing digital e trafego pago para uma industria metalica em Brasilia/DF.

PERSONALIDADE: Analitico, meticuloso, direto. Voce nao tolera achismo — tudo precisa de dado, metrica e ROI.
Voce e o tipo de gestor que olha os numeros antes de aprovar qualquer campanha.

CONHECIMENTO DA EMPRESA:
${CONHECIMENTO_BASE}

SUAS COMPETENCIAS AVANCADAS:
- Trafego pago: Google Ads (Search/Shopping), Meta Ads (Facebook/Instagram), LinkedIn Ads (B2B).
- Funil B2B Industrial:
  - TOFU (Awareness): Visibilidade de marca, dores estruturais.
  - MOFU (Consideracao): Autoridade, especificacoes tecnicas (NR12, espessuras).
  - BOFU (Conversao & Remarketing): Abordar quem orcou e nao comprou, ou fazer cross-sell (quem orcou escada precisa de guarda-corpo).
- Metricas B2B: CPL (Custo por Lead) da industria metalica B2B varia entre R$ 20 e R$ 80.
- CAC e LTV: Clientes industriais tem alta recorrencia. Focar no LTV (Lifetime Value).

CONTEXTO ATUAL DA EMPRESA:
- A CDS JA anuncia ativamente na OLX, Facebook Marketplace e Instagram.
- Esses canais gratuitos sao essenciais.
- Trafego pago e focado em alta conversao.

REGRAS:
- Sugira budgets realistas para uma industria metalica PME e metas de CPL factiveis (R$ 20-80).
- SEMPRE inclua OLX e Marketplace na estrategia orgânica.
- Estruture o funil BOFU incluindo OBRIGATORIAMENTE uma acao de Remarketing.
- Retorne APENAS JSON valido.`;
}

function buildUserPrompt(params) {
  const { produto, publicoAlvo, objetivo, budget, plataforma, contextoExtra, campanhaAtual } = params;

  return `Preciso de uma estrategia de marketing para:
PRODUTO/SERVICO: ${produto || 'Produtos metalicos sob medida'}
PUBLICO-ALVO: ${publicoAlvo || 'Empresas, construtoras e pessoas fisicas que precisam de produtos metalicos'}
OBJETIVO: ${objetivo || 'Gerar leads qualificados'}
BUDGET MENSAL: ${budget || 'A definir'}
PLATAFORMA PREFERIDA: ${plataforma || 'Melhor custo-beneficio'}
${contextoExtra ? `CONTEXTO ADICIONAL: ${contextoExtra}` : ''}
${campanhaAtual ? `CAMPANHA ATUAL: ${campanhaAtual}` : ''}

Retorne APENAS este JSON:
{
  "diagnostico": "Analise breve do cenario atual e oportunidades",
  "estrategia": {
    "posicionamento": "Como a CDS deve se posicionar neste mercado",
    "canaisPrioritarios": [{"canal": "nome", "motivo": "porque", "budgetSugerido": "R$ X/mes", "roiEsperado": "X:1"}],
    "funil": {
      "tofu": "Estrategia de awareness",
      "mofu": "Estrategia de consideracao",
      "bofu": "Estrategia de conversao direta",
      "remarketing": "Estrategia de remarketing/LTV"
    }
  },
  "campanhas": [
    {
      "nome": "Nome da campanha",
      "plataforma": "Google/Meta/TikTok",
      "objetivo": "Conversao/Trafego/Awareness",
      "segmentacao": "Descricao do publico",
      "orcamentoDiario": "R$ X",
      "metricasAlvo": {"cpl": "R$ X", "ctr": "X%", "conversoes": "X/mes"},
      "duracao": "X dias"
    }
  ],
  "kpis": [{"nome": "Metrica", "meta": "Valor", "prazo": "Periodo"}],
  "proximosPassos": ["Passo 1", "Passo 2", "Passo 3"],
  "alertas": ["Risco ou observacao importante"]
}`;
}

/**
 * Executa o agente Abbacchio: analisa briefing e retorna estrategia completa.
 * Opcionalmente persiste campanha e emite eventos.
 */
export async function executar(params, opts = {}) {
  const { persistCampaign = false } = opts;
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(params);

  const { content, provider, model } = await chamarIA(systemPrompt, userPrompt);
  const resultado = parseIAResponse(content);

  const durationMs = Date.now() - startTime;

  // Emitir evento de sessao do agente
  emitEvent({
    type: 'agent.session_completed',
    source: 'agent',
    actor: 'agente:abbacchio',
    payload: {
      trigger: 'user_request',
      provider,
      model,
      duration_ms: durationMs,
      produto: params.produto,
      objetivo: params.objetivo,
    },
  });

  // Persistir campanha se solicitado
  let campaignId = null;
  if (persistCampaign && resultado.campanhas?.length > 0) {
    try {
      const campaign = await insert('campaigns', {
        name: resultado.campanhas[0].nome || `Campanha ${params.produto || 'geral'}`,
        channel: (params.plataforma || 'multi').toLowerCase().replace(/\s+/g, '_'),
        objective: params.objetivo || 'leads',
        status: 'draft',
        budget_monthly: parseFloat((params.budget || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || null,
        target_audience: params.publicoAlvo || null,
        product_focus: params.produto || null,
        strategy: resultado,
        created_by: 'agente:abbacchio',
      });
      campaignId = campaign?.id;

      if (campaignId) {
        emitEvent({
          type: 'campaign.created',
          source: 'agent',
          entity_type: 'campanha',
          entity_id: campaignId,
          actor: 'agente:abbacchio',
          payload: {
            name: resultado.campanhas[0].nome,
            channel: params.plataforma,
            objective: params.objetivo,
          },
        });
      }
    } catch (err) {
      console.warn('[abbacchio] Erro ao persistir campanha:', err.message);
    }
  }

  return {
    resultado,
    modo: 'marketing-abbacchio',
    personagem: 'Leone Abbacchio',
    campaignId,
    meta: { provider, model, durationMs },
  };
}
