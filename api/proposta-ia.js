import axios from 'axios';

// Cheapest Gemini model available (Flash Lite ~ 1/10 do preco do Flash)
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID       = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0908948294';
const DATABASE_ID      = process.env.FIREBASE_DATABASE_ID || 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || '';

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
                  limit: 50, // bem menor que antes (150) - so precisamos do fim
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

async function gerarPropostaComGemini(mensagens, { nome, email, empresa, telefone }) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY nao configurada no servidor');

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 900,
                  responseMimeType: 'application/json',
          },
    });

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Metodo nao permitido' });

  const { telefone, nome, email, empresa } = req.body || {};
    if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });

  const tel = String(telefone).replace(/\D/g, '');

  try {
        const mensagens = await buscarMensagens(tel);
        const conversaAtual = recortarConversaAtual(mensagens);
        const proposta = await gerarPropostaComGemini(mensagens, { nome, email, empresa, telefone: tel });
        return res.status(200).json({
                ok: true,
                proposta,
                totalMensagens: mensagens.length,
                mensagensUsadas: conversaAtual.length,
                modelo: GEMINI_MODEL,
        });
  } catch (err) {
        console.error('Erro proposta-ia:', err.response?.data || err.message);
        const msg = err.message || 'Erro interno';
        const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
        return res.status(status).json({ error: msg });
  }
}
