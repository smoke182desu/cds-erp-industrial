// =================================================================
//  useLicitacoesState.ts
//  Hook de estado persistente para o módulo de Licitações (B2G)
//  Persiste automaticamente em localStorage (padrão do ERP)
// =================================================================

import { useState, useEffect, useCallback } from 'react';
import { ContratacaoPNCP } from '../services/LicitacoesService';
import { LicitacaoExtra, defaultExtra } from '../components/licitacoes/LicitacaoWorkspace';

// ── Tipos ──────────────────────────────────────────────────────────

export type EtapaLicitacao = 'captacao' | 'analise' | 'proposta' | 'disputa' | 'ganha';

export interface LicitacaoManualData {
  titulo: string;
  orgao: string;
  numeroEdital: string;
  modalidade: string;
  objeto: string;
  dataAbertura?: string;
  dataEncerramento?: string;
  valorEstimado?: number;
  observacoes?: string;
}

export interface LicitacaoTracked extends ContratacaoPNCP {
  etapa: EtapaLicitacao;
  adicionadoEm: string;
  manual?: boolean;
  manualData?: LicitacaoManualData;
}

// ── Chaves de localStorage ─────────────────────────────────────────

const KEY_TRACKED = '@cds-licitacoes-tracked';
const KEY_EXTRAS  = '@cds-licitacoes-extras';

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// =================================================================
//  Hook principal
// =================================================================

export function useLicitacoesState() {
  // ── Estado persistido ────────────────────────────────────────────

  const [tracked, setTracked] = useState<LicitacaoTracked[]>(() =>
    safeRead<LicitacaoTracked[]>(KEY_TRACKED, [])
  );

  const [extras, setExtras] = useState<Record<string, LicitacaoExtra>>(() =>
    safeRead<Record<string, LicitacaoExtra>>(KEY_EXTRAS, {})
  );

  // ── Sincroniza com localStorage sempre que mudar ─────────────────

  useEffect(() => {
    localStorage.setItem(KEY_TRACKED, JSON.stringify(tracked));
  }, [tracked]);

  useEffect(() => {
    localStorage.setItem(KEY_EXTRAS, JSON.stringify(extras));
  }, [extras]);

  // ── Helpers de extras ────────────────────────────────────────────

  const getExtra = useCallback(
    (id: string): LicitacaoExtra => extras[id] ?? defaultExtra(),
    [extras]
  );

  const setExtra = useCallback(
    (id: string, patch: Partial<LicitacaoExtra>) =>
      setExtras(prev => ({
        ...prev,
        [id]: { ...(prev[id] ?? defaultExtra()), ...patch },
      })),
    []
  );

  // ── Ações do Kanban ──────────────────────────────────────────────

  /** Adiciona uma licitação ao kanban (ou remove se já estiver) */
  const acompanhar = useCallback((item: ContratacaoPNCP) => {
    const jaEsta = tracked.some(t => t.numeroControlePNCP === item.numeroControlePNCP);
    if (jaEsta) {
      setTracked(prev => prev.filter(t => t.numeroControlePNCP !== item.numeroControlePNCP));
      return false; // removida
    }
    const novo: LicitacaoTracked = {
      ...item,
      etapa: 'captacao',
      adicionadoEm: new Date().toISOString(),
    };
    setTracked(prev => [novo, ...prev]);
    setExtras(prev => ({
      ...prev,
      [item.numeroControlePNCP]: prev[item.numeroControlePNCP] ?? defaultExtra(),
    }));
    return true; // adicionada
  }, [tracked]);

  /** Verifica se uma licitação está sendo acompanhada */
  const isTracked = useCallback(
    (id: string) => tracked.some(t => t.numeroControlePNCP === id),
    [tracked]
  );

  /** Move uma licitação de etapa no kanban */
  const moverEtapa = useCallback((id: string, etapa: EtapaLicitacao) => {
    setTracked(prev =>
      prev.map(t => (t.numeroControlePNCP === id ? { ...t, etapa } : t))
    );
  }, []);

  /** Remove uma licitação do kanban */
  const removerTracked = useCallback((id: string) => {
    setTracked(prev => prev.filter(t => t.numeroControlePNCP !== id));
  }, []);

  // ── Estatísticas rápidas ─────────────────────────────────────────

  const stats = {
    total: tracked.length,
    captacao:  tracked.filter(t => t.etapa === 'captacao').length,
    analise:   tracked.filter(t => t.etapa === 'analise').length,
    proposta:  tracked.filter(t => t.etapa === 'proposta').length,
    disputa:   tracked.filter(t => t.etapa === 'disputa').length,
    ganhas:    tracked.filter(t => t.etapa === 'ganha').length,
    valorTotal: tracked.reduce((acc, t) => acc + (t.valorTotalEstimado ?? 0), 0),
    // Licitações com prazo nos próximos 7 dias
    urgentes: tracked.filter(t => {
      if (!t.dataEncerramentoProposta) return false;
      const dias = Math.ceil(
        (new Date(t.dataEncerramentoProposta).getTime() - Date.now()) / 86_400_000
      );
      return dias >= 0 && dias <= 7;
    }).length,
  };

  /** Adiciona uma licitação manualmente (sem PNCP) */
  const adicionarManual = useCallback((
    data: LicitacaoManualData,
    etapa: EtapaLicitacao = 'captacao'
  ) => {
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nova: LicitacaoTracked = {
      numeroControlePNCP: id,
      orgaoEntidade: { cnpj: '', razaoSocial: data.orgao, poderId: '', esferaId: '' },
      unidadeOrgao: { ufNome: '', ufSigla: '', municipioNome: '', codigoUnidade: '', nomeUnidade: data.orgao },
      modalidadeId: 6,
      modalidadeNome: data.modalidade || 'Pregão Eletrônico',
      objetoCompra: data.objeto || data.titulo,
      informacaoComplementar: data.observacoes,
      dataPublicacaoPncp: new Date().toISOString(),
      dataEncerramentoProposta: data.dataEncerramento,
      dataAberturaProposta: data.dataAbertura,
      valorTotalEstimado: data.valorEstimado ?? undefined,
      situacaoCompraNome: 'Manual',
      sequencialCompra: 0,
      anoCompra: new Date().getFullYear(),
      etapa,
      adicionadoEm: new Date().toISOString(),
      manual: true,
      manualData: data,
    };
    setTracked(prev => [nova, ...prev]);
    setExtras(prev => ({
      ...prev,
      [id]: { ...defaultExtra(), numeroPregao: data.numeroEdital },
    }));
    return id;
  }, []);

  return {
    tracked,
    extras,
    getExtra,
    setExtra,
    acompanhar,
    isTracked,
    moverEtapa,
    removerTracked,
    adicionarManual,
    stats,
  };
}
