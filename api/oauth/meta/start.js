// api/oauth/meta/start.js — inicia OAuth flow do Meta (Facebook + Instagram)
// Gera URL de autorização com state criptografado e redireciona o usuário.
// Sprint 2: a Tuany precisa criar App em developers.facebook.com primeiro.
import crypto from "node:crypto";

const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const APP_URL = process.env.APP_URL || "https://erp.cdsind.com.br";

const SCOPES = [
  "business_management",
  "ads_management",
  "ads_read",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "read_insights",
].join(",");

export default function handler(req, res) {
  if (!META_APP_ID || !META_APP_SECRET) {
    return res.status(503).json({
      error: "Meta OAuth não configurado",
      hint: "Defina META_APP_ID e META_APP_SECRET no .env do VPS. Veja DOC-APP-META.md.",
    });
  }

  const clienteId = req.query.cliente_id;
  if (!clienteId) {
    return res.status(400).json({ error: "cliente_id obrigatório (cliente da agência ao qual conectar a conta)" });
  }

  // State assinado pra prevenir CSRF
  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = JSON.stringify({ cliente_id: clienteId, nonce, ts: Date.now() });
  const sig = crypto.createHmac("sha256", META_APP_SECRET).update(statePayload).digest("hex");
  const state = Buffer.from(statePayload).toString("base64url") + "." + sig;

  const redirectUri = `${APP_URL}/api/oauth/meta/callback`;
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");

  res.redirect(302, url.toString());
}
