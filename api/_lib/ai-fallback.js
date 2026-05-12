// api/_lib/ai-fallback.js
// Motor de IA multi-provider com fallback automatico: Gemini -> Groq -> OpenAI
// Extraido de assistente-vendas.js para reuso em todos os agentes.

import axios from 'axios';

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite'
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];

export function hasAnyProvider() {
  return !!(GROQ_API_KEY || GEMINI_API_KEY || OPENAI_API_KEY);
}

/**
 * Chama IA com fallback automatico entre providers.
 * Retorna { content, provider, model } em vez do formato raw de cada provider.
 */
export async function chamarIA(systemPrompt, userPrompt, opts = {}) {
  const { maxTokens = 800, temperature = 0.7 } = opts;
  let lastError;
  let usedProvider = '';
  let usedModel = '';

  // TIER 1: Gemini
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}` }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: "application/json" }
        };
        const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
        const content = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { content, provider: 'gemini', model };
      } catch (err) {
        console.log(`[ai-fallback] Gemini (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 2: Groq
  if (GROQ_API_KEY) {
    const payload = {
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
    };
    for (const model of GROQ_MODELS) {
      try {
        payload.model = model;
        const resp = await axios.post(`${GROQ_BASE_URL}/chat/completions`, payload, {
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        });
        const content = resp.data?.choices?.[0]?.message?.content || '';
        return { content, provider: 'groq', model };
      } catch (err) {
        console.log(`[ai-fallback] Groq (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
        lastError = err;
        continue;
      }
    }
  }

  // TIER 3: OpenAI
  if (OPENAI_API_KEY) {
    try {
      const model = 'gpt-4o-mini';
      const payload = {
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
      };
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      const content = resp.data?.choices?.[0]?.message?.content || '';
      return { content, provider: 'openai', model };
    } catch (err) {
      console.log('[ai-fallback] OpenAI falhou.');
      lastError = err;
    }
  }

  throw lastError || new Error('Todos os motores de IA esgotaram a cota (Gemini + Groq + OpenAI).');
}

/**
 * Parse JSON de resposta da IA com tolerancia a erros.
 * Tenta parse direto, depois regex, depois falha.
 */
export function parseIAResponse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    throw new Error('JSON invalido da IA: ' + raw.substring(0, 200));
  }
}
