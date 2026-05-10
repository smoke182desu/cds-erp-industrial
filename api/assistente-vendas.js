import axios from 'axios';
import { selectAll } from './_lib/supabase.js';

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.1-8b-instant';

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
    const data = await selectAll('mensagens', { filters: { telefone: `eq.${telefone}` } });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(row => ({
      tipo: row.tipo || 'entrada',
      texto: row.texto || row.conteudo || '',
    })).filter(m => m.texto.trim());
  } catch {
    return [];
  }
}

// Cache simples em memoria para evitar rate limit
// Em serverless, vive durante warm instances (~5-15min)
const cache = new Map();
const CACHE_TTL = 60000; // 60 segundos

function getCacheKey(telefone) { return `assistente_${telefone}`; }

function getCache(telefone) {
  const key = getCacheKey(telefone);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(telefone, data) {
  cache.set(getCacheKey(telefone), { data, ts: Date.now() });
  // Limpa cache antigo (max 50 entries)
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

// Chamada direta sem retry — Vercel tem timeout curto
async function chamarGroq(payload) {
  const resp = await axios.post(`${GROQ_BASE_URL}/chat/completions`, payload, {
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return resp;
}

async function analisarConversa(mensagens, lead) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY nao configurada no servidor.');
  const etapa = ETAPAS_LABEL[lead.etapa] || lead.etapa;
  const contextoExtra = await buscarContextoExtra();
  const extra = contextoExtra ? `\nEXTRA: ${contextoExtra}` : '';
  const ultimas = mensagens.slice(-10);
  const conversaStr = ultimas.length > 0
    ? ultimas.map(m => `[${m.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}]: ${m.texto}`).join('\n')
    : '(sem mensagens ainda)';

  // Saudacao baseada no horario de Brasilia (UTC-3)
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hora = agora.getUTCHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nomeCliente = (lead.nome || '').split(' ')[0] || 'cliente';

  const systemPrompt = `Você é o estrategista de vendas de elite da CDS Industrial, especialista nas metodologias SPIN Selling e Inside Sales da V4 Company.
Seu objetivo é analisar a conversa do WhatsApp e fornecer as melhores respostas para o vendedor JEAN enviar.
O funil de vendas V4/SPIN segue os passos:
1. Rapport & Saudação
2. Situação (Entender o cenário atual)
3. Problema & Implicação (Descobrir a dor/necessidade e aumentar a percepção do problema)
4. Solução (Apresentar o produto como a cura exata, gerando valor antes do preço)
5. Objeções (Contornar resistências de preço, prazo ou confiança)
6. Fechamento (Chamada para ação clara, criando urgência/escassez)

REGRA DE OURO: Escreva EXATAMENTE como um brasileiro de Brasília conversando no WhatsApp.
- Textos curtos, 1 a 3 linhas no máximo. NUNCA envie textões.
- Use "vc" (nunca "você"), "pra", "tá", "a gente".
- Use expressões naturais: "show", "beleza", "tranquilo", "massa", "fechou", "bora".
- MANTENHA O CONTROLE DA CONVERSA: Termine 90% das suas sugestões com UMA PERGUNTA. Quem pergunta domina a negociação.
- Foque em fazer o cliente falar as medidas, necessidades e prazos antes de atirar preço.

Analise o momento exato da conversa e retorne APENAS um JSON válido.`;

  const userPrompt = `Contexto da CDS Industrial (Brasília/DF - Vendedor: JEAN):
${CONHECIMENTO_EMPRESA}${extra}
LEAD: nome="${lead.nome || ''}" empresa="${lead.empresa || ''}" etapa=${etapa}
HORÁRIO: ${saudacao} | NOME CLIENTE: ${nomeCliente}

CONVERSA ATUAL:
${conversaStr}

Sua tarefa:
1. Identifique em que passo da venda a conversa está.
2. Formule 4 sugestões de resposta para avançar a venda para a próxima etapa (ex: de Problema para Solução, ou de Objeção para Fechamento).

Retorne APENAS o JSON:
{
  "dadosProposta":{"tipoCliente":"empresa|pessoa_fisica|orgao_publico|nao_identificado","nome":"","empresa":"","documento":"","email":"","endereco":"","produtos":["item c/ qtd"],"valorEstimado":"","prazo":"","observacoes":""},
  "etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido",
  "parecer": "Sua análise breve de 2 linhas sobre o momento do cliente e qual a estratégia agora.",
  "tecnicaRecomendada": "Ex: SPIN - Focar na implicação do problema",
  "sugestoes":[
    {"label":"Qualificação", "mensagem":"..."},
    {"label":"Focar na Dor", "mensagem":"..."},
    {"label":"Apresentar Solução", "mensagem":"..."},
    {"label":"Fechamento Direto", "mensagem":"..."}
  ]
}

EXEMPLOS de tom e labels (Adapte ao momento da conversa):
[MOMENTO: INÍCIO / SITUAÇÃO]
- label: "Saudação + Situação" | mensagem: "${saudacao}, ${nomeCliente}! Tudo certo? Vi que vc tem interesse nos nossos materiais. Me conta, é pra uma obra nova ou reforma?"
[MOMENTO: PROBLEMA / IMPLICAÇÃO]
- label: "Explorar Problema" | mensagem: "Entendi. E hoje como vcs tão resolvendo essa questão do acesso? Pq se demorar muito atrasa a obra toda, né?"
[MOMENTO: OBJEÇÃO DE PREÇO]
- label: "Contornar Preço" | mensagem: "Cara, eu entendo que o orçamento tá apertado. Mas essa escada já vai com ART e garantia de 10 anos. Se pegar uma mais barata sem laudo e der BO, o prejuízo é gigante. Conseguimos fechar no PIX com 7% de desconto pra te ajudar?"
[MOMENTO: FECHAMENTO]
- label: "Fechamento Imediato" | mensagem: "Show, ${nomeCliente}! O projeto tá redondo. Consigo colocar na produção amanhã cedo se a gente fechar hoje. Bora passar o cartão ou prefere PIX?"`;

  const resp = await chamarGroq({
    model: GROQ_MODEL,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 800,
  });

  const raw = resp.data?.choices?.[0]?.message?.content || '';
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error('JSON invalido: ' + raw.substring(0, 200));
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });
  try {
    const { telefone, nome, empresa, etapa } = req.body || {};
    if (!GROQ_API_KEY) return res.status(503).json({ error: 'GROQ_API_KEY nao configurada no servidor.' });

    // Verifica cache antes de chamar Groq
    const cached = telefone ? getCache(telefone) : null;
    if (cached) {
      return res.status(200).json(cached);
    }

    const mensagens = telefone ? await buscarMensagens(telefone) : [];
    const analise = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });
    const resultado = { analise, totalMensagens: mensagens.length };

    // Armazena no cache
    if (telefone) setCache(telefone, resultado);

    return res.status(200).json(resultado);
  } catch (e) {
    const is429 = e.response?.status === 429 || e.message?.includes('429');
    if (is429) {
      return res.status(429).json({ error: 'Muitas requisicoes. Aguarde alguns segundos e tente novamente.' });
    }
    console.error('[assistente-vendas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
