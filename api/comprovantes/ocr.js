// api/comprovantes/ocr.js — Extrai dados estruturados de comprovantes via vision LLM
// POST { comprovante_id } ou { arquivo_id }
// Suporta: Anthropic Claude vision, Groq llama vision, OpenAI gpt-4o vision
import { sb } from '../_lib/supabase.js';
import fs from 'fs';

async function sbBody(p, o) { const r = await sb(p, o); if (!r.ok) throw new Error(r.status); return r.body; }

const SYSTEM_PROMPT = `Você é um extrator de dados de comprovantes bancários brasileiros (PIX, boleto, TED, recibos).
Sua tarefa: olhar a imagem do comprovante e retornar APENAS um JSON com a estrutura:
{
  "tipo": "pix|boleto|transferencia|cartao|dinheiro|recibo|outro",
  "valor": 0.00,
  "data": "YYYY-MM-DD",
  "hora": "HH:MM",
  "banco": "Nome do banco do pagador",
  "banco_destino": "Nome do banco do beneficiário",
  "pagador_nome": "string",
  "pagador_documento": "CPF/CNPJ",
  "beneficiario_nome": "string",
  "beneficiario_documento": "CPF/CNPJ",
  "chave_pix": "string ou null",
  "txid": "string ou null",
  "end_to_end_id": "E... ou null",
  "descricao": "descrição/mensagem do comprovante",
  "confianca": 0.0
}
Confiança 0.0 a 1.0 — o quanto você tem certeza dos dados. Se não conseguir ler algo, deixe null. Responda APENAS com o JSON, sem markdown.`;

async function ocrAnthropic(buf, mime) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const isPdf = mime === 'application/pdf';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [
        { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } },
        { type: 'text', text: 'Extraia os dados estruturados deste comprovante. Responda apenas com o JSON.' }
      ]}],
    }),
  });
  if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0,200));
  const j = await r.json();
  const txt = j.content?.[0]?.text || '';
  return { provider: 'anthropic', json: extractJSON(txt) };
}

async function ocrGroq(buf, mime) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (mime === 'application/pdf') return null; // Groq vision não suporta PDF direto
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.2-90b-vision-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: dataUrl }},
          { type: 'text', text: 'Extraia os dados estruturados deste comprovante. Responda apenas com o JSON.' }
        ]}
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error('Groq ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content || '';
  return { provider: 'groq', json: extractJSON(txt) };
}

async function ocrOpenAI(buf, mime) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (mime === 'application/pdf') return null;
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: dataUrl }},
          { type: 'text', text: 'Extraia os dados estruturados. Responda apenas JSON.' }
        ]}
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });
  if (!r.ok) throw new Error('OpenAI ' + r.status + ': ' + (await r.text()).slice(0,200));
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content || '';
  return { provider: 'openai', json: extractJSON(txt) };
}

function extractJSON(text) {
  if (!text) return null;
  // Remove markdown fences se houver
  let t = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  // Pega 1º bloco {...}
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function tentarOCR(buf, mime) {
  // tenta Groq (gratis) → Anthropic → OpenAI (pago)
  for (const fn of [ocrGroq, ocrAnthropic, ocrOpenAI]) {
    try {
      const r = await fn(buf, mime);
      if (r) return r;
    } catch (e) { console.error('[ocr] provider falhou:', e.message); }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { comprovante_id, arquivo_id } = req.body || {};

    // Resolver arquivo
    let arquivo;
    if (arquivo_id) {
      const arr = await sbBody(`/comprovantes_arquivos?id=eq.${arquivo_id}&select=*`);
      arquivo = arr?.[0];
    } else if (comprovante_id) {
      const arr = await sbBody(`/comprovantes_arquivos?comprovante_id=eq.${comprovante_id}&order=criado_em.desc&limit=1&select=*`);
      arquivo = arr?.[0];
    } else {
      return res.status(400).json({ error: 'comprovante_id ou arquivo_id obrigatório' });
    }
    if (!arquivo) return res.status(404).json({ error: 'arquivo não encontrado' });

    if (!fs.existsSync(arquivo.caminho_arquivo)) {
      await sb(`/comprovantes_arquivos?id=eq.${arquivo.id}`, { method: 'PATCH', body: { ocr_status: 'falhou', ocr_resultado: { erro: 'arquivo não encontrado em disco' }}});
      return res.status(410).json({ error: 'arquivo em disco ausente' });
    }

    const buf = fs.readFileSync(arquivo.caminho_arquivo);
    await sb(`/comprovantes_arquivos?id=eq.${arquivo.id}`, { method: 'PATCH', body: { ocr_status: 'processando' }});

    const r = await tentarOCR(buf, arquivo.mime_type);
    if (!r) {
      await sb(`/comprovantes_arquivos?id=eq.${arquivo.id}`, { method: 'PATCH', body: { ocr_status: 'sem_chave_ia', ocr_resultado: { erro: 'nenhuma chave de IA configurada (ANTHROPIC_API_KEY, GROQ_API_KEY ou OPENAI_API_KEY)' }, ocr_executado_em: new Date().toISOString() }});
      return res.status(503).json({ error: 'OCR indisponível — configure GROQ_API_KEY ou ANTHROPIC_API_KEY no .env' });
    }

    await sb(`/comprovantes_arquivos?id=eq.${arquivo.id}`, { method: 'PATCH', body: {
      ocr_status: 'concluido', ocr_resultado: r.json, ocr_provider: r.provider, ocr_executado_em: new Date().toISOString()
    }});

    // atualiza comprovante com campos extraídos
    if (r.json) {
      const patch = {};
      if (r.json.valor && !isNaN(r.json.valor)) patch.valor = r.json.valor;
      if (r.json.data) patch.data_pagamento = r.json.data;
      if (r.json.tipo) patch.tipo = r.json.tipo;
      if (r.json.banco) patch.banco = r.json.banco;
      if (r.json.pagador_nome) patch.pagador = r.json.pagador_nome;
      if (r.json.beneficiario_nome) patch.beneficiario = r.json.beneficiario_nome;
      if (r.json.txid) patch.txid = r.json.txid;
      if (r.json.end_to_end_id) patch.end_to_end_id = r.json.end_to_end_id;
      if (Object.keys(patch).length > 0) {
        await sb(`/comprovantes?id=eq.${arquivo.comprovante_id}`, { method: 'PATCH', body: patch });
      }
    }
    return res.status(200).json({ ok: true, provider: r.provider, extraido: r.json });
  } catch (err) {
    console.error('[comprovantes/ocr]', err);
    return res.status(500).json({ error: err.message });
  }
}
