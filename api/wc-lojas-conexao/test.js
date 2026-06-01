// api/wc-lojas-conexao/test.js — Testa credenciais WC sem persistir nada
// POST { url, consumer_key, consumer_secret } -> retorna info da loja se OK
import { sb } from '../_lib/supabase.js';

async function sbBody(p, o) {
  const r = await sb(p, o);
  if (!r.ok) { const e = new Error(`${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { url, consumer_key, consumer_secret, loja_id, salvar } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url obrigatória' });
    if (!consumer_key || !consumer_secret) return res.status(400).json({ error: 'consumer_key e consumer_secret obrigatórios' });

    const baseUrl = url.replace(/\/$/, '');
    const auth = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

    // Testa 1: products (qualquer permissão de leitura WC)
    const t1 = await fetch(`${baseUrl}/wp-json/wc/v3/products?per_page=1`, {
      headers: { Authorization: auth, Accept: 'application/json' }
    });
    if (!t1.ok) {
      const txt = await t1.text();
      return res.status(200).json({
        ok: false,
        erro: `WC HTTP ${t1.status}: ${txt.slice(0, 300)}`,
        dica: t1.status === 401 ? 'Consumer key/secret inválidos' : t1.status === 404 ? 'URL pode não ter WooCommerce ativo, ou REST API desabilitada' : 'verifique permissões'
      });
    }
    const produtos = await t1.json();
    const produtosCount = t1.headers.get('x-wp-total') || produtos?.length || 0;

    // Testa 2: tentar dados gerais via /system_status (precisa write_keys)
    let lojaInfo = null;
    try {
      const t2 = await fetch(`${baseUrl}/wp-json/wc/v3/system_status`, {
        headers: { Authorization: auth, Accept: 'application/json' }
      });
      if (t2.ok) {
        const data = await t2.json();
        lojaInfo = {
          nome_loja: data?.settings?.title || data?.environment?.site_url,
          versao_wc: data?.environment?.version,
          versao_wp: data?.environment?.wp_version,
          moeda: data?.settings?.currency,
          pais: data?.settings?.base_country,
          plugins_ativos: data?.active_plugins?.length || 0
        };
      }
    } catch {/* opcional */}

    // Testa 3: orders pra contar
    let pedidosTotal = null;
    try {
      const t3 = await fetch(`${baseUrl}/wp-json/wc/v3/orders?per_page=1`, {
        headers: { Authorization: auth, Accept: 'application/json' }
      });
      if (t3.ok) pedidosTotal = Number(t3.headers.get('x-wp-total')) || 0;
    } catch {/* opcional */}

    // Salvar?
    if (salvar && loja_id) {
      await sb(`/wc_lojas?id=eq.${loja_id}`, { method: 'PATCH', body: {
        url: baseUrl,
        consumer_key,
        consumer_secret,
        status_conexao: 'testada_ok',
        ultimo_teste_em: new Date().toISOString(),
        ultimo_teste_erro: null
      }});
    }

    return res.status(200).json({
      ok: true,
      produtos_disponiveis: Number(produtosCount) || 0,
      pedidos_total: pedidosTotal,
      loja: lojaInfo,
      mensagem: `Conexão bem-sucedida! ${produtosCount} produtos, ${pedidosTotal ?? '?'} pedidos disponíveis.`
    });
  } catch (err) {
    console.error('[wc-lojas-conexao/test]', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
