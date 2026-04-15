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
  negociacao: 'Em NegociaÃ§Ã£o',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
};

// =============================================================
// CONHECIMENTO DA EMPRESA â edite aqui para customizar a IA
// =============================================================
const CONHECIMENTO_EMPRESA = `
EMPRESA VENDEDORA (SOMOS NÃS): CDS Industrial
- FÃ¡brica de produtos metÃ¡licos em BrasÃ­lia/DF, manufatura sob demanda
- Site: https://cdsind.com.br
- WhatsApp Vendas: (61) 99308-1396
- E-mail: vendas01@cdsind.com.br
- FÃ¡brica/Retirada: NÃºcleo Rural CÃ³rrego do Torto, Trecho 3-A, BrasÃ­lia/DF
- HorÃ¡rio: Segunda a Domingo, 09hâ17h
- Entrega para todo o Brasil (transportadoras parceiras + Munck prÃ³prio 14 ton)

PRODUTOS E CATEGORIAS:
1. Escadas, Rampas & Plataformas â conformidade ABNT/NR, projeto CAD 3D + ART CREA
2. Tampas de Casa de MÃ¡quinas â 70x70 atÃ© 110x110cm, aÃ§o carbono + epÃ³xi, garantia 10 anos
3. Chapas Cortadas Sob Medida â aÃ§o carbono, galvanizado ou inox, espessuras variadas
4. MÃ³veis & Bancadas Industriais â bancadas inox, estantes, mesas, escrivaninhas estrutura aÃ§o
5. LogÃ­stica & Carga â carrinhos plataforma, tartarugas, transpaletes
6. Projetos Sob Encomenda â levantamento tÃ©cnico â CAD 3D â fabricaÃ§Ã£o â ART + databook

DIFERENCIAIS:
- Direto da fÃ¡brica: sem intermediÃ¡rios, preÃ§o justo, negociaÃ§Ã£o direta com quem produz
- Engenharia prÃ³pria: CAD 3D, cÃ¡lculo estrutural, ART pelo CREA
- Conformidade ABNT/NR: documentaÃ§Ã£o completa, mitiga riscos trabalhistas
- +500 projetos entregues com sucesso
- PIX: 7% de desconto | Cupom 1COMPRA: 5% OFF na primeira compra

IDENTIDADE: Voce e JEAN, vendedor da CDS Industrial. Toda sugestao de resposta fala como Jean em primeira pessoa (ex: "sou o Jean da CDS..."). REGRA DURA: cada sugestao de resposta tem NO MAXIMO 2 linhas curtas de WhatsApp. Nunca escreva paragrafos. LEIA COM ATENCAO a ultima mensagem do CLIENTE e responda exatamente o que ele perguntou. Se ele fez uma pergunta objetiva, responda objetivamente. TOM DE VOZ: TÃ©cnico mas acessÃ­vel, direto, honesto. NÃ£o robotizado.
As sugestÃµes de mensagem devem soar como um vendedor tÃ©cnico real, cordial, informal no WhatsApp.
Mencione diferenciais da CDS Industrial quando pertinente nas sugestÃµes.
`;

