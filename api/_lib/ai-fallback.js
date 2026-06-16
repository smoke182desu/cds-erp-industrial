// api/_lib/ai-fallback.js
// Motor de IA multi-provider com fallback automatico: OpenAI -> Gemini -> Groq
// Ordem configurada por preferencia: qualidade (OpenAI) primeiro, depois custo zero (Gemini, Groq)

import axios from 'axios';

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const OPENAI_MODELS = [
  'gpt-4o-mini',
  'gpt-3.5-turbo'
];

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite'
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];

export function hasAnyProvider() {
  return !!(OPENAI_API_KEY || GEMINI_API_KEY || GROQ_API_KEY);
}

/**
 * Indica quais providers estao disponiveis (util pra UI mostrar status).
 */
export function providerStatus() {
  return {
    openai: !!OPENAI_API_KEY,
    gemini: !!GEMINI_API_KEY,
    groq: !!GROQ_API_KEY,
  };
}

async function tryOpenAI(systemPrompt, userPrompt, maxTokens, temperature) {
  for (const model of OPENAI_MODELS) {
    try {
      const payload = {
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
      };
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      });
      const content = resp.data?.choices?.[0]?.message?.content || '';
      return { content, provider: 'openai', model };
    } catch (err) {
      console.log(`[ai-fallback] OpenAI (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
      // 401/403 -> sem chave valida, nao adianta tentar outro modelo do mesmo provider
      if (err.response?.status === 401 || err.response?.status === 403) break;
    }
  }
  return null;
}

async function tryGemini(systemPrompt, userPrompt, maxTokens, temperature) {
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}` }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }
      };
      const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
      const content = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { content, provider: 'gemini', model };
    } catch (err) {
      console.log(`[ai-fallback] Gemini (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
      if (err.response?.status === 401 || err.response?.status === 403) break;
    }
  }
  return null;
}

async function tryGroq(systemPrompt, userPrompt, maxTokens, temperature) {
  for (const model of GROQ_MODELS) {
    try {
      const payload = {
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
      };
      const resp = await axios.post(`${GROQ_BASE_URL}/chat/completions`, payload, {
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      });
      const content = resp.data?.choices?.[0]?.message?.content || '';
      return { content, provider: 'groq', model };
    } catch (err) {
      console.log(`[ai-fallback] Groq (${model}) erro:`, err.response?.status, err.response?.data?.error?.message || err.message);
      if (err.response?.status === 401 || err.response?.status === 403) break;
    }
  }
  return null;
}

/**
 * Chama IA com fallback automatico entre providers.
 * Ordem: Gemini (gratis) -> Groq (gratis) -> OpenAI (pago)
 * Retorna { content, provider, model } em vez do formato raw de cada provider.
 */
export async function chamarIA(systemPrompt, userPrompt, opts = {}) {
  const { maxTokens = 800, temperature = 0.7 } = opts;

  // TIER 1: Gemini (gratis, excelente PT-BR)
  if (GEMINI_API_KEY) {
    const r = await tryGemini(systemPrompt, userPrompt, maxTokens, temperature);
    if (r) return r;
  }

  // TIER 2: Groq (gratis, rapido)
  if (GROQ_API_KEY) {
    const r = await tryGroq(systemPrompt, userPrompt, maxTokens, temperature);
    if (r) return r;
  }

  // TIER 3: OpenAI (pago, fallback final)
  if (OPENAI_API_KEY) {
    const r = await tryOpenAI(systemPrompt, userPrompt, maxTokens, temperature);
    if (r) return r;
  }

  throw new Error('Todos os motores de IA esgotaram (Gemini + Groq + OpenAI). Verifique as chaves no .env.');
}

/**
 * Parse JSON de resposta da IA com tolerancia a erros.
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
