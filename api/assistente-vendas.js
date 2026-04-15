import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cds-erp-industrial';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const ETAPAS_LABEL = {
  lead_novo: 'Lead Novo',
  contato_feito: 'Contato Feito',
  qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Em Negociação',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
};

// Conhecimento resumido (curto, economia de tokens)
const CONHECIMENTO_EMPRESA = `CDS Industrial — fábrica metálica em Brasília/DF. Vendedor: Jean.
Produtos: escadas/rampas (ABNT/NR+ART), tampas casa de máquinas (70x70-110x110, garantia 10a),
chapas sob medida, móveis/bancadas industriais, carrinhos, projetos sob encomenda (CAD+ART).
PIX 7% OFF | cupom 1COMPRA 5% OFF | Entrega Brasil todo + Munck 14t.`;

const CONHECIMENTO_RAW_URL =
  'https://raw.githubusercontent.com/smoke182desu/cds-erp-industrial/main/empresa-conhecimento.md';

async function buscarContextoExtra() {
  try {
    const resp = await axios.get(CONHECIMENTO_RAW_URL, { timeout: 4000 });
    const match = resp.data.match(/CONTEXTO_EXTRA=([^\n`]*)/);
    const valor = match ? match[1].trim() : '';
    return valor || null;
  } catch {
    return null;
  }
}

async function buscarMensagens(telefone) {
  try {
    const resp = await axios.post(
      `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`,
      {
        structuredQuery: {
          from: [{ collectionId: 'mensagens' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'telefone' },
              op: 'EQUAL',
              value: { stringValue: telefone },
            },
          },
          orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'ASCENDING' }],
          limit: 150,
        },
      }
    );
    return (resp.data || [])
      .filter(r => r.document)
      .map(r => {
        const f = r.document.fields || {};
        return {
          tipo: f.tipo?.stringValue || 'entrada',
          texto: f.texto?.stringValue || f.mensagem?.stringValue || '',
        };
      })
      .filter(m => m.texto.trim());
  } catch {
    return [];
  }
}

async function analisarConversa(mensagens, lead) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');

  // Últimas 10 mensagens — economia de tokens
  const ultimas = mensagens.slice(-10);
  const conversaStr = ultimas.length > 0
    ? ultimas.map(m => `[${m.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}]: ${m.texto}`).join('\n')
    : 'Sem mensagens — primeiro contato.';

  const etapa = ETAPAS_LABEL[lead.etapa] || lead.etapa;
  const contextoExtra = await buscarContextoExtra();
  const extra = contextoExtra ? `\nEXTRA: ${contextoExtra}` : '';

  const prompt = `Assiste o vendedor JEAN da CDS Industrial.
${CONHECIMENTO_EMPRESA}${extra}
LEAD atual: nome="${lead.nome || ''}" empresa="${lead.empresa || ''}" etapa=${etapa}

CONVERSA (leia toda para entender o momento):
${conversaStr}

Retorne APENAS JSON:
{
 "dadosProposta":{
  "tipoCliente":"empresa|pessoa_fisica|orgao_publico|nao_identificado",
  "nome":"nome da pessoa de contato (sem emojis, ou vazio)",
  "empresa":"razão social da empresa cliente (ou vazio se PF)",
  "documento":"CPF ou CNPJ (ou vazio)",
  "email":"(ou vazio)",
  "endereco":"(ou vazio)",
  "produtos":["item c/ qtd e medidas"],
  "valorEstimado":"R$ (ou vazio)",
  "prazo":"(ou vazio)",
  "observacoes":"1 frase curta p/ proposta"
 },
 "etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido",
 "sugestoes":[
  {"label":"curto","mensagem":"resposta pronta WhatsApp"},
  {"label":"curto","mensagem":"resposta pronta WhatsApp"},
  {"label":"curto","mensagem":"resposta pronta WhatsApp"}
 ]
}

REGRAS SUGESTÕES:
- Continuação natural do diálogo atual (não resposta isolada).
- Máx 2 linhas, ≤280 chars, tom profissional humano (Jean no WhatsApp).
- Citar produto + 1 característica técnica (medida, ABNT, prazo, garantia, desconto PIX).
- 3 ângulos diferentes: (a) direta/técnica, (b) gatilho/urgência, (c) avançar funil.
- Não assinar "Jean" no meio — só em despedida.
- Nomes de cliente SEM emojis/emoticons.`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const raw = result?.text || '';
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error('JSON inválido: ' + raw.substring(0, 200));
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const { telefone, nome, empresa, etapa } = req.body || {};
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY não configurada.' });
    }
    const mensagens = telefone ? await buscarMensagens(telefone) : [];
    const analise = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });
    return res.status(200).json({ analise, totalMensagens: mensagens.length });
  } catch (e) {
    console.error('[assistente-vendas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
