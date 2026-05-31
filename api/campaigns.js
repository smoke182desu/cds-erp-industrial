// api/campaigns.js — CRUD multi-tenant de campanhas de marketing
// Filtra automaticamente por cliente_id (referencia trafego_clientes)
import { selectAll, insert, update, remove, sb } from "./_lib/supabase.js";

const TABLE = "campaigns";

function normalizar(c) {
  return {
    id: c.id,
    clienteId: c.cliente_id,
    name: c.name,
    channel: c.channel,
    objective: c.objective,
    status: c.status || "draft",
    budgetMonthly: Number(c.budget_monthly) || 0,
    budgetDaily: Number(c.budget_daily) || 0,
    targetAudience: c.target_audience,
    productFocus: c.product_focus,
    strategy: c.strategy || {},
    startDate: c.start_date,
    endDate: c.end_date,
    createdBy: c.created_by,
    criadoEm: c.criado_em,
    atualizadoEm: c.atualizado_em,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Cliente-Id");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // cliente_id pode vir via query ?cliente_id=, header X-Cliente-Id, ou body
    const clienteId = req.query.cliente_id || req.headers["x-cliente-id"] || req.body?.clienteId || req.body?.cliente_id;

    if (req.method === "GET") {
      if (req.query.id) {
        const r = await sb(`/${TABLE}?id=eq.${encodeURIComponent(req.query.id)}&limit=1`);
        if (!r.ok) return res.status(500).json({ error: "erro buscando" });
        const row = Array.isArray(r.body) && r.body[0] ? normalizar(r.body[0]) : null;
        return res.status(200).json(row);
      }
      const filters = {};
      if (clienteId) filters.cliente_id = `eq.${clienteId}`;
      if (req.query.status) filters.status = `eq.${req.query.status}`;
      if (req.query.channel) filters.channel = `eq.${req.query.channel}`;
      const rows = await selectAll(TABLE, {
        orderBy: "criado_em",
        limit: 1000,
        filters,
      });
      return res.status(200).json(rows.map(normalizar));
    }

    if (req.method === "POST") {
      const body = req.body || {};
      if (!clienteId) return res.status(400).json({ error: "cliente_id obrigatorio (query, header X-Cliente-Id ou body)" });
      const payload = {
        cliente_id: clienteId,
        name: body.name || body.nome || "Nova campanha",
        channel: body.channel || "meta_ads",
        objective: body.objective || "awareness",
        status: body.status || "draft",
        budget_monthly: Number(body.budgetMonthly || body.budget_monthly) || 0,
        budget_daily: Number(body.budgetDaily || body.budget_daily) || 0,
        target_audience: body.targetAudience || body.target_audience || "",
        product_focus: body.productFocus || body.product_focus || "",
        strategy: body.strategy || {},
        start_date: body.startDate || body.start_date || null,
        end_date: body.endDate || body.end_date || null,
        created_by: body.createdBy || body.created_by || "sistema",
      };
      const created = await insert(TABLE, payload);
      return res.status(201).json(normalizar(created));
    }

    if (req.method === "PATCH") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id obrigatorio" });
      const body = req.body || {};
      const patch = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.status !== undefined) patch.status = body.status;
      if (body.budgetMonthly !== undefined) patch.budget_monthly = Number(body.budgetMonthly);
      if (body.budgetDaily !== undefined) patch.budget_daily = Number(body.budgetDaily);
      if (body.targetAudience !== undefined) patch.target_audience = body.targetAudience;
      if (body.productFocus !== undefined) patch.product_focus = body.productFocus;
      if (body.strategy !== undefined) patch.strategy = body.strategy;
      if (body.startDate !== undefined) patch.start_date = body.startDate;
      if (body.endDate !== undefined) patch.end_date = body.endDate;
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para atualizar" });
      const updated = await update(TABLE, "id", id, patch);
      return res.status(200).json(normalizar(updated));
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id obrigatorio" });
      await remove(TABLE, "id", id);
      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: "Metodo nao permitido" });
  } catch (err) {
    console.error("[campaigns]", req.method, "erro:", err.message);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
