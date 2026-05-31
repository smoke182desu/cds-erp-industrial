// api/agencia/stats.js
// GET → estatísticas consolidadas de TODAS as empresas atendidas pela agência
import { sb } from '../_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){return [];}return r.body||[];}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const [empresas, leads, campanhas, contas, propostas, mensagens] = await Promise.all([
      sbBody(`/trafego_clientes?status=neq.arquivado&select=*`),
      sbBody(`/leads?select=cliente_agencia_id,etapa,valor,criado_em&limit=10000`),
      sbBody(`/campanhas_trafego?select=cliente_agencia_id,status,orcamento_diario&limit=10000`),
      sbBody(`/trafego_contas?select=cliente_id,status,plataforma&limit=10000`),
      sbBody(`/propostas?select=cliente_agencia_id,status,valor_total&limit=10000`),
      sbBody(`/mensagens?select=cliente_agencia_id,criado_em&limit=20000&order=criado_em.desc`),
    ]);

    // Agrega por empresa
    const porEmpresa = new Map();
    for (const e of empresas || []) {
      porEmpresa.set(e.id, {
        id: e.id,
        nome: e.nome,
        slug: e.slug,
        cor: e.cor_destaque || '#6366f1',
        fee_mensal: Number(e.fee_mensal) || 0,
        status: e.status,
        responsavel: e.responsavel,
        leads: { total: 0, pipeline: 0, ganhos: 0, perdidos: 0, ativos: 0 },
        campanhas: { total: 0, publicadas: 0, gasto_diario: 0 },
        contas_conectadas: 0,
        propostas: { total: 0, pendentes: 0, aprovadas: 0, valor_total: 0 },
        mensagens_7d: 0,
      });
    }

    for (const l of leads || []) {
      const e = porEmpresa.get(l.cliente_agencia_id);
      if (!e) continue;
      e.leads.total++;
      if (l.etapa === 'fechado_ganho') { e.leads.ganhos++; e.leads.pipeline += Number(l.valor) || 0; }
      else if (l.etapa === 'fechado_perdido') e.leads.perdidos++;
      else { e.leads.ativos++; e.leads.pipeline += Number(l.valor) || 0; }
    }

    for (const c of campanhas || []) {
      const e = porEmpresa.get(c.cliente_agencia_id);
      if (!e) continue;
      e.campanhas.total++;
      if (c.status === 'publicada') {
        e.campanhas.publicadas++;
        e.campanhas.gasto_diario += Number(c.orcamento_diario) || 0;
      }
    }

    for (const ct of contas || []) {
      const e = porEmpresa.get(ct.cliente_id);
      if (e && ct.status === 'ativo') e.contas_conectadas++;
    }

    for (const p of propostas || []) {
      const e = porEmpresa.get(p.cliente_agencia_id);
      if (!e) continue;
      e.propostas.total++;
      e.propostas.valor_total += Number(p.valor_total) || 0;
      if (p.status === 'aprovada' || p.status === 'aprovado') e.propostas.aprovadas++;
      else if (!p.status || p.status === 'pendente' || p.status === 'enviada') e.propostas.pendentes++;
    }

    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const m of mensagens || []) {
      if (new Date(m.criado_em) < seteDiasAtras) continue;
      const e = porEmpresa.get(m.cliente_agencia_id);
      if (e) e.mensagens_7d++;
    }

    const arr = [...porEmpresa.values()].sort((a,b) => b.fee_mensal - a.fee_mensal);

    const total = {
      empresas: arr.length,
      mrr: arr.reduce((s,e) => s + e.fee_mensal, 0),
      leads_total: arr.reduce((s,e) => s + e.leads.total, 0),
      leads_ganhos: arr.reduce((s,e) => s + e.leads.ganhos, 0),
      pipeline_total: arr.reduce((s,e) => s + e.leads.pipeline, 0),
      campanhas_total: arr.reduce((s,e) => s + e.campanhas.total, 0),
      campanhas_publicadas: arr.reduce((s,e) => s + e.campanhas.publicadas, 0),
      gasto_diario_total: arr.reduce((s,e) => s + e.campanhas.gasto_diario, 0),
      contas_conectadas_total: arr.reduce((s,e) => s + e.contas_conectadas, 0),
      mensagens_7d_total: arr.reduce((s,e) => s + e.mensagens_7d, 0),
      propostas_valor: arr.reduce((s,e) => s + e.propostas.valor_total, 0),
    };

    return res.status(200).json({ total, empresas: arr });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
