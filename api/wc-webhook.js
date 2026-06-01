// api/wc-webhook.js — Receptor real-time de webhooks WooCommerce
// POST /api/wc-webhook?loja_id=UUID  (URL configurada no WC Admin → Settings → Advanced → Webhooks)
// Headers WC: x-wc-webhook-topic, x-wc-webhook-resource, x-wc-webhook-event, x-wc-webhook-signature
import crypto from 'crypto';
import { sb } from './_lib/supabase.js';

async function sbBody(p, o) {
  const r = await sb(p, o);
  if (!r.ok) { const e = new Error(`${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'string') return resolve(req.body);
    if (req.body && typeof req.body === 'object') return resolve(JSON.stringify(req.body));
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifySignature(body, secret, sigHeader) {
  if (!secret || !sigHeader) return null; // sem segredo, retorna null (não invalida, só não verifica)
  const hmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  return hmac === sigHeader;
}

// Idempotente — chama as funções SQL pra criar proposta + comprovante
async function processarPedidoPago(pedidoRowId) {
  try {
    // Chama RPC postgrest (function); aceitamos erros silenciosos pra não derrubar webhook
    await sb('/rpc/wc_pedido_para_proposta', { method: 'POST', body: { p_pedido_id: pedidoRowId } });
    await sb('/rpc/wc_pedido_para_comprovante', { method: 'POST', body: { p_pedido_id: pedidoRowId } });
  } catch (e) {
    console.error('[wc-webhook] processarPedidoPago erro:', e.message);
  }
}

async function tratarOrder(loja, payload) {
  const wc_order_id = payload?.id;
  if (!wc_order_id) return { skipped: true, motivo: 'sem id' };

  const itens = (payload.line_items || []).map(i => ({
    nome: i.name, sku: i.sku, qtd: i.quantity, total: i.total, preco_unit: i.price, produto_id: i.product_id,
  }));
  const mapped = {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_order_id,
    wc_customer_id: payload.customer_id || null,
    numero_wc: String(payload.number || wc_order_id),
    status: payload.status,
    total: Number(payload.total) || 0,
    subtotal: (payload.line_items || []).reduce((s, i) => s + (Number(i.subtotal) || 0), 0),
    shipping_total: Number(payload.shipping_total) || 0,
    payment_method: payload.payment_method,
    payment_method_title: payload.payment_method_title,
    cliente_nome: ((payload.billing?.first_name || '') + ' ' + (payload.billing?.last_name || '')).trim(),
    cliente_email: payload.billing?.email,
    cliente_telefone: payload.billing?.phone,
    cliente_documento: payload.meta_data?.find(m => m.key === '_billing_cpf' || m.key === '_billing_cnpj')?.value,
    endereco_entrega: payload.shipping || {},
    endereco_cobranca: payload.billing || {},
    itens,
    notas_cliente: payload.customer_note,
    data_pedido: payload.date_created || null,
    data_pago: payload.date_paid || null,
    data_completo: payload.date_completed || null,
    payload_bruto: payload,
  };

  // upsert
  const ex = await sbBody(`/wc_pedidos?loja_id=eq.${loja.id}&wc_order_id=eq.${wc_order_id}&select=id`);
  let pedidoRowId;
  if (ex?.[0]) {
    pedidoRowId = ex[0].id;
    await sb(`/wc_pedidos?id=eq.${pedidoRowId}`, { method: 'PATCH', body: mapped });
  } else {
    const ins = await sb('/wc_pedidos', { method: 'POST', body: mapped, headers: { Prefer: 'return=representation' } });
    pedidoRowId = ins.body?.[0]?.id;
  }

  // se está pago/processing/completed E auto_criar_proposta → gera proposta + comprovante
  const ehPago = payload.date_paid || ['processing', 'completed'].includes(payload.status);
  if (pedidoRowId && ehPago && loja.auto_criar_proposta) {
    await processarPedidoPago(pedidoRowId);
  }
  return { pedidoRowId, ehPago };
}

async function tratarCustomer(loja, payload) {
  if (!loja.sync_clientes_wp) return { skipped: true };
  const mapped = {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_customer_id: payload.id,
    email: payload.email,
    username: payload.username,
    nome: ((payload.first_name || '') + ' ' + (payload.last_name || '')).trim(),
    primeiro_nome: payload.first_name,
    sobrenome: payload.last_name,
    telefone: payload.billing?.phone,
    data_cadastro: payload.date_created || null,
    total_pedidos: payload.orders_count || 0,
    total_gasto: Number(payload.total_spent) || 0,
    endereco_cobranca: payload.billing || {},
    endereco_entrega: payload.shipping || {},
    metadata: { source: 'wc-webhook' },
  };
  const ex = await sbBody(`/wc_clientes?loja_id=eq.${loja.id}&wc_customer_id=eq.${payload.id}&select=id`);
  if (ex?.[0]) {
    await sb(`/wc_clientes?id=eq.${ex[0].id}`, { method: 'PATCH', body: mapped });
    return { atualizado: ex[0].id };
  }
  const ins = await sb('/wc_clientes', { method: 'POST', body: mapped, headers: { Prefer: 'return=representation' } });
  return { criado: ins.body?.[0]?.id };
}

async function tratarProduct(loja, payload) {
  if (!loja.sync_produtos_estoque) return { skipped: true };
  const mapped = {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_product_id: payload.id,
    nome: payload.name,
    sku: payload.sku,
    status: payload.status,
    tipo: payload.type,
    preco: Number(payload.price) || 0,
    preco_promo: payload.sale_price ? Number(payload.sale_price) : null,
    estoque: payload.stock_quantity,
    gerencia_estoque: !!payload.manage_stock,
    status_estoque: payload.stock_status,
    categorias: payload.categories || [],
    imagem_url: payload.images?.[0]?.src || null,
    permalink: payload.permalink,
    total_vendas: payload.total_sales || 0,
    data_criacao: payload.date_created || null,
    data_modificacao: payload.date_modified || null,
    payload_bruto: payload,
  };
  const ex = await sbBody(`/wc_produtos?loja_id=eq.${loja.id}&wc_product_id=eq.${payload.id}&select=id`);
  if (ex?.[0]) {
    await sb(`/wc_produtos?id=eq.${ex[0].id}`, { method: 'PATCH', body: mapped });
    return { atualizado: ex[0].id };
  }
  await sb('/wc_produtos', { method: 'POST', body: mapped });
  return { criado: true };
}

async function tratarCoupon(loja, payload) {
  if (!loja.sync_cupons) return { skipped: true };
  const mapped = {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_coupon_id: payload.id,
    codigo: payload.code,
    descricao: payload.description,
    tipo_desconto: payload.discount_type,
    valor: Number(payload.amount) || 0,
    data_validade: payload.date_expires ? payload.date_expires.substring(0, 10) : null,
    total_usos: payload.usage_count || 0,
    limite_usos: payload.usage_limit,
    ativo: payload.status !== 'draft',
    payload_bruto: payload,
  };
  const ex = await sbBody(`/wc_cupons?loja_id=eq.${loja.id}&wc_coupon_id=eq.${payload.id}&select=id`);
  if (ex?.[0]) {
    await sb(`/wc_cupons?id=eq.${ex[0].id}`, { method: 'PATCH', body: mapped });
    return { atualizado: ex[0].id };
  }
  await sb('/wc_cupons', { method: 'POST', body: mapped });
  return { criado: true };
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, msg: 'WC webhook endpoint — POST com payload do WooCommerce' });
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { loja_id } = req.query || {};
    if (!loja_id) return res.status(400).json({ error: 'loja_id query param obrigatório' });

    const lojaArr = await sbBody(`/wc_lojas?id=eq.${loja_id}&select=*`);
    const loja = lojaArr?.[0];
    if (!loja) return res.status(404).json({ error: 'loja não encontrada' });
    if (!loja.ativo) return res.status(403).json({ error: 'loja inativa' });

    const rawBody = await readRawBody(req);
    const topic = req.headers['x-wc-webhook-topic'] || '';
    const resource = req.headers['x-wc-webhook-resource'] || topic.split('.')[0];
    const event = req.headers['x-wc-webhook-event'] || topic.split('.')[1];
    const signature = req.headers['x-wc-webhook-signature'] || '';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;

    const sigValid = verifySignature(rawBody, loja.webhook_secret, signature);
    // se loja tem webhook_secret, exige assinatura válida
    if (loja.webhook_secret && sigValid === false) {
      await sb('/wc_webhook_eventos', { method: 'POST', body: {
        loja_id: loja.id, topic, resource, event, payload: { raw: rawBody.slice(0, 500) },
        signature, signature_valid: false, ip_origem: ip, erro: 'assinatura inválida'
      }});
      return res.status(401).json({ error: 'assinatura inválida' });
    }

    let payload;
    try { payload = JSON.parse(rawBody); } catch { payload = { raw: rawBody }; }

    // Log do evento
    const evIns = await sb('/wc_webhook_eventos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: {
      loja_id: loja.id, topic, resource, event,
      wc_resource_id: payload?.id || null,
      payload, signature, signature_valid: sigValid,
      ip_origem: ip,
    }});
    const evId = evIns.body?.[0]?.id;

    // Dispatch por resource
    let resultado;
    try {
      if (resource === 'order') resultado = await tratarOrder(loja, payload);
      else if (resource === 'customer') resultado = await tratarCustomer(loja, payload);
      else if (resource === 'product') resultado = await tratarProduct(loja, payload);
      else if (resource === 'coupon') resultado = await tratarCoupon(loja, payload);
      else resultado = { skipped: true, motivo: 'resource não suportado: ' + resource };

      if (evId) await sb(`/wc_webhook_eventos?id=eq.${evId}`, { method: 'PATCH', body: { processed: true, processed_at: new Date().toISOString() }});
    } catch (e) {
      if (evId) await sb(`/wc_webhook_eventos?id=eq.${evId}`, { method: 'PATCH', body: { erro: e.message }});
      throw e;
    }

    return res.status(200).json({ ok: true, topic, resource, event, ...resultado });
  } catch (err) {
    console.error('[wc-webhook]', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
