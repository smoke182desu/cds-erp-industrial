// api/oauth/meta/callback.js — recebe code da Meta, troca por long-lived token,
// e grava em trafego_contas.
import crypto from "node:crypto";
import { insert, update, sb } from "../../_lib/supabase.js";

const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const APP_URL = process.env.APP_URL || "https://erp.cdsind.com.br";

export default async function handler(req, res) {
  if (!META_APP_ID || !META_APP_SECRET) {
    return res.status(503).send("Meta OAuth não configurado. Veja DOC-APP-META.md.");
  }

  const { code, state, error: oauthError, error_description } = req.query;
  if (oauthError) {
    return res.status(400).send(`Meta retornou erro: ${oauthError} - ${error_description}`);
  }
  if (!code || !state) {
    return res.status(400).send("code e state obrigatórios");
  }

  // Valida state
  let clienteId;
  try {
    const [b64, sig] = state.split(".");
    const payload = Buffer.from(b64, "base64url").toString("utf8");
    const expected = crypto.createHmac("sha256", META_APP_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new Error("state inválido");
    }
    const parsed = JSON.parse(payload);
    if (Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error("state expirado");
    clienteId = parsed.cliente_id;
  } catch (e) {
    return res.status(400).send("state inválido ou expirado");
  }

  const redirectUri = `${APP_URL}/api/oauth/meta/callback`;

  try {
    // 1) troca code por short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", META_APP_ID);
    tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`troca code falhou: ${JSON.stringify(tokenData)}`);

    // 2) Troca por long-lived (60 dias)
    const longUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", META_APP_ID);
    longUrl.searchParams.set("client_secret", META_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);
    const longRes = await fetch(longUrl);
    const longData = await longRes.json();
    if (!longRes.ok) throw new Error(`exchange long-lived falhou: ${JSON.stringify(longData)}`);

    // 3) Lista ad accounts disponíveis
    const accountsUrl = new URL("https://graph.facebook.com/v21.0/me/adaccounts");
    accountsUrl.searchParams.set("fields", "id,account_id,name,account_status,business");
    accountsUrl.searchParams.set("access_token", longData.access_token);
    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json();

    // 4) Salva conta principal (a primeira) em trafego_contas
    const principalAccount = accountsData.data?.[0];
    if (!principalAccount) {
      throw new Error("Nenhuma ad account encontrada na sua conta Meta");
    }
    const expiresAt = new Date(Date.now() + (longData.expires_in || 60 * 86400) * 1000).toISOString();

    await sb("/trafego_contas?on_conflict=cliente_id,plataforma,account_id", {
      method: "POST",
      body: {
        cliente_id: clienteId,
        plataforma: "meta_ads",
        account_id: principalAccount.id,
        account_name: principalAccount.name,
        access_token: longData.access_token,
        token_type: "Bearer",
        expires_at: expiresAt,
        status: "ativo",
        scopes: [],
        metadata: {
          all_accounts: accountsData.data,
          business: principalAccount.business,
        },
      },
      prefer: "resolution=merge-duplicates,return=representation",
    });

    // 5) Redireciona pra UI com sucesso
    res.redirect(302, `${APP_URL}/?meta_conectado=1&account=${encodeURIComponent(principalAccount.name)}`);
  } catch (err) {
    console.error("[oauth/meta/callback]", err);
    res.status(500).send(`Erro no OAuth Meta: ${err.message}`);
  }
}
