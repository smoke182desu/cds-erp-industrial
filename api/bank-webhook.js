// api/bank-webhook.js — Receptor genérico de webhooks bancários (PIX, boleto, TED)
// POST /api/bank-webhook?banco=sicoob|itau|bradesco|bb|santander|nubank|generic[&cliente_id=UUID]
// Persistir payload bruto, tentar matching automático com pedido/comprovante.
//
// Cada banco real envia formato próprio. Aqui temos um normalizador genérico que
// extrai campos comuns (valor, txid, endToEndId, pagador) de várias estruturas conhecidas.
import crypto from 'crypto';
import { sb } from './_lib/supabase.js';

async function sbBody(p, o) { const r = await sb(p, o); if (!r.ok) throw new Error(r.status); return r.body; }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.rawBody) return resolve(Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody));
    if (req.body && typeof req.body === 'string') return resolve(req.body);
    if (req.body && typeof req.body === 'object') return resolve(JSON.stringify(req.body));
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifySignature(banco, body, signature) {
  const secrets = {
    sicoob: process.env.SICOOB_WEBHOOK_SECRET,
    itau: process.env.ITAU_WEBHOOK_SECRET,
    bradesco: process.env.BRADESCO_WEBHOOK_SECRET,
    bb: process.env.BB_WEBHOOK_SECRET,
    santander: process.env.SANTANDER_WEBHOOK_SECRET,
    nubank: process.env.NUBANK_WEBHOOK_SECRET,
    generic: process.env.BANK_WEBHOOK_SECRET,
  };
  const secret = secrets[banco] || secrets.generic;
  if (!secret) return null;
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.replace(/^sha256=/, '')));
}

function normalizarPayload(banco, p) {
  // tenta achar campos comuns de várias APIs
  const out = { banco };
  // BACEN/Pix padrão (Sicoob, Itaú, BB seguem similar)
  if (p?.pix?.[0]) {
    const x = p.pix[0];
    out.tipo_evento = 'pix_recebido';
    out.txid = x.txid;
    out.end_to_end_id = x.endToEndId;
    out.valor = Number(x.valor) || 0;
    out.data_pagamento = x.horario || x.dataHorario;
    out.pagador_nome = x.pagador?.nome || x.devedor?.nome;
    out.pagador_documento = x.pagador?.cpf || x.pagador?.cnpj || x.devedor?.cpf || x.devedor?.cnpj;
    out.pagador_banco = x.infoPagador;
  } else if (p?.txid && p?.valor) {
    out.tipo_evento = p.tipo || 'pix_recebido';
    out.txid = p.txid;
    out.end_to_end_id = p.endToEndId || p.e2eid;
    out.valor = Number(p.valor) || 0;
    out.data_pagamento = p.horario || p.dataPagamento;
    out.pagador_nome = p.pagador?.nome;
    out.pagador_documento = p.pagador?.documento || p.pagador?.cpf || p.pagador?.cnpj;
  } else if (p?.evento === 'boleto_pago' || p?.evento === 'boleto') {
    out.tipo_evento = 'boleto_pago';
    out.txid = p.nossoNumero || p.linhaDigitavel;
    out.valor = Number(p.valorPago || p.valor) || 0;
    out.data_pagamento = p.dataPagamento;
    out.pagador_nome = p.pagador?.nome;
  } else {
    // payload desconhecido — guarda como é
    out.tipo_evento = p?.tipo || p?.evento || 'desconhecido';
    out.valor = Number(p?.valor || p?.amount) || 0;
  }
  return out;
}

