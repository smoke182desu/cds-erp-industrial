// api/wc-sync.js — Puxa pedidos novos do WooCommerce via REST API
// POST { loja_id } ou { cliente_agencia_id }
import { sb } from './_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}`);e.status=r.status;throw e;}return r.body;}

async function buscarPedidosWC(loja, desdeId = 0) {
  const url = `${loja.url.replace(/\/$/, '')}/wp-json/wc/v3/orders?per_page=50&orderby=id&order=asc&after=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`;
  const auth = Buffer.from(`${loja.consumer_key}:${loja.consumer_secret}`).toString('base64');
  const r = await fetch(url, { headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`WC HTTP ${r.status}: ${await r.text()}`);
  const pedidos = await r.json();
  return pedidos.filter(p => p.id > desdeId);
}

function mapearPedido(loja, p) {
  const itens = (p.line_items || []).map(i => ({
    nome: i.name, sku: i.sku, qtd: i.quantity, total: i.total, preco_unit: i.price, produto_id: i.product_id,
  }));
  return {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_order_id: p.id,
    numero_wc: String(p.number || p.id),
    status: p.status,
    total: Number(p.total) || 0,
    subtotal: (p.line_items || []).reduce((s,i) => s + (Number(i.subtotal) || 0), 0),
    shipping_total: Number(p.shipping_total) || 0,
    payment_method: p.payment_method,
    payment_method_title: p.payment_method_title,
    cliente_nome: ((p.billing?.first_name || '') + ' ' + (p.billing?.last_name || '')).trim(),
    cliente_email: p.billing?.email,
    cliente_telefone: p.billing?.phone,
    cliente_documento: p.meta_data?.find(m => m.key === '_billing_cpf' || m.key === '_billing_cnpj')?.value,
    endereco_entrega: p.shipping || {},
    endereco_cobranca: p.billing || {},
    itens,
    notas_cliente: p.customer_note,
    data_pedido: p.date_created,
    data_pago: p.date_paid || null,
    data_completo: p.date_completed || null,
    payload_bruto: p,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { loja_id, cliente_agencia_id } = req.body || {};
    let lojas = [];
    if (loja_id) {
      const arr = await sbBody(`/wc_lojas?id=eq.${loja_id}&select=*`);
      lojas = arr || [];
    } else if (cliente_agencia_id) {
      lojas = await sbBody(`/wc_lojas?cliente_agencia_id=eq.${cliente_agencia_id}&ativo=eq.true&select=*`);
    } else {
      lojas = await sbBody(`/wc_lojas?ativo=eq.true&select=*`);
    }

    const resultado = [];
    for (const loja of lojas) {
      if (!loja.consumer_key || !loja.consumer_secret) {
        resultado.push({ loja: loja.nome, erro: 'Sem credenciais consumer_key/secret' });
        continue;
      }
      try {
        const pedidos = await buscarPedidosWC(loja, loja.ultimo_pedido_id || 0);
        let novos = 0, atualizados = 0;
        let maiorId = loja.ultimo_pedido_id || 0;
        for (const p of pedidos) {
          maiorId = Math.max(maiorId, p.id);
          const mapped = mapearPedido(loja, p);
          // upsert pelo (loja_id, wc_order_id)
          const ex = await sbBody(`/wc_pedidos?loja_id=eq.${loja.id}&wc_order_id=eq.${p.id}&select=id`);
          if (ex?.[0]) {
            await sb(`/wc_pedidos?id=eq.${ex[0].id}`, { method: 'PATCH', body: mapped });
            atualizados++;
          } else {
            await sb('/wc_pedidos', { method: 'POST', body: mapped });
            novos++;
          }
        }
        await sb(`/wc_lojas?id=eq.${loja.id}`, { method: 'PATCH', body: { ultimo_sync: new Date().toISOString(), ultimo_pedido_id: maiorId } });
        resultado.push({ loja: loja.nome, novos, atualizados, total_processados: pedidos.length });
      } catch (e) {
        resultado.push({ loja: loja.nome, erro: e.message });
      }
    }
    return res.status(200).json({ resultado });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
