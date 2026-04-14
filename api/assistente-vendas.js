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
  const conversaStr = mensagens.length > 0 ? mensagens.slice(-80).map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`).join('\n') : 'Sem mensagens ainda — possível primeiro contato ou lead recém-captado.';
  const etapaAtualLabel = ETAPAS_LABEL[lead.etapa] || lead.etapa;
  const prompt = `Você é um especialista sênior em vendas B2B industrial com domínio em VendaC, V4 Company, SPIN Selling, BANT e Challenger Sale.

LEAD: ${lead.nome || 'Cliente'} | Empresa: ${lead.empresa || 'não informada'} | Tel: ${lead.telefone || 'sem telefone'} | Etapa: ${etapaAtualLabel}

CONVERSA:
${conversaStr}
FIM DA CONVERSA

Retorne APENAS JSON puro sem nenhum texto extra, sem markdown, sem bloco de código, começando diretamente com { e terminando com }:
{"etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido","deveAvancarEtapa":true,"motivoAvanco":"motivo","sentimento":"Interessado|Hesitante|Resistente|Animado|Neutro|Frio|Urgente","parecer":"análise em 2-3 frases","tecnicaRecomendada":"técnica + justificativa","sinaisPositivos":["sinal"],"objeccoes":["objeção"],"proximoPasso":"instrução direta","sugestoes":[{"label":"rótulo","mensagem":"texto whatsapp informal"}]}`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { temperature: 0.1, maxOutputTokens: 2048 } });
  const raw = result?.text || '';
  const clean = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(clean); } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    throw new Error('Resposta da IA inválida (JSON malformado): ' + clean.substring(0, 200));
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
