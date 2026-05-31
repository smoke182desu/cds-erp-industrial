// api/busca-global.js — pesquisa em todas tabelas operacionais
import { sb } from './_lib/supabase.js';
async function arr(p){const r=await sb(p);return r.ok?(r.body||[]):[];}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const q = (req.query?.q || '').trim();
    if (!q || q.length < 2) return res.status(200).json({ resultados: [] });
    const enc = encodeURIComponent(`*${q}*`);

    const [empresas, leads, propostas, posts, campanhas, pedidos, faturas, mensagens] = await Promise.all([
      arr(`/trafego_clientes?or=(nome.ilike.${enc},responsavel.ilike.${enc},email_contato.ilike.${enc},cnpj.ilike.${enc})&select=id,nome,slug,cor_destaque,responsavel&limit=10`),
      arr(`/leads?or=(nome.ilike.${enc},telefone.ilike.${enc},email.ilike.${enc},ultima_mensagem.ilike.${enc})&select=id,nome,telefone,etapa,cliente_agencia_id&limit=15`),
      arr(`/propostas_geradas?or=(titulo.ilike.${enc},cliente_nome.ilike.${enc},numero_documento.ilike.${enc})&select=id,titulo,cliente_nome,status,valor_total,cliente_agencia_id&limit=10`),
      arr(`/posts_calendario?or=(titulo.ilike.${enc},texto.ilike.${enc})&select=id,titulo,status,agendado_para,cliente_agencia_id&limit=10`),
      arr(`/campanhas_trafego?nome=ilike.${enc}&select=id,nome,status,objetivo,cliente_agencia_id&limit=10`),
      arr(`/wc_pedidos?or=(cliente_nome.ilike.${enc},cliente_email.ilike.${enc},numero_wc.ilike.${enc})&select=id,wc_order_id,numero_wc,cliente_nome,total,status,cliente_agencia_id&limit=10`),
      arr(`/faturas_agencia?or=(numero_fatura.ilike.${enc},descricao.ilike.${enc})&select=id,competencia,valor_total,status,cliente_agencia_id&limit=10`),
      arr(`/mensagens?texto=ilike.${enc}&select=id,telefone,texto,tipo,criado_em,cliente_agencia_id&limit=10&order=criado_em.desc`),
    ]);

    const resultados = [];
    for (const e of empresas) resultados.push({ tipo: 'empresa', icon: 'Building2', titulo: e.nome, sub: e.responsavel || '', meta: { id: e.id, slug: e.slug, cor: e.cor_destaque }, navega: 'agencia' });
    for (const l of leads) resultados.push({ tipo: 'lead', icon: 'User', titulo: l.nome || `+${l.telefone}`, sub: l.telefone + (l.etapa ? ` · ${l.etapa}` : ''), meta: { id: l.id, cliente: l.cliente_agencia_id }, navega: 'leads' });
    for (const p of propostas) resultados.push({ tipo: 'proposta', icon: 'FileText', titulo: p.titulo, sub: `${p.cliente_nome || '?'} · R$ ${p.valor_total}`, meta: { id: p.id, status: p.status, cliente: p.cliente_agencia_id }, navega: 'templates-proposta' });
    for (const p of posts) resultados.push({ tipo: 'post', icon: 'Calendar', titulo: p.titulo, sub: `${p.status} · ${p.agendado_para ? new Date(p.agendado_para).toLocaleDateString('pt-BR') : 'sem data'}`, meta: { id: p.id, cliente: p.cliente_agencia_id }, navega: 'calendario' });
    for (const c of campanhas) resultados.push({ tipo: 'campanha', icon: 'Target', titulo: c.nome, sub: `${c.objetivo} · ${c.status}`, meta: { id: c.id, cliente: c.cliente_agencia_id }, navega: 'trafego-pago' });
    for (const p of pedidos) resultados.push({ tipo: 'pedido', icon: 'ShoppingBag', titulo: `Pedido #${p.numero_wc}`, sub: `${p.cliente_nome} · R$ ${p.total}`, meta: { id: p.id, cliente: p.cliente_agencia_id }, navega: 'woocommerce' });
    for (const f of faturas) resultados.push({ tipo: 'fatura', icon: 'Receipt', titulo: `Fatura ${f.competencia}`, sub: `R$ ${f.valor_total} · ${f.status}`, meta: { id: f.id, cliente: f.cliente_agencia_id }, navega: 'faturas-agencia' });
    for (const m of mensagens) resultados.push({ tipo: 'mensagem', icon: 'MessageCircle', titulo: m.texto.slice(0, 80), sub: `${m.telefone} · ${new Date(m.criado_em).toLocaleString('pt-BR')}`, meta: { id: m.id, cliente: m.cliente_agencia_id }, navega: 'leads' });

    return res.status(200).json({ resultados, total: resultados.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
