// api/_lib/events.js
// Event Bus — emite eventos tipados para o Supabase.
// Cada acao significativa no sistema gera um evento imutavel.
// Isso permite rastreabilidade, causalidade e aprendizado.

import { insert } from './supabase.js';

/**
 * Emite um evento no Event Bus.
 * Fire-and-forget: erros sao logados mas nao bloqueiam o fluxo.
 *
 * @param {object} event
 * @param {string} event.type - Ex: 'lead.stage_changed', 'message.received'
 * @param {string} event.source - Ex: 'whatsapp', 'user', 'agent', 'cron'
 * @param {string} [event.entity_type] - Ex: 'lead', 'campanha', 'proposta'
 * @param {string} [event.entity_id] - ID da entidade afetada
 * @param {string} [event.actor] - Quem causou: 'jean', 'agente:bruno', etc
 * @param {object} [event.payload] - Dados especificos
 * @param {string} [event.session_id] - Agrupa eventos relacionados
 * @param {string} [event.parent_event_id] - Evento pai (causalidade)
 * @param {number} [event.confidence] - Se gerado por IA: 0-100
 */
export function emitEvent(event) {
  const row = {
    type: event.type,
    source: event.source || 'sistema',
    entity_type: event.entity_type || null,
    entity_id: event.entity_id || null,
    actor: event.actor || 'sistema',
    payload: event.payload || {},
    session_id: event.session_id || null,
    parent_event_id: event.parent_event_id || null,
    confidence: event.confidence ?? null,
  };

  // Fire and forget — nunca bloqueia o fluxo principal
  insert('events', row).catch(err => {
    console.warn(`[events] Falha ao emitir ${event.type}:`, err.message);
  });
}

/**
 * Emite evento de mudanca de etapa do lead.
 */
export function emitLeadStageChanged(leadId, fromStage, toStage, actor = 'user') {
  emitEvent({
    type: 'lead.stage_changed',
    source: actor.startsWith('agente:') ? 'agent' : 'user',
    entity_type: 'lead',
    entity_id: leadId,
    actor,
    payload: { from: fromStage, to: toStage },
  });
}

/**
 * Emite evento de mensagem recebida ou enviada.
 */
export function emitMessage(leadId, telefone, direction, texto) {
  emitEvent({
    type: direction === 'saida' ? 'message.sent' : 'message.received',
    source: direction === 'saida' ? 'user' : 'whatsapp',
    entity_type: 'lead',
    entity_id: leadId || telefone,
    actor: direction === 'saida' ? 'jean' : `cliente:${telefone}`,
    payload: { telefone, preview: (texto || '').substring(0, 100) },
  });
}

/**
 * Emite evento de sugestao da IA usada ou rejeitada.
 */
export function emitSuggestionUsed(leadId, agent, label, mensagem, variantId) {
  emitEvent({
    type: 'agent.suggestion_used',
    source: 'agent',
    entity_type: 'lead',
    entity_id: leadId,
    actor: `agente:${agent}`,
    payload: { label, mensagem: (mensagem || '').substring(0, 100), variant: variantId },
  });
}

/**
 * Emite evento de proposta criada.
 */
export function emitProposalCreated(proposalId, leadId, valorTotal) {
  emitEvent({
    type: 'proposal.created',
    source: 'user',
    entity_type: 'proposta',
    entity_id: proposalId,
    actor: 'jean',
    payload: { lead_id: leadId, valor_total: valorTotal },
  });
}

/**
 * Emite evento de campanha criada/gerada.
 */
export function emitCampaignCreated(campaignId, channel, objective, createdBy) {
  emitEvent({
    type: 'campaign.created',
    source: 'agent',
    entity_type: 'campanha',
    entity_id: campaignId,
    actor: createdBy || 'agente:abbacchio',
    payload: { channel, objective },
  });
}

/**
 * Emite evento de sessao de agente.
 */
export function emitAgentSession(agent, triggerType, inputSummary, outputSummary, provider, model, durationMs) {
  emitEvent({
    type: 'agent.session_completed',
    source: 'agent',
    actor: `agente:${agent}`,
    payload: {
      trigger: triggerType,
      input: (inputSummary || '').substring(0, 200),
      output: (outputSummary || '').substring(0, 200),
      provider,
      model,
      duration_ms: durationMs,
    },
  });
}
