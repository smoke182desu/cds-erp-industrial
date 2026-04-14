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

const CONHECIMENTO_EMPRESA = `
EMPRESA VENDEDORA (SOMOS NÓS): CDS Industrial
- Fábrica de produtos metálicos em Brasília/DF, manufatura sob demanda
- Site: https://cdsind.com.br
- WhatsApp Vendas: (61) 99308-1396
- E-mail: vendas01@cdsind.com.br
- Fábrica/Retirada: Núcleo Rural Córrego do Torto, Trecho 3-A, Brasília/DF
- Horário: Segunda a Domingo, 09h–17h
- Entrega para todo o Brasil (transportadoras parceiras + Munck próprio 14 ton)

PRODUTOS E CATEGORIAS:
1. Escadas, Rampas & Plataformas — conformidade ABNT/NR, projeto CAD 3D + ART CREA
2. Tampas de Casa de Máquinas — 70x70 até 110x110cm, aço carbono + epóxi, garantia 10 anos
3. Chapas Cortadas Sob Medida — aço carbono, galvanizado ou inox, espessuras variadas
4. Móveis & Bancadas Industriais — bancadas inox, estantes, mesas, escrivaninhas estrutura aço
5. Logística & Carga — carrinhos plataforma, tartarugas, transpaletes
6. Projetos Sob Encomenda — levantamento técnico → CAD 3D → fabricação → ART + databook

DIFERENCIAIS:
- Direto da fábrica: sem intermediários, preço justo, negociação direta com quem produz
- Engenharia própria: CAD 3D, cálculo estrutural, ART pelo CREA
- Conformidade ABNT/NR: documentação completa, mitiga riscos trabalhistas
- +500 projetos entregues com sucesso
- PIX: 7% de desconto | Cupom 1COMPRA: 5% OFF na primeira compra

TOM DE VOZ: Técnico mas acessível, direto, honesto. Não robotizado.
As sugestões de mensagem devem soar como um vendedor técnico real, cordial, informal no WhatsApp.
Mencione diferenciais da CDS Industrial quando pertinente nas sugestões.
`;

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
    ? mensagens.slice(-60).map(m => `[${m.tipo === 'saida' ? 'VENDEDOR CDS' : `CLIENTE (${lead.empresa || lead.nome || 'cliente'})`}]: ${m.texto}`).join('\n')
    : 'Sem mensagens ainda — primeiro contato ou lead recém-captado.';
  const etapaAtualLabel = ETAPAS_LABEL[lead.etapa] || lead.etapa;

  const prompt = `Você é um coach sênior de vendas B2B industrial assistindo a equipe comercial da CDS Industrial.

══════════════════════════════════════════════
CONTEXTO DA NOSSA EMPRESA (VENDEDOR = CDS Industrial)
══════════════════════════════════════════════
${CONHECIMENTO_EMPRESA}

══════════════════════════════════════════════
LEAD (CLIENTE/PROSPECT — NÃO É A NOSSA EMPRESA)
══════════════════════════════════════════════
Nome do contato: ${lead.nome || 'não informado'}
Empresa do CLIENTE: ${lead.empresa || 'não informada'}
Telefone: ${lead.telefone || 'não informado'}
Etapa atual no CRM: ${etapaAtualLabel}

⚠️ ATENÇÃO: "${lead.empresa || 'empresa do lead'}" é a empresa DO CLIENTE, não a CDS Industrial.
O VENDEDOR é sempre a CDS Industrial. O CLIENTE é ${lead.nome || 'o contato acima'}.

══════════════════════════════════════════════
CONVERSA (mensagens trocadas via WhatsApp)
══════════════════════════════════════════════
${conversaStr}

══════════════════════════════════════════════
METODOLOGIAS A APLICAR
══════════════════════════════════════════════
- VendaC: Conectar → Descobrir → Demonstrar → Comprometer
- SPIN Selling: Situação → Problema → Implicação → Necessidade-Benefício
- BANT: Budget, Authority, Need, Timeline
- Challenger Sale: ensinar, personalizar, assumir o controle
- Gatilhos: escassez, urgência, prova social, autoridade, reciprocidade

Retorne JSON com: etapaDetectada, deveAvancarEtapa, motivoAvanco, sentimento, parecer (2-3 frases), tecnicaRecomendada, sinaisPositivos (array máx 3), objeccoes (array máx 3), proximoPasso (instrução imperativa ao vendedor da CDS), sugestoes (array 3-4 objetos {label, mensagem} para WhatsApp, tom informal, personalizadas com nome do cliente, a CDS Industrial é quem envia).`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash', contents: prompt,
    config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
  });
  const raw = result?.text || '';
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    throw new Error('JSON inválido: ' + raw.substring(0, 300));
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
