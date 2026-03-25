// ══════════════════════════════════════════════════════════════
//  LicitacoesService.ts
//  Integração com o Portal Nacional de Contratações Públicas (PNCP)
//  Endpoint de busca: https://pncp.gov.br/api/search/
//
//  Em dev/produção: requisições via proxy Express /pncp-api/* → pncp.gov.br/*
// ══════════════════════════════════════════════════════════════

// O proxy no server.ts ou Vercel Serverless Function atende em /api/pncp
const PNCP_BASE = '/api/pncp';

// ── Resposta da API de busca PNCP ───────────────────────────────

export interface SearchItemPNCP {
  id: string;
  numero_controle_pncp: string;
  title: string;
  description: string;
  item_url: string;
  document_type: string;
  createdAt: string;
  ano: string;
  numero_sequencial: string;
  orgao_cnpj: string;
  orgao_nome: string;
  unidade_nome: string;
  esfera_nome: string;
  uf: string;                        // "SP", "MG", "RJ" etc — campo real da API
  municipio_nome: string;
  modalidade_licitacao_id?: string;
  modalidade_licitacao_nome?: string;
  valor_global?: number;             // Campo real para valor estimado
  data_publicacao_pncp?: string;
  data_fim_vigencia?: string;        // Campo real para encerramento proposta
  situacao_nome?: string;
  cancelado?: boolean;
}

// Interface normalizada usada nos componentes (mantida p/ compatibilidade)
export interface ContratacaoPNCP {
  numeroControlePNCP: string;
  orgaoEntidade: {
    cnpj: string;
    razaoSocial: string;
    poderId: string;
    esferaId: string;
  };
  unidadeOrgao: {
    ufNome: string;
    ufSigla: string;
    municipioNome: string;
    codigoUnidade: string;
    nomeUnidade: string;
  };
  modalidadeId: number;
  modalidadeNome: string;
  objetoCompra: string;
  informacaoComplementar?: string;
  dataPublicacaoPncp: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  situacaoCompraNome: string;
  linkSistemaOrigem?: string;
  sequencialCompra: number;
  anoCompra: number;
}

// Converte SearchItemPNCP → ContratacaoPNCP
function mapSearchItem(item: SearchItemPNCP): ContratacaoPNCP {
  const seq = parseInt(item.numero_sequencial || '0');
  const ano = parseInt(item.ano || '2026');
  const modalId = parseInt(item.modalidade_licitacao_id || '6');
  return {
    numeroControlePNCP: item.numero_controle_pncp || item.id,
    orgaoEntidade: {
      cnpj: item.orgao_cnpj || '',
      razaoSocial: item.orgao_nome || '',
      poderId: '',
      esferaId: item.esfera_nome?.charAt(0) || '',
    },
    unidadeOrgao: {
      ufNome: item.uf || '',
      ufSigla: item.uf || '',          // campo real: "SP", "MG" etc
      municipioNome: item.municipio_nome || '',
      codigoUnidade: '',
      nomeUnidade: item.unidade_nome || '',
    },
    modalidadeId: modalId,
    modalidadeNome: item.modalidade_licitacao_nome || MODALIDADES[modalId] || 'Pregão Eletrônico',
    objetoCompra: item.title || item.description || '',
    informacaoComplementar: item.description,
    dataPublicacaoPncp: item.data_publicacao_pncp || item.createdAt || '',
    dataEncerramentoProposta: item.data_fim_vigencia,  // campo real
    valorTotalEstimado: item.valor_global,              // campo real
    situacaoCompraNome: item.situacao_nome || 'Divulgada no PNCP',
    linkSistemaOrigem: `https://pncp.gov.br/app/editais/${item.orgao_cnpj}/${item.ano}/${item.numero_sequencial}`,
    sequencialCompra: seq,
    anoCompra: ano,
  };
}

// ── Tipos de parâmetros de busca ────────────────────────────────

export interface BuscaPNCPParams {
  q?: string;
  uf?: string;
  dataInicial?: string;
  dataFinal?: string;
  modalidadeId?: number;
  pagina?: number;
  tamanhoPagina?: number;
  apenasAbertas?: boolean;
}

