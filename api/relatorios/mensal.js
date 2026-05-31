// api/relatorios/mensal.js
import { sb } from '../_lib/supabase.js';
async function arr(p){const r=await sb(p);return r.ok?(r.body||[]):[];}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { cliente_id, mes } = req.query || {};
    if (!cliente_id || !mes) return res.status(400).json({ error: 'cliente_id + mes (YYYY-MM) obrigatorios' });

    const partes = mes.split('-');
    const ano = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10);
    const inicio = ano + '-' + String(m).padStart(2,'0') + '-01';
    const proximoMes = new Date(ano, m, 1);
    const fim = proximoMes.getFullYear() + '-' + String(proximoMes.getMonth()+1).padStart(2,'0') + '-01';

    const [empresaArr, leads, mensagens, campanhas, posts, propostas, conhecimento] = await Promise.all([
      arr('/trafego_clientes?id=eq.' + cliente_id + '&select=*'),
      arr('/leads?cliente_agencia_id=eq.' + cliente_id + '&criado_em=gte.' + inicio + '&criado_em=lt.' + fim + '&select=*'),
      arr('/mensagens?cliente_agencia_id=eq.' + cliente_id + '&criado_em=gte.' + inicio + '&criado_em=lt.' + fim + '&select=tipo,criado_em'),
      arr('/campanhas_trafego?cliente_agencia_id=eq.' + cliente_id + '&select=*'),
      arr('/posts_calendario?cliente_agencia_id=eq.' + cliente_id + '&agendado_para=gte.' + inicio + '&agendado_para=lt.' + fim + '&select=*'),
      arr('/propostas?cliente_agencia_id=eq.' + cliente_id + '&criado_em=gte.' + inicio + '&criado_em=lt.' + fim + '&select=*'),
      arr('/conhecimento_empresa?cliente_agencia_id=eq.' + cliente_id + '&select=*'),
    ]);

    const empresa = empresaArr && empresaArr[0];
    if (!empresa) return res.status(404).json({ error: 'Empresa nao encontrada' });

    const ganhos = leads.filter(l => l.etapa === 'fechado_ganho');
    const valorGanhos = ganhos.reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const conversao = leads.length > 0 ? ((ganhos.length / leads.length) * 100).toFixed(1) : '0.0';
    const msgsRecebidas = mensagens.filter(x => x.tipo === 'entrada').length;
    const msgsEnviadas = mensagens.filter(x => x.tipo === 'saida').length;
    const postsPublicados = posts.filter(p => p.status === 'publicado').length;
    const postsAprovados = posts.filter(p => p.status === 'aprovado_cliente').length;
    const orcamentoCampanhas = campanhas
      .filter(c => c.status === 'publicada')
      .reduce((s, c) => s + ((Number(c.orcamento_diario) || 0) * 30), 0);

    const porEtapa = {};
    for (const l of leads) {
      porEtapa[l.etapa] = (porEtapa[l.etapa] || 0) + 1;
    }

    return res.status(200).json({
      empresa: {
        id: empresa.id, nome: empresa.nome, slug: empresa.slug,
        cor: empresa.cor_destaque, responsavel: empresa.responsavel,
        fee_mensal: empresa.fee_mensal, logo_url: empresa.logo_url,
      },
      periodo: {
        mes, inicio, fim,
        mes_nome: new Date(ano, m-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      },
      resumo: {
        leads_novos: leads.length,
        ganhos: ganhos.length,
        valor_ganhos: valorGanhos,
        taxa_conversao: conversao,
        mensagens_recebidas: msgsRecebidas,
        mensagens_enviadas: msgsEnviadas,
        posts_publicados: postsPublicados,
        posts_aprovados: postsAprovados,
        campanhas_ativas: campanhas.filter(c => c.status === 'publicada').length,
        orcamento_mes_estimado: orcamentoCampanhas,
        propostas_enviadas: propostas.length,
        propostas_aprovadas: propostas.filter(p => p.status === 'aprovada' || p.status === 'aprovado').length,
      },
      por_etapa_funil: porEtapa,
      destaques: {
        ultima_proposta_valor: (propostas[0] && propostas[0].valor_total) || 0,
        ultimo_lead_nome: (leads[0] && leads[0].nome) || null,
        contexto_empresa: (conhecimento && conhecimento[0]) || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
