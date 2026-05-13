import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { selectAll, update } from './_lib/supabase.js';
import { chamarIA, hasAnyProvider, parseIAResponse } from './_lib/ai-fallback.js';
import { emitEvent, emitSuggestionUsed } from './_lib/events.js';
import { registrarUso, registrarResultado, buscarInsights as buscarInsightsLearning, buscarInsightsGlobais } from './_lib/learning.js';
import { getCache, setCache, getCacheByKey, setCacheByKey } from './_lib/cache.js';
import { executar as executarAbbacchio } from './agents/abbacchio.js';
import { executar as executarNarancia } from './agents/narancia.js';

const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);



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
Precificacao sob medida fora do catalogo: simular por peso quando houver medidas/material. Base: aco carbono R$70/kg, inox R$150/kg, aluminio R$120/kg, galvanizado R$100/kg. Se faltar espessura, usar chapa 14 / 2mm como base inicial.
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
    const d = String(telefone || '').replace(/\D/g, '');
    if (!d) return [];

    // Gera variantes do telefone (com/sem DDI 55, com/sem nono digito)
    const variantes = new Set([d]);
    if (d.startsWith('55')) {
      const ddd = d.slice(2, 4);
      const local = d.slice(4);
      if (ddd.length === 2 && local.length === 9) {
        variantes.add(`${ddd}${local}`);
        variantes.add(`55${ddd}${local.slice(1)}`);
        variantes.add(`${ddd}${local.slice(1)}`);
      }
      if (ddd.length === 2 && local.length === 8) {
        variantes.add(`${ddd}${local}`);
        variantes.add(`55${ddd}9${local}`);
        variantes.add(`${ddd}9${local}`);
      }
    } else if (d.length === 11) {
      variantes.add(`55${d}`);
      variantes.add(`55${d.slice(0, 2)}${d.slice(3)}`);
    } else if (d.length === 10) {
      variantes.add(`55${d}`);
      variantes.add(`55${d.slice(0, 2)}9${d.slice(2)}`);
    }

    // Tenta cada variante ate achar mensagens
    for (const tel of variantes) {
      const data = await selectAll('mensagens', { filters: { telefone: `eq.${tel}` }, orderBy: 'criado_em' });
      const rows = Array.isArray(data) ? data : [];
      if (rows.length > 0) {
        return rows.map(row => ({
          tipo: row.tipo || 'entrada',
          texto: row.texto || row.conteudo || '',
          criadoEm: row.criado_em || row.created_at || '',
        }))
          .filter(m => m.texto.trim())
          .sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
      }
    }
    return [];
  } catch {
    return [];
  }
}

