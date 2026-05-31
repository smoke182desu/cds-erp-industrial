// api/webhooks/github.js — auto-deploy quando GitHub push pro main
// Valida assinatura HMAC SHA-256 e executa: git pull + npm build + pm2 restart
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const DEPLOY_PATH = "/var/www/cds-erp";

function verifySignature(body, signature) {
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

// Captura raw body antes do JSON parse pra fazer HMAC
function getRawBody(req) {
  if (req.rawBody) return req.rawBody;
  return Buffer.from(JSON.stringify(req.body || {}));
}

function deploy() {
  const result = { steps: [] };
  try {
    const out1 = execSync("git pull origin main", { cwd: DEPLOY_PATH, encoding: "utf8", timeout: 60000 });
    result.steps.push({ step: "git pull", output: out1.slice(-500) });

    // Detecta se mudou package.json ou src/
    const status = execSync("git diff HEAD~1 HEAD --stat", { cwd: DEPLOY_PATH, encoding: "utf8" });
    result.steps.push({ step: "diff", output: status.slice(-300) });
    const needsInstall = /package(-lock)?\.json/.test(status);
    const needsBuild = /(src\/|index\.html|vite\.config)/.test(status);

    if (needsInstall) {
      const out2 = execSync("npm install --silent --no-audit --no-fund", { cwd: DEPLOY_PATH, encoding: "utf8", timeout: 300000 });
      result.steps.push({ step: "npm install", output: out2.slice(-200) });
    }
    if (needsBuild) {
      const out3 = execSync("npm run build 2>&1", { cwd: DEPLOY_PATH, encoding: "utf8", timeout: 180000 });
      result.steps.push({ step: "npm run build", output: out3.slice(-300) });
    }

    const out4 = execSync("pm2 restart cds-erp --update-env", { encoding: "utf8" });
    result.steps.push({ step: "pm2 restart", output: out4.slice(-200) });
    result.ok = true;
    return result;
  } catch (err) {
    result.ok = false;
    result.error = err.message;
    if (err.stderr) result.stderr = err.stderr.toString().slice(-500);
    if (err.stdout) result.stdout = err.stdout.toString().slice(-300);
    return result;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!SECRET) {
    return res.status(503).json({ error: "GITHUB_WEBHOOK_SECRET não configurado no .env" });
  }

  const signature = req.headers["x-hub-signature-256"];
  const rawBody = getRawBody(req);
  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: "assinatura inválida" });
  }

  const event = req.headers["x-github-event"];
  const ref = req.body?.ref;

  if (event === "ping") {
    return res.status(200).json({ ok: true, msg: "pong" });
  }
  if (event !== "push") {
    return res.status(200).json({ ok: true, ignored: `evento ${event} ignorado` });
  }
  if (ref !== "refs/heads/main") {
    return res.status(200).json({ ok: true, ignored: `branch ${ref} ignorado (só main auto-deploya)` });
  }

  // Dispara deploy em background (responde rápido pra GitHub)
  setImmediate(() => {
    const result = deploy();
    console.log("[webhook github] deploy result:", JSON.stringify(result));
  });

  return res.status(202).json({ ok: true, msg: "deploy disparado em background", commit: req.body?.head_commit?.id?.slice(0,7) });
}
