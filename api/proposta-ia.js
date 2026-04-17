import axios from 'axios';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Groq - modelo gratuito (14.400 req/dia)
const GROQ_MODEL = 'llama-3.1-8b-instant';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0908948294';
const DATABASE_ID      = process.env.FIREBASE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const GROQ_API_KEY     = process.env.GROQ_API_KEY || '';

// Tempo em minutos sem trocar mensagem que consideramos ser "outra conversa anterior".
const JANELA_CONVERSA_MIN = 180; // 3h sem responder = corta e pega so a conversa atual
const MAX_MSGS_CONTEXTO   = 20;  // teto duro para nao inflar o prompt
const MAX_PRODUTOS_PROMPT = 30;  // limite de produtos pre-filtrados enviados a IA

// Cache catalogo (TTL 5 min)
const CACHE_TTL_MS = 5 * 60 * 1000;
let CACHE_PRODUTOS = { data: null, ts: 0 };

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

function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairPalavrasChave(texto) {
  const norm = normalizarTexto(texto);
  const palavras = norm.split(' ').filter(p => p.length >= 3 && !STOPWORDS.has(p));
  return [...new Set(palavras)];
}

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

async function carregarCatalogoCompleto() {
  const agora = Date.now();
  if (CACHE_PRODUTOS.data && (agora - CACHE_PRODUTOS.ts) < CACHE_TTL_MS) return CACHE_PRODUTOS.data;

  const db = getDbAdmin();
  if (!db) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/produtos?pageSize=300&key=${FIREBASE_API_KEY}`;
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
        };
      });
      CACHE_PRODUTOS = { data: produtos, ts: agora };
      return produtos;
    } catch {
      return [];
    }
  }

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
      });
    }
    last = snap.docs.length === 500 ? snap.docs[snap.docs.length - 1] : null;
  } while (last);

  CACHE_PRODUTOS = { data: produtos, ts: agora };
  return produtos;
}

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

async function buscarProdutosRelevantes(textoConversa) {
  try {
    const todos = await carregarCatalogoCompleto();
    const palavrasChave = extrairPalavrasChave(textoConversa);
    if (!todos.length) return { produtos: [], totalCatalogo: 0, palavrasChave };
    const relevantes = filtrarProdutosRelevantes(todos, palavrasChave, MAX_PRODUTOS_PROMPT);
    return { produtos: relevantes, totalCatalogo: todos.length, palavrasChave };
  } catch {
    return { produtos: [], totalCatalogo: 0, palavrasChave: [] };
  }
}

async function buscarMensagens(telefone) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'mensagens' }],
      where: { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: telefone } } },
      orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'DESCENDING' }],
      limit: 50,
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
  const out = [mensagens[mensagens.length - 1]];
  for (let i = mensagens.length - 2; i >= 0; i--) {
    const atual  = new Date(out[0].criadoEm).getTime();
    const anter  = new Date(mensagens[i].criadoEm).getTime();
    const diffMin = (atual - anter) / 60000;
    if (diffMin > JANELA_CONVERSA_MIN) break;
    out.unshift(mensagens[i]);
    if (out.length >= MAX_MSGS_CONTEXTO) break;
  }
  return out;
}

// Chama a Groq com retry em 429 (rate limit). Ate 2 tentativas com backoff.
async function chamarGroq(prompt, { maxTokens = 900, temperature = 0.3 } = {}) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY nao configurada no servidor');

  const body = {
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };
  const headers = {
    'Authorization': `Bearer ${GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const MAX_TENTATIVAS = 3;
  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        body,
        { headers, timeout: 30000 }
      );
      return response.data?.choices?.[0]?.message?.content || '';
    } catch (err) {
      ultimoErro = err;
      const status = err.response?.status;
      // 429 = rate limit. Tenta de novo com backoff.
      if (status === 429 && tentativa < MAX_TENTATIVAS) {
        const retryAfter = Number(err.response?.headers?.['retry-after']) || (tentativa * 2);
        const waitMs = Math.min(retryAfter * 1000, 10000);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw ultimoErro;
}

async function gerarPropostaComGroq(mensagens, produtosRelevantes, { nome, email, empresa, telefone }, metaCatalogo = {}) {
  const conversa = recortarConversaAtual(mensagens)
    .map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`)
    .join('\n');

  // Produtos ja pre-filtrados por palavras-chave (max 30). Nao mandamos os 3668.
  const catalogoResumo = produtosRelevantes.length > 0
    ? produtosRelevantes.map(p => {
        const preco = Number(p.preco || p.precoRegular || 0);
        const precoStr = preco > 0 ? `R$${preco.toFixed(2)}` : 's/preco';
        const cat = p.categoria ? ` [${p.categoria}]` : '';
        return `- ${p.nome} (SKU: ${p.sku}) ${precoStr}${cat}`;
      }).join('\n')
    : (metaCatalogo.totalCatalogo > 0
        ? `(nenhum produto do catalogo (${metaCatalogo.totalCatalogo} cadastrados) casou com as palavras da conversa)`
        : '(catalogo vazio)');

  const prompt = `Voce gera propostas comerciais da CDS Industrial (metalurgia / caldeiraria / estruturas).
Baseie-se APENAS na conversa abaixo (ignore historico anterior). Se faltar info, use valores estimados razoaveis e marque com "(estimado)".

CATALOGO DE PRODUTOS RELEVANTES (use SKU e preco destes quando o cliente mencionar o produto):
${catalogoResumo}

Lead: ${nome || '-'} | ${empresa || '-'} | ${email || '-'} | ${telefone || '-'}

Conversa atual:
${conversa || '(sem mensagens)'}

REGRAS:
1. Se o item mencionado pelo cliente corresponde a um produto do catalogo acima, USE o nome e preco exatos do catalogo e preencha "skuCatalogo".
2. Se nao houver correspondencia, estime preco razoavel e deixe "skuCatalogo" null.
3. Nomes de produto SEMPRE com specs (capacidade, material, dimensoes). Ex: "Container 1200L Inox 304".

Responda SOMENTE um JSON valido, sem texto antes ou depois, no formato:
{
  "titulo": "string curto",
  "descricao": "string ate 400 caracteres",
  "itens": [ { "descricao": "string", "quantidade": number, "unidade": "string", "precoUnitario": number, "skuCatalogo": "string ou null" } ],
  "observacoes": "string"
}`;

  const text = await chamarGroq(prompt, { maxTokens: 900, temperature: 0.3 });
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Groq retornou resposta invalida. Tente novamente.');
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Metodo nao permitido' });

  const { telefone, nome, email, empresa } = req.body || {};
  if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });

  const tel = String(telefone).replace(/\D/g, '');

  try {
    const mensagens = await buscarMensagens(tel);
    const conversaAtual = recortarConversaAtual(mensagens);

    // Texto do cliente (pondera melhor as palavras-chave)
    const textoCliente = conversaAtual
      .filter(m => m.tipo === 'entrada')
      .map(m => m.texto)
      .join(' ')
      || conversaAtual.map(m => m.texto).join(' ');

    const { produtos: produtosRelevantes, totalCatalogo, palavrasChave } =
      await buscarProdutosRelevantes(textoCliente);

    const proposta = await gerarPropostaComGroq(
      mensagens,
      produtosRelevantes,
      { nome, email, empresa, telefone: tel },
      { totalCatalogo }
    );

    // Pos-match: aplica preco e skuCatalogo do catalogo completo quando possivel
    if (proposta.itens?.length) {
      const catalogoCompleto = CACHE_PRODUTOS.data || produtosRelevantes;
      for (const item of proposta.itens) {
        if (item.skuCatalogo) {
          const match = catalogoCompleto.find(p => p.sku === item.skuCatalogo);
          if (match) {
            item.precoUnitario = item.precoUnitario || match.preco || match.precoRegular;
            item.produtoId = match.id;
            item.nomeCatalogo = match.nome;
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      proposta,
      totalMensagens: mensagens.length,
      mensagensUsadas: conversaAtual.length,
      produtosCatalogo: totalCatalogo,
      produtosRelevantes: produtosRelevantes.length,
      palavrasChaveBusca: palavrasChave.slice(0, 20),
      modelo: GROQ_MODEL,
    });
  } catch (err) {
    console.error('Erro proposta-ia:', err.response?.data || err.message);
    const msg = err.message || 'Erro interno';
    const status429 = err.response?.status === 429;
    const status = status429 ? 429
      : (msg.includes('GROQ_API_KEY') ? 503 : 500);
    return res.status(status).json({
      error: status429 ? 'Limite de requisicoes da IA atingido. Tente novamente em alguns segundos.' : msg,
    });
  }
}
