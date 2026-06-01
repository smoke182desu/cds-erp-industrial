// api/wc-sync.js — Sincronização WooCommerce / WordPress
// POST { loja_id?, cliente_agencia_id?, entity? }
//   entity: 'pedidos' (default), 'clientes', 'produtos', 'cupons', 'tudo'
import { sb } from './_lib/supabase.js';

async function sbBody(p, o) {
  const r = await sb(p, o);
  if (!r.ok) { const e = new Error(`${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

// ---------- HTTP helpers ----------
function wcAuth(loja) {
  return 'Basic ' + Buffer.from(`${loja.consumer_key}:${loja.consumer_secret}`).toString('base64');
}
function wpAuth(loja) {
  if (!loja.wp_user || !loja.wp_app_password) return null;
  return 'Basic ' + Buffer.from(`${loja.wp_user}:${loja.wp_app_password}`).toString('base64');
}
async function fetchJson(url, auth) {
  const r = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url.replace(/consumer_key=[^&]+/, 'consumer_key=***')}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}
async function fetchAllPages(baseUrl, auth, perPage = 50, maxPages = 20) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}per_page=${perPage}&page=${page}`;
    const arr = await fetchJson(url, auth);
    if (!Array.isArray(arr) || arr.length === 0) break;
    all.push(...arr);
    if (arr.length < perPage) break;
  }
  return all;
}

// ---------- MAP / SYNC pedidos ----------
function mapPedido(loja, p) {
  const itens = (p.line_items || []).map(i => ({
    nome: i.name, sku: i.sku, qtd: i.quantity, total: i.total, preco_unit: i.price, produto_id: i.product_id,
  }));
  return {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_order_id: p.id,
    wc_customer_id: p.customer_id || null,
    numero_wc: String(p.number || p.id),
    status: p.status,
    total: Number(p.total) || 0,
    subtotal: (p.line_items || []).reduce((s, i) => s + (Number(i.subtotal) || 0), 0),
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

async function syncPedidos(loja) {
  if (!loja.consumer_key) return { entity: 'pedidos', erro: 'sem consumer_key' };
  const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const url = `${loja.url.replace(/\/$/, '')}/wp-json/wc/v3/orders?orderby=id&order=asc&after=${desde}`;
  const pedidos = await fetchAllPages(url, wcAuth(loja), 50, 10);
  let novos = 0, atualizados = 0, propostasCriadas = 0, comprovantesCriados = 0;
  let maiorId = loja.ultimo_pedido_id || 0;

  for (const p of pedidos) {
    maiorId = Math.max(maiorId, p.id);
    const mapped = mapPedido(loja, p);
    const ex = await sbBody(`/wc_pedidos?loja_id=eq.${loja.id}&wc_order_id=eq.${p.id}&select=id,proposta_gerada_id,comprovante_auto_id`);
    let pedidoRowId;
    if (ex?.[0]) {
      pedidoRowId = ex[0].id;
      await sb(`/wc_pedidos?id=eq.${pedidoRowId}`, { method: 'PATCH', body: mapped });
      atualizados++;
    } else {
      const ins = await sb('/wc_pedidos', { method: 'POST', body: mapped, headers: { Prefer: 'return=representation' } });
      pedidoRowId = ins.body?.[0]?.id;
      novos++;
    }

    const ehPago = p.date_paid || ['processing', 'completed'].includes(p.status);
    if (pedidoRowId && ehPago && loja.auto_criar_proposta !== false) {
      try {
        const rProp = await sb('/rpc/wc_pedido_para_proposta', { method: 'POST', body: { p_pedido_id: pedidoRowId }, headers: { Accept: 'application/vnd.pgrst.object+json' } });
        if (rProp.ok && !ex?.[0]?.proposta_gerada_id) propostasCriadas++;
      } catch { /* silently continue */ }
      try {
        const rCompr = await sb('/rpc/wc_pedido_para_comprovante', { method: 'POST', body: { p_pedido_id: pedidoRowId } });
        if (rCompr.ok && !ex?.[0]?.comprovante_auto_id) comprovantesCriados++;
      } catch { /* silently */ }
    }
  }

  await sb(`/wc_lojas?id=eq.${loja.id}`, { method: 'PATCH', body: {
    ultimo_sync: new Date().toISOString(),
    ultimo_pedido_id: maiorId
  }});
  return { entity: 'pedidos', total: pedidos.length, novos, atualizados, propostas_criadas: propostasCriadas, comprovantes_criados: comprovantesCriados };
}

// ---------- SYNC clientes (WC) ----------
function mapWcCliente(loja, c) {
  return {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_customer_id: c.id,
    email: c.email,
    username: c.username,
    nome: ((c.first_name || '') + ' ' + (c.last_name || '')).trim(),
    primeiro_nome: c.first_name,
    sobrenome: c.last_name,
    telefone: c.billing?.phone,
    data_cadastro: c.date_created || null,
    total_pedidos: c.orders_count || 0,
    total_gasto: Number(c.total_spent) || 0,
    endereco_cobranca: c.billing || {},
    endereco_entrega: c.shipping || {},
    metadata: { source: 'wc-sync' },
  };
}

async function syncClientesWC(loja) {
  if (!loja.consumer_key) return { entity: 'clientes', erro: 'sem consumer_key' };
  const url = `${loja.url.replace(/\/$/, '')}/wp-json/wc/v3/customers?orderby=id&order=asc`;
  const clientes = await fetchAllPages(url, wcAuth(loja), 100, 10);
  let novos = 0, atualizados = 0, leadsVinculados = 0;
  for (const c of clientes) {
    const mapped = mapWcCliente(loja, c);
    const ex = await sbBody(`/wc_clientes?loja_id=eq.${loja.id}&wc_customer_id=eq.${c.id}&select=id,lead_id`);
    let rowId;
    if (ex?.[0]) {
      rowId = ex[0].id;
      await sb(`/wc_clientes?id=eq.${rowId}`, { method: 'PATCH', body: mapped });
      atualizados++;
    } else {
      const ins = await sb('/wc_clientes', { method: 'POST', body: mapped, headers: { Prefer: 'return=representation' } });
      rowId = ins.body?.[0]?.id;
      novos++;
    }
    // Auto-cria lead se config + email/telefone presentes
    if (rowId && loja.auto_criar_lead !== false && !ex?.[0]?.lead_id && (c.email || c.billing?.phone)) {
      try {
        const phone = (c.billing?.phone || '').replace(/\D/g, '');
        // checa duplicata por telefone/email no cliente_agencia
        const dupArr = await sbBody(`/leads?cliente_agencia_id=eq.${loja.cliente_agencia_id}&or=(telefone.eq.${phone},email.eq.${encodeURIComponent(c.email || '')})&select=id&limit=1`);
        let leadId = dupArr?.[0]?.id;
        if (!leadId) {
          const leadIns = await sb('/leads', { method: 'POST', headers: { Prefer: 'return=representation' }, body: {
            cliente_agencia_id: loja.cliente_agencia_id,
            nome: mapped.nome || c.username || c.email,
            telefone: phone || null,
            email: c.email,
            etapa: 'lead_novo',
            origem: 'WooCommerce',
            metadata: { wc_customer_id: c.id, loja_id: loja.id }
          }});
          leadId = leadIns.body?.[0]?.id;
        }
        if (leadId) {
          await sb(`/wc_clientes?id=eq.${rowId}`, { method: 'PATCH', body: { lead_id: leadId }});
          leadsVinculados++;
        }
      } catch (e) { /* silently */ }
    }
  }
  await sb(`/wc_lojas?id=eq.${loja.id}`, { method: 'PATCH', body: { ultima_sync_clientes: new Date().toISOString() }});
  return { entity: 'clientes', total: clientes.length, novos, atualizados, leads_vinculados: leadsVinculados };
}

// ---------- SYNC produtos (estoque) ----------
function mapProduto(loja, p) {
  return {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_product_id: p.id,
    nome: p.name,
    sku: p.sku,
    status: p.status,
    tipo: p.type,
    preco: Number(p.price) || 0,
    preco_promo: p.sale_price ? Number(p.sale_price) : null,
    estoque: p.stock_quantity,
    gerencia_estoque: !!p.manage_stock,
    status_estoque: p.stock_status,
    categorias: p.categories || [],
    imagem_url: p.images?.[0]?.src || null,
    permalink: p.permalink,
    total_vendas: p.total_sales || 0,
    data_criacao: p.date_created || null,
    data_modificacao: p.date_modified || null,
    payload_bruto: p,
  };
}
async function syncProdutos(loja) {
  if (!loja.consumer_key) return { entity: 'produtos', erro: 'sem consumer_key' };
  const url = `${loja.url.replace(/\/$/, '')}/wp-json/wc/v3/products?orderby=id&order=asc`;
  const prods = await fetchAllPages(url, wcAuth(loja), 100, 20);
  let novos = 0, atualizados = 0, alertasBaixoEstoque = 0;
  const minimo = loja.estoque_minimo_alerta ?? 5;
  for (const p of prods) {
    const mapped = mapProduto(loja, p);
    const ex = await sbBody(`/wc_produtos?loja_id=eq.${loja.id}&wc_product_id=eq.${p.id}&select=id`);
    if (ex?.[0]) {
      await sb(`/wc_produtos?id=eq.${ex[0].id}`, { method: 'PATCH', body: mapped });
      atualizados++;
    } else {
      await sb('/wc_produtos', { method: 'POST', body: mapped });
      novos++;
    }
    if (mapped.gerencia_estoque && typeof mapped.estoque === 'number' && mapped.estoque <= minimo) alertasBaixoEstoque++;
  }
  await sb(`/wc_lojas?id=eq.${loja.id}`, { method: 'PATCH', body: { ultima_sync_produtos: new Date().toISOString() }});
  return { entity: 'produtos', total: prods.length, novos, atualizados, baixo_estoque: alertasBaixoEstoque };
}

// ---------- SYNC cupons ----------
function mapCupom(loja, c) {
  return {
    cliente_agencia_id: loja.cliente_agencia_id,
    loja_id: loja.id,
    wc_coupon_id: c.id,
    codigo: c.code,
    descricao: c.description,
    tipo_desconto: c.discount_type,
    valor: Number(c.amount) || 0,
    data_validade: c.date_expires ? c.date_expires.substring(0, 10) : null,
    total_usos: c.usage_count || 0,
    limite_usos: c.usage_limit,
    ativo: c.status !== 'draft',
    payload_bruto: c,
  };
}
async function syncCupons(loja) {
  if (!loja.consumer_key) return { entity: 'cupons', erro: 'sem consumer_key' };
  const url = `${loja.url.replace(/\/$/, '')}/wp-json/wc/v3/coupons?orderby=id&order=asc`;
  const cups = await fetchAllPages(url, wcAuth(loja), 100, 5);
  let novos = 0, atualizados = 0;
  for (const c of cups) {
    const mapped = mapCupom(loja, c);
    const ex = await sbBody(`/wc_cupons?loja_id=eq.${loja.id}&wc_coupon_id=eq.${c.id}&select=id`);
    if (ex?.[0]) {
      await sb(`/wc_cupons?id=eq.${ex[0].id}`, { method: 'PATCH', body: mapped });
      atualizados++;
    } else {
      await sb('/wc_cupons', { method: 'POST', body: mapped });
      novos++;
    }
  }
  await sb(`/wc_lojas?id=eq.${loja.id}`, { method: 'PATCH', body: { ultima_sync_cupons: new Date().toISOString() }});
  return { entity: 'cupons', total: cups.length, novos, atualizados };
}

// ---------- SYNC usuarios WordPress (via wp-json/wp/v2/users) ----------
async function syncUsuariosWP(loja) {
  const auth = wpAuth(loja);
  if (!auth) return { entity: 'wp_users', erro: 'sem wp_user/wp_app_password — gere Application Password no WP-Admin → Perfil' };
  const url = `${loja.url.replace(/\/$/, '')}/wp-json/wp/v2/users?context=edit&orderby=id&order=asc`;
  const users = await fetchAllPages(url, auth, 100, 20);
  let novos = 0, atualizados = 0, leadsVinculados = 0;
  for (const u of users) {
    const mapped = {
      cliente_agencia_id: loja.cliente_agencia_id,
      loja_id: loja.id,
      wp_user_id: u.id,
      email: u.email,
      username: u.slug || u.username,
      nome: u.name,
      data_cadastro: u.registered_date || null,
      metadata: { roles: u.roles || [], source: 'wp-users' },
    };
    const ex = await sbBody(`/wc_clientes?loja_id=eq.${loja.id}&wp_user_id=eq.${u.id}&select=id,lead_id`);
    let rowId;
    if (ex?.[0]) {
      rowId = ex[0].id;
      await sb(`/wc_clientes?id=eq.${rowId}`, { method: 'PATCH', body: mapped });
      atualizados++;
    } else {
      const ins = await sb('/wc_clientes', { method: 'POST', body: mapped, headers: { Prefer: 'return=representation' } });
      rowId = ins.body?.[0]?.id;
      novos++;
    }
    if (rowId && loja.auto_criar_lead !== false && !ex?.[0]?.lead_id && u.email) {
      try {
        const dupArr = await sbBody(`/leads?cliente_agencia_id=eq.${loja.cliente_agencia_id}&email=eq.${encodeURIComponent(u.email)}&select=id&limit=1`);
        let leadId = dupArr?.[0]?.id;
        if (!leadId) {
          const leadIns = await sb('/leads', { method: 'POST', headers: { Prefer: 'return=representation' }, body: {
            cliente_agencia_id: loja.cliente_agencia_id,
            nome: u.name || u.email,
            email: u.email,
            etapa: 'lead_novo',
            origem: 'WordPress',
            metadata: { wp_user_id: u.id, loja_id: loja.id }
          }});
          leadId = leadIns.body?.[0]?.id;
        }
        if (leadId) {
          await sb(`/wc_clientes?id=eq.${rowId}`, { method: 'PATCH', body: { lead_id: leadId }});
          leadsVinculados++;
        }
      } catch { /* silently */ }
    }
  }
  return { entity: 'wp_users', total: users.length, novos, atualizados, leads_vinculados: leadsVinculados };
}

// ---------- HANDLER ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { loja_id, cliente_agencia_id, entity = 'pedidos' } = req.body || {};
    let lojas = [];
    if (loja_id) lojas = await sbBody(`/wc_lojas?id=eq.${loja_id}&select=*`);
    else if (cliente_agencia_id) lojas = await sbBody(`/wc_lojas?cliente_agencia_id=eq.${cliente_agencia_id}&ativo=eq.true&select=*`);
    else lojas = await sbBody(`/wc_lojas?ativo=eq.true&select=*`);

    const resultado = [];
    for (const loja of lojas) {
      try {
        if (entity === 'tudo') {
          resultado.push({ loja: loja.nome, ...(await syncPedidos(loja)) });
          if (loja.sync_clientes_wp !== false) resultado.push({ loja: loja.nome, ...(await syncClientesWC(loja)) });
          if (loja.sync_produtos_estoque !== false) resultado.push({ loja: loja.nome, ...(await syncProdutos(loja)) });
          if (loja.sync_cupons !== false) resultado.push({ loja: loja.nome, ...(await syncCupons(loja)) });
          if (wpAuth(loja)) resultado.push({ loja: loja.nome, ...(await syncUsuariosWP(loja)) });
        } else if (entity === 'pedidos') resultado.push({ loja: loja.nome, ...(await syncPedidos(loja)) });
        else if (entity === 'clientes') resultado.push({ loja: loja.nome, ...(await syncClientesWC(loja)) });
        else if (entity === 'produtos' || entity === 'estoque') resultado.push({ loja: loja.nome, ...(await syncProdutos(loja)) });
        else if (entity === 'cupons') resultado.push({ loja: loja.nome, ...(await syncCupons(loja)) });
        else if (entity === 'wp_users') resultado.push({ loja: loja.nome, ...(await syncUsuariosWP(loja)) });
        else resultado.push({ loja: loja.nome, erro: 'entity inválido' });
      } catch (e) {
        resultado.push({ loja: loja.nome, entity, erro: e.message });
      }
    }
    return res.status(200).json({ entity, resultado });
  } catch (err) {
    console.error('[wc-sync]', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
