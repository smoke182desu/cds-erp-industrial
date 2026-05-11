import axios from 'axios';
import { selectAll, update } from './_lib/supabase.js';

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite'
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];

const ETAPAS_LABEL = {
  lead_novo: 'Lead Novo',
  contato_feito: 'Contato Feito',
  qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Em Negociacao',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
};

const CONHECIMENTO_EMPRESA = `CDS Industrial - fabrica metalica em Brasilia/DF. Vendedor: Jean.
Produtos: escadas/rampas (ABNT/NR+ART), tampas casa de maquinas (70x70-110x110, garantia 10a),
chapas sob medida, moveis/bancadas industriais, carrinhos, projetos sob encomenda (CAD+ART).
PIX 7% OFF | cupom 1COMPRA 5% OFF | Entrega Brasil todo + Munck 14t.`;

const CONHECIMENTO_RAW_URL =
  'https://raw.githubusercontent.com/smoke182desu/cds-erp-industrial/main/empresa-conhecimento.md';

async function buscarContextoExtra() {
  try {
    const resp = await axios.get(CONHECIMENTO_RAW_URL, { timeout: 5000 });
    return resp.data || '';
  } catch {
    return '';
  }
}

async function buscarMensagens(telefone) {
  try {
    const data = await selectAll('mensagens', { filters: { telefone: `eq.${telefone}` }, orderBy: 'criado_em' });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(row => ({
      tipo: row.tipo || 'entrada',
      texto: row.texto || row.conteudo || '',
      criadoEm: row.criado_em || row.created_at || '',
    }))
      .filter(m => m.texto.trim())
      .sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
  } catch {
    return [];
  }
}

// Cache simples em memoria para evitar rate limit
// Em serverless, vive durante warm instances (~5-15min)
const cache = new Map();
const CACHE_TTL = 180000; // Aumentado para 3 minutos (evita frontend spam)

function getCacheKey(telefone, mensagens = []) {
  const ultima = mensagens[mensagens.length - 1] || {};
  return `assistente_${telefone}_${mensagens.length}_${ultima.tipo || ''}_${ultima.criadoEm || ''}_${ultima.texto || ''}`;
}

