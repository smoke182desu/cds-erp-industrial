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

// Retry com backoff para lidar com 429 (rate limit)
async function chamarGroqComRetry(payload, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await axios.post(`${GROQ_BASE_URL}/chat/completions`, payload, {
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      return resp;
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && i < tentativas - 1) {
        // Pega o retry-after do header ou usa backoff exponencial
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0');
        const delay = retryAfter > 0 ? retryAfter * 1000 : (i + 1) * 3000;
        console.warn(`[assistente] 429 rate limit, aguardando ${delay}ms (tentativa ${i + 1}/${tentativas})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
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

  const systemPrompt = `Voce e o assistente de vendas de JEAN da CDS Industrial em Brasilia/DF.
Analise a conversa e retorne APENAS JSON valido, sem markdown, sem explicacoes.

REGRA DE OURO: Escreva EXATAMENTE como um brasileiro de Brasilia escreve no WhatsApp.
- Use "vc" em vez de "voce", "pra" em vez de "para", "ta" em vez de "esta"
- Use expressoes naturais: "show", "beleza", "tranquilo", "massa", "fechou", "bora"
- Seja caloroso e direto, como um amigo que entende do assunto
- NUNCA use linguagem corporativa ou robotica
- Escreva como se tivesse mandando audio transcrito: natural, fluido, humano
- Use "a gente" em vez de "nos", "ce" ou "vc" em vez de "voce"`;

  const userPrompt = `Assiste o vendedor JEAN da CDS Industrial (Brasilia/DF).
${CONHECIMENTO_EMPRESA}${extra}
LEAD: nome="${lead.nome || ''}" empresa="${lead.empresa || ''}" etapa=${etapa}
HORARIO: ${saudacao} | NOME CLIENTE: ${nomeCliente}

CONVERSA:
${conversaStr}

Retorne APENAS JSON:
{
  "dadosProposta":{"tipoCliente":"empresa|pessoa_fisica|orgao_publico|nao_identificado","nome":"","empresa":"","documento":"","email":"","endereco":"","produtos":["item c/ qtd e medidas"],"valorEstimado":"","prazo":"","observacoes":"1 frase curta"},
  "etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido",
  "sugestoes":[
    {"label":"saudacao","mensagem":"(saudacao com ${saudacao} + nome)"},
    {"label":"cordial","mensagem":"(resposta amigavel e natural)"},
    {"label":"tecnica","mensagem":"(fala sobre o produto de forma simples)"},
    {"label":"urgencia","mensagem":"(cria senso de oportunidade)"}
  ]
}

EXEMPLO de tom correto:
- "${saudacao}, ${nomeCliente}! Tudo certo? Vi que vc se interessou pelo nosso material, vou te passar tudo certinho!"
- "Show, ${nomeCliente}! Essa escada a gente faz sob medida, com ART inclusa. Quer que eu mande as opcoes pra vc?"
- "Massa! Olha, to com uma condicao especial essa semana - PIX sai 7% OFF. Bora fechar?"
- "Tranquilo, ${nomeCliente}! A gente entrega no Brasil todo. Me passa as medidas que ja monto o orcamento pra vc"

REGRAS:
- Primeira sugestao: saudacao usando "${saudacao}, ${nomeCliente}!" + frase natural brasileira
- Tom: vendedor brasiliense no WhatsApp, como se fosse amigo do cliente
- Maximo 3 linhas, ate 250 chars
- Cite produto quando fizer sentido
- 4 sugestoes diferentes (saudacao/cordial/tecnica/urgencia)`;

  const resp = await chamarGroqComRetry({
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
    const mensagens = telefone ? await buscarMensagens(telefone) : [];
    const analise = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });
    return res.status(200).json({ analise, totalMensagens: mensagens.length });
  } catch (e) {
    const is429 = e.response?.status === 429 || e.message?.includes('429');
    if (is429) {
      return res.status(429).json({ error: 'Muitas requisicoes. Aguarde alguns segundos e tente novamente.' });
    }
    console.error('[assistente-vendas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
