import axios from 'axios';
import { selectAll } from './_lib/supabase.js';
import { aplicarPrecoSobMedida } from './_lib/preco-sob-medida.js';

const GROQ_API_KEY     = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY || '';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite'
];

const FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];

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

function imagemPrincipalProduto(p) {
  const vistos = new Set();
  const urls = [
    p?.foto_url,
    p?.imagem,
    ...(Array.isArray(p?.imagens) ? p.imagens : []),
    ...(Array.isArray(p?.fotos) ? p.fotos : []),
  ]
    .map(url => String(url || '').trim())
    .filter(url => /^(https?:|data:image\/)/i.test(url))
    .filter(url => {
      if (vistos.has(url)) return false;
      vistos.add(url);
      return true;
    });
  return urls[0] || '';
}

function extrairPalavrasChave(texto) {
  const norm = normalizarTexto(texto);
  const palavras = norm.split(' ').filter(p => p.length >= 3 && !STOPWORDS.has(p));
  return [...new Set(palavras)];
}

async function carregarCatalogoCompleto() {
  const agora = Date.now();
  if (CACHE_PRODUTOS.data && (agora - CACHE_PRODUTOS.ts) < CACHE_TTL_MS) return CACHE_PRODUTOS.data;

  try {
    const data = await selectAll('produtos', { limit: 1000, orderBy: 'nome' });
    const produtos = data.map(p => ({
      id: p.id,
      nome: p.nome || '',
      sku: p.sku || '',
      preco: Number(p.preco || 0),
      precoRegular: Number(p.preco_regular || p.precoRegular || 0),
      categoria: p.categoria || '',
      descricao: p.descricao || '',
      imagem: imagemPrincipalProduto(p),
    }));
    CACHE_PRODUTOS = { data: produtos, ts: agora };
    return produtos;
  } catch (err) {
    console.warn('[proposta-ia] falha ao carregar catalogo:', err.message);
    return [];
  }
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
  try {
    const data = await selectAll('mensagens', {
      filters: { telefone: `eq.${telefone}` },
      orderBy: 'criado_em',
      limit: 50
    });
    return data.map(m => ({
      texto: m.texto || m.conteudo || '',
      criadoEm: m.criado_em || m.created_at || '',
      tipo: m.tipo || 'entrada',
    }))
    .filter(m => m.texto.trim())
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
  } catch (err) {
    console.error('[proposta-ia] erro buscarMensagens:', err.message);
    return [];
  }
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

function montarParts(prompt, images) {
  if (!images || !images.length) return [{ text: prompt }];
  const parts = [{ text: prompt }];
  for (const img of images) {
    let mimeType = img.tipo || 'image/jpeg';
    let data = img.base64 || img.data || '';
    if (data.startsWith('data:')) {
      const matches = data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) { mimeType = matches[1]; data = matches[2]; }
      else { data = data.split(',')[1] || data; }
    }
    parts.push({ inlineData: { data, mimeType } });
  }
  return parts;
}

function montarContentOpenAI(prompt, images) {
  if (!images || !images.length) return prompt;
  const content = [{ type: 'text', text: prompt }];
  for (const img of images) {
    let mimeType = img.tipo || 'image/jpeg';
    let data = img.base64 || img.data || '';
    if (data.startsWith('data:')) {
      const matches = data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) { mimeType = matches[1]; data = matches[2]; }
      else { data = data.split(',')[1] || data; }
    }
    if (mimeType !== 'application/pdf') {
      content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } });
    }
  }
  return content;
}

// Chama a IA com fallback (Gemini -> Groq -> OpenAI), suporta imagens
async function chamarIA(prompt, { maxTokens = 900, temperature = 0.3, images } = {}) {
  if (!GROQ_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) throw new Error('Nenhuma API KEY configurada');

  let lastError;

  // TIER 1: Google Gemini Models (suporta inline_data)
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
          contents: [{ role: 'user', parts: montarParts(prompt, images) }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: "application/json" }
        };
        const geminiResp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 45000 });
        return geminiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err) {
        console.log(`[proposta-ia] Gemini (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 2: Groq Fallbacks (suporta image_url)
  if (GROQ_API_KEY) {
    const body = {
      messages: [{ role: 'user', content: montarContentOpenAI(prompt, images) }],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    };
    const headers = {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    };

    for (const model of FALLBACK_MODELS) {
      try {
        body.model = model;
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', body, { headers, timeout: 45000 });
        return response.data?.choices?.[0]?.message?.content || '';
      } catch (err) {
        console.log(`[proposta-ia] Groq (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 3: OpenAI Fallback (suporta image_url)
  if (OPENAI_API_KEY) {
    try {
      const body = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: montarContentOpenAI(prompt, images) }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      };
      const headers = {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      };
      const response = await axios.post('https://api.openai.com/v1/chat/completions', body, { headers, timeout: 45000 });
      return response.data?.choices?.[0]?.message?.content || '';
    } catch (err) {
      console.log('[proposta-ia] OpenAI esgotou/falhou.');
      lastError = err;
    }
  }

  throw lastError || new Error('Todos os provedores de IA falharam.');
}

