// api/trafego/contas.js — CRUD de contas conectadas (Meta, Google, TikTok, etc.)
// Cada conta pertence a um cliente da agência (trafego_clientes).
// Por enquanto suporta cadastro manual (cole token); OAuth flow vem no Sprint 2.
import { selectAll, insert, update, remove, sb } from "../_lib/supabase.js";

const TABLE = "trafego_contas";
const PLATAFORMAS_VALIDAS = ['meta_ads','google_ads','tiktok_ads','linkedin_ads','pinterest_ads','snapchat_ads'];

function normalizar(c) {
  return {
    id: c.id,
    clienteId: c.cliente_id,
    plataforma: c.plataforma,
    accountId: c.account_id,
    accountName: c.account_name,
    // NÃO retornar tokens em listings (só ao buscar individual com ?include_tokens=1)
    status: c.status || 'ativo',
    expiresAt: c.expires_at,
    syncUltimoEm: c.sync_ultimo_em,
    erroUltimo: c.erro_ultimo,
    scopes: c.scopes || [],
    metadata: c.metadata || {},
    criadoEm: c.criado_em,
    atualizadoEm: c.atualizado_em,
  };
}

function normalizarCompleto(c) {
  return {
    ...normalizar(c),
    accessToken: c.access_token,
    refreshToken: c.refresh_token,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Cliente-Id");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const clienteId = req.query.cliente_id || req.headers["x-cliente-id"] || req.body?.clienteId || req.body?.cliente_id;

    if (req.method === "GET") {
      if (req.query.id) {
        const r = await sb(`/${TABLE}?id=eq.${encodeURIComponent(req.query.id)}&limit=1`);
        if (!r.ok) return res.status(500).json({ error: "erro buscando" });
        const row = Array.isArray(r.body) && r.body[0] ? r.body[0] : null;
        if (!row) return res.status(404).json({ error: "nao encontrado" });
        const includeTokens = req.query.include_tokens === '1';
        return res.status(200).json(includeTokens ? normalizarCompleto(row) : normalizar(row));
      }
      const filters = {};
      if (clienteId) filters.cliente_id = `eq.${clienteId}`;
      if (req.query.plataforma) filters.plataforma = `eq.${req.query.plataforma}`;
      if (req.query.status) filters.status = `eq.${req.query.status}`;
      const rows = await selectAll(TABLE, { orderBy: "criado_em", limit: 500, filters });
      return res.status(200).json(rows.map(normalizar));
    }

    if (req.method === "POST") {
      const body = req.body || {};
      if (!clienteId) return res.status(400).json({ error: "cliente_id obrigatorio" });
      if (!body.plataforma || !PLATAFORMAS_VALIDAS.includes(body.plataforma)) {
        return res.status(400).json({ error: `plataforma invalida. Use: ${PLATAFORMAS_VALIDAS.join(", ")}` });
      }
      if (!body.account_id && !body.accountId) {
        return res.status(400).json({ error: "account_id obrigatorio" });
      }
      const payload = {
        cliente_id: clienteId,
        plataforma: body.plataforma,
        account_id: body.accountId || body.account_id,
        account_name: body.accountName || body.account_name || null,
        access_token: body.accessToken || body.access_token || null,
        refresh_token: body.refreshToken || body.refresh_token || null,
        token_type: body.tokenType || body.token_type || 'Bearer',
        scopes: body.scopes || null,
        expires_at: body.expiresAt || body.expires_at || null,
        status: body.status || 'ativo',
        metadata: body.metadata || {},
      };
      try {
        const created = await insert(TABLE, payload);
        return res.status(201).json(normalizar(created));
      } catch (err) {
        if (/uq_trafego_contas_unica|23505/.test(err.message)) {
          return res.status(409).json({ error: "Esta conta ja esta conectada para este cliente. Use PATCH pra atualizar o token." });
        }
        throw err;
      }
    }

    if (req.method === "PATCH") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id obrigatorio" });
      const body = req.body || {};
      const patch = {};
      if (body.accountName !== undefined) patch.account_name = body.accountName;
      if (body.accessToken !== undefined) patch.access_token = body.accessToken;
      if (body.refreshToken !== undefined) patch.refresh_token = body.refreshToken;
      if (body.expiresAt !== undefined) patch.expires_at = body.expiresAt;
      if (body.status !== undefined) patch.status = body.status;
      if (body.metadata !== undefined) patch.metadata = body.metadata;
      if (body.erroUltimo !== undefined) patch.erro_ultimo = body.erroUltimo;
      if (body.syncUltimoEm !== undefined) patch.sync_ultimo_em = body.syncUltimoEm;
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
    console.error("[trafego/contas]", req.method, "erro:", err.message);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
