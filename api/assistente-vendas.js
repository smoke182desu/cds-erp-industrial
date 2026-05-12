import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { selectAll, update } from './_lib/supabase.js';

const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const PROMPT_VERSION = 'momento-conversa-v5-checkup';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite'
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];

const ETAPAS_LABEL = {
  lead_novo: 'Lead Novo',
  contato_feito: 'Contato Feito',
  qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Em Negociacao',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
};

const CONHECIMENTO_EMPRESA = `CDS Industrial - fabrica metalica em Brasilia/DF. Vendedor: Jean.
Produtos: chapas dobradas, pecas em metalon/tubo/chapa, pes de mesa, carrinhos, tampas para casas de maquinas, containers de lixo, escadas/rampas (ABNT/NR+ART), bancadas e projetos sob encomenda.
Capacidades: solda MIG e eletrica; dobra de chapas ate 6,35mm; corte reto em guilhotina; dobradeira e guilhotina de 3m; pintura com compressor industrial em tinta epoxi, esmalte sintetico ou PU.
Limites: nao fazemos plasma, oxicorte ou cortes curvos/recortados; pecas passam de 3m somente com emenda/solda. Materiais: aluminio, aco carbono, aco galvanizado, inox 430 e inox 304. Aco carbono 1010/1020; chapa acima de 14 geralmente A36.
PIX 7% OFF | cupom 1COMPRA 5% OFF | Entrega Brasil todo + Munck 14t.`;

const CONHECIMENTO_RAW_URL =
  'https://raw.githubusercontent.com/smoke182desu/cds-erp-industrial/main/empresa-conhecimento.md';

async function buscarContextoExtra() {
  try {
    const resp = await axios.get(CONHECIMENTO_RAW_URL, { timeout: 5000 });
    return resp.data || '';
  } catch {
    return '';
  }
}

async function buscarMensagens(telefone) {
  try {
    const data = await selectAll('mensagens', { filters: { telefone: `eq.${telefone}` }, orderBy: 'criado_em' });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(row => ({
      tipo: row.tipo || 'entrada',
      texto: row.texto || row.conteudo || '',
      criadoEm: row.criado_em || row.created_at || '',
    }))
      .filter(m => m.texto.trim())
      .sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
  } catch {
    return [];
  }
}

// Busca insights globais aprendidos pelo Bruno para injetar no prompt de Giorno
async function buscarInsightsGlobais(etapa) {
  try {
    const { data, error } = await supabaseClient
      .from('ia_insights_globais')
      .select('tipo, contexto, insight, confianca')
      .gte('confianca', 40)
      .gte('usos', 3)
      .order('confianca', { ascending: false })
      .limit(10);
    if (error) throw error;
    // Prioriza insights relevantes para a etapa atual
    const relevantes = (data || []).sort((a, b) => {
      const aRel = a.contexto?.includes(etapa) ? 1 : 0;
      const bRel = b.contexto?.includes(etapa) ? 1 : 0;
      return bRel - aRel;
    });
    return relevantes;
  } catch {
    return []; // falha silenciosa — insights sao bonus, nao bloqueantes
  }
}


// Em serverless, vive durante warm instances (~5-15min)
const cache = new Map();
const CACHE_TTL = 180000; // Aumentado para 3 minutos (evita frontend spam)

function getCacheKey(telefone, mensagens = []) {
  const ultima = mensagens[mensagens.length - 1] || {};
  return `assistente_${PROMPT_VERSION}_${telefone}_${mensagens.length}_${ultima.tipo || ''}_${ultima.criadoEm || ''}_${ultima.texto || ''}`;
}

