import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cds-erp-industrial';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const ETAPAS_LABEL = {
  lead_novo: 'Lead Novo', contato_feito: 'Contato Feito', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada', negociacao: 'Em Negociação',
  fechado_ganho: 'Fechado (Ganho)', fechado_perdido: 'Fechado (Perdido)',
};

async function buscarMensagens(telefone) {
  try {
    const resp = await axios.post(`${BASE_URL}:runQuery?key=${FIREBASE_API_KEY}`, {
      structuredQuery: { from: [{ collectionId: 'mensagens' }], where: { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: telefone } } }, orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'ASCENDING' }], limit: 150 }
    });
    return (resp.data || []).filter(r => r.document).map(r => { const f = r.document.fields || {}; return { tipo: f.tipo?.stringValue || 'entrada', texto: f.texto?.stringValue || f.mensagem?.stringValue || '' }; }).filter(m => m.texto.trim());
  } catch { return []; }
}

async function analisarConversa(mensagens, lead) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');
  const conversaStr = mensagens.length > 0
    ? mensagens.slice(-60).map(m => `[${m.tipo === 'saida' ? 'V' : 'C'}]: ${m.texto}`).join('\n')
    : 'Sem mensagens ainda.';
  const etapaLabel = ETAPAS_LABEL[lead.etapa] || lead.etapa;
  const prompt = `Coach sênior de vendas B2B industrial. Analise e responda em JSON.

LEAD: ${lead.nome || 'Cliente'} | Empresa: ${lead.empresa || '?'} | Etapa: ${etapaLabel}
CONVERSA: ${conversaStr}

Metodologias: VendaC, SPIN Selling, BANT, Challenger Sale, V4 Company.

JSON de resposta (campos obrigatórios):
- etapaDetectada: lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido
- deveAvancarEtapa: boolean
- motivoAvanco: string (1 frase, só se deveAvancarEtapa=true)
- sentimento: Interessado|Hesitante|Resistente|Animado|Neutro|Frio|Urgente
- parecer: string (2 frases sobre momento da negociação)
- tecnicaRecomendada: string (nome + por que agora)
- sinaisPositivos: array de strings (máx 3)
- objeccoes: array de strings (máx 3, vazio se não houver)
- proximoPasso: string (instrução imperativa ao vendedor)
- sugestoes: array de 3 objetos {label: string, mensagem: string} para WhatsApp (tom informal, direto)`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
  });

  const raw = result?.text || '';
  try { return JSON.parse(raw); }
  catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    throw new Error('JSON invalido: ' + raw.substring(0, 400));
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
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
