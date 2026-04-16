import axios from 'axios';

// Groq - modelo gratuito (14.400 req/dia) substitui Gemini
const GROQ_MODEL = 'llama-3.1-8b-instant';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0908948294';
const DATABASE_ID      = process.env.FIREBASE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const GROQ_API_KEY     = process.env.GROQ_API_KEY || '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';

// Tempo em minutos sem trocar mensagem que consideramos ser "outra conversa anterior".
const JANELA_CONVERSA_MIN = 180; // 3h sem responder = corta e pega so a conversa atual
const MAX_MSGS_CONTEXTO   = 20;  // teto duro para nao inflar o prompt

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

// Pega apenas a "conversa atual": do fim pra tras, ate encontrar um gap > JANELA_CONVERSA_MIN.
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

async function gerarPropostaComGroq(mensagens, { nome, email, empresa, telefone }) {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY nao configurada no servidor');

  const conversa = recortarConversaAtual(mensagens)
      .map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`)
      .join('\n');

  const prompt = `Voce gera propostas comerciais da CDS Industrial (metalurgia / caldeiraria / estruturas).
Baseie-se APENAS na conversa abaixo (ignore historico anterior). Se faltar info, use valores estimados razoaveis e marque com "(estimado)".

Lead: ${nome || '-'} | ${empresa || '-'} | ${email || '-'} | ${telefone || '-'}

Conversa atual:
${conversa || '(sem mensagens)'}

Responda SOMENTE um JSON valido, sem texto antes ou depois, no formato:
{
  "titulo": "string curto",
  "descricao": "string ate 400 caracteres",
  "itens": [ { "descricao": "string", "quantidade": number, "unidade": "string", "precoUnitario": number } ],
  "observacoes": "string"
}`;

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 900,
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
        const proposta = await gerarPropostaComGroq(mensagens, { nome, email, empresa, telefone: tel });
        return res.status(200).json({
                ok: true,
                proposta,
                totalMensagens: mensagens.length,
                mensagensUsadas: conversaAtual.length,
                modelo: GROQ_MODEL,
        });
  } catch (err) {
        console.error('Erro proposta-ia:', err.response?.data || err.message);
        const msg = err.message || 'Erro interno';
        const status = msg.includes('GROQ_API_KEY') ? 503 : 500;
        return res.status(status).json({ error: msg });
  }
}

