import axios from 'axios';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Groq - modelo gratuito (14.400 req/dia)
const GROQ_MODEL = 'llama-3.1-8b-instant';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID      = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0908948294';
const DATABASE_ID     = process.env.FIREBASE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const GROQ_API_KEY    = process.env.GROQ_API_KEY || '';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// Pega as ultimas N mensagens sem filtro de tempo — clientes frequentemente retomam
// conversas dias/semanas depois e os dados (CPF, endereco, produto) estao nas mensagens antigas.
const MAX_MSGS_CONTEXTO   = 50;

// Max de produtos pre-filtrados enviados ao prompt da IA
const MAX_PRODUTOS_PROMPT = 30;

// Cache do catalogo em memoria (TTL 5 min) para nao recarregar 3668 produtos a cada request
const CACHE_TTL_MS = 5 * 60 * 1000;
let CACHE_PRODUTOS = { data: null, ts: 0 };

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

// Normaliza texto para busca (sem acento, minusculo, apenas alfanumerico+espaco)
function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

// Inicializa firebase-admin apenas se FIREBASE_SERVICE_ACCOUNT disponivel
function getDbAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    if (!getApps().length) {
      const serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
      initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
    }
    const databaseId = process.env.FIRESTORE_DATABASE_ID || DATABASE_ID;
    return getFirestore(undefined, databaseId);
  } catch {
    return null;
  }
}

// Carrega TODOS os produtos (via firebase-admin, com paginacao) e cacheia
async function carregarCatalogoCompleto() {
  const agora = Date.now();
  if (CACHE_PRODUTOS.data && (agora - CACHE_PRODUTOS.ts) < CACHE_TTL_MS) {
    return CACHE_PRODUTOS.data;
  }

  const db = getDbAdmin();
  if (!db) {
    // Fallback: REST API (max 300 docs, nao ideal mas evita quebrar se admin nao estiver configurado)
    try {
      const url = `${BASE_URL}/produtos?pageSize=300&key=${FIREBASE_API_KEY}`;
      const res = await axios.get(url, { timeout: 8000 });
      const produtos = (res.data.documents || []).map(d => {
        const f = d.fields || {};
        const get = (k, fb = '') => f[k]?.stringValue ?? f[k]?.doubleValue ?? f[k]?.booleanValue ?? fb;
        return {
          id: d.name.split('/').pop(),
          nome: get('nome'),
          sku: get('sku'),
          preco: Number(get('preco', 0)),
          precoRegular: Number(get('precoRegular', 0)),
          categoria: get('categoria'),
          descricao: get('descricao'),
          tipo: get('tipo'),
        };
      });
      CACHE_PRODUTOS = { data: produtos, ts: agora };
      return produtos;
    } catch {
      return [];
    }
  }

  // firebase-admin: paginacao completa
  const produtos = [];
  let last = null;
  do {
    let q = db.collection('produtos').orderBy('__name__').limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    for (const d of snap.docs) {
      const data = d.data() || {};
      produtos.push({
        id: d.id,
        nome: data.nome || '',
        sku: data.sku || '',
        preco: Number(data.preco || 0),
        precoRegular: Number(data.precoRegular || 0),
        categoria: data.categoria || '',
        descricao: data.descricao || '',
        tipo: data.tipo || '',
      });
    }
    last = snap.docs.length === 500 ? snap.docs[snap.docs.length - 1] : null;
  } while (last);

  CACHE_PRODUTOS = { data: produtos, ts: agora };
  return produtos;
}

// Pontua cada produto baseado em quantas palavras-chave da conversa matcham
// Score = soma de matches em nome (peso 3) + sku (peso 4) + categoria (peso 2) + descricao (peso 1)
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

