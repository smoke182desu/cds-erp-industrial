// api/agencia/operacao.js — Tudo que precisa de atenção AGORA
import { sb } from '../_lib/supabase.js';
async function arr(p){const r=await sb(p);return r.ok?(r.body||[]):[];}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const hoje = new Date();
    const hojeIso = hoje.toISOString();
    const ontem = new Date(hoje.getTime() - 24*60*60*1000).toISOString();
    const set_dias = new Date(hoje.getTime() + 7*24*60*60*1000).toISOString().slice(0,10);
    const _30 = new Date(hoje.getTime() + 30*24*60*60*1000).toISOString().slice(0,10);

    const [
      empresas,
      faturasPendentes,
      faturasVencidas,
      faturasPagasMes,
      postsRevisao,
      postsAprovadosNaoPublicados,
      postsPublicarHoje,
      campanhasRevisao,
      mensagensHoje,
      whatsappDesconectados,
      certificadosVencendo,
      leadsNovos24h,
    ] = await Promise.all([
      arr(`/trafego_clientes?status=eq.ativo&select=id,nome,slug,cor_destaque,fee_mensal,responsavel,certificado_a1_validade,emite_nfe`),
      arr(`/faturas_agencia?status=in.(pendente,enviada)&select=*,trafego_clientes(nome,cor_destaque)&order=data_vencimento.asc&limit=30`),
      arr(`/faturas_agencia?status=eq.vencida&select=*,trafego_clientes(nome,cor_destaque)&order=data_vencimento.asc`),
      arr(`/faturas_agencia?status=eq.paga&data_pagamento=gte.${hoje.toISOString().slice(0,7)}-01&select=valor_total`),
      arr(`/posts_calendario?status=eq.revisao&select=*,trafego_clientes(nome,cor_destaque)&order=agendado_para.asc&limit=20`),
      arr(`/posts_calendario?status=eq.aprovado_cliente&select=*,trafego_clientes(nome,cor_destaque)&order=agendado_para.asc&limit=20`),
      arr(`/posts_calendario?status=eq.aprovado_cliente&agendado_para=gte.${hojeIso.slice(0,10)}&agendado_para=lt.${hojeIso.slice(0,10)}T23:59:59&select=*,trafego_clientes(nome,cor_destaque)`),
      arr(`/campanhas_trafego?status=eq.revisao&select=*,trafego_clientes(nome,cor_destaque)&order=criado_em.asc&limit=20`),
      arr(`/mensagens?criado_em=gte.${hoje.toISOString().slice(0,10)}T00:00:00&tipo=eq.entrada&select=cliente_agencia_id,telefone,texto,criado_em&order=criado_em.desc&limit=50`),
      arr(`/whatsapp_instancias?status=in.(desconectado,erro)&select=*,trafego_clientes(nome,cor_destaque)`),
      arr(`/trafego_clientes?certificado_a1_validade=lte.${_30}&certificado_a1_validade=gt.${hoje.toISOString().slice(0,10)}&select=id,nome,slug,certificado_a1_validade`),
      arr(`/leads?criado_em=gte.${ontem}&select=id,nome,telefone,etapa,valor,cliente_agencia_id`),
    ]);

    // Agrupa mensagens novas por empresa
    const msgsPorEmpresa = new Map();
    for (const m of mensagensHoje) {
      const e = msgsPorEmpresa.get(m.cliente_agencia_id);
      if (!e) msgsPorEmpresa.set(m.cliente_agencia_id, { total: 1, ultima: m });
      else { e.total++; }
    }

    const leadsPorEmpresa = new Map();
    for (const l of leadsNovos24h) {
      const e = leadsPorEmpresa.get(l.cliente_agencia_id);
      if (!e) leadsPorEmpresa.set(l.cliente_agencia_id, { total: 1, valor: Number(l.valor) || 0 });
      else { e.total++; e.valor += Number(l.valor) || 0; }
    }

    // KPIs por empresa pra alertas
    const alertasEmpresas = [];
    for (const e of empresas) {
      const msgsNovas = msgsPorEmpresa.get(e.id)?.total || 0;
      const leadsHoje = leadsPorEmpresa.get(e.id)?.total || 0;
      const wppDesc = whatsappDesconectados.some(w => w.cliente_agencia_id === e.id);
      if (msgsNovas > 0 || leadsHoje > 0 || wppDesc) {
        alertasEmpresas.push({
          ...e,
          mensagens_hoje: msgsNovas,
          leads_24h: leadsHoje,
          wpp_desconectado: wppDesc,
        });
      }
    }

    const recebidoMes = faturasPagasMes.reduce((s,f) => s + Number(f.valor_total), 0);
    const aReceber = faturasPendentes.reduce((s,f) => s + Number(f.valor_total), 0);
    const vencido = faturasVencidas.reduce((s,f) => s + Number(f.valor_total), 0);

    return res.status(200).json({
      resumo: {
        faturas_a_enviar: faturasPendentes.filter(f => f.status === 'pendente').length,
        faturas_pendentes_pagamento: faturasPendentes.filter(f => f.status === 'enviada').length,
        faturas_vencidas: faturasVencidas.length,
        posts_aguardando_revisao_agencia: postsRevisao.length,
        posts_aprovados_aguardando_publicacao: postsAprovadosNaoPublicados.length,
        posts_publicar_hoje: postsPublicarHoje.length,
        campanhas_aguardando_revisao: campanhasRevisao.length,
        mensagens_hoje: mensagensHoje.length,
        leads_novos_24h: leadsNovos24h.length,
        whatsapp_desconectados: whatsappDesconectados.length,
        certificados_vencendo: certificadosVencendo.length,
        recebido_mes: recebidoMes,
        a_receber: aReceber,
        vencido: vencido,
      },
      pendencias: {
        faturas_pendentes: faturasPendentes.slice(0, 10),
        faturas_vencidas: faturasVencidas.slice(0, 10),
        posts_revisao: postsRevisao.slice(0, 10),
        posts_publicar_hoje: postsPublicarHoje,
        campanhas_revisao: campanhasRevisao.slice(0, 10),
        whatsapp_desconectados: whatsappDesconectados.slice(0, 10),
        certificados_vencendo: certificadosVencendo,
      },
      alertas_empresas: alertasEmpresas,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
