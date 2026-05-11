import axios from 'axios';
import { selectAll, update } from './_lib/supabase.js';

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const PROMPT_VERSION = 'momento-conversa-v4';

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
Produtos: chapas dobradas, pecas em metalon/tubo/chapa, pes de mesa, carrinhos, tampas para casas de maquinas, containers de lixo, escadas/rampas (ABNT/NR+ART), bancadas e projetos sob encomenda.
Capacidades: solda MIG e eletrica; dobra de chapas ate 6,35mm; corte reto em guilhotina; dobradeira e guilhotina de 3m; pintura com compressor industrial em tinta epoxi, esmalte sintetico ou PU.
Limites: nao fazemos plasma, oxicorte ou cortes curvos/recortados; pecas passam de 3m somente com emenda/solda. Materiais: aluminio, aco carbono, aco galvanizado, inox 430 e inox 304. Aco carbono 1010/1020; chapa acima de 14 geralmente A36.
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
  return `assistente_${PROMPT_VERSION}_${telefone}_${mensagens.length}_${ultima.tipo || ''}_${ultima.criadoEm || ''}_${ultima.texto || ''}`;
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

function removerSaudacao(texto) {
  return String(texto || '')
    .replace(/^(oi|ola|olá)[!,.\s-]*/i, '')
    .replace(/^(bom dia|boa tarde|boa noite)[!,.\s-]*/i, '')
    .trim();
}

function encurtarMensagem(texto, maxPalavras = 14) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  const palavras = limpo.split(' ').filter(Boolean);
  if (palavras.length <= maxPalavras) return limpo;

  const primeiraFrase = limpo.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (primeiraFrase && primeiraFrase.split(' ').length <= maxPalavras) return primeiraFrase;
  const curta = palavras.slice(0, maxPalavras).join(' ');
  return limpo.includes('?') ? `${curta}?` : curta;
}

function pareceMedidaCurta(texto) {
  return /^\s*\d+([.,]\d+)?\s*[xX]\s*\d+([.,]\d+)?\s*$/.test(String(texto || ''));
}

function sugestoesDepoisDaRespostaDoJean(ultimaMensagem) {
  const texto = String(ultimaMensagem?.texto || '').trim();
  if (pareceMedidaCurta(texto)) {
    return [
      { label: 'Aguardar retorno', mensagem: 'Fico no aguardo da confirmação.' },
      { label: 'Complementar medida', mensagem: 'Essa é a medida do modelo fabricado.' },
      { label: 'Confirmar configuração', mensagem: 'Ele vai com pneus, conforme conversamos.' },
      { label: 'Próximo passo', mensagem: 'Se aprovar, calculo valor e prazo.' },
    ];
  }

  return [
    { label: 'Aguardar retorno', mensagem: 'Fico no aguardo.' },
    { label: 'Complementar', mensagem: 'Posso complementar com mais detalhes.' },
    { label: 'Próximo passo', mensagem: 'Se fizer sentido, avanço com o orçamento.' },
    { label: 'Confirmar', mensagem: 'Pode me confirmar se ficou claro?' },
  ];
}