async function tentarMatch(empresaId, dados) {
  // 1) match por txid em wc_pedidos.payload_bruto (raro mas possível)
  if (dados.txid) {
    const arr = await sbBody(`/comprovantes?cliente_agencia_id=eq.${empresaId}&txid=eq.${encodeURIComponent(dados.txid)}&select=id&limit=1`);
    if (arr?.[0]) return { comprovante_id: arr[0].id, reason: 'txid existente', score: 1.0 };
  }
  // 2) match por end_to_end_id em comprovantes
  if (dados.end_to_end_id) {
    const arr = await sbBody(`/comprovantes?cliente_agencia_id=eq.${empresaId}&end_to_end_id=eq.${encodeURIComponent(dados.end_to_end_id)}&select=id&limit=1`);
    if (arr?.[0]) return { comprovante_id: arr[0].id, reason: 'end_to_end_id existente', score: 1.0 };
  }
  // 3) match por valor exato + data ±1 dia em wc_pedidos pendentes
  if (dados.valor && dados.data_pagamento) {
    const dt = new Date(dados.data_pagamento);
    const dtIni = new Date(dt.getTime() - 24*3600*1000).toISOString().slice(0,10);
    const dtFim = new Date(dt.getTime() + 24*3600*1000).toISOString().slice(0,10);
    const arr = await sbBody(`/wc_pedidos?cliente_agencia_id=eq.${empresaId}&total=eq.${dados.valor}&data_pedido=gte.${dtIni}&data_pedido=lte.${dtFim}&select=id,proposta_gerada_id&limit=1`);
    if (arr?.[0]) return { wc_pedido_id: arr[0].id, reason: 'valor+data wc_pedido', score: 0.85 };
  }
  // 4) match por valor exato em faturas_agencia pendentes
  if (dados.valor) {
    const arr = await sbBody(`/faturas_agencia?cliente_agencia_id=eq.${empresaId}&status=in.(pendente,vencida)&valor_total=eq.${dados.valor}&select=id&limit=1`);
    if (arr?.[0]) return { fatura_id: arr[0].id, reason: 'valor de fatura pendente', score: 0.8 };
  }
  return null;
}

async function criarComprovanteAuto(empresaId, banco, dados) {
  const ins = await sb('/comprovantes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: {
    cliente_agencia_id: empresaId,
    tipo: dados.tipo_evento?.startsWith('pix') ? 'pix' : dados.tipo_evento?.includes('boleto') ? 'boleto' : 'transferencia',
    titulo: `${banco.toUpperCase()} — ${dados.pagador_nome || dados.txid || 'pagamento recebido'}`,
    descricao: `Recebido automaticamente via webhook ${banco}`,
    valor: dados.valor,
    data_pagamento: dados.data_pagamento ? new Date(dados.data_pagamento).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
    status: 'aprovado',
    fonte: 'banco',
    banco,
    pagador: dados.pagador_nome,
    txid: dados.txid,
    end_to_end_id: dados.end_to_end_id,
    metadata: { origem: 'bank-webhook', banco, dados },
  }});
  return ins.body?.[0]?.id;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, msg: 'Bank webhook endpoint. Configure no portal do seu banco apontando POST aqui com query ?banco=' });
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const banco = (req.query?.banco || 'generic').toLowerCase();
    const cliente_id = req.query?.cliente_id;

    const rawBody = await readRawBody(req);
    const signature = req.headers['x-signature'] || req.headers['x-hub-signature-256'] || req.headers['x-itau-signature'] || '';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    const sigValid = verifySignature(banco, rawBody, signature);

    let payload;
    try { payload = JSON.parse(rawBody); } catch { payload = { raw: rawBody.slice(0, 2000) }; }
    const dados = normalizarPayload(banco, payload);

    // Persistir
    const ins = await sb('/bank_webhooks_recebidos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: {
      cliente_agencia_id: cliente_id || null,
      banco,
      tipo_evento: dados.tipo_evento,
      txid: dados.txid,
      end_to_end_id: dados.end_to_end_id,
      valor: dados.valor,
      data_pagamento: dados.data_pagamento ? new Date(dados.data_pagamento).toISOString() : null,
      pagador_nome: dados.pagador_nome,
      pagador_documento: dados.pagador_documento,
      pagador_banco: dados.pagador_banco,
      payload_bruto: payload,
      signature, signature_valid: sigValid,
      ip_origem: ip,
    }});
    const wbId = ins.body?.[0]?.id;

    // Se signature_valid===false, retorna 401 mas mantém log
    if (sigValid === false) {
      return res.status(401).json({ error: 'assinatura inválida', wb_id: wbId });
    }

    // Tentar matching automático
    let match = null;
    if (cliente_id) {
      match = await tentarMatch(cliente_id, dados);
      if (match && wbId) {
        const patch = { processado: true, matched_at: new Date().toISOString(), ...match };
        delete patch.reason;
        patch.match_reason = match.reason;
        patch.match_score = match.score;
        await sb(`/bank_webhooks_recebidos?id=eq.${wbId}`, { method: 'PATCH', body: patch });
      } else if (wbId) {
        // sem match — auto-cria comprovante avulso (operador concilia depois)
        const cId = await criarComprovanteAuto(cliente_id, banco, dados);
        if (cId) await sb(`/bank_webhooks_recebidos?id=eq.${wbId}`, { method: 'PATCH', body: { processado: true, comprovante_id: cId, match_reason: 'sem match — comprovante avulso criado', matched_at: new Date().toISOString() }});
      }
    }
    return res.status(200).json({ ok: true, wb_id: wbId, banco, match });
  } catch (err) {
    console.error('[bank-webhook]', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