function normalizarMensagensBody(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map(m => ({
      tipo: m?.tipo || m?.direction || 'entrada',
      texto: String(m?.texto || m?.conteudo || m?.body || '').trim(),
      criadoEm: m?.criadoEm || m?.criado_em || m?.timestamp || m?.created_at || '',
    }))
    .filter(m => m.texto)
    .sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
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

function encurtarMensagem(texto, maxPalavras = 22) {
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

function tecnicaPorEtapa(etapa) {
  const mapa = {
    lead_novo: 'SPIN - Situacao: entender produto, uso e urgencia sem pedir tudo de uma vez.',
    contato_feito: 'SPIN - Problema: confirmar dor, medida, carga, ambiente e impacto do atraso.',
    qualificado: 'BANT: validar orcamento, autoridade, necessidade e prazo antes da proposta.',
    proposta_enviada: 'Challenger + fechamento consultivo: defender valor, prazo e proximo passo.',
    negociacao: 'Negociacao de valor: concessao apenas com contrapartida, evitando desconto facil.',
    fechado_ganho: 'Pos-venda: alinhar pagamento, producao, entrega e satisfacao.',
    fechado_perdido: 'Recuperacao: entender motivo da perda e registrar aprendizado.',
  };
  return mapa[etapa] || 'SPIN Selling: conduzir pelo proximo dado necessario.';
}

function selecionarContextoConversa(mensagens) {
  const lista = (Array.isArray(mensagens) ? mensagens : []).filter(m => String(m?.texto || '').trim());
  if (lista.length <= 36) return lista;
  const primeiras = lista.slice(0, 6);
  const recentes = lista.slice(-30);
  return [...primeiras, { tipo: 'sistema', texto: '... mensagens intermediarias omitidas para foco operacional ...', criadoEm: '' }, ...recentes];
}

function montarResumoLeitura(mensagens) {
  const lista = (Array.isArray(mensagens) ? mensagens : []).filter(m => String(m?.texto || '').trim());
  const ultima = lista[lista.length - 1];
  const ultimaCliente = [...lista].reverse().find(m => m.tipo !== 'saida');
  const ultimaJean = [...lista].reverse().find(m => m.tipo === 'saida');
  const dadosRelevantes = lista
    .filter(m => /\b(cnpj|cpf|cep|email|valor|preco|preço|prazo|entrega|aprov|fech|pagamento|pix|boleto|medida|metro|mm|cm|kg|container|carrinho|tampa|chapa|mesa)\b/i.test(m.texto))
    .slice(-10)
    .map(m => `[${m.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}] ${m.texto}`)
    .join('\n');

  return [
    `Ultima mensagem: ${ultima ? `[${ultima.tipo === 'saida' ? 'JEAN' : 'CLIENTE'}] ${ultima.texto}` : '(nenhuma)'}`,
    `Ultimo pedido do cliente: ${ultimaCliente?.texto || '(nenhum)'}`,
    `Ultima resposta do Jean: ${ultimaJean?.texto || '(nenhuma)'}`,
    `Dados comerciais ja citados:\n${dadosRelevantes || '(nenhum dado comercial claro ainda)'}`,
  ].join('\n');
}

const ETAPAS_ORDEM_BACKEND = ['lead_novo', 'contato_feito', 'qualificado', 'proposta_enviada', 'negociacao', 'fechado_ganho', 'fechado_perdido'];

function evidenciasParaEtapa(etapa, mensagens, analise) {
  const texto = (Array.isArray(mensagens) ? mensagens : []).map(m => m.texto || '').join(' ').toLowerCase();
  const temSaida = (Array.isArray(mensagens) ? mensagens : []).some(m => m.tipo === 'saida');
  const produtos = analise?.dadosProposta?.produtos || [];
  if (etapa === 'contato_feito') return temSaida;
  if (etapa === 'qualificado') return produtos.length > 0 || /\b(medida|quantidade|qtd|kg|cep|cnpj|orcamento|orçamento|valor|prazo)\b/i.test(texto);
  if (etapa === 'proposta_enviada') return /\b(proposta|orcamento|orçamento|valor|total|r\$|enviado|enviei|segue)\b/i.test(texto);
  if (etapa === 'negociacao') return /\b(desconto|pix|condicao|condição|aprov|prazo|frete|fechar|pedido|retorno)\b/i.test(texto);
  if (etapa === 'fechado_ganho') return /\b(fechado|aprovado|pode fazer|vamos fechar|confirmado|pedido aprovado|pago|pagamento feito)\b/i.test(texto);
  return false;
}

function normalizarAvancoFunil(analise, etapaAtual, mensagens) {
  if (!analise) return analise;
  const detectada = analise.etapaDetectada;
  const atualIdx = ETAPAS_ORDEM_BACKEND.indexOf(etapaAtual);
  const proxIdx = ETAPAS_ORDEM_BACKEND.indexOf(detectada);
  const confianca = Number(analise.confiancaFunil || analise.confianca || 0);
  const etapaAvanca = atualIdx >= 0 && proxIdx >= 0 && proxIdx > atualIdx && detectada !== 'fechado_perdido';
  const temEvidencia = evidenciasParaEtapa(detectada, mensagens, analise);

  analise.confiancaFunil = confianca || (temEvidencia ? 82 : 50);
  analise.deveAvancarEtapa = !!(etapaAvanca && temEvidencia && analise.confiancaFunil >= 80);
  if (analise.deveAvancarEtapa && !analise.motivoAvanco) {
    analise.motivoAvanco = `A conversa tem evidencia suficiente para sair de ${ETAPAS_LABEL[etapaAtual] || etapaAtual} e ir para ${ETAPAS_LABEL[detectada] || detectada}.`;
  }
  if (!analise.deveAvancarEtapa && !analise.motivoAvanco) {
    analise.motivoAvanco = 'Manter etapa atual ate a conversa confirmar o proximo marco comercial.';
  }
  return analise;
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

function clampNota(valor, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(valor) || 0)));
}