async function gerarPropostaComIA(mensagens, produtosRelevantes, { nome, email, empresa, telefone }, metaCatalogo = {}, contextoExtra = '', arquivos = []) {

async function gerarPropostaComIA(mensagens, produtosRelevantes, { nome, email, empresa, telefone }, metaCatalogo = {}) {
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

  let prompt = `Voce gera propostas comerciais da CDS Industrial (metalurgia / caldeiraria / estruturas).
Baseie-se APENAS na conversa abaixo (ignore historico anterior). Se faltar info, use valores estimados razoaveis e marque com "(estimado)".

CATALOGO DE PRODUTOS RELEVANTES (use SKU e preco destes quando o cliente mencionar o produto):
${catalogoResumo}

Lead: ${nome || '-'} | ${empresa || '-'} | ${email || '-'} | ${telefone || '-'}

Conversa atual:
${conversa || '(sem mensagens)'}

CAPACIDADES E LIMITES DA FABRICA:
- Fabricamos produtos metalicos sob medida com solda MIG e eletrica.
- Dobra de chapas ate 6,35mm; corte reto em guilhotina; pintura com compressor industrial em epoxi, esmalte sintetico ou PU.
- Dobradeira e guilhotina de 3m: pecas maiores que 3m somente com emenda/solda.
- Nao incluir plasma, oxicorte, laser, jato d'agua, cortes curvos ou recortes internos na proposta.
- Materiais possiveis: aluminio, aco carbono, aco galvanizado, inox 430 e inox 304. Acos usuais 1010/1020; chapa acima de 14 geralmente A36.`;

  if (contextoExtra) {
    prompt += `\n\nINSTRUCOES EXTRAS DO VENDEDOR (devem ser seguidas com prioridade):
${contextoExtra}`;
  }

  if (arquivos && arquivos.length > 0) {
    const nomesArquivos = arquivos.map(a => `- ${a.nome || 'arquivo'} (${a.tipo || 'desconhecido'})`).join('\n');
    prompt += `\n\nARQUIVOS ANEXADOS PELO VENDEDOR (use imagens para identificar produtos, medidas, materiais):
${nomesArquivos}`;
  }

  prompt += `\n\nREGRAS:
1. Se o item mencionado pelo cliente corresponde a um produto do catalogo acima, USE o nome e preco exatos do catalogo e preencha "skuCatalogo". Use "nome" para o nome do produto e "valorUnitario" para o preco.
2. Se nao houver correspondencia, deixe "skuCatalogo" null e preserve medidas, material, espessura, perfil/tubo/chapa e quantidade na descricao. O sistema vai calcular o preco por peso.
2.1. Para sob medida, use a tabela: aco carbono R$70/kg, inox R$150/kg, aluminio R$120/kg, galvanizado R$100/kg. Se faltar espessura, base inicial chapa 14 / 2mm.
3. Nomes de produto SEMPRE com specs (capacidade, material, dimensoes). Ex: "Container 1200L Inox 304".
4. Se o vendedor enviou imagens, examine-as para identificar produtos, materiais, dimensoes ou detalhes tecnicos.
5. Se o vendedor deu instrucoes extras, siga-as mesmo que contradigam a conversa.

Responda SOMENTE um JSON valido, sem texto antes ou depois, no formato:
{
  "titulo": "string curto",
  "descricao": "string ate 400 caracteres",
  "itens": [ { "nome": "string (nome do produto)", "descricao": "string (detalhes tecnicos)", "qtd": number, "unidade": "string", "valorUnitario": number, "skuCatalogo": "string ou null" } ],
  "observacoes": "string"
}`;

  const text = await chamarIA(prompt, { maxTokens: 1200, temperature: 0.3, images: arquivos });
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('IA retornou resposta invalida. Tente novamente.');
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Metodo nao permitido' });

  const { telefone, nome, email, empresa, mensagens: msgsBody, contextoExtra, arquivos } = req.body || {};
  if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });

  const tel = String(telefone).replace(/\D/g, '');

  try {
    // Usa mensagens enviadas pelo frontend (ja carregadas no chat) ou busca do Supabase como fallback
    let mensagens;
    if (Array.isArray(msgsBody) && msgsBody.length > 0) {
      mensagens = msgsBody.map(m => ({
        texto: m.texto || m.conteudo || m.body || '',
        tipo: m.tipo || m.direction || 'entrada',
        criadoEm: m.criadoEm || m.timestamp || new Date().toISOString(),
      })).filter(m => m.texto.trim());
    } else {
      mensagens = await buscarMensagens(tel);
    }
    const conversaAtual = recortarConversaAtual(mensagens);

    // Texto do cliente (pondera melhor as palavras-chave)
    const textoCliente = conversaAtual
      .filter(m => m.tipo === 'entrada')
      .map(m => m.texto)
      .join(' ')
      || conversaAtual.map(m => m.texto).join(' ');

    const { produtos: produtosRelevantes, totalCatalogo, palavrasChave } =
      await buscarProdutosRelevantes(textoCliente);

    const proposta = await gerarPropostaComIA(
      mensagens,
      produtosRelevantes,
      { nome, email, empresa, telefone: tel },
      { totalCatalogo },
      contextoExtra,
      arquivos
    );

    // Pos-match: aplica preco e skuCatalogo do catalogo completo quando possivel
    // Tenta: 1) match exato por SKU 2) match exato por nome 3) match fuzzy por palavras-chave do nome
    if (proposta.itens?.length) {
      const catalogoCompleto = CACHE_PRODUTOS.data || produtosRelevantes;
      for (const item of proposta.itens) {
        let match = null;

        // 1) Match por SKU (caminho mais confiavel quando a IA preenche)
        if (item.skuCatalogo) {
          match = catalogoCompleto.find(p => p.sku === item.skuCatalogo);
        }

        // 2) Match exato por nome (case-insensitive, normalizado)
        if (!match && item.nome) {
          const nomeItem = normalizarTexto(item.nome);
          match = catalogoCompleto.find(p => normalizarTexto(p.nome) === nomeItem);
        }

        // 3) Match fuzzy: produto do catalogo cujo nome tem maior sobreposicao de palavras com o item
        if (!match && item.nome) {
          const palavrasItem = extrairPalavrasChave(item.nome);
          if (palavrasItem.length) {
            let melhor = { score: 0, produto: null };
            for (const p of catalogoCompleto) {
              const palavrasProd = new Set(extrairPalavrasChave(p.nome));
              if (!palavrasProd.size) continue;
              let score = 0;
              for (const pal of palavrasItem) {
                if (palavrasProd.has(pal)) score += 1;
              }
              // Exige que pelo menos metade das palavras do item batam com o produto
              const limiar = Math.max(2, Math.ceil(palavrasItem.length / 2));
              if (score >= limiar && score > melhor.score) {
                melhor = { score, produto: p };
              }
            }
            if (melhor.produto) match = melhor.produto;
          }
        }

        if (match) {
          const precoCatalogo = Number(match.preco) || Number(match.precoRegular) || 0;
          // Produto cadastrado sempre usa preco do cadastro; o vendedor pode editar depois no modal.
          item.valorUnitario = precoCatalogo;
          item.produtoId = match.id;
          item.nomeCatalogo = match.nome;
          item.nome = match.nome || item.nome;
          item.skuCatalogo = item.skuCatalogo || match.sku;
          item.imagem = match.imagem || item.imagem || '';
        }

        if (!match) {
          aplicarPrecoSobMedida(item, conversaAtual.map(m => m.texto).join(' '), 'valorUnitario');
        }
      }
    }

    // Normaliza campos para compatibilidade com o frontend
    if (proposta) {
      proposta.intro = proposta.intro || proposta.descricao || '';
      if (Array.isArray(proposta.itens)) {
        proposta.itens = proposta.itens.map(it => ({
          ...it,
          nome: it.nome || it.descricao || 'Item',
          qtd: Number(it.qtd || it.quantidade) || 1,
          valorUnitario: Number(it.valorUnitario || it.precoUnitario) || 0,
          imagem: it.imagem || '',
        }));
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
      modelo: 'multi-provedor',
    });
  } catch (err) {
    console.error('Erro proposta-ia:', err.response?.data || err.message);
    const msg = err.message || 'Erro interno';
    const status429 = err.response?.status === 429;
    const status = status429 ? 429
      : (msg.includes('API KEY') ? 503 : 500);
    return res.status(status).json({
      error: status429 ? 'Limite de requisicoes da IA atingido. Tente novamente em alguns segundos.' : msg,
    });
  }
}