function getCache(telefone, mensagens) {
  const key = getCacheKey(telefone, mensagens);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(telefone, mensagens, data) {
  cache.set(getCacheKey(telefone, mensagens), { data, ts: Date.now() });
  // Limpa cache antigo (max 50 entries)
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

function obterSaudacao() {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(new Date()));
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function aplicarSaudacaoInicial(analise, saudacao, precisaSaudacao) {
  if (!precisaSaudacao || !Array.isArray(analise?.sugestoes) || analise.sugestoes.length === 0) {
    return analise;
  }

  const primeira = analise.sugestoes[0];
  const mensagem = String(primeira?.mensagem || '').trim();
  const semSaudacaoAntiga = mensagem
    .replace(/^(oi|ola|olá)[!,.\s-]*/i, '')
    .replace(/^(bom dia|boa tarde|boa noite)[!,.\s-]*/i, '')
    .trim();

  primeira.label = 'saudacao';
  primeira.mensagem = semSaudacaoAntiga ? `${saudacao}! ${semSaudacaoAntiga}` : `${saudacao}!`;
  return analise;
}

// Chamada com Fallback Automático
async function chamarIAComFallback(systemPrompt, userPrompt) {
  let lastError;

  // TIER 1: Gemini
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800, responseMimeType: "application/json" }
        };
        const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
        const content = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { data: { choices: [{ message: { content } }] } }; // mock formato OpenAI
      } catch (err) {
        console.log(`[assistente-vendas] Gemini (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 2: Groq Fallbacks
  if (GROQ_API_KEY) {
    const payload = {
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 800,
    };
    for (const model of GROQ_MODELS) {
      try {
        payload.model = model;
        const resp = await axios.post(`${GROQ_BASE_URL}/chat/completions`, payload, {
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        });
        return resp;
      } catch (err) {
        console.log(`[assistente-vendas] Groq (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 3: OpenAI Fallback
  if (OPENAI_API_KEY) {
    try {
      const payload = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800,
      };
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      return resp;
    } catch (err) {
      console.log('[assistente-vendas] OpenAI falhou.');
      lastError = err;
    }
  }

  throw lastError || new Error('Todos os motores de IA esgotaram a cota (Gemini + Groq + OpenAI).');
}

async function analisarConversa(mensagens, lead) {
  if (!GROQ_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) {
    throw new Error('Nenhuma API KEY (Groq, Gemini ou OpenAI) configurada no servidor.');
  }

  const etapa = ETAPAS_LABEL[lead.etapa] || lead.etapa;
  const contextoExtra = await buscarContextoExtra();
  const extra = contextoExtra ? `\nEXTRA: ${contextoExtra}` : '';
  const ultimas = mensagens.slice(-10);
  const conversaStr = ultimas.length > 0
    ? ultimas.map(m => `[${m.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}]: ${m.texto}`).join('\n')
    : '(sem mensagens ainda)';

  const saudacao = obterSaudacao();
  const nomeCliente = (lead.nome || '').split(' ')[0] || 'cliente';
  const ultimaMensagem = ultimas[ultimas.length - 1];
  const precisaSaudacao = !ultimaMensagem || ultimaMensagem.tipo !== 'saida';

  let observacoesAtuais = lead.observacoes || '';
  let memoriaAtual = '';
  const memMatch = observacoesAtuais.match(/\[MEMÓRIA IA\]([\s\S]*?)(\n\n|$)/);
  if (memMatch) {
    memoriaAtual = memMatch[1].trim();
  }

  const systemPrompt = `Você é a inteligência central da CDS Industrial. Sua missão é atuar como o cérebro tático do JEAN no WhatsApp.

Sua PRIMEIRA TAREFA ABSOLUTA é a TRIAGEM DE CONTEXTO para ativar o avatar correto:

1. [JEAN VENDEDOR] -> O contato quer COMPRAR escadas/materiais?
- Ative o Cientista de Vendas da V4 Company.
- Use SPIN Selling: Escale a dor antes de dar o preço.
- Use Challenger Sale: Ensine o cliente e não ceda fácil a descontos.
- Use BANT: Qualifique o orçamento e autoridade.

2. [JEAN GESTOR] -> O contato é um FUNCIONÁRIO ou candidato?
- Esqueça vendas. Você é o dono/chefe.
- Seja firme, mas justo. Cobre comprometimento, alinhe horários, faltas e expectativas de trabalho. Mantenha o controle da equipe.

3. [JEAN COMPRADOR] -> O contato é um FORNECEDOR (alguém te vendendo material/serviço)?
- Você é o cliente agora! O objetivo é proteger o caixa da CDS Industrial.
- Negocie preços a favor da CDS, cobre prazos de entrega de materiais (chapas, aço), peça desconto e seja exigente.

4. [JEAN NORMAL] -> O contato é um AMIGO ou o papo é OFF-TOPIC/PESSOAL?
- Desligue totalmente o modo corporativo.
- Aja de forma natural, zoe junto, converse sobre o assunto sem tentar vender nada nem dar ordens.

DIRETRIZES PARA AS MENSAGENS SUGERIDAS (Efeito Doppelgänger):
- Espelhe a vibe da pessoa (se formal seja direto, se informal seja ágil estilo WhatsApp: "vc", "pra", "blz").
- Se a última mensagem foi do CLIENTE, a primeira sugestão deve começar obrigatoriamente com a saudação do horário atual ("Bom dia", "Boa tarde" ou "Boa noite").
- REGRA DE OURO: Textos extremamente curtos! MÁXIMO ABSOLUTO DE 2 LINHAS (cerca de 15 a 20 palavras). NUNCA escreva parágrafos.
- MANTENHA O CONTROLE: Termine a sugestão com uma pergunta ou diretriz que faça a conversa avançar no sentido estratégico do Avatar ativo.

Analise o momento exato da conversa e retorne APENAS um JSON válido.`;

  const userPrompt = `Contexto da CDS Industrial (Brasília/DF - Vendedor: JEAN):
${CONHECIMENTO_EMPRESA}${extra}
LEAD: nome="${lead.nome || ''}" empresa="${lead.empresa || ''}" etapa=${etapa}
HORÁRIO: ${saudacao} | NOME CLIENTE: ${nomeCliente}
ÚLTIMA MENSAGEM FOI DO: ${precisaSaudacao ? 'CLIENTE - primeira sugestão deve iniciar com "' + saudacao + '!"' : 'JEAN - não precisa repetir saudação'}

MEMÓRIA DE LONGO PRAZO DA IA (LTM):
${memoriaAtual ? memoriaAtual : '(Nenhuma memória anterior registrada para este contato. Inicie a análise do zero.)'}

CONVERSA ATUAL:
${conversaStr}

Sua tarefa:
1. Avalie a conversa atual levando em consideração a MEMÓRIA DE LONGO PRAZO (se existir) para não ser repetitivo e entender o contexto histórico.
2. Formule 4 sugestões TÁTICAS e ORIGINAIS de resposta que façam sentido PARA ESTE EXATO SEGUNDO da conversa.
3. Gere uma "novaMemoria" que seja um resumo denso de tudo que você aprendeu sobre esse contato até o momento (junte o que já sabia com o que descobriu agora na conversa atual). Foque no perfil psicológico, dores e estágio da negociação.

Retorne APENAS o JSON:
{
  "dadosProposta":{"tipoCliente":"empresa|pessoa_fisica|orgao_publico|nao_identificado","nome":"","empresa":"","documento":"","email":"","endereco":"","produtos":["item c/ qtd"],"valorEstimado":"","prazo":"","observacoes":""},
  "etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido|pos_venda|nao_se_aplica|funcionario|fornecedor",
  "parecer": "Sua análise estratégica focada no perfil (Venda, Funcionário ou Pessoal), tom e próximo passo lógico.",
  "tecnicaRecomendada": "Ex: SPIN (se venda) OU Gestão de Conflitos (se funcionário) OU Rapport (se amigo)",
  "novaMemoria": "Resumo de longo prazo consolidado sobre esse contato (junte memória antiga com a conversa atual) para consultas futuras.",
  "sugestoes":[
    {"label":"Ação 1", "mensagem":"Sua mensagem 1 aqui..."},
    {"label":"Ação 2", "mensagem":"Sua mensagem 2 aqui..."},
    {"label":"Ação 3", "mensagem":"Sua mensagem 3 aqui..."},
    {"label":"Ação 4", "mensagem":"Sua mensagem 4 aqui..."}
  ]
}

REGRAS CRÍTICAS DE ESTRUTURA:
1. IMPORTANTE: Crie labels (Ação 1, Ação 2, etc) personalizadas para o contexto. Não use "Qualificação" ou "Apresentar Solução" se for um papo com funcionário!
2. FUNCIONÁRIO / PESSOAL: Use etapa "funcionario", "nao_se_aplica" ou "fornecedor". Não aplique SPIN. Fale do assunto que está sendo falado na conversa (ex: dia de trabalho, faltas, etc).
3. PÓS-VENDA: Se a venda já foi concluída, use "pos_venda" e apenas alinhe a entrega.
4. SAUDAÇÃO: Quando a última mensagem for do CLIENTE, a sugestão 1 deve ter label "saudacao" e a mensagem deve começar com "${saudacao}!" antes de qualquer pergunta.

EXEMPLOS DE TOM (INSPIRAÇÃO APENAS - NÃO COPIE):
[MOMENTO: VENDAS - PROBLEMA]
- label: "Explorar Dor" | mensagem: "Entendi. E hoje como vcs tão resolvendo isso? Pq se demorar muito atrasa a obra toda, né?"
[MOMENTO: VENDAS - FECHAMENTO]
- label: "Puxar pro PIX" | mensagem: "Show! Consigo colocar na produção amanhã cedo se a gente fechar hoje. Bora passar o cartão ou prefere PIX com desconto?"
[MOMENTO: FUNCIONÁRIO - ALINHAMENTO]
- label: "Cobrar Posição" | mensagem: "E aí, que horas vc chega na fábrica amanhã? Tem aquela entrega da estrutura pra montar."
[MOMENTO: AMIGO / PESSOAL - NATURAL]
- label: "Rapport / Papo" | mensagem: "Hahaha, cara nem me fala. Ontem foi correria total aqui tmb. E vc, como tão as coisas?"

ATENÇÃO: Se a conversa for PESSOAL, NÃO FALE DE PRODUTOS. Seja um amigo conversando normalmente.`;

  let resp;
  
  resp = await chamarIAComFallback(systemPrompt, userPrompt);
  
  const raw = resp.data?.choices?.[0]?.message?.content || '';
  let analise;
  try { analise = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { analise = JSON.parse(m[0]); } catch {} }
    if (!analise) throw new Error('JSON invalido: ' + raw.substring(0, 200));
  }

  analise = aplicarSaudacaoInicial(analise, saudacao, precisaSaudacao);

  // Persistir Memoria no Supabase em background
  if (analise && analise.novaMemoria && lead.id) {
    let newObs = observacoesAtuais;
    if (memMatch) {
      newObs = newObs.replace(/\[MEMÓRIA IA\][\s\S]*?(\n\n|$)/, `[MEMÓRIA IA]\n${analise.novaMemoria}\n\n`);
    } else {
      newObs = `${observacoesAtuais}\n\n[MEMÓRIA IA]\n${analise.novaMemoria}`.trim();
    }
    // Fire and forget
    update('leads', 'id', lead.id, { observacoes: newObs }).catch(e => console.error('Erro ao salvar novaMemoria:', e.message));
  }

  return analise;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });
  try {
    const { telefone, nome, empresa, etapa } = req.body || {};
    if (!GROQ_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) return res.status(503).json({ error: 'Nenhuma API KEY configurada.' });

    const mensagens = telefone ? await buscarMensagens(telefone) : [];

    // Verifica cache para esta versao exata da conversa antes de chamar IA
    const cached = telefone ? getCache(telefone, mensagens) : null;
    if (cached) {
      return res.status(200).json(cached);
    }

    const analise = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });
    const resultado = { analise, totalMensagens: mensagens.length };

    // Armazena no cache
    if (telefone) setCache(telefone, mensagens, resultado);

    return res.status(200).json(resultado);
  } catch (e) {
    const rawError = e.response?.data?.error?.message || e.message || 'Erro desconhecido';
    const msgFinal = `[DEBUG IA] ${rawError}`;
    console.error('[assistente-vendas] erro:', msgFinal);
    const status = e.response?.status === 429 ? 429 : 500;
    return res.status(status).json({ error: msgFinal });
  }
}