function mediaNumerica(lista, campo) {
  const valores = lista.map(item => Number(item?.[campo])).filter(n => Number.isFinite(n));
  if (!valores.length) return 0;
  return clampNota(valores.reduce((s, n) => s + n, 0) / valores.length);
}

function temposRespostaLead(mensagens) {
  const tempos = [];
  let ultimaEntrada = null;
  for (const msg of Array.isArray(mensagens) ? mensagens : []) {
    if (msg.tipo !== 'saida') {
      ultimaEntrada = msg;
      continue;
    }
    if (ultimaEntrada) {
      const diff = (new Date(msg.criadoEm || 0).getTime() - new Date(ultimaEntrada.criadoEm || 0).getTime()) / 60000;
      if (Number.isFinite(diff) && diff >= 0) tempos.push(diff);
      ultimaEntrada = null;
    }
  }
  return tempos;
}

function calcularValorPotencial(lead, pediuOrcamento) {
  const valor = Number(lead.valor || 0);
  if (valor > 0) return valor;
  const porEtapa = {
    lead_novo: 800,
    contato_feito: 1200,
    qualificado: 2500,
    proposta_enviada: 4500,
    negociacao: 6000,
  };
  return (porEtapa[lead.etapa] || 600) + (pediuOrcamento ? 2500 : 0);
}

function nivelCobrancaProgressiva({ pendenteCliente, minutosParado, pediuOrcamento, valorPotencial }) {
  if (!pendenteCliente) {
    if (minutosParado >= 1440) {
      return {
        nivel: 3,
        titulo: 'Follow-up vencido',
        texto: 'Bruno cobra retorno: proposta parada, venda esfriando e dinheiro ficando na mesa.',
      };
    }
    return {
      nivel: 1,
      titulo: 'Acompanhar retorno',
      texto: 'Cliente esta com a bola. Monitorar sem parecer ansioso.',
    };
  }

  if (minutosParado >= 2880) {
    return {
      nivel: 5,
      titulo: 'Risco de perda',
      texto: 'Bruno chama atencao forte: cliente abandonado, chance alta de comprar em outro lugar.',
    };
  }
  if (minutosParado >= 240) {
    return {
      nivel: 4,
      titulo: 'Cliente esfriando',
      texto: 'Bruno cobra agora: atendimento passou do limite e precisa resposta objetiva.',
    };
  }
  if (minutosParado >= 60 || pediuOrcamento || valorPotencial >= 4000) {
    return {
      nivel: 3,
      titulo: 'Responder agora',
      texto: pediuOrcamento
        ? 'Cliente pediu valor ou prazo. Bruno exige orcamento ou dado faltante sem enrolar.'
        : 'Cliente importante esperando. Bruno prioriza antes que vire perda.',
    };
  }
  if (minutosParado >= 15) {
    return {
      nivel: 2,
      titulo: 'Atencao no prazo',
      texto: 'Bruno alerta: responder antes de passar a imagem de descuido.',
    };
  }
  return {
    nivel: 1,
    titulo: 'Dentro do prazo',
    texto: 'Responder mantendo qualidade e proximo passo claro.',
  };
}

