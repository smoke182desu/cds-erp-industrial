çimport axios from 'axios';
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

async function buscarMensagens(telefone) {
  try {
    const resp = await axios.post(
      `${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`,
      { structuredQuery: { from: [{ collectionId: 'mensagens' }], where: { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: telefone } } }, orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'ASCENDING' }], limit: 150 } }
    );
    return (resp.data || []).filter(r => r.document).map(r => { const f = r.document.fields || {}; return { tipo: f.tipo?.stringValue || 'entrada', texto: f.texto?.stringValue || f.mensagem?.stringValue || '', criadoEm: f.criadoEm?.timestampValue || '' }; }).filter(m => m.texto.trim());
  } catch { return []; }
}

async function analisarConversa(mensagens, lead) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');
  const conversaStr = mensagens.length > 0 ? mensagens.slice(-80).map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`).join('\n') : 'Sem mensagens ainda.';
  const etapaAtualLabel = ETAPAS_LABEL[lead.etapa] || lead.etapa;

  const prompt = `Você é coach sênior de vendas B2B industrial. Analise o lead e retorne JSON estruturado.

LEAD: ${lead.nome || 'Cliente'} | Empresa: ${lead.empresa || 'não informada'} | Etapa CRM: ${etapaAtualLabel}

CONVERSA:
${conversaStr}

Use VendaC (Conectar→Descobrir→Demonstrar→Comprometer), SPIN Selling, BANT, Challenger Sale e gatilhos mentais.

Retorne um objeto JSON com os campos: etapaDetectada (string: lead_novo/contato_feito/qualificado/proposta_enviada/negociacao/fechado_ganho/fechado_perdido), deveAvancarEtapa (boolean), motivoAvanco (string), sentimento (string: Interessado/Hesitante/Resistente/Animado/Neutro/Frio/Urgente), parecer (string 2-3 frases), tecnicaRecomendada (string), sinaisPositivos (array de strings), objeccoes (array de strings), proximoPasso (string imperativa), sugestoes (array de 3-4 objetos com label e mensagem para WhatsApp, tom informal).`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const raw = result?.text || '';
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    throw new Error('JSON invalido: ' + raw.substring(0, 300));
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
    if (!GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY não configurada. Configure nas variáveis de ambiente do Vercel.' });
    const mensagens = telefone ? await buscarMensagens(telefone) : [];
    const analise = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });
    return res.status(200).json({ analise, totalMensagens: mensagens.length });
  } catch (e) {
    console.error('[assistente-vendas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno no assistente de vendas' });
  }
}