function normalizarSugestoes(analise, saudacao, precisaSaudacao, contexto = {}) {
  if (contexto.ultimaMensagem?.tipo === 'saida') {
    analise.sugestoes = sugestoesDepoisDaRespostaDoJean(contexto.ultimaMensagem);
  }

  if (!Array.isArray(analise?.sugestoes) || analise.sugestoes.length === 0) {
    return analise;
  }

  for (const sugestao of analise.sugestoes) {
    sugestao.mensagem = encurtarMensagem(removerSaudacao(sugestao.mensagem));
  }

  if (!precisaSaudacao) {
    if (String(analise.sugestoes[0]?.label || '').toLowerCase() === 'saudacao') {
      analise.sugestoes[0].label = 'Responder';
    }
    return analise;
  }

  const primeira = analise.sugestoes[0];
  const semSaudacaoAntiga = removerSaudacao(primeira?.mensagem || '');

  primeira.label = 'saudacao';
  primeira.mensagem = encurtarMensagem(semSaudacaoAntiga ? `${saudacao}! ${semSaudacaoAntiga}` : `${saudacao}!`, 16);
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
  const ultimaMensagemCliente = [...ultimas].reverse().find(m => m.tipo !== 'saida');
  const ultimaMensagemJean = [...ultimas].reverse().find(m => m.tipo === 'saida');
  const conversaJaIniciadaPeloJean = mensagens.some(m => m.tipo === 'saida');
  const precisaSaudacao = (!ultimaMensagem || ultimaMensagem.tipo !== 'saida') && !conversaJaIniciadaPeloJean;

  let observacoesAtuais = lead.observacoes || '';
  let memoriaAtual = '';
  const memMatch = observacoesAtuais.match(/\[MEMÓRIA IA\]([\s\S]*?)(\n\n|$)/);
  if (memMatch) {
    memoriaAtual = memMatch[1].trim();
  }

  const systemPrompt = `Voce e a inteligencia central da CDS Industrial. Sua missao e operar dois funcionarios IA contratados.

FUNCIONARIOS IA:
- Giorno Giovanna, Operador de Vendas IA: vendedor profissional, educado, objetivo e tecnico. Atua somente nas sugestoes para o WhatsApp do cliente.
- Bruno Bucciarati, Gerente de Vendas IA: gerente comercial senior. Administra os atendimentos, avalia oportunidades, identifica produtos para cadastrar/fabricar e fala internamente com o dono.

Cada funcionario deve agir com informacoes atuais e relevantes do cargo. Giorno vende com clareza e perguntas curtas. Bruno pensa como gerente de vendas industrial, sem floreios, separando atendimento normal, produto de catalogo, sob medida e oportunidade de novo produto.

Sua PRIMEIRA TAREFA ABSOLUTA é a TRIAGEM DE CONTEXTO para ativar o avatar correto:

1. [GIORNO VENDEDOR] -> O contato quer COMPRAR escadas/materiais?
- Ative Giorno Giovanna, Operador de Vendas IA.
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
- Tom: educado, profissional e direto. Sem floreios, sem exagero e sem gírias forçadas.
- Pode usar linguagem simples de WhatsApp, mas mantenha postura comercial séria.
- Só use saudação ("Bom dia", "Boa tarde", "Boa noite") se o JEAN ainda não respondeu nenhuma vez nesta conversa.
- Se a conversa já começou, NUNCA repita saudação; responda direto ao assunto.
- REGRA DE OURO: frases de WhatsApp real, curtíssimas. Máximo de 8 a 12 palavras por sugestão. Nada de parágrafo.
- Evite tom de robô/consultor. Pergunte apenas o próximo dado necessário.
- MANTENHA O CONTROLE: Termine a sugestão com uma pergunta ou diretriz que faça a conversa avançar no sentido estratégico do Avatar ativo.

Analise o momento exato da conversa e retorne APENAS um JSON válido.`;

  const userPrompt = `Contexto da CDS Industrial (Brasília/DF - Vendedor: JEAN):
${CONHECIMENTO_EMPRESA}${extra}
LEAD: nome="${lead.nome || ''}" empresa="${lead.empresa || ''}" etapa=${etapa}
HORÁRIO: ${saudacao} | NOME CLIENTE: ${nomeCliente}
SAUDAÇÃO: ${precisaSaudacao ? 'usar "' + saudacao + '!" apenas na sugestão 1' : 'não usar saudação; conversa já iniciada ou Jean acabou de responder'}

MEMÓRIA DE LONGO PRAZO DA IA (LTM):
${memoriaAtual ? memoriaAtual : '(Nenhuma memória anterior registrada para este contato. Inicie a análise do zero.)'}

CONVERSA ATUAL:
${conversaStr}

MOMENTO EXATO:
- Ultima mensagem geral: ${ultimaMensagem ? `[${ultimaMensagem.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}] ${ultimaMensagem.texto}` : '(nenhuma)'}
- Ultima pergunta/pedido do cliente: ${ultimaMensagemCliente ? ultimaMensagemCliente.texto : '(nenhum)'}
- Ultima resposta do Jean: ${ultimaMensagemJean ? ultimaMensagemJean.texto : '(nenhuma)'}

CAPACIDADES E LIMITES DA FABRICA:
- Somos fabricantes; fazemos produtos sob medida em metal, solda MIG e eletrica.
- Dobramos chapas ate 6,35mm de espessura.
- Cortamos em guilhotina: somente cortes retos. Nao oferecer plasma, oxicorte, laser, jato d'agua, cortes curvos ou recortes internos.
- Guilhotina e dobradeira tem 3m. Pecas maiores que 3m so com emenda/solda, deixando isso claro.
- Pintura com compressor industrial: tinta epoxi, esmalte sintetico ou PU.
- Materiais trabalhados: aluminio, aco carbono, aco galvanizado, inox 430 e inox 304.
- Acos usuais: 1010/1020; chapa acima de 14 geralmente A36.
- Produtos recorrentes: chapas dobradas, estruturas em metalon/tubos/chapa, carrinhos, tampas para casas de maquinas, containers de lixo, pes de mesa e fabricacoes metalicas sob medida.

QUESTIONARIO IDEAL POR FAMILIA:
- Carrinho: perguntar o que transporta, peso em kg, piso/ambiente, dimensoes, lateral/grade/berco, manual/eletrico. Uma pergunta por vez.
- Vaso/cachepot/jardim: nao tratar como carrinho plataforma, mesmo se tiver rodas. Se aparecer "vaso", "jardim" ou "paisagismo", e produto de paisagismo/cachepot, nao carrinho.
- Tampa/bandeja: perguntar vao livre, local, carga sobre a tampa, dobradica/removivel, acabamento.
- Chapa/corte/dobra: perguntar medida, espessura, dobras/abas, material, quantidade, acabamento.
- Pes/base de mesa: identificar como pe/base para mesa, nao como tampa. Se ja houver quantidade, medida e nivelador, nao repetir. Perguntar apenas material, perfil/espessura, acabamento ou confirmar que vai calcular valor e prazo.
- Bancada/base/mesa: perguntar uso/equipamento, peso, medida, tampo, acabamento.
- Estante: perguntar o que guarda, peso por prateleira, niveis, dimensoes, ambiente.
- Sob medida em aco: a CDS fabrica qualquer produto em aco sob medida. Pergunte finalidade, medidas, carga, ambiente, acabamento e quantidade.

PAPEL DO GERENTE DE VENDAS IA (BRUNO BUCCIARATI):
- Avaliar se esta conversa indica produto novo ideal para fabricar/cadastrar.
- Distinguir caso isolado de demanda com potencial recorrente.
- Sugerir ao dono ação objetiva: acompanhar, cadastrar produto, criar protótipo, tratar como sob medida ou priorizar orçamento.
- Indicar quais dados faltam para transformar a demanda em produto vendável.
- Nunca exagerar. Se não houver oportunidade clara, diga que é atendimento normal.

Sua tarefa:
1. Avalie a conversa atual levando em consideração a MEMÓRIA DE LONGO PRAZO (se existir) para não ser repetitivo e entender o contexto histórico.
2. Formule 4 sugestões TÁTICAS e ORIGINAIS de resposta que façam sentido PARA ESTE EXATO SEGUNDO da conversa.
2.1. As perguntas precisam ter lógica: não pergunte dado que o cliente já respondeu. Escolha o próximo dado técnico necessário para identificar produto de catálogo ou sob medida.
3. Gere uma leitura interna do GERENTE DE VENDAS IA para o dono, focada em produto, demanda e próxima decisão.
4. Gere uma "novaMemoria" que seja um resumo denso de tudo que você aprendeu sobre esse contato até o momento (junte o que já sabia com o que descobriu agora na conversa atual). Foque no perfil psicológico, dores e estágio da negociação.

REGRA PARA PEDIDO DE VALOR/PRAZO:
- Quando o cliente pedir valor e prazo de um item ja claro, responda nessa direcao.
- Nao volte para perguntas iniciais nem troque a familia do produto.
- Exemplo: "2 pes para mesa de granito 75x64, sem niveladores" e pe/base de mesa sob medida em metal, nao tampa.
- Sugestoes boas: confirmar material/acabamento, informar que vai calcular valor e prazo para o CEP, ou pedir espessura/perfil se faltar.

REGRA DE MOMENTO:
- As sugestoes devem responder ao MOMENTO EXATO.
- Se a ultima mensagem geral for do JEAN, nao aja como se o cliente tivesse acabado de perguntar de novo.
- Nesse caso, sugira apenas complemento natural, correcao, proximo passo ou aguardar.
- Se o cliente pediu uma medida e Jean acabou de responder a medida, nao pergunte uso/peso/piso como se nada tivesse sido respondido.
- Continue do ponto atual da conversa.

Retorne APENAS o JSON:
{
  "dadosProposta":{"tipoCliente":"empresa|pessoa_fisica|orgao_publico|nao_identificado","nome":"","empresa":"","documento":"","email":"","endereco":"","produtos":["item c/ qtd"],"valorEstimado":"","prazo":"","observacoes":""},
  "etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido|pos_venda|nao_se_aplica|funcionario|fornecedor",
  "parecer": "Sua análise estratégica focada no perfil (Venda, Funcionário ou Pessoal), tom e próximo passo lógico.",
  "tecnicaRecomendada": "Ex: SPIN (se venda) OU Gestão de Conflitos (se funcionário) OU Rapport (se amigo)",
  "diretorVendas": {
    "nivelOportunidade": "baixo|medio|alto",
    "tipoDemanda": "catalogo|sob_medida|novo_produto|atendimento_normal",
    "produtoSugerido": "",
    "recomendacaoDono": "Orientacao curta e objetiva para o dono.",
    "dadosFaltantesProduto": ["medida", "carga", "quantidade"],
    "acaoInterna": "acompanhar|cadastrar_produto|criar_prototipo|orcamento_sob_medida|sem_acao"
  },
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
4. SAUDAÇÃO: Só use label "saudacao" quando SAUDAÇÃO acima mandar usar. Caso contrário, nenhuma sugestão pode começar com "oi", "olá", "bom dia", "boa tarde" ou "boa noite".
5. TAMANHO: Cada "mensagem" deve ter no máximo 12 palavras. Quanto mais curta, melhor.
6. SOB MEDIDA: Se não houver produto padrão claro, conduza como orçamento sob medida em aço, sem dizer que "não temos".
7. TOM: Profissional e educado. Proibido: "kkk", "blz", "show demais", "top", "meu querido".
8. GERENTE DE VENDAS IA: O campo "diretorVendas" é interno para o dono. Seja objetivo, como gerente comercial experiente.
9. OPORTUNIDADE: Use "novo_produto" só quando a demanda parecer vendável para outros clientes. Caso isolado vira "sob_medida".

EXEMPLOS DE TOM (INSPIRAÇÃO APENAS - NÃO COPIE):
[MOMENTO: VENDAS - PROBLEMA]
- label: "Explorar Produto" | mensagem: "Certo. Qual produto e qual medida precisa?"
[MOMENTO: VENDAS - FECHAMENTO]
- label: "Condição" | mensagem: "Consigo melhorar no PIX. Pode ser assim?"
[MOMENTO: FUNCIONÁRIO - ALINHAMENTO]
- label: "Cobrar Posição" | mensagem: "Que horas vc chega? Preciso organizar a entrega."
[MOMENTO: AMIGO / PESSOAL - NATURAL]
- label: "Papo" | mensagem: "Entendi. Como ficou isso no final?"

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

  analise = normalizarSugestoes(analise, saudacao, precisaSaudacao, { ultimaMensagem });

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