// =============================================================
// CONTEXTO EXTRA â lido em tempo real do empresa-conhecimento.md
// Edite o campo CONTEXTO_EXTRA= naquele arquivo para mudar o
// comportamento da IA sem mexer no cÃ³digo.
// =============================================================
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
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY nÃ£o configurada no servidor');

  const conversaStr = mensagens.length > 0
    ? mensagens
        .slice(-60)
        .map(m => `[${m.tipo === 'saida' ? 'VENDEDOR CDS' : `CLIENTE (${lead.empresa || lead.nome || 'cliente'})`}]: ${m.texto}`)
        .join('\n')
    : 'Sem mensagens ainda â primeiro contato ou lead recÃ©m-captado.';

  const etapaAtualLabel = ETAPAS_LABEL[lead.etapa] || lead.etapa;

  // Busca contexto extra editÃ¡vel (ex: promoÃ§Ãµes, prazos, avisos da semana)
  const contextoExtra = await buscarContextoExtra();
  const blocoContextoExtra = contextoExtra
    ? `\nââââââââââââââââââââââââââââââââââââââââââââââ\nCONTEXTO ADICIONAL (instruÃ§Ãµes especiais da equipe)\nââââââââââââââââââââââââââââââââââââââââââââââ\n${contextoExtra}\n`
    : '';

  const prompt = `VocÃª Ã© um coach sÃªnior de vendas B2B industrial e analista de CRM assistindo a equipe comercial da CDS Industrial.

ââââââââââââââââââââââââââââââââââââââââââââââ
CONTEXTO DA NOSSA EMPRESA (VENDEDOR = CDS Industrial)
ââââââââââââââââââââââââââââââââââââââââââââââ
${CONHECIMENTO_EMPRESA}
${blocoContextoExtra}
ââââââââââââââââââââââââââââââââââââââââââââââ
LEAD (CLIENTE/PROSPECT â NÃO Ã A NOSSA EMPRESA)
ââââââââââââââââââââââââââââââââââââââââââââââ
Nome do contato: ${lead.nome || 'nÃ£o informado'}
Empresa do CLIENTE: ${lead.empresa || 'nÃ£o informada'}
Telefone: ${lead.telefone || 'nÃ£o informado'}
Etapa atual no CRM: ${etapaAtualLabel}

â ï¸ ATENÃÃO: "${lead.empresa || 'empresa do lead'}" Ã© a empresa DO CLIENTE, nÃ£o a CDS Industrial.
O VENDEDOR Ã© sempre a CDS Industrial. O CLIENTE Ã© ${lead.nome || 'o contato acima'}.

ââââââââââââââââââââââââââââââââââââââââââââââ
CONVERSA (mensagens trocadas via WhatsApp)
ââââââââââââââââââââââââââââââââââââââââââââââ
${conversaStr}

ââââââââââââââââââââââââââââââââââââââââââââââ
METODOLOGIAS A APLICAR
ââââââââââââââââââââââââââââââââââââââââââââââ
- VendaC: Conectar â Descobrir â Demonstrar â Comprometer
- SPIN Selling: SituaÃ§Ã£o â Problema â ImplicaÃ§Ã£o â Necessidade-BenefÃ­cio
- BANT: Budget, Authority, Need, Timeline
- Challenger Sale: ensinar, personalizar, assumir o controle
- Gatilhos: escassez, urgÃªncia, prova social, autoridade, reciprocidade
- Tratamento de objeÃ§Ãµes: Feel-Felt-Found, pergunta reversa
- Fechamento: assumptivo, por alternativas, por urgÃªncia, test close

ââââââââââââââââââââââââââââââââââââââââââââââ
INSTRUÃÃES DE ANÃLISE
ââââââââââââââââââââââââââââââââââââââââââââââ
Analise TODA a conversa com profundidade e retorne um objeto JSON com os seguintes campos:

CAMPOS EXISTENTES (mantenha a qualidade):
- etapaDetectada: string (lead_novo/contato_feito/qualificado/proposta_enviada/negociacao/fechado_ganho/fechado_perdido)
- deveAvancarEtapa: boolean
- motivoAvanco: string (1 frase â sÃ³ preencher se deveAvancarEtapa=true)
- sentimento: string (Interessado/Hesitante/Resistente/Animado/Neutro/Frio/Urgente)
- tecnicaRecomendada: string (nome da tÃ©cnica + por que ela se aplica agora)
- sinaisPositivos: array de strings (mÃ¡x 3 sinais de compra identificados)
- objeccoes: array de strings (mÃ¡x 3 objeÃ§Ãµes detectadas; array vazio [] se nÃ£o houver)
- proximoPasso: string (instruÃ§Ã£o imperativa direta ao vendedor da CDS Industrial â 1 frase)
- sugestoes: array de 3-4 objetos {label: string, mensagem: string}
  * label: rÃ³tulo curto descrevendo a abordagem (ex: "Criar urgÃªncia", "Superar objeÃ§Ã£o de preÃ§o")
  * mensagem: texto pronto para enviar no WhatsApp, tom informal e natural como uma pessoa real,
    personalizado com o nome do cliente. Mencione a CDS Industrial (nÃ£o a empresa do cliente)
    como quem estÃ¡ enviando. Inclua diferenciais relevantes quando fizer sentido.

CAMPOS NOVOS (obrigatÃ³rios, extraia da conversa):

- parecer: string â ANÃLISE PROFUNDA E CONECTADA Ã CONVERSA. MÃ­nimo 5-7 frases.
  Deve cobrir: (1) como iniciou o relacionamento, (2) principais momentos/viradas da conversa,
  (3) o que o cliente revelou sobre sua necessidade real e urgÃªncia, (4) estado psicolÃ³gico atual
  do cliente e o que o estÃ¡ travando, (5) riscos da negociaÃ§Ã£o, (6) oportunidade principal a explorar.
  Cite fatos concretos da conversa (o que foi dito, o que foi prometido, o que ficou sem resposta).

- tipoCliente: string â classifique com base na conversa e no nome da empresa:
  "empresa" (CNPJ, empresa privada), "pessoa_fisica" (CPF, consumidor individual),
  "orgao_publico" (prefeitura, governo, autarquia, licitaÃ§Ã£o), "nao_identificado"

- produtosDiscutidos: array de strings â todos os produtos, categorias ou serviÃ§os mencionados
  na conversa (ex: ["Tampa de Casa de MÃ¡quinas 80x80", "Escada metÃ¡lica 5 degraus", "Projeto sob encomenda"]).
  Array vazio [] se nenhum produto especÃ­fico foi mencionado.

- produtosComprados: array de strings â produtos que foram CONFIRMADOS como pedido ou compra
  (ex: ["2x Tampa 80x80 - pedido #1234", "Chapa galvanizada 2mm"]). Array vazio [] se nÃ£o houve compra confirmada.

- destaques: array de strings (mÃ¡x 5) â os pontos mais importantes que aconteceram nessa negociaÃ§Ã£o,
  em ordem cronolÃ³gica quando possÃ­vel. Inclua: valores mencionados, prazos prometidos, decisÃµes tomadas,
  visitas tÃ©cnicas, orÃ§amentos enviados, aprovaÃ§Ãµes parciais, escalonamento de decisÃ£o.
  Ex: ["OrÃ§amento de R$4.500 enviado em 12/03", "Cliente pediu prazo de 30 dias para pagamento",
  "DecisÃ£o depende do diretor financeiro que volta na segunda"].
  Array vazio [] se nÃ£o hÃ¡ nada relevante ainda.

- reclamacoes: array de strings (mÃ¡x 3) â reclamaÃ§Ãµes, insatisfaÃ§Ãµes ou pontos de atrito
  mencionados pelo cliente (ex: ["Prazo de entrega muito longo", "PreÃ§o acima do orÃ§amento",
  "Atendimento demorou para responder"]). Array vazio [] se nÃ£o houver.

- promessas: array de strings (mÃ¡x 4) â compromissos assumidos PELO VENDEDOR DA CDS Industrial
  na conversa (ex: ["EnviarÃ¡ orÃ§amento atÃ© quinta-feira", "Garantiu entrega em 15 dias Ãºteis",
  "Prometeu desconto de 5% se fechar atÃ© o fim do mÃªs"]). Array vazio [] se nÃ£o houver.

- dadosExtraidos: objeto com dados cadastrais inferidos da conversa:
  {
    "nome": string (nome completo ou parcial do contato, ou "" se nÃ£o identificado),
    "empresa": string (nome da empresa do cliente, ou "" se nÃ£o identificado),
    "email": string (e-mail mencionado na conversa, ou ""),
    "telefone": string (telefone do cliente, ou ""),
    "documento": string (CPF ou CNPJ mencionado, ou ""),
    "endereco": string (endereÃ§o ou cidade mencionados, ou ""),
    "cargo": string (cargo ou funÃ§Ã£o do contato, ex: "Gerente de Compras", ou "")
  }`;

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
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* continua */ }
    }
    throw new Error('JSON invÃ¡lido: ' + raw.substring(0, 300));
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'MÃ©todo nÃ£o permitido' });

  try {
    const { telefone, nome, empresa, etapa } = req.body || {};

    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY nÃ£o configurada. Configure nas variÃ¡veis de ambiente do Vercel.' });
    }

    const mensagens = telefone ? await buscarMensagens(telefone) : [];
    const analise = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });

    return res.status(200).json({ analise, totalMensagens: mensagens.length });
  } catch (e) {
    console.error('[assistente-vendas] erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno no assistente de vendas' });
  }
}