// ---------- Extrai alternativas (telefones, emails, cnpjs, cpfs, ceps) da conversa bruta ----------
// Usado no frontend: clicando no campo o usuario ve essas opcoes alem do valor extraido pela IA.
function extrairAlternativas(textoConversa) {
  const texto = String(textoConversa || '');

  // Telefones BR: captura "janelas" de digitos com separadores comuns (SEM ponto — ponto e de CPF/CNPJ).
  // Aceita fixo (10), celular (11), com/sem DDI 55 (12/13).
  const telefones = new Set();
  const reTel = /\+?[\d][\d\s\-\(\)]{8,18}\d/g;
  let m;
  while ((m = reTel.exec(texto)) !== null) {
    let digits = m[0].replace(/\D/g, '');
    // Remove DDI 55 se presente e reduz para 10 ou 11 digitos
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    // DDDs no Brasil sao 11-99 (nunca comecam com 0). Ignora CPF (11 dig) acidental.
    if (digits.length < 10 || digits.length > 11) continue;
    if (digits.startsWith('0')) continue;
    telefones.add(digits);
  }

  // Emails
  const emails = new Set();
  const reEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((m = reEmail.exec(texto)) !== null) emails.add(m[0].toLowerCase());

  // CNPJs (com ou sem mascara)
  const cnpjs = new Set();
  const reCNPJ = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
  while ((m = reCNPJ.exec(texto)) !== null) {
    const c = m[1].replace(/\D/g, '');
    if (c.length === 14) cnpjs.add(c);
  }

  // CPFs (com mascara — sem mascara conflitaria com outros numeros)
  const cpfs = new Set();
  const reCPF = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/g;
  while ((m = reCPF.exec(texto)) !== null) {
    const c = m[1].replace(/\D/g, '');
    if (c.length === 11) cpfs.add(c);
  }

  // CEPs
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
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'mensagens' }],
      where: { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: telefone } } },
      orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'DESCENDING' }],
      limit: 200,
    },
  };
  const res = await axios.post(url, body);
  return (res.data || [])
    .filter(r => r.document)
    .map(r => {
      const f = r.document.fields || {};
      return {
        texto:    f.texto?.stringValue || f.mensagem?.stringValue || '',
        criadoEm: f.criadoEm?.timestampValue || f.timestamp?.timestampValue || '',
        tipo:     f.tipo?.stringValue || 'entrada',
      };
    })
    .filter(m => m.texto.trim())
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
}

function recortarConversaAtual(mensagens) {
  if (!mensagens.length) return [];
  // Pega as ultimas MAX_MSGS_CONTEXTO mensagens (ordenadas cronologicamente).
  // Sem filtro de tempo: se o cliente passou dados ha dias/semanas, ainda queremos usar.
  return mensagens.slice(-MAX_MSGS_CONTEXTO);
}