function getCache(telefone, mensagens) {
  const key = getCacheKey(telefone, mensagens);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(telefone, mensagens, data) {
  cache.set(getCacheKey(telefone, mensagens), { data, ts: Date.now() });
  // Limpa cache antigo (max 50 entries)
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

function obterSaudacao() {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(new Date()));
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function removerSaudacao(texto) {
  return String(texto || '')
    .replace(/^(oi|ola|olá)[!,.\s-]*/i, '')
    .replace(/^(bom dia|boa tarde|boa noite)[!,.\s-]*/i, '')
    .trim();
}

function encurtarMensagem(texto, maxPalavras = 14) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  const palavras = limpo.split(' ').filter(Boolean);
  if (palavras.length <= maxPalavras) return limpo;

  const primeiraFrase = limpo.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (primeiraFrase && primeiraFrase.split(' ').length <= maxPalavras) return primeiraFrase;
  const curta = palavras.slice(0, maxPalavras).join(' ');
  return limpo.includes('?') ? `${curta}?` : curta;
}

function pareceMedidaCurta(texto) {
  return /^\s*\d+([.,]\d+)?\s*[xX]\s*\d+([.,]\d+)?\s*$/.test(String(texto || ''));
}

function sugestoesDepoisDaRespostaDoJean(ultimaMensagem) {
  const texto = String(ultimaMensagem?.texto || '').trim();
  if (pareceMedidaCurta(texto)) {
    return [
      { label: 'Aguardar retorno', mensagem: 'Fico no aguardo da confirmação.' },
      { label: 'Complementar medida', mensagem: 'Essa é a medida do modelo fabricado.' },
      { label: 'Confirmar configuração', mensagem: 'Ele vai com pneus, conforme conversamos.' },
      { label: 'Próximo passo', mensagem: 'Se aprovar, calculo valor e prazo.' },
    ];
  }

  return [
    { label: 'Aguardar retorno', mensagem: 'Fico no aguardo.' },
    { label: 'Complementar', mensagem: 'Posso complementar com mais detalhes.' },
    { label: 'Próximo passo', mensagem: 'Se fizer sentido, avanço com o orçamento.' },
    { label: 'Confirmar', mensagem: 'Pode me confirmar se ficou claro?' },
  ];
}

function minutosDesde(data) {
  const t = new Date(data || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function textoIndicaOrcamento(texto) {
  return /\b(valor|preco|preço|prazo|entrega|orcamento|orçamento|quanto fica|quanto custa)\b/i.test(String(texto || ''));
}

function gerarCheckupAtendimento(analise, mensagens) {
  const lista = Array.isArray(mensagens) ? mensagens : [];
  const ultima = lista[lista.length - 1] || null;
  const ultimaCliente = [...lista].reverse().find(m => m.tipo !== 'saida') || null;
  const ultimaJean = [...lista].reverse().find(m => m.tipo === 'saida') || null;
  const pendenteCliente = !!ultima && ultima.tipo !== 'saida';
  const minutos = ultima ? minutosDesde(ultima.criadoEm) : 0;
  const faltantes = analise?.diretorVendas?.dadosFaltantesProduto || [];
  const pediuOrcamento = textoIndicaOrcamento(ultimaCliente?.texto);

  let status = 'em_acompanhamento';
  let prioridade = 'media';
  let prazoResposta = 'Hoje';
  let motivo = 'Atendimento em andamento.';
  const tarefas = [];

  if (!ultima) {
    status = 'sem_conversa';
    prioridade = 'baixa';
    prazoResposta = 'Sem prazo';
    motivo = 'Lead sem conversa recente.';
  } else if (pendenteCliente) {
    status = 'responder_cliente';
    prioridade = minutos >= 60 || pediuOrcamento ? 'alta' : 'media';
    prazoResposta = minutos >= 60 || pediuOrcamento ? 'Responder agora' : 'Responder em ate 15 min';
    motivo = pediuOrcamento
      ? 'Cliente pediu valor/prazo e precisa de retorno comercial.'
      : 'Cliente foi o ultimo a falar e aguarda resposta.';
    tarefas.push({
      tipo: pediuOrcamento ? 'orcamento' : 'resposta',
      titulo: pediuOrcamento ? 'Responder valor/prazo ou pedir dado faltante' : 'Responder cliente',
      prazo: prazoResposta,
    });
  } else {
    status = 'aguardando_cliente';
    prioridade = 'baixa';
    prazoResposta = 'Relembrar em 2 horas uteis';
    motivo = 'Jean foi o ultimo a responder. Acompanhar retorno do cliente.';
    tarefas.push({
      tipo: 'follow_up',
      titulo: 'Relembrar cliente se nao responder',
      prazo: prazoResposta,
    });
  }

  if (faltantes.length > 0) {
    tarefas.push({
      tipo: 'coleta_dados',
      titulo: `Coletar dados faltantes: ${faltantes.slice(0, 3).join(', ')}`,
      prazo: pendenteCliente ? 'Na proxima resposta' : 'Antes do orcamento',
    });
  }

  const parametrosVenda = [
    'Produto/familia identificado corretamente',
    'Medidas e quantidade confirmadas',
    'Carga/uso/ambiente avaliados quando relevante',
    'Material e acabamento definidos',
    'Valor, prazo e proximo passo alinhados',
  ];

  const riscos = [];
  if (pendenteCliente) riscos.push('Cliente aguardando resposta.');
  if (pediuOrcamento && faltantes.length > 0) riscos.push('Orcamento pode sair impreciso sem dados faltantes.');
  if (!ultimaJean) riscos.push('Jean ainda nao conduziu o atendimento.');

  const notaAtendimento = Math.max(45, Math.min(95,
    80
    - (pendenteCliente ? 20 : 0)
    - (faltantes.length > 0 ? 10 : 0)
    + (ultimaJean ? 5 : 0)
  ));

  return {
    status,
    prioridade,
    prazoResposta,
    motivo,
    tarefas: tarefas.slice(0, 4),
    parametrosVenda,
    avaliacaoVenda: {
      nota: notaAtendimento,
      pontosFortes: ultimaJean ? ['Jean respondeu e manteve a conversa ativa.'] : [],
      riscos,
      cobranca: pendenteCliente ? 'Responder este cliente dentro do prazo.' : 'Monitorar retorno e fazer follow-up no prazo.',
    },
  };
}

function aplicarCheckupAtendimento(analise, mensagens) {
  if (!analise) return analise;
  if (!analise.diretorVendas) analise.diretorVendas = {};
  analise.diretorVendas.checkupAtendimento = gerarCheckupAtendimento(analise, mensagens);
  return analise;
}

function telefoneKey(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function normalizarLead(row = {}) {
  return {
    id: String(row.id || ''),
    nome: row.nome || row.contato_nome || row.telefone || 'Lead',
    telefone: row.telefone || '',
    empresa: row.empresa || '',
    etapa: row.etapa || row.status_funil || 'lead_novo',
    valor: Number(row.valor || row.valor_estimado || 0) || 0,
    criadoEm: row.criado_em || row.criadoEm || row.created_at || '',
    atualizadoEm: row.atualizado_em || row.atualizadoEm || row.updated_at || '',
    ultimaMensagem: row.ultima_mensagem || row.ultimaMensagem || row.mensagem || '',
    ultimaHora: row.ultima_hora || row.ultimaHora || row.atualizado_em || row.criado_em || '',
  };
}

function normalizarMensagem(row = {}) {
  return {
    telefone: telefoneKey(row.telefone || row.remote_jid || row.numero || ''),
    tipo: row.tipo || row.direcao || 'entrada',
    texto: row.texto || row.conteudo || row.body || '',
    criadoEm: row.criado_em || row.criadoEm || row.created_at || '',
  };
}

function prioridadePeso(prioridade) {
  return prioridade === 'critica' ? 0 : prioridade === 'alta' ? 1 : prioridade === 'media' ? 2 : 3;
}

function pct(valor, total) {
  if (!total) return valor ? 0 : 100;
  return Math.max(0, Math.min(100, Math.round((valor / total) * 100)));
}

function metaReducao(nome, alvoZero, atual, unidade, descricao) {
  const atingido = atual <= alvoZero ? 100 : 0;
  return {
    nome,
    direcao: 'reducao',
    alvo: alvoZero,
    atual,
    falta: Math.max(0, atual - alvoZero),
    unidade,
    atingido,
    status: atingido >= 100 ? 'ok' : 'cobrar',
    descricao,
  };
}

function metaPercentual(nome, alvo, atual, unidade, descricao) {
  const atingido = alvo > 0 ? pct(atual, alvo) : 100;
  return {
    nome,
    direcao: 'aumento',
    alvo,
    atual,
    falta: Math.max(0, alvo - atual),
    unidade,
    atingido,
    status: atingido >= 100 ? 'ok' : atingido >= 70 ? 'acompanhar' : 'cobrar',
    descricao,
  };
}

function etapaAtiva(etapa) {
  return !['fechado_ganho', 'fechado_perdido', 'pos_venda'].includes(String(etapa || ''));
}

function encontrarMensagensDoLead(mensagensPorTelefone, telefone) {
  const key = telefoneKey(telefone);
  if (!key) return [];
  if (mensagensPorTelefone.has(key)) return mensagensPorTelefone.get(key);

  const tail = key.slice(-10);
  if (!tail) return [];
  for (const [mapKey, lista] of mensagensPorTelefone.entries()) {
    if (mapKey.endsWith(tail) || tail.endsWith(mapKey.slice(-10))) return lista;
  }
  return [];
}

function prazoISO(minutosAFrente) {
  return new Date(Date.now() + minutosAFrente * 60000).toISOString();
}

function montarCobranca({ lead, tipo, prioridade, titulo, motivo, prazoTexto, prazoMinutos, acao, minutosParado = 0 }) {
  return {
    leadId: lead.id,
    nome: lead.nome,
    telefone: lead.telefone,
    empresa: lead.empresa,
    etapa: lead.etapa,
    etapaLabel: ETAPAS_LABEL[lead.etapa] || lead.etapa || 'Lead',
    tipo,
    prioridade,
    titulo,
    motivo,
    prazoTexto,
    prazoEm: prazoISO(prazoMinutos),
    acao,
    minutosParado,
  };
}

async function gerarCheckupGeralVendas() {
  const [leadsRaw, mensagensRaw, insightsRaw] = await Promise.all([
    selectAll('leads', { orderBy: 'atualizado_em', limit: 300 }),
    selectAll('mensagens', { orderBy: 'criado_em', limit: 1200 }),
    supabaseClient.from('ia_insights_globais').select('tipo, contexto, insight, confianca, usos, sucessos').gte('confianca', 30).order('confianca', { ascending: false }).limit(5).then(r => r.data || []).catch(() => []),
  ]);

  const mensagensPorTelefone = new Map();
  for (const row of Array.isArray(mensagensRaw) ? mensagensRaw : []) {
    const msg = normalizarMensagem(row);
    if (!msg.telefone) continue;
    const lista = mensagensPorTelefone.get(msg.telefone) || [];
    lista.push(msg);
    mensagensPorTelefone.set(msg.telefone, lista);
  }
  for (const lista of mensagensPorTelefone.values()) {
    lista.sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
  }

  const todosLeads = (Array.isArray(leadsRaw) ? leadsRaw : []).map(normalizarLead).filter(lead => lead.id);
  const leads = todosLeads.filter(lead => etapaAtiva(lead.etapa));

  const cobrancas = [];
  let aguardandoCliente = 0;
  let semMovimento = 0;
  let propostasAbertas = 0;
  let orcamentosPendentes = 0;

  // Metricas de tempo de espera
  const temposEspera = [];
  let respostasRapidas = 0;
  let respostasLentas = 0;
  let leadsEsquecidos = 0;

  // Distribuicao do funil
  const CORES_FUNIL = {
    lead_novo: '#6366f1', contato_feito: '#3b82f6', qualificado: '#8b5cf6',
    proposta_enviada: '#f59e0b', negociacao: '#ef4444', fechado_ganho: '#10b981',
    fechado_perdido: '#6b7280', pos_venda: '#14b8a6',
  };
  const contadorFunil = {};
  for (const lead of todosLeads) {
    contadorFunil[lead.etapa] = (contadorFunil[lead.etapa] || 0) + 1;
  }

  for (const lead of leads) {
    if (lead.etapa === 'proposta_enviada' || lead.etapa === 'negociacao') propostasAbertas++;

    const mensagens = encontrarMensagensDoLead(mensagensPorTelefone, lead.telefone);
    const ultima = mensagens[mensagens.length - 1] || null;
    const ultimaCliente = [...mensagens].reverse().find(m => m.tipo !== 'saida') || null;
    const ultimaJean = [...mensagens].reverse().find(m => m.tipo === 'saida') || null;
    const textoAtual = ultimaCliente?.texto || lead.ultimaMensagem || '';
    const pediuOrcamento = textoIndicaOrcamento(textoAtual);

    // Calcular tempo de espera do cliente (quando o cliente mandou e Jean ainda nao respondeu)
    if (ultima && ultima.tipo !== 'saida') {
      const espera = minutosDesde(ultima.criadoEm);
      temposEspera.push(espera);
    }

    // Medir velocidade de resposta do Jean (analisar pares cliente->jean)
    for (let i = 1; i < mensagens.length; i++) {
      if (mensagens[i].tipo === 'saida' && mensagens[i - 1].tipo !== 'saida') {
        const tempoResp = (new Date(mensagens[i].criadoEm) - new Date(mensagens[i - 1].criadoEm)) / 60000;
        if (tempoResp >= 0 && tempoResp < 15) respostasRapidas++;
        else if (tempoResp >= 60) respostasLentas++;
      }
    }

    // Lead esquecido (>48h sem interacao)
    const minutosUltimaInteracao = ultima ? minutosDesde(ultima.criadoEm) : minutosDesde(lead.atualizadoEm || lead.criadoEm);
    if (minutosUltimaInteracao >= 2880) leadsEsquecidos++;

    if (!ultima) {
      const minutosLead = minutosDesde(lead.atualizadoEm || lead.criadoEm);
      if (minutosLead >= 1440) {
        semMovimento++;
        cobrancas.push(montarCobranca({
          lead,
          tipo: 'sem_movimento',
          prioridade: 'baixa',
          titulo: 'Lead sem conversa registrada',
          motivo: 'Lead ativo sem atendimento recente registrado no WhatsApp.',
          prazoTexto: 'Revisar hoje',
          prazoMinutos: 240,
          acao: 'Conferir se precisa primeiro contato, cadastro ou descarte.',
          minutosParado: minutosLead,
        }));
      }
      continue;
    }

    const minutosUltima = minutosDesde(ultima.criadoEm);
    if (ultima.tipo !== 'saida') {
      const critica = minutosUltima >= 60 || pediuOrcamento;
      if (pediuOrcamento) orcamentosPendentes++;
      cobrancas.push(montarCobranca({
        lead,
        tipo: pediuOrcamento ? 'orcamento_pendente' : 'resposta_pendente',
        prioridade: critica ? 'alta' : 'media',
        titulo: pediuOrcamento ? 'Cliente pediu valor/prazo' : 'Cliente aguardando resposta',
        motivo: pediuOrcamento
          ? 'Pedido comercial claro. Bruno cobra retorno com valor, prazo ou dado faltante.'
          : 'A ultima mensagem foi do cliente. Atendimento precisa voltar para o vendedor.',
        prazoTexto: critica ? 'Responder agora' : 'Responder em ate 15 min',
        prazoMinutos: critica ? 0 : 15,
        acao: pediuOrcamento
          ? 'Responder valor/prazo ou pedir somente o dado faltante para orcar.'
          : 'Responder objetivamente e conduzir para o proximo dado.',
        minutosParado: minutosUltima,
      }));
      continue;
    }

    aguardandoCliente++;
    const minutosDesdeJean = ultimaJean ? minutosDesde(ultimaJean.criadoEm) : minutosUltima;
    if ((lead.etapa === 'proposta_enviada' || lead.etapa === 'negociacao') && minutosDesdeJean >= 1440) {
      cobrancas.push(montarCobranca({
        lead,
        tipo: 'follow_up_proposta',
        prioridade: 'alta',
        titulo: 'Cobrar retorno de proposta',
        motivo: 'Proposta/negociacao parada ha mais de 24h sem retorno do cliente.',
        prazoTexto: 'Fazer follow-up hoje',
        prazoMinutos: 120,
        acao: 'Chamar o cliente com proximo passo simples: aprovar, ajustar ou descartar.',
        minutosParado: minutosDesdeJean,
      }));
    } else if (minutosDesdeJean >= 360) {
      cobrancas.push(montarCobranca({
        lead,
        tipo: 'follow_up',
        prioridade: 'media',
        titulo: 'Relembrar cliente',
        motivo: 'Vendedor respondeu e o cliente ainda nao voltou.',
        prazoTexto: 'Relembrar ainda hoje',
        prazoMinutos: 240,
        acao: 'Enviar follow-up curto sem repetir perguntas ja feitas.',
        minutosParado: minutosDesdeJean,
      }));
    }
  }

  cobrancas.sort((a, b) => {
    const p = prioridadePeso(a.prioridade) - prioridadePeso(b.prioridade);
    if (p !== 0) return p;
    return (b.minutosParado || 0) - (a.minutosParado || 0);
  });

  const respostasPendentes = cobrancas.filter(c => c.tipo === 'resposta_pendente' || c.tipo === 'orcamento_pendente').length;
  const followUps = cobrancas.filter(c => c.tipo === 'follow_up' || c.tipo === 'follow_up_proposta').length;
  const altaPrioridade = cobrancas.filter(c => c.prioridade === 'alta' || c.prioridade === 'critica').length;
  const ganhos = todosLeads.filter(lead => lead.etapa === 'fechado_ganho').length;
  const perdidos = todosLeads.filter(lead => lead.etapa === 'fechado_perdido').length;
  const totalComFechamento = leads.length + ganhos + perdidos;
  const taxaConversao = totalComFechamento > 0 ? Math.round((ganhos / totalComFechamento) * 100) : 0;
  const metaConversao = Number(process.env.META_CONVERSAO_CRM || 20);
  const atendimentoSemPendencia = leads.length ? Math.max(0, leads.length - respostasPendentes) : 0;
  const percentualFilaRespondida = pct(atendimentoSemPendencia, leads.length);

  // Tempo medio e maximo de espera
  const tempoMedioEspera = temposEspera.length > 0 ? Math.round(temposEspera.reduce((a, b) => a + b, 0) / temposEspera.length) : 0;
  const tempoMaximoEspera = temposEspera.length > 0 ? Math.max(...temposEspera) : 0;

  // Distribuicao do funil
  const etapasOrdenadas = ['lead_novo', 'contato_feito', 'qualificado', 'proposta_enviada', 'negociacao', 'fechado_ganho', 'fechado_perdido'];
  const distribuicaoFunil = etapasOrdenadas.map(etapa => ({
    etapa,
    label: ETAPAS_LABEL[etapa] || etapa,
    total: contadorFunil[etapa] || 0,
    cor: CORES_FUNIL[etapa] || '#94a3b8',
  }));

  // Processos que faltam — Bruno identifica gaps operacionais
  const processosQueFaltam = [];
  if (ganhos > 0 && !todosLeads.some(l => l.etapa === 'pos_venda')) {
    processosQueFaltam.push({ titulo: 'Pos-venda inexistente', descricao: `${ganhos} venda(s) fechada(s) sem nenhum contato de satisfacao ou recompra.`, prioridade: 'alta' });
  }
  const qualificadosParados = leads.filter(l => l.etapa === 'qualificado' && minutosDesde(l.atualizadoEm || l.criadoEm) >= 7200);
  if (qualificadosParados.length > 0) {
    processosQueFaltam.push({ titulo: 'Leads qualificados sem orcamento', descricao: `${qualificadosParados.length} lead(s) qualificado(s) parado(s) ha mais de 5 dias sem proposta.`, prioridade: 'alta' });
  }
  if (leadsEsquecidos > 0) {
    processosQueFaltam.push({ titulo: 'Leads esquecidos', descricao: `${leadsEsquecidos} lead(s) sem nenhuma interacao ha mais de 48h. Risco de perder cliente.`, prioridade: 'media' });
  }
  if (respostasLentas > respostasRapidas && respostasLentas > 3) {
    processosQueFaltam.push({ titulo: 'Tempo de resposta alto', descricao: `Mais respostas lentas (${respostasLentas}) que rapidas (${respostasRapidas}). Precisa reduzir tempo de atendimento.`, prioridade: 'alta' });
  }
  if (propostasAbertas > 3) {
    processosQueFaltam.push({ titulo: 'Acumulo de propostas', descricao: `${propostasAbertas} propostas em aberto. Fechar ou descartar para liberar pipeline.`, prioridade: 'media' });
  }
  const totalRespostas = respostasRapidas + respostasLentas;
  const taxaRespostaRapida = totalRespostas > 0 ? Math.round((respostasRapidas / totalRespostas) * 100) : 100;

  return {
    atualizadoEm: new Date().toISOString(),
    resumoGerencial: altaPrioridade > 0
      ? `Bruno encontrou ${altaPrioridade} atendimento(s) que precisam de acao imediata.`
      : 'Fila sem urgencia critica. Manter follow-ups e padrao de atendimento.',
    indicadores: {
      leadsAtivos: leads.length,
      respostasPendentes,
      orcamentosPendentes,
      followUps,
      propostasAbertas,
      aguardandoCliente,
      semMovimento,
      altaPrioridade,
      taxaConversao,
      ganhos,
      perdidos,
      percentualFilaRespondida,
      tempoMedioEspera,
      tempoMaximoEspera,
      respostasRapidas,
      respostasLentas,
      leadsEsquecidos,
      taxaRespostaRapida,
    },
    distribuicaoFunil,
    processosQueFaltam: processosQueFaltam.slice(0, 5),
    insightsAprendidos: (Array.isArray(insightsRaw) ? insightsRaw : []).map(i => ({
      tipo: i.tipo,
      insight: i.insight,
      confianca: i.confianca,
    })),
    parametros: [
      'Responder cliente em ate 15 min quando a ultima mensagem for dele.',
      'Pedido de valor/prazo deve virar orcamento ou pergunta de dado faltante no mesmo atendimento.',
      'Proposta enviada nao pode ficar mais de 24h sem follow-up.',
      'Produto sob medida precisa de medida, quantidade, material, acabamento e uso/carga quando relevante.',
      'Lead sem movimento precisa ser reativado, qualificado ou descartado.',
    ],
    metas: [
      metaPercentual('Fila respondida', 100, percentualFilaRespondida, '%', 'Meta: todos os leads ativos sem cliente aguardando resposta.'),
      metaReducao('Pendencias de resposta', 0, respostasPendentes, 'lead(s)', 'Meta: nenhuma conversa com a ultima mensagem do cliente parada.'),
      metaReducao('Orcamentos sem decisao', 0, orcamentosPendentes, 'pedido(s)', 'Meta: todo pedido de valor/prazo vira orcamento ou coleta de dado faltante.'),
      metaReducao('Follow-ups atrasados', 0, followUps, 'lead(s)', 'Meta: proposta e negociacao acompanhadas no prazo.'),
      metaPercentual('Conversao CRM', metaConversao, taxaConversao, '%', 'Meta gerencial configuravel por META_CONVERSAO_CRM.'),
    ],
    cobrancas: cobrancas.slice(0, 30),
  };
}


function normalizarSugestoes(analise, saudacao, precisaSaudacao, contexto = {}) {
  if (contexto.ultimaMensagem?.tipo === 'saida') {
    analise.sugestoes = sugestoesDepoisDaRespostaDoJean(contexto.ultimaMensagem);
  }

  if (!Array.isArray(analise?.sugestoes) || analise.sugestoes.length === 0) {
    return analise;
  }

  for (const sugestao of analise.sugestoes) {
    sugestao.mensagem = encurtarMensagem(removerSaudacao(sugestao.mensagem));
  }

  if (!precisaSaudacao) {
    if (String(analise.sugestoes[0]?.label || '').toLowerCase() === 'saudacao') {
      analise.sugestoes[0].label = 'Responder';
    }
    return analise;
  }

  const primeira = analise.sugestoes[0];
  const semSaudacaoAntiga = removerSaudacao(primeira?.mensagem || '');

  primeira.label = 'saudacao';
  primeira.mensagem = encurtarMensagem(semSaudacaoAntiga ? `${saudacao}! ${semSaudacaoAntiga}` : `${saudacao}!`, 16);
  return analise;
}

// Chamada com Fallback Automático
async function chamarIAComFallback(systemPrompt, userPrompt) {
  let lastError;

  // TIER 1: Gemini
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800, responseMimeType: "application/json" }
        };
        const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
        const content = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { data: { choices: [{ message: { content } }] } }; // mock formato OpenAI
      } catch (err) {
        console.log(`[assistente-vendas] Gemini (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 2: Groq Fallbacks
  if (GROQ_API_KEY) {
    const payload = {
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 800,
    };
    for (const model of GROQ_MODELS) {
      try {
        payload.model = model;
        const resp = await axios.post(`${GROQ_BASE_URL}/chat/completions`, payload, {
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        });
        return resp;
      } catch (err) {
        console.log(`[assistente-vendas] Groq (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 3: OpenAI Fallback
  if (OPENAI_API_KEY) {
    try {
      const payload = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800,
      };
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      return resp;
    } catch (err) {
      console.log('[assistente-vendas] OpenAI falhou.');
      lastError = err;
    }
  }

  throw lastError || new Error('Todos os motores de IA esgotaram a cota (Gemini + Groq + OpenAI).');
}

async function analisarConversa(mensagens, lead) {
  if (!GROQ_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) {
    throw new Error('Nenhuma API KEY (Groq, Gemini ou OpenAI) configurada no servidor.');
  }

  const etapa = ETAPAS_LABEL[lead.etapa] || lead.etapa;

  // Sorteia variante: 75% padrao (A) com insights, 25% exploratorio (B)
  const variantB = Math.random() < 0.25;
  const variantId = variantB ? 'B' : 'A';

  const [contextoExtra, insights] = await Promise.all([
    buscarContextoExtra(),
    buscarInsightsGlobais(lead.etapa || ''),
  ]);
  const extra = contextoExtra ? `\nEXTRA: ${contextoExtra}` : '';

  const ultimas = mensagens.slice(-10);
  const conversaStr = ultimas.length > 0
    ? ultimas.map(m => `[${m.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}]: ${m.texto}`).join('\n')
    : '(sem mensagens ainda)';

  const saudacao = obterSaudacao();
  const nomeCliente = (lead.nome || '').split(' ')[0] || 'cliente';
  const ultimaMensagem = ultimas[ultimas.length - 1];
  const ultimaMensagemCliente = [...ultimas].reverse().find(m => m.tipo !== 'saida');
  const ultimaMensagemJean = [...ultimas].reverse().find(m => m.tipo === 'saida');
  const conversaJaIniciadaPeloJean = mensagens.some(m => m.tipo === 'saida');
  const precisaSaudacao = (!ultimaMensagem || ultimaMensagem.tipo !== 'saida') && !conversaJaIniciadaPeloJean;

  let observacoesAtuais = lead.observacoes || '';
  let memoriaAtual = '';
  const memMatch = observacoesAtuais.match(/\[MEMÓRIA IA\]([\s\S]*?)(\n\n|$)/);
  if (memMatch) {
    memoriaAtual = memMatch[1].trim();
  }

  const systemPrompt = `Voce e a inteligencia central da CDS Industrial. Sua missao e operar dois funcionarios IA contratados.

FUNCIONARIOS IA:
- Giorno Giovanna, Operador de Vendas IA: vendedor profissional, educado, objetivo e tecnico. Atua somente nas sugestoes para o WhatsApp do cliente.
- Bruno Bucciarati, Gerente de Vendas IA: gerente comercial senior. Administra os atendimentos, avalia oportunidades, identifica produtos para cadastrar/fabricar e fala internamente com o dono.

Cada funcionario deve agir com informacoes atuais e relevantes do cargo. Giorno vende com clareza e perguntas curtas. Bruno pensa como gerente de vendas industrial, sem floreios, separando atendimento normal, produto de catalogo, sob medida e oportunidade de novo produto.

REGRAS DE PAPEL:
- Eles nao sao agentes genericos. Cada um tem conhecimento profundo do cargo e deve agir com foco proprio.
- Giorno pensa como vendedor de industria metalica: qualifica necessidade, conduz valor/prazo e evita pergunta repetida.
- Bruno pensa como gerente/diretor comercial: mede atendimento, compara contra metas, cobra vendedores, organiza prioridades, aponta riscos e sugere acao para o dono.
- Bruno nunca escreve mensagem para cliente. Bruno fala para o superior com gestao, parametros, metas e cobrancas.

Sua PRIMEIRA TAREFA ABSOLUTA é a TRIAGEM DE CONTEXTO para ativar o avatar correto:

1. [GIORNO VENDEDOR] -> O contato quer COMPRAR escadas/materiais?
- Ative Giorno Giovanna, Operador de Vendas IA.
- Use SPIN Selling: Escale a dor antes de dar o preço.
- Use Challenger Sale: Ensine o cliente e não ceda fácil a descontos.
- Use BANT: Qualifique o orçamento e autoridade.

2. [JEAN GESTOR] -> O contato é um FUNCIONÁRIO ou candidato?
- Esqueça vendas. Você é o dono/chefe.
- Seja firme, mas justo. Cobre comprometimento, alinhe horários, faltas e expectativas de trabalho. Mantenha o controle da equipe.

3. [JEAN COMPRADOR] -> O contato é um FORNECEDOR (alguém te vendendo material/serviço)?
- Você é o cliente agora! O objetivo é proteger o caixa da CDS Industrial.
- Negocie preços a favor da CDS, cobre prazos de entrega de materiais (chapas, aço), peça desconto e seja exigente.

4. [JEAN NORMAL] -> O contato é um AMIGO ou o papo é OFF-TOPIC/PESSOAL?
- Desligue totalmente o modo corporativo.
- Aja de forma natural, zoe junto, converse sobre o assunto sem tentar vender nada nem dar ordens.

DIRETRIZES PARA AS MENSAGENS SUGERIDAS (Efeito Doppelgänger):
- Tom: educado, profissional e direto. Sem floreios, sem exagero e sem gírias forçadas.
- Pode usar linguagem simples de WhatsApp, mas mantenha postura comercial séria.
- Só use saudação ("Bom dia", "Boa tarde", "Boa noite") se o JEAN ainda não respondeu nenhuma vez nesta conversa.
- Se a conversa já começou, NUNCA repita saudação; responda direto ao assunto.
- REGRA DE OURO: frases de WhatsApp real, curtíssimas. Máximo de 8 a 12 palavras por sugestão. Nada de parágrafo.
- Evite tom de robô/consultor. Pergunte apenas o próximo dado necessário.
- MANTENHA O CONTROLE: Termine a sugestão com uma pergunta ou diretriz que faça a conversa avançar no sentido estratégico do Avatar ativo.

Analise o momento exato da conversa e retorne APENAS um JSON valido.

MEMORIA GLOBAL — BRUNO COMUNICA A GIORNO (aprendizados de todos os atendimentos):
${insights.length > 0
  ? insights.map(i => `- [${i.tipo === 'tecnica_efetiva' ? 'USAR' : 'EVITAR'}] ${i.insight} (confianca: ${i.confianca}%)`).join('\n')
  : '(Sem aprendizados globais ainda — este e um dos primeiros atendimentos do sistema.)'}

${variantB ? 'MODO EXPLORATORIO (variante B): Giorno deve ARRISCAR uma abordagem diferente — tom mais direto, pergunta incomum, ou tecnica alternativa. Bruno vai registrar o resultado para aprender.' : 'MODO PADRAO (variante A): use os aprendizados acima para maximizar chances de sucesso.'}`;


  const userPrompt = `Contexto da CDS Industrial (Brasília/DF - Vendedor: JEAN):
${CONHECIMENTO_EMPRESA}${extra}
LEAD: nome="${lead.nome || ''}" empresa="${lead.empresa || ''}" etapa=${etapa}
HORÁRIO: ${saudacao} | NOME CLIENTE: ${nomeCliente}
SAUDAÇÃO: ${precisaSaudacao ? 'usar "' + saudacao + '!" apenas na sugestão 1' : 'não usar saudação; conversa já iniciada ou Jean acabou de responder'}

MEMÓRIA DE LONGO PRAZO DA IA (LTM):
${memoriaAtual ? memoriaAtual : '(Nenhuma memória anterior registrada para este contato. Inicie a análise do zero.)'}

CONVERSA ATUAL:
${conversaStr}

MOMENTO EXATO:
- Ultima mensagem geral: ${ultimaMensagem ? `[${ultimaMensagem.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}] ${ultimaMensagem.texto}` : '(nenhuma)'}
- Ultima pergunta/pedido do cliente: ${ultimaMensagemCliente ? ultimaMensagemCliente.texto : '(nenhum)'}
- Ultima resposta do Jean: ${ultimaMensagemJean ? ultimaMensagemJean.texto : '(nenhuma)'}

CAPACIDADES E LIMITES DA FABRICA:
- Somos fabricantes; fazemos produtos sob medida em metal, solda MIG e eletrica.
- Dobramos chapas ate 6,35mm de espessura.
- Cortamos em guilhotina: somente cortes retos. Nao oferecer plasma, oxicorte, laser, jato d'agua, cortes curvos ou recortes internos.
- Guilhotina e dobradeira tem 3m. Pecas maiores que 3m so com emenda/solda, deixando isso claro.
- Pintura com compressor industrial: tinta epoxi, esmalte sintetico ou PU.
- Materiais trabalhados: aluminio, aco carbono, aco galvanizado, inox 430 e inox 304.
- Acos usuais: 1010/1020; chapa acima de 14 geralmente A36.
- Produtos recorrentes: chapas dobradas, estruturas em metalon/tubos/chapa, carrinhos, tampas para casas de maquinas, containers de lixo, pes de mesa e fabricacoes metalicas sob medida.

QUESTIONARIO IDEAL POR FAMILIA:
- Carrinho: perguntar o que transporta, peso em kg, piso/ambiente, dimensoes, lateral/grade/berco, manual/eletrico. Uma pergunta por vez.
- Vaso/cachepot/jardim: nao tratar como carrinho plataforma, mesmo se tiver rodas. Se aparecer "vaso", "jardim" ou "paisagismo", e produto de paisagismo/cachepot, nao carrinho.
- Tampa/bandeja: perguntar vao livre, local, carga sobre a tampa, dobradica/removivel, acabamento.
- Chapa/corte/dobra: perguntar medida, espessura, dobras/abas, material, quantidade, acabamento.
- Pes/base de mesa: identificar como pe/base para mesa, nao como tampa. Se ja houver quantidade, medida e nivelador, nao repetir. Perguntar apenas material, perfil/espessura, acabamento ou confirmar que vai calcular valor e prazo.
- Bancada/base/mesa: perguntar uso/equipamento, peso, medida, tampo, acabamento.
- Estante: perguntar o que guarda, peso por prateleira, niveis, dimensoes, ambiente.
- Sob medida em aco: a CDS fabrica qualquer produto em aco sob medida. Pergunte finalidade, medidas, carga, ambiente, acabamento e quantidade.

PAPEL DO GERENTE DE VENDAS IA (BRUNO BUCCIARATI):
- Cobrar o atendimento: prazo de resposta, follow-up, qualidade da venda, risco de perder cliente e proxima acao do vendedor.
- Comparar a conversa contra parametros comerciais: produto correto, medida, quantidade, material, acabamento, uso/carga, valor, prazo e proximo passo.
- Avaliar se esta conversa indica produto novo ideal para fabricar/cadastrar.
- Distinguir caso isolado de demanda com potencial recorrente.
- Sugerir ao dono ação objetiva: acompanhar, cadastrar produto, criar protótipo, tratar como sob medida ou priorizar orçamento.
- Indicar quais dados faltam para transformar a demanda em produto vendável.
- Nunca exagerar. Se não houver oportunidade clara, diga que é atendimento normal.

Sua tarefa:
1. Avalie a conversa atual levando em consideração a MEMÓRIA DE LONGO PRAZO (se existir) para não ser repetitivo e entender o contexto histórico.
2. Formule 4 sugestões TÁTICAS e ORIGINAIS de resposta que façam sentido PARA ESTE EXATO SEGUNDO da conversa.
2.1. As perguntas precisam ter lógica: não pergunte dado que o cliente já respondeu. Escolha o próximo dado técnico necessário para identificar produto de catálogo ou sob medida.
3. Gere uma leitura interna do GERENTE DE VENDAS IA para o dono, focada em produto, demanda e próxima decisão.
4. Gere uma "novaMemoria" que seja um resumo denso de tudo que você aprendeu sobre esse contato até o momento (junte o que já sabia com o que descobriu agora na conversa atual). Foque no perfil psicológico, dores e estágio da negociação.

REGRA PARA PEDIDO DE VALOR/PRAZO:
- Quando o cliente pedir valor e prazo de um item ja claro, responda nessa direcao.
- Nao volte para perguntas iniciais nem troque a familia do produto.
- Exemplo: "2 pes para mesa de granito 75x64, sem niveladores" e pe/base de mesa sob medida em metal, nao tampa.
- Sugestoes boas: confirmar material/acabamento, informar que vai calcular valor e prazo para o CEP, ou pedir espessura/perfil se faltar.

REGRA DE MOMENTO:
- As sugestoes devem responder ao MOMENTO EXATO.
- Se a ultima mensagem geral for do JEAN, nao aja como se o cliente tivesse acabado de perguntar de novo.
- Nesse caso, sugira apenas complemento natural, correcao, proximo passo ou aguardar.
- Se o cliente pediu uma medida e Jean acabou de responder a medida, nao pergunte uso/peso/piso como se nada tivesse sido respondido.
- Continue do ponto atual da conversa.

Retorne APENAS o JSON:
{
  "dadosProposta":{"tipoCliente":"empresa|pessoa_fisica|orgao_publico|nao_identificado","nome":"","empresa":"","documento":"","email":"","endereco":"","produtos":["item c/ qtd"],"valorEstimado":"","prazo":"","observacoes":""},
  "etapaDetectada":"lead_novo|contato_feito|qualificado|proposta_enviada|negociacao|fechado_ganho|fechado_perdido|pos_venda|nao_se_aplica|funcionario|fornecedor",
  "parecer": "Sua análise estratégica focada no perfil (Venda, Funcionário ou Pessoal), tom e próximo passo lógico.",
  "tecnicaRecomendada": "Ex: SPIN (se venda) OU Gestão de Conflitos (se funcionário) OU Rapport (se amigo)",
  "diretorVendas": {
    "nivelOportunidade": "baixo|medio|alto",
    "tipoDemanda": "catalogo|sob_medida|novo_produto|atendimento_normal",
    "produtoSugerido": "",
    "recomendacaoDono": "Orientacao curta e objetiva para o dono.",
    "dadosFaltantesProduto": ["medida", "carga", "quantidade"],
    "acaoInterna": "acompanhar|cadastrar_produto|criar_prototipo|orcamento_sob_medida|sem_acao"
  },
  "novaMemoria": "Resumo de longo prazo consolidado sobre esse contato (junte memória antiga com a conversa atual) para consultas futuras.",
  "sugestoes":[
    {"label":"Ação 1", "mensagem":"Sua mensagem 1 aqui..."},
    {"label":"Ação 2", "mensagem":"Sua mensagem 2 aqui..."},
    {"label":"Ação 3", "mensagem":"Sua mensagem 3 aqui..."},
    {"label":"Ação 4", "mensagem":"Sua mensagem 4 aqui..."}
  ]
}

REGRAS CRÍTICAS DE ESTRUTURA:
1. IMPORTANTE: Crie labels (Ação 1, Ação 2, etc) personalizadas para o contexto. Não use "Qualificação" ou "Apresentar Solução" se for um papo com funcionário!
2. FUNCIONÁRIO / PESSOAL: Use etapa "funcionario", "nao_se_aplica" ou "fornecedor". Não aplique SPIN. Fale do assunto que está sendo falado na conversa (ex: dia de trabalho, faltas, etc).
3. PÓS-VENDA: Se a venda já foi concluída, use "pos_venda" e apenas alinhe a entrega.
4. SAUDAÇÃO: Só use label "saudacao" quando SAUDAÇÃO acima mandar usar. Caso contrário, nenhuma sugestão pode começar com "oi", "olá", "bom dia", "boa tarde" ou "boa noite".
5. TAMANHO: Cada "mensagem" deve ter no máximo 12 palavras. Quanto mais curta, melhor.
6. SOB MEDIDA: Se não houver produto padrão claro, conduza como orçamento sob medida em aço, sem dizer que "não temos".
7. TOM: Profissional e educado. Proibido: "kkk", "blz", "show demais", "top", "meu querido".
8. GERENTE DE VENDAS IA: O campo "diretorVendas" é interno para o dono. Seja objetivo, como gerente comercial experiente.
9. OPORTUNIDADE: Use "novo_produto" só quando a demanda parecer vendável para outros clientes. Caso isolado vira "sob_medida".

EXEMPLOS DE TOM (INSPIRAÇÃO APENAS - NÃO COPIE):
[MOMENTO: VENDAS - PROBLEMA]
- label: "Explorar Produto" | mensagem: "Certo. Qual produto e qual medida precisa?"
[MOMENTO: VENDAS - FECHAMENTO]
- label: "Condição" | mensagem: "Consigo melhorar no PIX. Pode ser assim?"
[MOMENTO: FUNCIONÁRIO - ALINHAMENTO]
- label: "Cobrar Posição" | mensagem: "Que horas vc chega? Preciso organizar a entrega."
[MOMENTO: AMIGO / PESSOAL - NATURAL]
- label: "Papo" | mensagem: "Entendi. Como ficou isso no final?"

ATENÇÃO: Se a conversa for PESSOAL, NÃO FALE DE PRODUTOS. Seja um amigo conversando normalmente.`;

  let resp;
  
  resp = await chamarIAComFallback(systemPrompt, userPrompt);
  
  const raw = resp.data?.choices?.[0]?.message?.content || '';
  let analise;
  try { analise = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { analise = JSON.parse(m[0]); } catch {} }
    if (!analise) throw new Error('JSON invalido: ' + raw.substring(0, 200));
  }

  analise = normalizarSugestoes(analise, saudacao, precisaSaudacao, { ultimaMensagem });
  analise = aplicarCheckupAtendimento(analise, mensagens);

  // Persistir Memoria no Supabase em background
  if (analise && analise.novaMemoria && lead.id) {
    let newObs = observacoesAtuais;
    if (memMatch) {
      newObs = newObs.replace(/\[MEMÓRIA IA\][\s\S]*?(\n\n|$)/, `[MEMÓRIA IA]\n${analise.novaMemoria}\n\n`);
    } else {
      newObs = `${observacoesAtuais}\n\n[MEMÓRIA IA]\n${analise.novaMemoria}`.trim();
    }
    // Fire and forget
    update('leads', 'id', lead.id, { observacoes: newObs }).catch(e => console.error('Erro ao salvar novaMemoria:', e.message));
  }

  return { analise, variantId };
}

// ── Aprendizado IA — consolidado de ia-aprendizado.js ─────────────────────────
const MIN_USOS_PARA_INSIGHT = 8;
const TAXA_SUCESSO_POSITIVO = 0.55;
const TAXA_SUCESSO_NEGATIVO = 0.25;

async function aprendizadoRegistrarUso(body) {
  const { lead_id, telefone, variant_id = 'A', label, mensagem, etapa, tecnica } = body;
  if (!lead_id || !label) return { ok: false, erro: 'lead_id e label obrigatorios' };
  const { data, error } = await supabaseClient.from('ia_experimentos').insert({
    lead_id, telefone: telefone || '', variant_id,
    label_sugestao: label, mensagem_sugestao: mensagem || '',
    etapa_no_momento: etapa || '', tecnica_usada: tecnica || '',
    usada: true, resultado: 'pendente',
  }).select('id').single();
  if (error) throw error;
  aprendizadoConsolidarLazy(label, etapa).catch(() => {});
  return { ok: true, experimento_id: data?.id };
}

async function aprendizadoRegistrarResultado(body) {
  const { lead_id, experimento_id, resultado } = body;
  if (!lead_id && !experimento_id) return { ok: false };
  if (experimento_id) {
    await supabaseClient.from('ia_experimentos').update({ resultado, atualizado_em: new Date().toISOString() }).eq('id', experimento_id);
  } else {
    await supabaseClient.from('ia_experimentos').update({ resultado, atualizado_em: new Date().toISOString() }).eq('lead_id', lead_id).eq('resultado', 'pendente').order('criado_em', { ascending: false }).limit(1);
  }
  return { ok: true };
}

async function aprendizadoBuscarInsights(contexto = '') {
  try {
    let query = supabaseClient.from('ia_insights_globais').select('tipo, contexto, insight, confianca, usos, sucessos').gte('confianca', 40).gte('usos', 3).order('confianca', { ascending: false }).limit(12);
    if (contexto) query = query.or(`contexto.ilike.%${contexto}%,contexto.is.null`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[aprendizado] buscarInsights falhou:', err.message);
    return [];
  }
}

async function aprendizadoConsolidarLazy(label, etapa) {
  const contextoKey = etapa ? `label:${label};etapa:${etapa}` : `label:${label}`;
  const { data: exps, error } = await supabaseClient.from('ia_experimentos').select('variant_id, usada, resultado').eq('label_sugestao', label).eq('etapa_no_momento', etapa || '').eq('usada', true);
  if (error || !exps || exps.length < MIN_USOS_PARA_INSIGHT) return;
  const total = exps.length;
  const sucessos = exps.filter(e => e.resultado === 'etapa_avancou' || e.resultado === 'resposta_recebida').length;
  const taxa = sucessos / total;
  let tipo, insight;
  if (taxa >= TAXA_SUCESSO_POSITIVO) {
    tipo = 'tecnica_efetiva';
    insight = `Sugestoes com label "${label}" no contexto "${etapa || 'geral'}" tiveram ${Math.round(taxa * 100)}% de taxa de sucesso (${sucessos}/${total} usos resultaram em avanco). Giorno deve priorizar esse estilo de abordagem.`;
  } else if (taxa <= TAXA_SUCESSO_NEGATIVO) {
    tipo = 'abordagem_falhou';
    insight = `Sugestoes com label "${label}" no contexto "${etapa || 'geral'}" tiveram apenas ${Math.round(taxa * 100)}% de sucesso (${sucessos}/${total}). Giorno deve evitar esse padrao e tentar abordagem diferente.`;
  } else { return; }
  const confianca = Math.min(95, 40 + Math.round(taxa * 60));
  const { data: existente } = await supabaseClient.from('ia_insights_globais').select('id').eq('tipo', tipo).eq('contexto', contextoKey).maybeSingle();
  if (existente) {
    await supabaseClient.from('ia_insights_globais').update({ insight, confianca, usos: total, sucessos, atualizado_em: new Date().toISOString() }).eq('id', existente.id);
  } else {
    await supabaseClient.from('ia_insights_globais').insert({ tipo, contexto: contextoKey, insight, confianca, usos: total, sucessos });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — buscar insights aprendidos (usado pelo prompt e pelo frontend)
    if (req.method === 'GET') {
      const insights = await aprendizadoBuscarInsights(req.query?.contexto || '');
      return res.status(200).json({ insights });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

    const body = req.body || {};
    const modo = body.modo || '';

    if (modo === 'checkup-geral') {
      const checkupGeral = await gerarCheckupGeralVendas();
      return res.status(200).json({ checkupGeral });
    }

    // ── Modos de aprendizado (consolidados de ia-aprendizado.js) ──
    if (modo === 'aprendizado-uso') {
      const result = await aprendizadoRegistrarUso(body);
      return res.status(result.ok ? 200 : 400).json(result);
    }
    if (modo === 'aprendizado-resultado') {
      const result = await aprendizadoRegistrarResultado(body);
      return res.status(200).json(result);
    }

    // ── Analise de conversa (modo padrao) ──
    const { telefone, nome, empresa, etapa } = body;
    if (!GROQ_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) return res.status(503).json({ error: 'Nenhuma API KEY configurada.' });

    const mensagens = telefone ? await buscarMensagens(telefone) : [];

    const cached = telefone ? getCache(telefone, mensagens) : null;
    if (cached) {
      return res.status(200).json(cached);
    }

    const { analise, variantId } = await analisarConversa(mensagens, { nome, empresa, etapa, telefone });
    const resultado = { analise, variantId, totalMensagens: mensagens.length };

    if (telefone) setCache(telefone, mensagens, resultado);

    return res.status(200).json(resultado);
  } catch (e) {
    const rawError = e.response?.data?.error?.message || e.message || 'Erro desconhecido';
    const msgFinal = `[DEBUG IA] ${rawError}`;
    console.error('[assistente-vendas] erro:', msgFinal);
    const status = e.response?.status === 429 ? 429 : 500;
    return res.status(status).json({ error: msgFinal });
  }
}
