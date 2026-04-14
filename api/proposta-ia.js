import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = 'gen-lang-client-0908948294';
const DATABASE_ID      = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || '';

async function buscarMensagens(telefone) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'mensagens' }],
      where: { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: telefone } } },
      orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'ASCENDING' }],
      limit: 150,
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
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
}

async function gerarPropostaComGemini(mensagens, lead) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY nao configurada nas variaveis de ambiente do Vercel.');
  }
  const conversaFormatada = mensagens.map(m => {
    const quem = m.tipo === 'saida' ? 'CDS Industrial' : (lead.nome || 'Cliente');
    const hora  = m.criadoEm ? new Date(m.criadoEm).toLocaleString('pt-BR') : '';
    return `[${hora}] ${quem}: ${m.texto}`;
  }).join('\n');

  const prompt = `Voce e um assistente especializado em propostas comerciais da CDS Industrial (escadas, corrimaos, portoes, guarda-corpos, estruturas metalicas, locacao de andaimes).

Analise a conversa abaixo entre a CDS Industrial e o cliente "${lead.nome || 'Cliente'}" e gere uma proposta comercial estruturada.

CONVERSA:
${conversaFormatada || '(sem mensagens registradas)'}

DADOS DO LEAD:
- Nome: ${lead.nome || ''}
- Empresa: ${lead.empresa || ''}
- Telefone: ${lead.telefone || ''}
- Email: ${lead.email || ''}

Retorne SOMENTE um JSON valido com esta estrutura (sem markdown, apenas JSON puro):
{
  "empresa": "nome da empresa ou nome do cliente",
  "ac": "nome do contato se mencionado",
  "telefone": "${lead.telefone || ''}",
  "email": "${lead.email || ''}",
  "cidade": "cidade/estado mencionada ou vazio",
  "vendedor": "Jean",
  "validade": "7 dias corridos",
  "frete": "A combinar",
  "pagamento": "50% de entrada e 50% na entrega",
  "prazoEntrega": "A confirmar apos aceite formal",
  "intro": "paragrafo introdutorio personalizado (2-3 frases, mencione o produto/servico solicitado)",
  "itens": [{ "nome": "produto", "descricao": "especificacao tecnica", "qtd": 1, "valorUnitario": 0 }],
  "observacoes": "pontos importantes da conversa"
}

Regras: 1) Extraia todos os produtos/servicos - cada um e um item separado. 2) Use quantidades da conversa ou 1. 3) Use precos da conversa ou 0. 4) intro menciona o cliente pelo nome. 5) Use terminologia tecnica: escada metalica tipo marinheiro, guarda-corpo em aco galvanizado, etc.`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048 } }
  );

  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemini retornou resposta invalida. Tente novamente.');
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Metodo nao permitido' });

  const { telefone, nome, email, empresa } = req.body || {};
  if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });

  const tel = String(telefone).replace(/\D/g, '');

  try {
    const mensagens = await buscarMensagens(tel);
    const proposta  = await gerarPropostaComGemini(mensagens, { nome, email, empresa, telefone: tel });
    return res.status(200).json({ ok: true, proposta, totalMensagens: mensagens.length });
  } catch (err) {
    console.error('Erro proposta-ia:', err.response?.data || err.message);
    const msg = err.message || 'Erro interno';
    const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
    return res.status(status).json({ error: msg });
  }
}
