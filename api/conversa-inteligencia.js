import axios from 'axios';
import { selectAll } from './_lib/supabase.js';

const GROQ_API_KEY    = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY  = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY || '';
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite'
];
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];

// Mensagens enviadas ao LLM: ultimas N + algumas do inicio (onde o cliente costuma mencionar o produto).
const MAX_MSGS_CONTEXTO   = 100;
// Quantas mensagens do INICIO incluir para nao perder o produto mencionado na primeira abordagem.
const MSGS_INICIAIS       = 15;

// Max de produtos pre-filtrados enviados ao prompt da IA
const MAX_PRODUTOS_PROMPT = 30;

// Cache do catalogo compartilhado entre instancias (TTL 10 min)
const CACHE_TTL_MS = 10 * 60 * 1000;
let CACHE_PRODUTOS = { data: null, ts: 0 };

// Cache de resultados da inteligencia para evitar torrar Rate Limit global (30 RPM) da Groq
const cacheInteligencia = new Map();
const TTL_INTELIGENCIA = 180000; // 3 minutos

// Stopwords PT-BR (nao usadas como keyword de busca)
const STOPWORDS = new Set([
  'a','o','as','os','um','uma','uns','umas','de','do','da','dos','das','no','na','nos','nas',
  'em','por','para','pra','pro','com','sem','sob','sobre','entre','ate','apos','ante','per',
  'e','ou','mas','porem','contudo','todavia','se','que','qual','quais','quando','onde','como',
  'eu','tu','ele','ela','nos','vos','eles','elas','me','te','lhe','nos','vos','lhes',
  'meu','minha','teu','tua','seu','sua','nosso','nossa','deles','delas',
  'isto','isso','aquilo','este','esta','esse','essa','aquele','aquela',
  'ser','estar','ter','haver','fazer','ir','vir','ver','dar','dizer','poder','querer',
  'sim','nao','tambem','muito','pouco','mais','menos','bem','mal','ja','ainda','so','apenas',
  'ola','oi','bom','boa','dia','tarde','noite','obrigado','obrigada','por favor','favor',
  'ok','okay','blz','beleza','valeu','tudo','aqui','la','ali','entao','agora','depois','antes'
]);

// Normaliza dimensoes: "19 x 42", "19X42mm", "19 X 42" -> "19x42"
function normalizarDimensoes(s) {
  return String(s || '').replace(/(\d+)\s*[xX×]\s*(\d+)(?:\s*mm|\s*cm|\s*m)?/g, '$1x$2');
}

// Title Case: capitaliza primeira letra de cada palavra (>= 2 chars)
function tituloCase(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/\b([a-zÀ-ſ])([a-zÀ-ſ]+)/g, (_, a, b) => a.toUpperCase() + b);
}

