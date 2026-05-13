// api/agents/narancia.js
// Narancia Ghirga — Criador de Conteudo & Design IA
// Gera copies, anuncios, briefings de design e calendario de conteudo.

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
  return `Voce e Narancia Ghirga, Criador de Conteudo e Design IA da CDS Industrial.
Seu papel: criativo publicitario especializado em industria metalica. Voce cria copys, anuncios, posts e briefings de design.

PERSONALIDADE: Criativo, energetico, visual. Voce pensa em imagens e palavras que impactam.
Mas voce e profissional — sabe que copy de industria precisa de credibilidade, nao de hype vazio.

CONHECIMENTO DA EMPRESA:
${CONHECIMENTO_BASE}

SUAS COMPETENCIAS:
- Copywriting: headlines, bodys, CTAs para anuncios pagos e organicos
- Formatos: carrossel, reels, stories, single image, video script
- Plataformas: Instagram, Facebook, Facebook Marketplace, OLX, Google Ads, LinkedIn, TikTok
- Classificados: OLX e Marketplace tem regras proprias (titulo curto, preco visivel, fotos reais)
- Design thinking: briefing para designers, paleta de cores, tipografia, composicao
- Estrategia de imagens: definir quantas imagens (1-5), tipo e fonte para cada post
- Tom de voz: industrial profissional mas acessivel, sem ser generico
- A/B testing: gerar variacoes de copy para testar performance
- SEO: meta titles, descriptions, alt texts

FONTES DE IMAGENS DISPONIVEIS:
- "foto_produto": fotos reais ja cadastradas no e-commerce (usar quando o produto existe)
- "ia_gerada": imagem gerada por IA (criar prompt detalhado em ingles)
- "propaganda": banner/arte com texto sobreposto (gerar briefing para designer ou ferramenta)
- "upload_manual": foto tirada pelo funcionario (instruir como tirar boa foto industrial)

REGRAS:
- Copies curtas e impactantes. Industria nao precisa de texto de influencer.
- Use numeros concretos quando possivel (7% PIX, entrega nacional, 14t Munck)
- Destaque diferenciais reais: fabricacao propria, sob medida, Brasilia/DF
- Briefings de design devem ser claros e executaveis por qualquer designer
- SEMPRE inclua guiaPostagem com passo-a-passo detalhado para cada plataforma
- SEMPRE inclua imagensRecomendadas com 1 a 5 imagens por post
- Para OLX/Marketplace: priorize fotos reais do produto (minimo 3)
- Para Instagram: priorize propaganda ou ia_gerada com visual premium
- O guia deve ser tao claro que um funcionario novo consiga executar sozinho
- Retorne APENAS JSON valido`;
}