function avaliarAtendimentoLead({ lead, mensagens, ultima, ultimaCliente, ultimaJean, pediuOrcamento, minutosParado }) {
  const pendenteCliente = !!ultima && ultima.tipo !== 'saida';
  const tempos = temposRespostaLead(mensagens);
  const tempoMedioResposta = tempos.length ? Math.round(tempos.reduce((s, n) => s + n, 0) / tempos.length) : null;
  const textoCliente = (Array.isArray(mensagens) ? mensagens : [])
    .filter(m => m.tipo !== 'saida')
    .map(m => m.texto || '')
    .join(' ')
    .toLowerCase();
  const positivos = (textoCliente.match(/\b(obrigad|perfeito|combinado|aprov|fechado|gostei|certo|ok|show|excelente)\b/g) || []).length;
  const negativos = (textoCliente.match(/\b(caro|demora|atras|problema|cancel|reclama|ruim|nao gostei|absurdo)\b/g) || []).length;
  const valorPotencial = calcularValorPotencial(lead, pediuOrcamento);
  const etapaPeso = {
    lead_novo: 4,
    contato_feito: 8,
    qualificado: 14,
    proposta_enviada: 22,
    negociacao: 28,
  }[lead.etapa] || 5;
  const cobranca = nivelCobrancaProgressiva({ pendenteCliente, minutosParado, pediuOrcamento, valorPotencial });

  const notaAtendimento = clampNota(
    88
    - (pendenteCliente ? Math.min(38, Math.floor(minutosParado / 8)) : 0)
    - (!ultimaJean ? 18 : 0)
    - (pediuOrcamento && pendenteCliente ? 12 : 0)
    - (tempoMedioResposta && tempoMedioResposta > 60 ? 10 : 0)
    + (tempoMedioResposta !== null && tempoMedioResposta <= 15 ? 8 : 0)
    + (lead.etapa === 'negociacao' || lead.etapa === 'proposta_enviada' ? 4 : 0),
    10,
    100
  );

  const indiceSatisfacao = clampNota(
    76
    + (positivos * 5)
    - (negativos * 12)
    - (pendenteCliente ? Math.min(30, Math.floor(minutosParado / 20)) : 0)
    + (tempoMedioResposta !== null && tempoMedioResposta <= 15 ? 7 : 0),
    0,
    100
  );

  const urgenciaScore = clampNota(
    (pendenteCliente ? 35 : 8)
    + Math.min(35, Math.floor(minutosParado / 20))
    + (pediuOrcamento ? 20 : 0)
    + etapaPeso
    + Math.min(20, Math.floor(valorPotencial / 500)),
    0,
    100
  );

  const prioridade = urgenciaScore >= 85 ? 'critica' : urgenciaScore >= 65 ? 'alta' : urgenciaScore >= 40 ? 'media' : 'baixa';
  const proximaAcao = pendenteCliente
    ? (pediuOrcamento ? 'Responder valor/prazo ou pedir so o dado faltante.' : 'Responder cliente e conduzir proximo passo.')
    : (lead.etapa === 'proposta_enviada' || lead.etapa === 'negociacao' ? 'Fazer follow-up de decisao.' : 'Acompanhar retorno sem repetir pergunta.');

  return {
    leadId: lead.id,
    nome: lead.nome,
    telefone: lead.telefone,
    empresa: lead.empresa,
    etapa: lead.etapa,
    etapaLabel: ETAPAS_LABEL[lead.etapa] || lead.etapa || 'Lead',
    notaAtendimento,
    indiceSatisfacao,
    tempoMedioResposta,
    valorPotencial,
    urgenciaScore,
    prioridade,
    minutosParado,
    ultimaTipo: ultima?.tipo || '',
    pediuOrcamento,
    nivelCobranca: cobranca.nivel,
    chamadaBruno: cobranca.texto,
    tituloCobranca: cobranca.titulo,
    proximaAcao,
    ultimoCliente: ultimaCliente?.texto || '',
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
  const atendimentosAvaliados = [];

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

    atendimentosAvaliados.push(avaliarAtendimentoLead({
      lead,
      mensagens,
      ultima,
      ultimaCliente,
      ultimaJean,
      pediuOrcamento,
      minutosParado: minutosUltimaInteracao,
    }));

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
  const notaMediaAtendimento = mediaNumerica(atendimentosAvaliados, 'notaAtendimento');
  const indiceSatisfacao = mediaNumerica(atendimentosAvaliados, 'indiceSatisfacao');
  const pipelineEstimado = todosLeads.reduce((s, lead) => s + (Number(lead.valor || 0) || 0), 0);
  const ordemAtendimento = [...atendimentosAvaliados]
    .sort((a, b) => {
      const p = prioridadePeso(a.prioridade) - prioridadePeso(b.prioridade);
      if (p !== 0) return p;
      const score = (b.urgenciaScore || 0) - (a.urgenciaScore || 0);
      if (score !== 0) return score;
      return (b.valorPotencial || 0) - (a.valorPotencial || 0);
    })
    .slice(0, 40);
  const notaSaudeFunil = clampNota(
    (notaMediaAtendimento * 0.30)
    + (indiceSatisfacao * 0.20)
    + (percentualFilaRespondida * 0.20)
    + (Math.min(100, metaConversao > 0 ? (taxaConversao / metaConversao) * 100 : 100) * 0.20)
    + (taxaRespostaRapida * 0.10)
    - (altaPrioridade * 2)
  );
  const saudeFunil = {
    notaGeral: notaSaudeFunil,
    status: notaSaudeFunil >= 85 ? 'saudavel' : notaSaudeFunil >= 70 ? 'atencao' : notaSaudeFunil >= 50 ? 'risco' : 'critico',
    notaMediaAtendimento,
    indiceSatisfacao,
    melhoresIndices: [
      { nome: 'Resposta rapida', valor: taxaRespostaRapida, detalhe: `${respostasRapidas} respostas abaixo de 15min` },
      { nome: 'Fila respondida', valor: percentualFilaRespondida, detalhe: `${atendimentoSemPendencia}/${leads.length || 0} sem pendencia` },
      { nome: 'Nota dos atendimentos', valor: notaMediaAtendimento, detalhe: 'Media das conversas ativas' },
      { nome: 'Satisfacao percebida', valor: indiceSatisfacao, detalhe: 'Inferida por tom e tempo de resposta' },
    ].sort((a, b) => b.valor - a.valor),
    pioresIndices: [
      { nome: 'Urgencias abertas', valor: altaPrioridade, detalhe: `${altaPrioridade} atendimento(s) exigem acao` },
      { nome: 'Espera maxima', valor: tempoMaximoEspera, detalhe: `${tempoMaximoEspera} min` },
      { nome: 'Follow-ups', valor: followUps, detalhe: `${followUps} retorno(s) atrasado(s)` },
    ].sort((a, b) => b.valor - a.valor),
  };
  const metasAtendimento = [
    metaPercentual('Nota media dos atendimentos', 85, notaMediaAtendimento, '/100', 'Bruno quer atendimento acima de 85/100.'),
    metaPercentual('Satisfacao percebida', 82, indiceSatisfacao, '%', 'Medida por tom do cliente, velocidade e continuidade.'),
    metaPercentual('Fila respondida', 100, percentualFilaRespondida, '%', 'Nenhum cliente esperando resposta.'),
    metaPercentual('Resposta rapida', 75, taxaRespostaRapida, '%', 'Responder em ate 15 minutos.'),
    metaReducao('Tempo medio de espera', 15, tempoMedioEspera, 'min', 'Media de espera abaixo de 15 minutos.'),
  ];
  const metasFechamento = [
    metaPercentual('Conversao CRM', metaConversao, taxaConversao, '%', 'Meta gerencial configuravel por META_CONVERSAO_CRM.'),
    metaReducao('Propostas sem retorno', 0, followUps, 'lead(s)', 'Toda proposta precisa decisao ou proximo passo.'),
    metaReducao('Orcamentos sem decisao', 0, orcamentosPendentes, 'pedido(s)', 'Pedido de valor/prazo precisa virar proposta ou coleta de dado.'),
    metaPercentual('Saude do funil', 85, notaSaudeFunil, '/100', 'Combina atendimento, satisfacao, resposta e conversao.'),
  ];

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
      notaMediaAtendimento,
      indiceSatisfacao,
      notaSaudeFunil,
      pipelineEstimado,
    },
    saudeFunil,
    distribuicaoFunil,
    atendimentosAvaliados: atendimentosAvaliados
      .sort((a, b) => (b.notaAtendimento || 0) - (a.notaAtendimento || 0))
      .slice(0, 80),
    ordemAtendimento,
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
    cronograma: [
      { ordem: 1, etapa: 'Resposta inicial', prazo: '0-15 min', responsavel: 'Giorno', objetivo: 'Responder o cliente e entender o produto sem repetir perguntas.' },
      { ordem: 2, etapa: 'Qualificacao tecnica', prazo: 'ate 2h uteis', responsavel: 'Giorno', objetivo: 'Coletar medida, quantidade, material, acabamento, uso/carga e local quando necessario.' },
      { ordem: 3, etapa: 'Orcamento', prazo: 'mesmo dia', responsavel: 'Jean/Giorno', objetivo: 'Gerar proposta com produto de catalogo ou simulacao sob medida por peso.' },
      { ordem: 4, etapa: 'Follow-up', prazo: '24h apos proposta', responsavel: 'Bruno', objetivo: 'Cobrar retorno, ajustar condicao ou marcar perda/ganho.' },
      { ordem: 5, etapa: 'Fechamento e pos-venda', prazo: 'apos aprovacao', responsavel: 'Bruno', objetivo: 'Confirmar pagamento, producao, entrega e satisfacao.' },
    ],
    ordemProcessos: [
      'Cliente respondeu: Giorno deve responder pelo momento exato da conversa.',
      'Produto claro: buscar cadastro e usar preco cadastrado antes de estimar.',
      'Produto sob medida: coletar dados faltantes e calcular por peso.',
      'Proposta enviada: Bruno cobra follow-up em ate 24h.',
      'Aprovacao confirmada: mover para ganho e iniciar acompanhamento de entrega.',
    ],
    metasAtendimento,
    metasFechamento,
    metas: [...metasAtendimento, ...metasFechamento],
    cobrancas: cobrancas.slice(0, 30),
  };
}