// Busca produtos relevantes para a conversa (pre-filtro por palavras-chave)
// Nao manda 3668 produtos pra IA — so os que realmente podem casar com o que o cliente falou.
async function buscarProdutosRelevantes(conversaTexto) {
  try {
    const [todos, palavrasChave] = await Promise.all([
      carregarCatalogoCompleto(),
      Promise.resolve(extrairPalavrasChave(conversaTexto)),
    ]);
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
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY nao configurada no servidor');

  // IMPORTANTE: produtosRelevantes ja vem pre-filtrado (max 30) por palavras-chave da conversa.
  // Nao mandamos 3668 produtos pra IA — so os que realmente podem casar com o que o cliente falou.
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
1. Se o cliente mencionar um produto que EXISTE no catalogo acima, use o nome e preco do catalogo (campo "produtoPadrao": true).
2. Se o produto NAO existe no catalogo, marque "produtoPadrao": false e estime o preco se mencionado.
3. IMPORTANTE - NOME DO PRODUTO: Inclua TODAS as especificacoes mencionadas na conversa (capacidade em litros, dimensoes em mm/cm/m, material como inox/aco carbono/galvanizado, espessura, tipo). Exemplo: "Container 1200L Inox 304" ou "Tampa para casa de maquinas 110cm". NUNCA use nomes genericos como apenas "container" ou "tampa" sem as specs/dimensoes.
4. DESCRICAO DO PRODUTO: Coloque todos os detalhes tecnicos: dimensoes, material, acabamento, capacidade, quantidade, norma se aplicavel.
5. Extraia CNPJ, CPF, CEP, endereco, inscricao estadual se mencionados no texto.
6. DADOS ESTRUTURADOS: Se o cliente enviar uma mensagem em formato "Nome: X / Cpf: Y / Endereço: Z / Cep: W", EXTRAIA TODOS esses campos literalmente. O nome do cliente (pessoa fisica) vai em cliente.nome; CPF em cliente.cpf; parseia o endereco em logradouro/numero/bairro/cidade/uf; CEP em cliente.cep.
7. DIFERENCA CNPJ DO VENDEDOR vs CLIENTE: Se o VENDEDOR mandar "Nossa chave pix CNPJ: X", esse CNPJ e da CDS Industrial (vendedor), NAO do cliente. NAO preencha cliente.cnpj com esse CNPJ.
8. Se dados estao incompletos, liste em "camposFaltando".
9. Avalie "confianca" de 0 a 100 (quao completos estao os dados para gerar proposta).
10. CLIENTE: O campo "empresa" e para o nome da empresa/CNPJ. O campo "nome" e para a PESSOA de contato (responsavel). Se o lead ja tem dados no CRM, use como base, mas PREFIRA o nome da pessoa que o cliente informou explicitamente na conversa ("Nome: Zilmaria...") sobre o nome do lead no CRM.

Conversa:
${conversa}

Responda APENAS com JSON valido no formato:
{
  "cliente": {
    "nome": "string - nome da PESSOA de contato",
    "empresa": "string - nome da EMPRESA ou null se pessoa fisica",
    "telefone": "string ou null",
    "email": "string ou null",
    "cnpj": "string ou null",
    "cpf": "string ou null",
    "inscricaoEstadual": "string ou null",
    "cep": "string ou null",
    "logradouro": "string ou null",
    "numero": "string ou null",
    "bairro": "string ou null",
    "cidade": "string ou null",
    "uf": "string ou null"
  },
  "produtos": [
    {
      "nome": "string DETALHADO com specs (ex: Container 1200L Inox 304)",
      "descricao": "descricao tecnica completa com dimensoes/material/capacidade",
      "quantidade": 1,
      "unidade": "UN",
      "precoUnitario": 0,
      "produtoPadrao": true,
      "skuCatalogo": "string ou null"
    }
  ],
  "observacoes": "string",
  "resumoConversa": "string curto do contexto da negociacao",
  "camposFaltando": ["nome do campo que falta"],
  "confianca": 0,
  "prontoParaProposta": false
}`;

  // Retry em 429 (rate limit). Ate 3 tentativas com backoff.
  const body = {
    model: GROQ_MODEL,
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
  let ultimoErro;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        body,
        { headers, timeout: 30000 }
      );
      break;
    } catch (err) {
      ultimoErro = err;
      if (err.response?.status === 429 && tentativa < 3) {
        const retryAfter = Number(err.response?.headers?.['retry-after']) || (tentativa * 2);
        await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 10000)));
        continue;
      }
      throw err;
    }
  }
  if (!response) throw ultimoErro;

  const text = response.data?.choices?.[0]?.message?.content || '';
  const clean = text.replace(/\`\`\`json\s*/g, '').replace(/\`\`\`\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Groq retornou resposta invalida.');
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
          camposFaltando: ['conversa'],
          confianca: 0,
          prontoParaProposta: false,
        },
        totalMensagens: 0,
      });
    }

    const conversaFormatada = conversaAtual
      .map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`)
      .join('\n');

    // Pre-filtra produtos por palavras-chave da conversa (apenas mensagens do cliente pesam mais)
    const textoCliente = conversaAtual
      .filter(m => m.tipo === 'entrada')
      .map(m => m.texto)
      .join(' ') || conversaFormatada;
    const { produtos: produtosRelevantes, totalCatalogo, palavrasChave } =
      await buscarProdutosRelevantes(textoCliente);

    // Extrai alternativas (telefones, emails, cnpjs, cpfs, ceps) do texto bruto do cliente
    const alternativas = extrairAlternativas(textoCliente);
    // Garante que o numero do WhatsApp esteja na lista de telefones alternativos (primeiro)
    if (tel && !alternativas.telefones.includes(tel)) {
      alternativas.telefones.unshift(tel);
    }

    const analise = await analisarConversaComGroq(conversaFormatada, produtosRelevantes, {
      nome: leadNome || '',
      empresa: leadEmpresa || '',
    }, { totalCatalogo });

    if (!analise.cliente.nome && leadNome) analise.cliente.nome = leadNome;
    if (!analise.cliente.empresa && leadEmpresa) analise.cliente.empresa = leadEmpresa;
    // Telefone JA temos — e o numero do WhatsApp. Sempre preenche.
    if (!analise.cliente.telefone) analise.cliente.telefone = tel;
    // Se a IA nao captou CPF/CNPJ/CEP mas o regex encontrou, usa
    if (!analise.cliente.cpf && alternativas.cpfs[0])  analise.cliente.cpf = alternativas.cpfs[0];
    if (!analise.cliente.cnpj && alternativas.cnpjs[0]) analise.cliente.cnpj = alternativas.cnpjs[0];
    if (!analise.cliente.cep && alternativas.ceps[0])   analise.cliente.cep = alternativas.ceps[0];
    if (!analise.cliente.email && alternativas.emails[0]) analise.cliente.email = alternativas.emails[0];

    let dadosCNPJ = null;
    let dadosCEP = null;

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
        const preenchidos = ['cnpj', 'inscricaoEstadual', 'logradouro', 'cidade', 'uf', 'cep'];
        analise.camposFaltando = (analise.camposFaltando || []).filter(c => !preenchidos.includes(c));
      }
    }

    if (analise.cliente?.cep && !dadosCNPJ) {
      dadosCEP = await consultarCEP(analise.cliente.cep);
      if (dadosCEP) {
        analise.cliente.logradouro = analise.cliente.logradouro || dadosCEP.logradouro;
        analise.cliente.bairro = analise.cliente.bairro || dadosCEP.bairro;
        analise.cliente.cidade = analise.cliente.cidade || dadosCEP.cidade;
        analise.cliente.uf = analise.cliente.uf || dadosCEP.uf;
      }
    }

    if (analise.produtos?.length) {
      // Usa catalogo completo cacheado para post-match (nao so os 30 relevantes)
      const catalogoCompleto = CACHE_PRODUTOS.data || produtosRelevantes;
      for (const item of analise.produtos) {
        if (item.produtoPadrao && item.skuCatalogo) {
          const match = catalogoCompleto.find(p =>
            p.sku === item.skuCatalogo || (p.nome || '').toLowerCase() === (item.nome || '').toLowerCase()
          );
          if (match) {
            item.precoUnitario = item.precoUnitario || match.preco || match.precoRegular;
            item.produtoId = match.id;
            item.skuCatalogo = match.sku;
          }
        } else if (item.produtoPadrao) {
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
          } else {
            item.produtoPadrao = false;
          }
        }
      }
    }

    const camposCriticos = ['nome', 'telefone'];
    const temProdutos = analise.produtos?.length > 0;
    const temCliente = camposCriticos.every(c => analise.cliente?.[c]);
    analise.prontoParaProposta = temCliente && temProdutos && analise.confianca >= 50;

    // Limpa camposFaltando: remove tudo que ja esta preenchido no cliente.
    // Evita bug de ter "telefone" como faltando quando temos o numero do WhatsApp.
    if (Array.isArray(analise.camposFaltando)) {
      const ehPessoaFisica = !!analise.cliente?.cpf && !analise.cliente?.cnpj;
      const ehPessoaJuridica = !!analise.cliente?.cnpj;
      analise.camposFaltando = analise.camposFaltando.filter(c => {
        const v = analise.cliente?.[c];
        if (v && String(v).trim() !== '') return false;
        // Pessoa fisica nao precisa de CNPJ/IE
        if (ehPessoaFisica && (c === 'cnpj' || c === 'inscricaoEstadual')) return false;
        // Pessoa juridica nao precisa de CPF
        if (ehPessoaJuridica && c === 'cpf') return false;
        return true;
      });
    }

    return res.status(200).json({
      ok: true,
      analise,
      alternativas, // { telefones, emails, cnpjs, cpfs, ceps } — usado pelo frontend como opcoes alternativas
      totalMensagens: mensagens.length,
      mensagensUsadas: conversaAtual.length,
      produtosCatalogo: totalCatalogo,
      produtosRelevantes: produtosRelevantes.length,
      palavrasChaveBusca: palavrasChave.slice(0, 20),
      dadosCNPJ: dadosCNPJ ? true : false,
      dadosCEP: dadosCEP ? true : false,
      modelo: GROQ_MODEL,
    });

  } catch (err) {
    console.error('Erro conversa-inteligencia:', err.response?.data || err.message);
    const msg = err.message || 'Erro interno';
    const status429 = err.response?.status === 429;
    const status = status429 ? 429
      : (msg.includes('GROQ_API_KEY') ? 503 : 500);
    return res.status(status).json({
      error: status429 ? 'Limite de requisicoes da IA atingido. Tente novamente em alguns segundos.' : msg,
    });
  }
}

