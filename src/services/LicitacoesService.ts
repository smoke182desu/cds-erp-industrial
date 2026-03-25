// ══════════════════════════════════════════════════════════════
//  LicitacoesService.ts
//  Integração com o Portal Nacional de Contratações Públicas (PNCP)
//  API pública e gratuita: https://api.pncp.gov.br
// ══════════════════════════════════════════════════════════════

const PNCP_BASE = 'https://api.pncp.gov.br';

// ── Tipos retornados pela API PNCP ──────────────────────────────

export interface ContratacaoPNCP {
  numeroControlePNCP: string;          // ID único PNCP
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
  dataPublicacaoPncp: string;          // ISO Date
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  situacaoCompraNome: string;          // "Divulgada no PNCP" | "Encerrada" | etc.
  linkSistemaOrigem?: string;
  sequencialCompra: number;
  anoCompra: number;
}

export interface BuscaPNCPParams {
  q?: string;                          // Palavra-chave no objeto
  uf?: string;                         // Ex: "DF", "SP"
  dataInicial?: string;                // YYYY-MM-DD
  dataFinal?: string;
  modalidadeId?: number;               // 6 = Pregão Eletrônico, etc.
  pagina?: number;
  tamanhoPagina?: number;
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

// ── Palavras-chave sugeridas para metalurgia/construção ────────

export const PALAVRAS_CHAVE_SUGERIDAS = [
  'portão metálico', 'estrutura metálica', 'galpão', 'grade de ferro',
  'escada metálica', 'cobertura metálica', 'mezanino', 'guarda-corpo',
  'corrimão', 'cerca metálica', 'tela soldada', 'telha metálica',
  'guarita metálica', 'hangar', 'shed metálico', 'construção metálica',
  'metalúrgica', 'serralheria',
];

// ══════════════════════════════════════════════════════════════
//  BUSCA POR PUBLICAÇÃO — endpoint principal para novidades
//  GET /api/pncp/v1/contratacoes/publicacao
// ══════════════════════════════════════════════════════════════

export async function buscarLicitacoesPNCP(params: BuscaPNCPParams): Promise<ResultadoBuscaPNCP> {
  const pagina = params.pagina ?? 1;
  const tamanhoPagina = params.tamanhoPagina ?? 20;

  // Datas padrão: últimos 30 dias
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  const dataFinal   = params.dataFinal   ?? hoje.toISOString().slice(0, 10);
  const dataInicial = params.dataInicial ?? trintaDiasAtras.toISOString().slice(0, 10);

  const qs = new URLSearchParams({
    dataInicial,
    dataFinal,
    pagina: String(pagina),
    tamanhoPagina: String(tamanhoPagina),
  });

  if (params.modalidadeId) qs.set('modalidadeId', String(params.modalidadeId));
  if (params.uf)           qs.set('uf', params.uf);

  try {
    const res = await fetch(`${PNCP_BASE}/api/pncp/v1/contratacoes/publicacao?${qs}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) throw new Error(`PNCP HTTP ${res.status}`);

    const json = await res.json();

    // API retorna { data: [], totalRegistros: N, totalPaginas: N }
    let registros: ContratacaoPNCP[] = json.data ?? json ?? [];

    // Filtrar por palavra-chave no lado cliente (a API não suporta busca full-text neste endpoint)
    if (params.q && params.q.trim()) {
      const termo = params.q.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      registros = registros.filter(c => {
        const obj = (c.objetoCompra || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const info = (c.informacaoComplementar || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return obj.includes(termo) || info.includes(termo);
      });
    }

    return {
      data: registros,
      totalRegistros: json.totalRegistros ?? registros.length,
      totalPaginas: json.totalPaginas ?? Math.ceil((json.totalRegistros ?? registros.length) / tamanhoPagina),
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

// ══════════════════════════════════════════════════════════════
//  BUSCA POR PROPOSTA — editais com propostas abertas
//  GET /api/pncp/v1/contratacoes/proposta
// ══════════════════════════════════════════════════════════════

export async function buscarPropostasAbertas(params: BuscaPNCPParams): Promise<ResultadoBuscaPNCP> {
  const pagina = params.pagina ?? 1;
  const tamanhoPagina = params.tamanhoPagina ?? 20;

  const hoje = new Date();
  const dataFinal   = params.dataFinal   ?? new Date(hoje.getTime() + 60 * 86400000).toISOString().slice(0, 10);
  const dataInicial = params.dataInicial ?? hoje.toISOString().slice(0, 10);

  const qs = new URLSearchParams({
    dataInicial,
    dataFinal,
    pagina: String(pagina),
    tamanhoPagina: String(tamanhoPagina),
  });

  if (params.modalidadeId) qs.set('modalidadeId', String(params.modalidadeId));
  if (params.uf)           qs.set('uf', params.uf);

  try {
    const res = await fetch(`${PNCP_BASE}/api/pncp/v1/contratacoes/proposta?${qs}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) throw new Error(`PNCP HTTP ${res.status}`);
    const json = await res.json();
    let registros: ContratacaoPNCP[] = json.data ?? json ?? [];

    if (params.q?.trim()) {
      const termo = params.q.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      registros = registros.filter(c => {
        const obj = (c.objetoCompra || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return obj.includes(termo);
      });
    }

    return {
      data: registros,
      totalRegistros: json.totalRegistros ?? registros.length,
      totalPaginas: json.totalPaginas ?? 1,
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

// ══════════════════════════════════════════════════════════════
//  BUSCA UNIFICADA — tenta proposta aberta, cai para publicação
// ══════════════════════════════════════════════════════════════

export async function buscarLicitacoes(params: BuscaPNCPParams & { apenasAbertas?: boolean }): Promise<ResultadoBuscaPNCP> {
  if (params.apenasAbertas) {
    return buscarPropostasAbertas(params);
  }
  return buscarLicitacoesPNCP(params);
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
