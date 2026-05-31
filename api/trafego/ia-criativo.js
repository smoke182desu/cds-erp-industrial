// api/trafego/ia-criativo.js
// POST { briefing, plataforma, objetivo, tipo, n_variacoes }
// Retorna { variacoes: [{ headline, texto_principal, cta, descricao }, ...] }
// Suporta Groq (free fast), Anthropic Claude e OpenAI — tenta a primeira disponível

const SYSTEM_PROMPT = `Você é um copywriter especialista em tráfego pago brasileiro. Gera anúncios persuasivos, breves e com gatilhos de conversão.
- Headline: 30-60 caracteres, gancho forte
- Texto principal: 90-130 caracteres, benefício + prova social ou urgência
- Descrição: 30-90 caracteres, reforço
- CTA: SAIBA_MAIS, COMPRAR_AGORA, CADASTRE_SE, SOLICITAR_ORCAMENTO, FALAR_AGORA, BAIXAR_AGORA, ENVIAR_MENSAGEM
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
        { role: 'user', content: `${prompt}\n\nGere ${n} variações distintas.` },
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
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${prompt}\n\nGere ${n} variações distintas. Retorna JSON puro.` }],
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
    const { briefing, plataforma, objetivo, tipo, n_variacoes, contexto_cliente } = req.body || {};
    if (!briefing) return res.status(400).json({ error: 'briefing obrigatório' });

    const n = Math.min(Math.max(parseInt(n_variacoes) || 3, 1), 6);
    const partes = [
      `Cliente/Empresa: ${contexto_cliente || 'não informado'}`,
      `Plataforma: ${plataforma || 'meta'} (Facebook/Instagram Ads)`,
      `Objetivo: ${objetivo || 'leads'}`,
      `Tipo de criativo: ${tipo || 'imagem'}`,
      ``,
      `Briefing:`,
      briefing,
    ].join('\n');

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
      ...resultado,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