function normalizarSugestoes(analise, saudacao, precisaSaudacao, contexto = {}) {
  if (contexto.ultimaMensagem?.tipo === 'saida' && (!Array.isArray(analise?.sugestoes) || analise.sugestoes.length === 0)) {
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
  primeira.mensagem = encurtarMensagem(semSaudacaoAntiga ? `${saudacao}! ${semSaudacaoAntiga}` : `${saudacao}!`, 22);
  return analise;
}



async function analisarConversa(mensagens, lead) {
  if (!hasAnyProvider()) {
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

  const contextoConversa = selecionarContextoConversa(mensagens);
  const conversaStr = contextoConversa.length > 0
    ? contextoConversa.map(m => `[${m.tipo === 'saida' ? 'JEAN' : m.tipo === 'sistema' ? 'SISTEMA' : 'CLIENTE'}]: ${m.texto}`).join('\n')
    : '(sem mensagens ainda)';
  const resumoLeitura = montarResumoLeitura(mensagens);
  const tecnicaAtiva = tecnicaPorEtapa(lead.etapa || '');

  const saudacao = obterSaudacao();
  const nomeCliente = (lead.nome || '').split(' ')[0] || 'cliente';
  const ultimaMensagem = mensagens[mensagens.length - 1];
  const ultimaMensagemCliente = [...mensagens].reverse().find(m => m.tipo !== 'saida');
  const ultimaMensagemJean = [...mensagens].reverse().find(m => m.tipo === 'saida');
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
- REGRA DE OURO: frases de WhatsApp real, curtas e uteis. Maximo de 22 palavras por sugestao.
- Toda sugestao do Giorno deve nascer da etapa atual do funil, da tecnica de venda ativa e da ultima fala real do cliente/Jean.
- Evite tom de robô/consultor. Pergunte apenas o próximo dado necessário, ou responda valor/prazo se esse for o momento.
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

FUNIL E TECNICA ATIVA:
- Etapa atual do CRM: ${etapa}
- Tecnica obrigatoria para Giorno agora: ${tecnicaAtiva}
- Giorno sempre desenvolve as respostas a partir da etapa do funil + tecnica ativa + momento exato da conversa.
- Bruno valida se ha evidencia suficiente para mover o cliente para o proximo nivel do funil.

MEMÓRIA DE LONGO PRAZO DA IA (LTM):
${memoriaAtual ? memoriaAtual : '(Nenhuma memória anterior registrada para este contato. Inicie a análise do zero.)'}

LEITURA OPERACIONAL DA CONVERSA:
${resumoLeitura}

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
- Precificacao sob medida fora do catalogo: calcular por peso. Aco carbono R$70/kg, inox R$150/kg, aluminio R$120/kg, galvanizado R$100/kg. Se faltar espessura, base inicial chapa 14 / 2mm.

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
2.2. As respostas do Giorno precisam obedecer a etapa atual do funil e a técnica ativa informada acima.
3. Gere uma leitura interna do GERENTE DE VENDAS IA para o dono, focada em produto, demanda, cobrança, cronograma e próxima decisão.
4. Decida se o funil deve avançar automaticamente. Só marque "deveAvancarEtapa": true quando houver evidencia explicita na conversa e confiança >= 80.
5. Gere uma "novaMemoria" que seja um resumo denso de tudo que você aprendeu sobre esse contato até o momento (junte o que já sabia com o que descobriu agora na conversa atual). Foque no perfil psicológico, dores e estágio da negociação.

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
  "deveAvancarEtapa": false,
  "confiancaFunil": 0,
  "motivoAvanco": "Explique em uma frase curta a evidencia para avancar ou manter etapa.",
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
5. TAMANHO: Cada "mensagem" deve ter no máximo 22 palavras. Curta, mas com contexto suficiente.
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

  const iaResult = await chamarIA(systemPrompt, userPrompt);
  let analise = parseIAResponse(iaResult.content);

  analise = normalizarAvancoFunil(analise, lead.etapa || '', mensagens);
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


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — buscar insights aprendidos (usado pelo prompt e pelo frontend)
    if (req.method === 'GET') {
      const insights = await buscarInsightsLearning(req.query?.contexto || '');
      return res.status(200).json({ insights });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

    const body = req.body || {};
    const modo = body.modo || '';

    if (modo === 'checkup-geral') {
      const checkupGeral = await gerarCheckupGeralVendas();
      return res.status(200).json({ checkupGeral });
    }

    // ── Modos de aprendizado (delegados para _lib/learning.js) ──
    if (modo === 'aprendizado-uso') {
      const result = await registrarUso(body);
      return res.status(result.ok ? 200 : 400).json(result);
    }
    if (modo === 'aprendizado-resultado') {
      const result = await registrarResultado(body);
      return res.status(200).json(result);
    }

    // ── Marketing IA — delegado para agents/abbacchio.js e agents/narancia.js ──
    if (modo === 'marketing-abbacchio' || modo === 'marketing-narancia') {
      if (!hasAnyProvider()) return res.status(503).json({ error: 'Nenhuma API KEY configurada.' });

      const params = {
        produto: body.produto,
        publicoAlvo: body.publicoAlvo,
        objetivo: body.objetivo,
        budget: body.budget,
        plataforma: body.plataforma,
        contextoExtra: body.contextoExtra,
        campanhaAtual: body.campanhaAtual,
      };

      const cacheKeyMkt = `mkt_${modo}_${params.produto || ''}_${params.objetivo || ''}_${params.publicoAlvo || ''}`;
      const cached = getCacheByKey(cacheKeyMkt);
      if (cached) return res.status(200).json(cached);

      let response;
      if (modo === 'marketing-abbacchio') {
        response = await executarAbbacchio(params, { persistCampaign: true });
      } else {
        response = await executarNarancia(params, { campaignId: body.campaignId || null });
      }

      setCacheByKey(cacheKeyMkt, response, 120000);
      return res.status(200).json(response);
    }

    // ── Analise de conversa (modo padrao — Giorno + Bruno) ──
    const { telefone, nome, empresa, etapa, id } = body;
    if (!hasAnyProvider()) return res.status(503).json({ error: 'Nenhuma API KEY configurada.' });

    const mensagensBody = normalizarMensagensBody(body.mensagens);
    const mensagens = mensagensBody.length > 0
      ? mensagensBody
      : telefone ? await buscarMensagens(telefone) : [];

    const cached = telefone ? getCache(telefone, mensagens) : null;
    if (cached) {
      return res.status(200).json(cached);
    }

    const { analise, variantId } = await analisarConversa(mensagens, { id, nome, empresa, etapa, telefone });
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
