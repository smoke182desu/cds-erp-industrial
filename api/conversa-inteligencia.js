import axios from 'axios';

// Groq - modelo gratuito (14.400 req/dia)
const GROQ_MODEL = 'llama-3.1-8b-instant';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID      = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0908948294';
const DATABASE_ID     = process.env.FIREBASE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const GROQ_API_KEY    = process.env.GROQ_API_KEY || '';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const JANELA_CONVERSA_MIN = 180;
const MAX_MSGS_CONTEXTO   = 30;

// Buscar mensagens do Firestore
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
    const atual = new Date(out[0].criadoEm).getTime();
    const anter = new Date(mensagens[i].criadoEm).getTime();
    const diffMin = (atual - anter) / 60000;
    if (diffMin > JANELA_CONVERSA_MIN) break;
    out.unshift(mensagens[i]);
    if (out.length >= MAX_MSGS_CONTEXTO) break;
  }
  return out;
}

// Buscar produtos padrao do Firestore
async function buscarProdutosPadrao() {
  try {
    const url = `${BASE_URL}/produtos?pageSize=300&key=${FIREBASE_API_KEY}`;
    const res = await axios.get(url, { timeout: 8000 });
    return (res.data.documents || []).map(d => {
      const f = d.fields || {};
      const get = (k, fallback = '') =>
        f[k]?.stringValue ?? f[k]?.doubleValue ?? f[k]?.booleanValue ?? fallback;
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
  } catch {
    return [];
  }
}

// Consulta CNPJ via BrasilAPI
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

// Consulta CEP via ViaCEP
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

// Filtra produtos relevantes com base nas palavras da conversa
function filtrarProdutosRelevantes(produtos, conversa, maxProdutos = 80) {
  if (!produtos.length) return [];

  // Palavras de parada (stopwords PT-BR)
  const stopwords = new Set(['de','a','o','e','que','em','um','uma','para','com','não','do','da','dos','das','se','na','no','por','mais','como','mas','foi','ao','ele','das','tem','à','seu','sua','ou','quando','muito','nos','já','eu','também','só','pelo','pela','até','isso','ela','entre','era','depois','sem','mesmo','aos','seus','quem','nas','me','esse','eles','estão','você','tinha','foram','essa','num','nem','suas','meu','às','minha','numa','pelos','elas','havia','seja','qual','será','nós','tenho','lhe','deles','essas','esses','pelas','este','dele','tu','te','vocês','vos','lhes','meus','minhas','teu','tua','teus','tuas','nosso','nossa','nossos','nossas','dela','delas','esta','estes','estas','aquele','aquela','aqueles','aquelas','isto','aquilo','estou','está','estamos','estão','estive','esteve','estivemos','estiveram','estava','estávamos','estavam','estivera','estivéramos','esteja','estejamos','estejam','estivesse','estivéssemos','estivessem','estiver','estivermos','estiverem']);

  // Extrai palavras-chave da conversa (mínimo 3 chars, sem stopwords)
  const palavras = conversa
    .toLowerCase()
    .replace(/[^a-záéíóúãõâêîôûç\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length >= 3 && !stopwords.has(p));

  const keywords = [...new Set(palavras)];
  if (!keywords.length) return produtos.slice(0, maxProdutos);

  // Pontua cada produto pela quantidade de palavras-chave que batem
  const pontuados = produtos.map(p => {
    const texto = `${p.nome} ${p.categoria} ${p.descricao}`.toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (texto.includes(kw) ? 1 : 0), 0);
    return { ...p, _score: score };
  });

  // Ordena por score desc, pega os relevantes primeiro; se poucos, completa com os demais
  pontuados.sort((a, b) => b._score - a._score);
  const relevantes = pontuados.filter(p => p._score > 0).slice(0, maxProdutos);
  if (relevantes.length >= 20) return relevantes;

  // Fallback: completa com primeiros do catálogo até maxProdutos
  const ids = new Set(relevantes.map(p => p.id));
  const extras = pontuados.filter(p => !ids.has(p.id)).slice(0, maxProdutos - relevantes.length);
  return [...relevantes, ...extras];
}

// Analise progressiva com Groq
async function analisarConversaComGroq(conversa, produtosPadrao, leadNome = '', leadEmpresa = '') {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY nao configurada no servidor');

  const produtosFiltrados = filtrarProdutosRelevantes(produtosPadrao, conversa, 80);
  const catalogoResumo = produtosFiltrados.length > 0
    ? produtosFiltrados.map(p => `${p.nome}|${p.sku}|R$${p.preco}`).join('\n')
    : '(catalogo vazio)';

  const dadosConhecidos = [];
  if (leadNome) dadosConhecidos.push(`- Nome do contato: "${leadNome}"`);
  if (leadEmpresa) dadosConhecidos.push(`- Empresa do contato: "${leadEmpresa}"`);
  const contextoLead = dadosConhecidos.length
    ? `\nDADOS JA CONHECIDOS DO LEAD (use como base, nao ignore):\n${dadosConhecidos.join('\n')}\n`
    : '';

  const prompt = `Voce e um assistente de vendas da CDS Industrial (metalurgia / caldeiraria / estruturas metalicas).
Analise a conversa de WhatsApp abaixo e extraia TODOS os dados que conseguir identificar.
${contextoLead}
CATALOGO DE PRODUTOS PADRAO da empresa (use nomes EXATOS do catalogo quando possivel):
${catalogoResumo}

REGRAS:
1. Se o cliente mencionar um produto que EXISTE no catalogo acima (mesmo que nao seja exatamente igual), use o nome EXATO do catalogo e marque "produtoPadrao": true.
2. Para produtos do catalogo, preencha "skuCatalogo" com o SKU correspondente.
3. Se o produto NAO existe no catalogo, marque "produtoPadrao": false e estime o preco se mencionado.
4. Se DADOS JA CONHECIDOS DO LEAD foram informados, use-os DIRETAMENTE no campo cliente sem precisar extrair da conversa.
5. Extraia CNPJ, CPF, CEP, endereco, inscricao estadual se mencionados no texto.
6. Se dados estao incompletos, liste em "camposFaltando".
7. Avalie "confianca" de 0 a 100 (quao completos estao os dados para gerar proposta).

Conversa:
${conversa}

Responda APENAS com JSON valido no formato:
{
  "cliente": {
    "nome": "string ou null",
    "empresa": "string ou null",
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
      "nome": "string",
      "descricao": "string",
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

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

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

// Handler principal
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
    // 1. Buscar mensagens e produtos em paralelo
    const [mensagens, produtosPadrao] = await Promise.all([
      buscarMensagens(tel),
      buscarProdutosPadrao(),
    ]);

    // 2. Recortar conversa atual
    const conversaAtual = recortarConversaAtual(mensagens);
    if (!conversaAtual.length) {
      return res.status(200).json({
        ok: true,
        analise: {
          cliente: {},
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

    // 3. Formatar conversa para o Groq
    const conversaFormatada = conversaAtual
      .map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`)
      .join('\n');

    // 4. Analisar com Groq + catalogo de produtos
    const analise = await analisarConversaComGroq(conversaFormatada, produtosPadrao, leadNome, leadEmpresa);

    // 5. Enriquecer com BrasilAPI / ViaCEP se tiver CNPJ ou CEP
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

    // 6. Matching de produtos padrao com catalogo real
    if (analise.produtos?.length) {
      for (const item of analise.produtos) {
        if (item.produtoPadrao && item.skuCatalogo) {
          const match = produtosPadrao.find(p =>
            p.sku === item.skuCatalogo ||
            p.nome.toLowerCase() === item.nome.toLowerCase()
          );
          if (match) {
            item.precoUnitario = item.precoUnitario || match.preco || match.precoRegular;
            item.produtoId = match.id;
            item.skuCatalogo = match.sku;
          }
        } else if (item.produtoPadrao) {
          const match = produtosPadrao.find(p =>
            p.nome.toLowerCase().includes(item.nome.toLowerCase()) ||
            item.nome.toLowerCase().includes(p.nome.toLowerCase())
          );
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

    // 7. Recalcular confianca e prontoParaProposta
    const camposCriticos = ['nome', 'telefone'];
    const temProdutos = analise.produtos?.length > 0;
    const temCliente = camposCriticos.every(c => analise.cliente?.[c]);
    analise.prontoParaProposta = temCliente && temProdutos && analise.confianca >= 50;

    return res.status(200).json({
      ok: true,
      analise,
      totalMensagens: mensagens.length,
      mensagensUsadas: conversaAtual.length,
      produtosCatalogo: produtosPadrao.length,
      dadosCNPJ: dadosCNPJ ? true : false,
      dadosCEP: dadosCEP ? true : false,
      modelo: GROQ_MODEL,
    });

  } catch (err) {
    console.error('Erro conversa-inteligencia:', err.response?.data || err.message);
    const msg = err.message || 'Erro interno';
    const status = msg.includes('GROQ_API_KEY') ? 503 : 500;
    return res.status(status).json({ error: msg });
  }
}
