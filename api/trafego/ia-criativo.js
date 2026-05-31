// api/trafego/ia-criativo.js — gera variações de criativos via LLM, com contexto da empresa
import { sb } from '../_lib/supabase.js';

async function buscarContextoEmpresa(clienteId) {
  if (!clienteId) return '';
  try {
    const r = await fetch(`http://127.0.0.1:3000/api/conhecimento/contexto-ia?cliente_id=${clienteId}`);
    if (!r.ok) return '';
    const d = await r.json();
    return d.contexto_md || '';
  } catch { return ''; }
}

const SYSTEM_PROMPT = `Você é um copywriter especialista em tráfego pago brasileiro.
Quando o usuário enviar contexto sobre a empresa, use ESSE contexto pra alinhar tom de voz, mensagem, palavras-chave e diferenciais nos anúncios. Respeite a personalidade da marca.
Gera anúncios persuasivos, breves e com gatilhos de conversão.
- Headline: 30-60 caracteres, gancho forte
- Texto principal: 90-130 caracteres, benefício + prova social ou urgência
- Descrição: 30-90 caracteres, reforço
- CTA: SAIBA_MAIS, COMPRAR_AGORA, CADASTRE_SE, SOLICITAR_ORCAMENTO, FALAR_AGORA, BAIXAR_AGORA, ENVIAR_MENSAGEM, VER_OFERTA
Retorna JSON puro: { "variacoes": [{"headline","texto_principal","descricao","cta"}, ...] }`;

async function chamarGroq(prompt, n) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${prompt}\n\nGere ${n} variações distintas. Retorne JSON puro com a chave 'variacoes'.` },
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content);
}

async function chamarAnthropic(prompt, n) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${prompt}\n\nGere ${n} variações distintas. Retorna APENAS JSON puro com a chave 'variacoes'.` }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const txt = j.content[0].text;
  const m = txt.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : txt);
}

async function chamarOpenAI(prompt, n) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${prompt}\n\nGere ${n} variações distintas.` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { briefing, plataforma, objetivo, tipo, n_variacoes, contexto_cliente, cliente_id } = req.body || {};
    if (!briefing) return res.status(400).json({ error: 'briefing obrigatório' });

    const n = Math.min(Math.max(parseInt(n_variacoes) || 3, 1), 6);

    // Busca contexto da empresa do módulo Conhecimento
    const contextoEmpresa = cliente_id ? await buscarContextoEmpresa(cliente_id) : '';

    const partes = [
      contextoEmpresa ? `# CONTEXTO DA EMPRESA (use isso pra ajustar tom, mensagem, palavras-chave):\n${contextoEmpresa}\n\n---\n` : '',
      `# DETALHES DA CAMPANHA:`,
      `Cliente/Empresa: ${contexto_cliente || 'não informado'}`,
      `Plataforma: ${plataforma || 'meta'} (Facebook/Instagram Ads)`,
      `Objetivo: ${objetivo || 'leads'}`,
      `Tipo de criativo: ${tipo || 'imagem'}`,
      ``,
      `# BRIEFING DA CAMPANHA:`,
      briefing,
    ].filter(Boolean).join('\n');

    let resultado = null;
    let provedor = null;
    const tentativas = [
      { nome: 'groq', fn: chamarGroq },
      { nome: 'anthropic', fn: chamarAnthropic },
      { nome: 'openai', fn: chamarOpenAI },
    ];
    let ultimoErr = null;
    for (const t of tentativas) {
      try {
        const r = await t.fn(partes, n);
        if (r) { resultado = r; provedor = t.nome; break; }
      } catch (e) { ultimoErr = e; }
    }
    if (!resultado) {
      return res.status(503).json({
        error: 'Nenhum provedor de IA configurado',
        dica: 'Adicione GROQ_API_KEY (gratis em console.groq.com), ANTHROPIC_API_KEY ou OPENAI_API_KEY no .env do VPS',
        ultimo_erro: ultimoErr?.message,
      });
    }

    return res.status(200).json({
      provedor,
      tinha_contexto_empresa: !!contextoEmpresa,
      ...resultado,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