// Normaliza texto para busca (sem acento, minusculo, apenas alfanumerico+espaco)
function normalizarTexto(s) {
  return normalizarDimensoes(String(s || ''))
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrai palavras-chave relevantes da conversa (min 3 chars, nao stopword)
function extrairPalavrasChave(texto) {
  const norm = normalizarTexto(texto);
  const palavras = norm.split(' ').filter(p => p.length >= 3 && !STOPWORDS.has(p));
  // Dedupe mantendo ordem (primeiras aparicoes ganham)
  return [...new Set(palavras)];
}

async function carregarCatalogoCompleto() {
  const agora = Date.now();
  if (CACHE_PRODUTOS.data && (agora - CACHE_PRODUTOS.ts) < CACHE_TTL_MS) return CACHE_PRODUTOS.data;

  try {
    const data = await selectAll('produtos', { limit: 1000, orderBy: 'nome' });
    const produtos = data.map(p => ({
      id:           p.id || '',
      nome:         p.nome || '',
      sku:          p.sku || '',
      preco:        Number(p.preco || 0),
      precoRegular: Number(p.preco_regular || p.precoRegular || 0),
      categoria:    p.categoria || '',
      descricao:    p.descricao || '',
    }));
    CACHE_PRODUTOS = { data: produtos, ts: agora };
    return produtos;
  } catch (err) {
    console.warn('[conversa-inteligencia] falha ao carregar catalogo:', err.message);
    return [];
  }
}

// Pontua cada produto baseado em quantas palavras-chave da conversa matcham
function filtrarProdutosRelevantes(produtos, palavrasChave, limite = MAX_PRODUTOS_PROMPT) {
  if (!palavrasChave.length || !produtos.length) return [];

  const scored = produtos.map(p => {
    const nomeN = normalizarTexto(p.nome);
    const skuN  = normalizarTexto(p.sku);
    const catN  = normalizarTexto(p.categoria);
    const descN = normalizarTexto(p.descricao);
    let score = 0;
    for (const palavra of palavrasChave) {
      if (nomeN.includes(palavra)) score += 3;
      if (skuN.includes(palavra))  score += 4;
      if (catN.includes(palavra))  score += 2;
      if (descN.includes(palavra)) score += 1;
    }
    return { p, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(s => s.p);
}

// Extrai alternativas (telefones, emails, cnpjs, cpfs, ceps) da conversa bruta
function extrairAlternativas(textoConversa) {
  const texto = String(textoConversa || '');

  const telefones = new Set();
  const reTel = /\+?[\d][\d\s\-\(\)]{8,18}\d/g;
  let m;
  while ((m = reTel.exec(texto)) !== null) {
    let digits = m[0].replace(/\D/g, '');
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    if (digits.length < 10 || digits.length > 11) continue;
    if (digits.startsWith('0')) continue;
    telefones.add(digits);
  }

  const emails = new Set();
  const reEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((m = reEmail.exec(texto)) !== null) emails.add(m[0].toLowerCase());

  const cnpjs = new Set();
  const reCNPJ = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
  while ((m = reCNPJ.exec(texto)) !== null) {
    const c = m[1].replace(/\D/g, '');
    if (c.length === 14) cnpjs.add(c);
  }

  const cpfs = new Set();
  const reCPF = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/g;
  while ((m = reCPF.exec(texto)) !== null) {
    const c = m[1].replace(/\D/g, '');
    if (c.length === 11) cpfs.add(c);
  }

  const ceps = new Set();
  const reCEP = /\b(\d{5}-?\d{3})\b/g;
  while ((m = reCEP.exec(texto)) !== null) {
    const c = m[1].replace(/\D/g, '');
    if (c.length === 8) ceps.add(c);
  }

  return {
    telefones: [...telefones],
    emails: [...emails],
    cnpjs: [...cnpjs],
    cpfs: [...cpfs],
    ceps: [...ceps],
  };
}

async function buscarMensagens(telefone) {
  try {
    const data = await selectAll('mensagens', { filters: { telefone: `eq.${telefone}` }, orderBy: 'criado_em', limit: 200 });
    return data.map(m => ({
      texto:    m.texto || m.conteudo || '',
      criadoEm: m.criado_em || m.created_at || '',
      tipo:     m.tipo || 'entrada',
    }))
    .filter(m => m.texto.trim())
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
  } catch (err) {
    console.error('[conversa-inteligencia] erro buscarMensagens:', err.message);
    return [];
  }
}

function recortarConversaAtual(mensagens) {
  if (!mensagens.length) return [];
  if (mensagens.length <= MAX_MSGS_CONTEXTO) return mensagens;
  const iniciais = mensagens.slice(0, MSGS_INICIAIS);
  const finaisQtd = MAX_MSGS_CONTEXTO - MSGS_INICIAIS;
  const finais = mensagens.slice(-finaisQtd);
  return [...iniciais, ...finais];
}

async function buscarProdutosRelevantes(conversaTexto) {
  try {
    const todos = await carregarCatalogoCompleto();
    const palavrasChave = extrairPalavrasChave(conversaTexto);
    if (!todos.length) return { produtos: [], totalCatalogo: 0, palavrasChave };
    const relevantes = filtrarProdutosRelevantes(todos, palavrasChave, MAX_PRODUTOS_PROMPT);
    return { produtos: relevantes, totalCatalogo: todos.length, palavrasChave };
  } catch {
    return { produtos: [], totalCatalogo: 0, palavrasChave: [] };
  }
}

async function consultarCNPJ(cnpj) {
  try {
    const limpo = cnpj.replace(/\D/g, '');
    if (limpo.length !== 14) return null;
    const res = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`, { timeout: 5000 });
    const d = res.data;
    return {
      razaoSocial: d.razao_social || '',
      nomeFantasia: d.nome_fantasia || '',
      cnpj: limpo,
      inscricaoEstadual: d.inscricoes_estaduais?.[0]?.inscricao_estadual || '',
      logradouro: d.logradouro || '',
      numero: d.numero || '',
      bairro: d.bairro || '',
      cidade: d.municipio || '',
      uf: d.uf || '',
      cep: d.cep || '',
    };
  } catch {
    return null;
  }
}

async function consultarCEP(cep) {
  try {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return null;
    const res = await axios.get(`https://viacep.com.br/ws/${limpo}/json/`, { timeout: 5000 });
    if (res.data.erro) return null;
    const d = res.data;
    return {
      logradouro: d.logradouro || '',
      bairro: d.bairro || '',
      cidade: d.localidade || '',
      uf: d.uf || '',
      cep: limpo,
    };
  } catch {
    return null;
  }
}

async function analisarConversaComGroq(conversa, produtosRelevantes, leadInfo, metaCatalogo = {}) {
  if (!GROQ_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) {
    throw new Error('Nenhuma API KEY (Groq, Gemini ou OpenAI) configurada no servidor');
  }

  const catalogoResumo = produtosRelevantes.length > 0
    ? produtosRelevantes.map(p => {
        const preco = Number(p.preco || p.precoRegular || 0);
        const precoStr = preco > 0 ? `R$${preco.toFixed(2)}` : 's/preco';
        const cat = p.categoria ? ` [${p.categoria}]` : '';
        return `- ${p.nome} (SKU: ${p.sku}) ${precoStr}${cat}`;
      }).join('\n')
    : (metaCatalogo.totalCatalogo > 0
        ? `(nenhum produto do catalogo (${metaCatalogo.totalCatalogo} cadastrados) deu match nas palavras da conversa)`
        : '(catalogo vazio)');

  const leadCtx = [];
  if (leadInfo.nome) leadCtx.push(`Nome do contato no CRM: "${leadInfo.nome}"`);
  if (leadInfo.empresa) leadCtx.push(`Empresa do lead no CRM: "${leadInfo.empresa}"`);
  const leadContexto = leadCtx.length > 0
    ? `\n\nDADOS JA CONHECIDOS DO LEAD (use como base, atualize se a conversa trouxer dados mais recentes):\n${leadCtx.join('\n')}`
    : '';

  const prompt = `Voce e um assistente de vendas da CDS Industrial (metalurgia / caldeiraria / estruturas metalicas).
Analise a conversa de WhatsApp abaixo e extraia TODOS os dados que conseguir identificar.

CATALOGO DE PRODUTOS PADRAO da empresa:
${catalogoResumo}
${leadContexto}

REGRAS:
0. NUNCA INVENTE PRODUTOS. Se o cliente nao mencionou um produto especifico, deixe "produtos" como array vazio []. Nao escolha um produto aleatorio do catalogo.
1. Se o cliente mencionar um produto que EXISTE EXATAMENTE no catalogo acima, use o nome e preco do catalogo (campo "produtoPadrao": true). Faca o match literal pelo que foi dito.
1.1. SEMPRE escreva o nome do produto em Title Case (Primeira Letra de Cada Palavra Maiuscula). Ex: "Prego 19x42", "Chapa Galvanizada 1.5mm". NUNCA em CAIXA ALTA total nem tudo minusculo.
2. Se o cliente mencionar um produto mas o match no catalogo NAO FOR EXATO (voce nao tem certeza de qual e), marque "produtoPadrao": false.
2.1. PREENCHA a lista "opcoesSugeridas" com ate 3 produtos do catalogo que mais se assemelham, incluindo a "probabilidade" (0 a 100) de ser o item desejado.
3. NOME DO PRODUTO: Inclua TODAS as especificacoes mencionadas pelo cliente.
4. DESCRICAO DO PRODUTO: Coloque todos os detalhes tecnicos.
5. Extraia CNPJ, CPF, CEP, endereco, inscricao estadual se mencionados.
6. DADOS ESTRUTURADOS: Se o cliente enviar uma mensagem em formato estruturado, EXTRAIA TODOS esses campos.
7. CNPJ DA EMPRESA vs CLIENTE: Se for o CNPJ da CDS, ignore para o cliente.
8. Se dados estao incompletos, liste em "camposFaltando".
9. Avalie "confianca" global de 0 a 100.
10. CLIENTE: Prefira o nome que o cliente informou na conversa.

Conversa:
${conversa}

Responda APENAS com JSON valido no formato:
{
  "cliente": { "nome": "string", "empresa": "string", "telefone": "string", "email": "string", "cnpj": "string", "cpf": "string", "inscricaoEstadual": "string", "cep": "string", "logradouro": "string", "numero": "string", "bairro": "string", "cidade": "string", "uf": "string" },
  "produtos": [ { "nome": "string", "descricao": "string", "quantidade": 1, "unidade": "UN", "precoUnitario": 0, "produtoPadrao": true, "skuCatalogo": "string", "opcoesSugeridas": [ { "nome": "string", "sku": "string", "precoUnitario": 0, "probabilidade": 90 } ] } ],
  "observacoes": "string",
  "resumoConversa": "string",
  "camposFaltando": ["string"],
  "confianca": number,
  "prontoParaProposta": boolean
}`;

  const body = {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  };
  const headers = {
    'Authorization': `Bearer ${GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  };
  
  let response;
  let lastError;

  // TIER 1: Google Gemini Models
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1200, responseMimeType: "application/json" }
        };
        const geminiResp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
        const content = geminiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        response = { data: { choices: [{ message: { content } }], model } };
        break; // Sucesso
      } catch (err) {
        console.log(`[conversa-inteligencia] Gemini (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 2: Groq Fallback (Arsenal)
  if (!response && GROQ_API_KEY) {
    console.log('[conversa-inteligencia] Tentando fallback na rede Groq...');
    for (const model of GROQ_MODELS) {
      try {
        body.model = model;
        response = await axios.post('https://api.groq.com/openai/v1/chat/completions', body, { headers, timeout: 30000 });
        break; // Sucesso, quebra o loop
      } catch (err) {
        console.log(`[conversa-inteligencia] Groq (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 3: OpenAI Fallback
  if (!response && OPENAI_API_KEY) {
    console.log('[conversa-inteligencia] Tentando fallback final na OpenAI...');
    try {
      body.model = 'gpt-4o-mini';
      const openaiHeaders = {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      };
      response = await axios.post('https://api.openai.com/v1/chat/completions', body, { headers: openaiHeaders, timeout: 30000 });
    } catch (err) {
      lastError = err;
    }
  }

  if (!response) throw lastError || new Error('Nenhum provedor de IA conseguiu responder.');

  const text = response.data?.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('IA retornou resposta invalida.');
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  const { telefone, leadNome, leadEmpresa } = req.body || {};
  if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });

  const tel = String(telefone).replace(/\D/g, '');

  try {
    const mensagens = await buscarMensagens(tel);
    const conversaAtual = recortarConversaAtual(mensagens);
    
    if (!conversaAtual.length) {
      return res.status(200).json({
        ok: true,
        analise: {
          cliente: { nome: leadNome || null, empresa: leadEmpresa || null },
          produtos: [],
          observacoes: '',
          resumoConversa: 'Sem mensagens recentes',
          camposFaltando: [],
          confianca: 10,
          prontoParaProposta: true,
        },
        totalMensagens: 0,
      });
    }

    const conversaFormatada = conversaAtual
      .map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`)
      .join('\n');

    const textoCliente = mensagens
      .filter(m => m.tipo === 'entrada')
      .map(m => m.texto)
      .join(' ') || conversaFormatada;
      
    const { produtos: produtosRelevantes, totalCatalogo, palavrasChave } =
      await buscarProdutosRelevantes(textoCliente);

    const alternativas = extrairAlternativas(textoCliente);
    if (tel && !alternativas.telefones.includes(tel)) alternativas.telefones.unshift(tel);

    const cacheKey = `intel_${tel}_${mensagens.length}`;
    const cacheEntry = cacheInteligencia.get(cacheKey);
    let analise;
    
    if (cacheEntry && Date.now() - cacheEntry.ts < TTL_INTELIGENCIA) {
      analise = cacheEntry.data;
    } else {
      analise = await analisarConversaComGroq(conversaFormatada, produtosRelevantes, {
        nome: leadNome || '',
        empresa: leadEmpresa || '',
      }, { totalCatalogo });
      
      cacheInteligencia.set(cacheKey, { data: analise, ts: Date.now() });
      if (cacheInteligencia.size > 50) {
        const oldest = [...cacheInteligencia.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) cacheInteligencia.delete(oldest[0]);
      }
    }

    if (!analise.cliente.nome && leadNome) analise.cliente.nome = leadNome;
    if (!analise.cliente.empresa && leadEmpresa) analise.cliente.empresa = leadEmpresa;
    if (!analise.cliente.telefone) analise.cliente.telefone = tel;
    if (!analise.cliente.cpf && alternativas.cpfs[0])  analise.cliente.cpf = alternativas.cpfs[0];
    if (!analise.cliente.cnpj && alternativas.cnpjs[0]) analise.cliente.cnpj = alternativas.cnpjs[0];
    if (!analise.cliente.cep && alternativas.ceps[0])   analise.cliente.cep = alternativas.ceps[0];
    if (!analise.cliente.email && alternativas.emails[0]) analise.cliente.email = alternativas.emails[0];

    let dadosCNPJ = null;
    if (analise.cliente?.cnpj) {
      dadosCNPJ = await consultarCNPJ(analise.cliente.cnpj);
      if (dadosCNPJ) {
        analise.cliente.razaoSocial = dadosCNPJ.razaoSocial;
        analise.cliente.nomeFantasia = dadosCNPJ.nomeFantasia;
        analise.cliente.inscricaoEstadual = analise.cliente.inscricaoEstadual || dadosCNPJ.inscricaoEstadual;
        if (!analise.cliente.logradouro) {
          analise.cliente.logradouro = dadosCNPJ.logradouro;
          analise.cliente.numero = dadosCNPJ.numero;
          analise.cliente.bairro = dadosCNPJ.bairro;
          analise.cliente.cidade = dadosCNPJ.cidade;
          analise.cliente.uf = dadosCNPJ.uf;
          analise.cliente.cep = dadosCNPJ.cep;
        }
      }
    }

    if (analise.cliente?.cep && !dadosCNPJ) {
      const dCEP = await consultarCEP(analise.cliente.cep);
      if (dCEP) {
        analise.cliente.logradouro = analise.cliente.logradouro || dCEP.logradouro;
        analise.cliente.bairro = analise.cliente.bairro || dCEP.bairro;
        analise.cliente.cidade = analise.cliente.cidade || dCEP.cidade;
        analise.cliente.uf = analise.cliente.uf || dCEP.uf;
      }
    }

    if (analise.produtos?.length) {
      // Garante Title Case em todos os nomes de produto retornados pela IA
      for (const item of analise.produtos) {
        if (item.nome) item.nome = tituloCase(item.nome);
      }
      const catalogoCompleto = CACHE_PRODUTOS.data || produtosRelevantes;
      for (const item of analise.produtos) {
        const nomeItem = (item.nome || '').toLowerCase();
        const match = catalogoCompleto.find(p => {
          const n = (p.nome || '').toLowerCase();
          return n && (n.includes(nomeItem) || nomeItem.includes(n));
        });
        if (match) {
          item.precoUnitario = item.precoUnitario || match.preco || match.precoRegular;
          item.produtoId = match.id;
          item.skuCatalogo = match.sku;
          item.nomeCatalogo = match.nome;
        }
      }
    }

    analise.prontoParaProposta = true;

    return res.status(200).json({
      ok: true,
      analise,
      alternativas,
      totalMensagens: mensagens.length,
      mensagensUsadas: conversaAtual.length,
      produtosCatalogo: totalCatalogo,
      produtosRelevantes: produtosRelevantes.length,
      palavrasChaveBusca: palavrasChave.slice(0, 20),
      modelo: 'multi-provedor',
    });

  } catch (err) {
    console.error('Erro conversa-inteligencia:', err.message);
    const msg = err.response?.data?.error?.message || err.message || 'Erro interno';
    return res.status(200).json({
      ok: true,
      analise: {
        cliente: { nome: leadNome || null, telefone: tel, empresa: leadEmpresa || null },
        produtos: [],
        resumoConversa: `[DEBUG IA] ${msg}`,
        confianca: 5,
        prontoParaProposta: false,
      },
      aviso: `[DEBUG IA] ${msg}`,
    });
  }
}
