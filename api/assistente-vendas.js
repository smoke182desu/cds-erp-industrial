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
          criadoEm: f.criadoEm?.timestampValue || '',
        };
      })
      .filter(m => m.texto.trim());
  } catch {
    return [];
  }
}

async function analisarConversa(mensagens, lead) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');

  const conversaStr = mensagens.length > 0
    ? mensagens
        .slice(-80)
        .map(m => `[${m.tipo === 'saida' ? 'VENDEDOR' : 'CLIENTE'}]: ${m.texto}`)
        .join('\n')
    : 'Sem mensagens ainda — possível primeiro contato ou lead recém-captado.';

  const etapaAtualLabel = ETAPAS_LABEL[lead.etapa] || lead.etapa;

  const prompt = `Você é um especialista sênior em vendas B2B industrial, coach de alta performance comercial com domínio completo em:

METODOLOGIAS:
- VendaC (Conectar → Descobrir → Demonstrar → Comprometer)
- V4 Company (funil data-driven, LTV, performance, jornada do cliente)
- SPIN Selling (Situação → Problema → Implicação → Necessidade-Benefício)
- BANT (Budget, Authority, Need, Timeline)
- Challenger Sale (ensinar, personalizar, assumir o controle)

TÉCNICAS:
- Rapport e espelhamento
- Ancoragem de valor (mostrar ROI antes do preço)
- Gatilhos mentais: escassez, urgência, prova social, autoridade, reciprocidade
- Tratamento de objeções: Feel-Felt-Found, técnica da pergunta reversa, "e se"
- Fechamento: assumptivo, por alternativas, por urgência, por resumo, test close
- Follow-up cadenciado, storytelling de casos de sucesso

LEAD: ${lead.nome || 'Cliente'} | Empresa: ${lead.empresa || 'não informada'} | Tel: ${lead.telefone || 'sem telefone'} | Etapa atual no CRM: ${etapaAtualLabel}

CONVERSA COMPLETA:
${conversaStr}
FIM DA CONVERSA

Analise esta conversa com olhar clínico de especialista em vendas B2B industrial. Retorne APENAS um JSON válido (sem markdown, sem \`\`\`json, sem texto extra) com esta estrutura:
{
  "etapaDetectada": "lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido",
  "deveAvancarEtapa": true ou false,
  "motivoAvanco": "justificativa clara de 1 frase do por que avançar agora (apenas quando deveAvancarEtapa=true)",
  "sentimento": "Interessado|Hesitante|Resistente|Animado|Neutro|Frio|Urgente",
  "parecer": "Análise objetiva em 2-3 frases: qual é o momento real da negociação, o que está acontecendo psicologicamente com o cliente e qual é o ponto crítico agora",
  "tecnicaRecomendada": "Nome exato da técnica mais adequada agora + justificativa em 1 frase de por que ela se aplica a este momento específico",
  "sinaisPositivos": ["sinal de compra ou engajamento identificado na conversa"],
  "objeccoes": ["objeção, dúvida ou resistência detectada (lista vazia [] se não houver)"],
  "proximoPasso": "A ação comercial mais importante e urgente agora, escrita como instrução direta ao vendedor (1 frase imperativa)",
  "sugestoes": [
    {
      "label": "Rótulo curto descrevendo a abordagem (ex: Quebrar objeção de preço)",
      "mensagem": "Texto exato para enviar no WhatsApp. Tom informal e natural, como uma pessoa real escreveria — sem robotismo, sem formalidade excessiva. Personalize com o nome do cliente quando fizer sentido. Seja específico ao contexto desta conversa."
    }
  ]
}

Forneça 3 a 4 sugestões de mensagem cobrindo diferentes ângulos táticos (ex: uma para criar urgência, uma para superar objeção, uma para avançar para próxima etapa, etc). As mensagens devem ser cirúrgicas e específicas para este momento.`;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { temperature: 0.2, maxOutputTokens: 2048 },
  });

  const raw = result?.text || '';
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Resposta da IA inválida (JSON malformado)');
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
      return res.status(503).json({ error: 'GEMINI_API_KEY não configurada. Configure nas variáveis de ambiente do Vercel.' });
    }

    const mensagens = telefone ? await buscarMensagens(telefone) : [];
    const analise = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });

    return res.status(200).json({ analise, totalMensagens: mensagens.length });
  } catch (e) {
    console.error('[assistente-vendas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno no assistente de vendas' });
  }
}