export interface ResultadoBuscaPNCP {
  data: ContratacaoPNCP[];
  totalRegistros: number;
  totalPaginas: number;
  paginaAtual: number;
  erro?: string;
}

// ── Modalidades de licitação ────────────────────────────────────

export const MODALIDADES: Record<number, string> = {
  1:  'Leilão Eletrônico',
  2:  'Diálogo Competitivo',
  3:  'Concurso',
  4:  'Concorrência',
  5:  'Concorrência Eletrônica',
  6:  'Pregão Eletrônico',
  7:  'Pregão Presencial',
  8:  'Dispensa Eletrônica',
  9:  'Inexigibilidade',
  10: 'Manifestação de Interesse',
  11: 'Pré-qualificação',
  12: 'Credenciamento',
  13: 'Leilão Presencial',
};

// ── UFs brasileiras ─────────────────────────────────────────────

export const UFS_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
];

// ── Palavras-chave sugeridas para metalurgia ────────────────────

export const PALAVRAS_CHAVE_SUGERIDAS = [
  'portão metálico', 'estrutura metálica', 'galpão', 'grade de ferro',
  'escada metálica', 'cobertura metálica', 'mezanino', 'guarda-corpo',
  'corrimão', 'cerca metálica', 'tela soldada', 'telha metálica',
  'guarita metálica', 'hangar', 'shed metálico', 'construção metálica',
  'metalurgia', 'serralheria',
];

// ══════════════════════════════════════════════════════════════
//  BUSCA PRINCIPAL via /api/search/
// ══════════════════════════════════════════════════════════════

export async function buscarLicitacoes(params: BuscaPNCPParams): Promise<ResultadoBuscaPNCP> {
  const pagina = params.pagina ?? 1;
  // Se UF filtrada, busca mais itens para compensar filtro client-side
  const fetchSize = params.uf ? Math.min(100, (params.tamanhoPagina ?? 20) * 5) : (params.tamanhoPagina ?? 20);

  const qs = new URLSearchParams({
    path: 'api/search/',
    tipos_documento: 'edital',
    ordenacao: '-data',
    pagina: String(params.uf ? 1 : pagina),  // Always page 1 when UF filter active
    tam_pagina: String(fetchSize),
  });

  if (params.q?.trim()) qs.set('q', params.q.trim());
  
  // A API do PNCP exige o filtro 'status' na busca.
  if (params.apenasAbertas) {
    qs.set('status', 'recebendo_proposta');
  } else {
    // Para buscar todos, passamos todas as situações válidas.
    qs.set('status', 'recebendo_proposta,encerrado,suspenso,revogado,anulado');
  }

  if (params.modalidadeId) qs.set('modalidades', String(params.modalidadeId));

  try {
    const res = await fetch(`${PNCP_BASE}?${qs}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`PNCP HTTP ${res.status}`);

    const json = await res.json();
    let items: SearchItemPNCP[] = json.items ?? [];
    let total: number = json.total ?? json.count ?? items.length;

    // Filtro client-side por UF (API não suporta server-side)
    if (params.uf) {
      items = items.filter(it => (it.uf || '').toUpperCase() === params.uf!.toUpperCase());
      total = items.length;
    }

    const pageSize = params.tamanhoPagina ?? 20;
    const start = params.uf ? 0 : 0;  // já está na página certa
    const pageItems = items.slice(start, start + pageSize);

    return {
      data: pageItems.map(mapSearchItem),
      totalRegistros: total,
      totalPaginas: Math.max(1, Math.ceil(total / pageSize)),
      paginaAtual: pagina,
    };
  } catch (err) {
    return {
      data: [],
      totalRegistros: 0,
      totalPaginas: 0,
      paginaAtual: pagina,
      erro: err instanceof Error ? err.message : 'Erro ao consultar PNCP',
    };
  }
}

// ── Helpers de formatação ───────────────────────────────────────

export function formatarDataPNCP(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatarMoeda(valor?: number): string {
  if (valor == null) return 'Sigiloso';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function urlPNCP(c: ContratacaoPNCP): string {
  if (c.linkSistemaOrigem) return c.linkSistemaOrigem;
  return `https://pncp.gov.br/app/editais/${c.orgaoEntidade.cnpj}/${c.anoCompra}/${c.sequencialCompra}`;
}
