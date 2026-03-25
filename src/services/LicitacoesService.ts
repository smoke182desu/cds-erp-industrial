// ══════════════════════════════════════════════════════════════
//  LicitacoesService.ts
//  Integração com o Portal Nacional de Contratações Públicas (PNCP)
//  Endpoint de busca: https://pncp.gov.br/api/search/
//
//  Em dev/produção: requisições via proxy Express /pncp-api/* → pncp.gov.br/*
// ══════════════════════════════════════════════════════════════

// O proxy no server.ts redireciona /pncp-api/* → https://pncp.gov.br/*
const PNCP_BASE = '/pncp-api';

// ── Resposta da API de busca PNCP ───────────────────────────────

export interface SearchItemPNCP {
  id: string;
  numero_controle_pncp: string;    // Ex: "10091502000129-1-000013/2026"
  title: string;                   // Título do edital
  description: string;             // Objeto/descrição
  item_url: string;                // Ex: "/compras/cnpj/2026/13"
  document_type: string;           // "edital" | "contrato" | "ata"
  createdAt: string;               // ISO
  ano: string;
  numero_sequencial: string;
  orgao_cnpj: string;
  orgao_nome: string;
  unidade_nome: string;
  esfera_nome: string;             // "Federal" | "Estadual" | "Municipal"
  // Campos opcionais (nem sempre presentes)
  uf_nome?: string;
  municipio_nome?: string;
  modalidade_nome?: string;
  modalidade_id?: number;
  valor_total_estimado?: number;
  data_encerramento_proposta?: string;
  data_publicacao_pncp?: string;
  situacao_compra_nome?: string;
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

// Converte SearchItemPNCP → ContratacaoPNCP (para compatibilidade com os componentes)
function mapSearchItem(item: SearchItemPNCP): ContratacaoPNCP {
  // Extrai UF de uf_nome se disponível
  const ufSigla = item.uf_nome?.slice(0, 2).toUpperCase() || '';
  const seq = parseInt(item.numero_sequencial || '0');
  const ano = parseInt(item.ano || '2026');

  return {
    numeroControlePNCP: item.numero_controle_pncp || item.id,
    orgaoEntidade: {
      cnpj: item.orgao_cnpj || '',
      razaoSocial: item.orgao_nome || '',
      poderId: '',
      esferaId: item.esfera_nome?.charAt(0) || '',
    },
    unidadeOrgao: {
      ufNome: item.uf_nome || '',
      ufSigla,
      municipioNome: item.municipio_nome || '',
      codigoUnidade: '',
      nomeUnidade: item.unidade_nome || '',
    },
    modalidadeId: item.modalidade_id || 6,
    modalidadeNome: item.modalidade_nome || 'Pregão Eletrônico',
    objetoCompra: item.title || item.description || '',
    informacaoComplementar: item.description,
    dataPublicacaoPncp: item.data_publicacao_pncp || item.createdAt || '',
    dataEncerramentoProposta: item.data_encerramento_proposta,
    valorTotalEstimado: item.valor_total_estimado,
    situacaoCompraNome: item.situacao_compra_nome || 'Recebendo Proposta',
    linkSistemaOrigem: `https://pncp.gov.br${item.item_url}`,
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
  const tamanhoPagina = params.tamanhoPagina ?? 20;

  const qs = new URLSearchParams({
    tipos_documento: 'edital',
    ordenacao: '-data',
    pagina: String(pagina),
    tam_pagina: String(tamanhoPagina),
  });

  if (params.q?.trim())      qs.set('q', params.q.trim());
  if (params.apenasAbertas)  qs.set('status', 'recebendo_proposta');

  // Filtro de UF (o search API aceita uf via query)
  if (params.uf) qs.set('uf', params.uf);

  try {
    const res = await fetch(`${PNCP_BASE}/api/search/?${qs}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`PNCP HTTP ${res.status}`);

    const json = await res.json();
    const items: SearchItemPNCP[] = json.items ?? [];
    const total: number = json.total ?? json.count ?? items.length;

    return {
      data: items.map(mapSearchItem),
      totalRegistros: total,
      totalPaginas: Math.max(1, Math.ceil(total / tamanhoPagina)),
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