function buildUserPrompt(params) {
  const { produto, publicoAlvo, objetivo, plataforma, contextoExtra } = params;

  return `Preciso de conteudo de marketing para:
PRODUTO/SERVICO: ${produto || 'Produtos metalicos sob medida da CDS Industrial'}
PUBLICO-ALVO: ${publicoAlvo || 'Empresas e pessoas que precisam de produtos metalicos'}
OBJETIVO: ${objetivo || 'Gerar engajamento e leads'}
PLATAFORMA: ${plataforma || 'Instagram e Facebook'}
${contextoExtra ? `CONTEXTO ADICIONAL: ${contextoExtra}` : ''}

IMPORTANTE: Quem vai executar as postagens pode ser um funcionario novo que nunca fez marketing. O guiaPostagem DEVE ser extremamente detalhado, passo a passo, como um manual. Inclua onde clicar, o que escrever em cada campo, tamanho de foto, etc.

Retorne APENAS este JSON:
{
  "analiseCreativa": "Sua leitura do cenario e angulo criativo escolhido",
  "copies": [
    {
      "tipo": "anuncio|post|stories|carrossel|reels_script|classificado_olx|classificado_marketplace",
      "plataforma": "Instagram/Facebook/Marketplace/OLX/Google/LinkedIn",
      "headline": "Titulo impactante",
      "corpo": "Texto do anuncio/post",
      "cta": "Call to action",
      "hashtags": ["#tag1", "#tag2"],
      "observacao": "Nota sobre tom ou variacao"
    }
  ],
  "imagensRecomendadas": [
    {
      "ordem": 1,
      "tipo": "foto_produto|ia_gerada|propaganda|upload_manual",
      "descricao": "Descricao clara do que a imagem deve mostrar",
      "formato": "1080x1080",
      "plataformaAlvo": "Instagram/OLX/Marketplace",
      "promptIA": "Se tipo=ia_gerada: prompt em ingles para gerar a imagem. Ex: Professional photo of a custom metal staircase in a modern building...",
      "instrucaoFoto": "Se tipo=upload_manual: como tirar a foto. Ex: Tire foto da escada montada, de frente, com boa iluminacao...",
      "produtoRef": "Se tipo=foto_produto: nome ou ID do produto no catalogo"
    }
  ],
  "guiaPostagem": [
    {
      "plataforma": "Nome da plataforma",
      "passos": [
        "Passo 1: Abra o app X e clique em Y",
        "Passo 2: Selecione a opcao Z",
        "Passo 3: Cole o titulo (copie acima)",
        "Passo 4: Adicione as fotos (minimo 3, tamanho ideal 1080x1080)",
        "Passo 5: Preencha o preco",
        "Passo 6: Clique em publicar"
      ],
      "dicasImportantes": ["Dica 1", "Dica 2"],
      "errosComuns": ["Erro que iniciantes cometem"]
    }
  ],
  "variacoes": [
    {
      "original": "Copy A",
      "variacao": "Copy B (teste A/B)",
      "hipotese": "Porque testar essa variacao"
    }
  ],
  "briefingDesign": [
    {
      "peca": "Nome da peca (ex: Post feed quadrado)",
      "formato": "1080x1080 / 1080x1920 / 1200x628",
      "elementosVisuais": "Foto de produto, fundo escuro, texto em destaque",
      "paleta": "Cores sugeridas",
      "tipografia": "Bold sans-serif para headline, regular para corpo",
      "referencia": "Estilo industrial premium, limpo"
    }
  ],
  "calendarioSugerido": [
    {"dia": "Segunda", "conteudo": "Tipo de post", "formato": "Feed/Stories/Reels"}
  ],
  "proximosPassos": ["Passo 1", "Passo 2"]
}`;
}

/**
 * Executa o agente Narancia: gera conteudo criativo completo.
 * Opcionalmente persiste conteudos vinculados a uma campanha.
 */
export async function executar(params, opts = {}) {
  const { campaignId = null } = opts;
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(params);

  const { content, provider, model } = await chamarIA(systemPrompt, userPrompt);
  const resultado = parseIAResponse(content);

  const durationMs = Date.now() - startTime;

  // Emitir evento de sessao
  emitEvent({
    type: 'agent.session_completed',
    source: 'agent',
    actor: 'agente:narancia',
    payload: {
      trigger: 'user_request',
      provider,
      model,
      duration_ms: durationMs,
      produto: params.produto,
      copies_geradas: resultado.copies?.length || 0,
    },
  });

  // Persistir conteudos se ha campanha vinculada
  if (campaignId && resultado.copies?.length > 0) {
    for (const copy of resultado.copies) {
      try {
        await insert('campaign_contents', {
          campaign_id: campaignId,
          type: copy.tipo || 'post',
          platform: copy.plataforma || params.plataforma,
          headline: copy.headline,
          body: copy.corpo,
          cta: copy.cta,
          hashtags: copy.hashtags || [],
          design_brief: resultado.briefingDesign?.[0] || null,
          status: 'draft',
          created_by: 'agente:narancia',
        });
      } catch (err) {
        console.warn('[narancia] Erro ao persistir conteudo:', err.message);
      }
    }

    emitEvent({
      type: 'content.batch_created',
      source: 'agent',
      entity_type: 'campanha',
      entity_id: campaignId,
      actor: 'agente:narancia',
      payload: { count: resultado.copies.length },
    });
  }

  return {
    resultado,
    modo: 'marketing-narancia',
    personagem: 'Narancia Ghirga',
    meta: { provider, model, durationMs },
  };
}
