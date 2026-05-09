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

  const systemPrompt = `Voce e o assistente de vendas de JEAN da CDS Industrial. Analise a conversa e retorne APENAS JSON valido, sem markdown, sem explicacoes.
IMPORTANTE: As mensagens sugeridas devem ser CORDIAIS, AMIGAVEIS e PROFISSIONAIS. Use um tom caloroso e acolhedor, como um vendedor que se importa genuinamente com o cliente. Nao seja robotico nem frio.`;
  const userPrompt = `Assiste o vendedor JEAN da CDS Industrial.
${CONHECIMENTO_EMPRESA}${extra}
LEAD atual: nome="${lead.nome || ''}" empresa="${lead.empresa || ''}" etapa=${etapa}
HORARIO ATUAL: ${saudacao} (usar esta saudacao nas mensagens quando apropriado)
NOME DO CLIENTE (primeiro nome): ${nomeCliente}

CONVERSA:
${conversaStr}

Retorne APENAS JSON:
{
  "dadosProposta":{"tipoCliente":"empresa|pessoa_fisica|orgao_publico|nao_identificado","nome":"","empresa":"","documento":"","email":"","endereco":"","produtos":["item c/ qtd e medidas"],"valorEstimado":"","prazo":"","observacoes":"1 frase curta p/ proposta"},
  "etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido",
  "sugestoes":[{"label":"saudacao","mensagem":"saudacao inicial cordial com ${saudacao} e nome do cliente"},{"label":"cordial","mensagem":"resposta cordial e acolhedora"},{"label":"tecnica","mensagem":"resposta com detalhes tecnicos do produto"},{"label":"urgencia","mensagem":"resposta criando senso de oportunidade"}]
}
REGRAS:
- A PRIMEIRA sugestao DEVE ser uma saudacao inicial usando "${saudacao}, ${nomeCliente}!" seguida de uma frase acolhedora
- Todas as mensagens devem ser CORDIAIS e AMIGAVEIS, como se Jean fosse um amigo ajudando
- Use expressoes como "fico feliz", "sera um prazer", "pode contar comigo", "estou aqui pra te ajudar"
- Tom WhatsApp natural, maximo 3 linhas, <=250 chars
- Cite produto quando relevante
- 4 sugestoes com angulos diferentes (saudacao/cordial/tecnica/urgencia)
- Sem emoji no nome do JSON`;

  const resp = await axios.post(`${GROQ_BASE_URL}/chat/completions`, {
    model: GROQ_MODEL,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 800,
  }, {
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 30000,
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
    console.error('[assistente-vendas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
