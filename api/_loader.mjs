// api/_loader.mjs — Monta as funcoes serverless de /api/*.js como rotas Express
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

async function loadHandlerFile(filePath) {
  const mod = await import(pathToFileURL(filePath).href);
  return mod.default || mod.handler || null;
}

function wrapVercelHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("[api]", req.method, req.path, err);
      if (!res.headersSent) res.status(500).json({ error: err.message || "Internal error" });
      else next(err);
    }
  };
}

function isApiFile(name) {
  return name.endsWith(".js") && !name.startsWith("_");
}

export async function mountApiRoutes(app, baseDir = "api", urlPrefix = "/api") {
  const dir = path.resolve(process.cwd(), baseDir);
  if (!fs.existsSync(dir)) return [];
  const mounted = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_")) continue;
      const subRoutes = await mountApiRoutes(app, path.join(baseDir, entry.name), `${urlPrefix}/${entry.name}`);
      mounted.push(...subRoutes);
    } else if (entry.isFile() && isApiFile(entry.name)) {
      const route = `${urlPrefix}/${entry.name.replace(/\.js$/, "")}`;
      try {
        const handler = await loadHandlerFile(fullPath);
        if (typeof handler === "function") {
          app.all(route, wrapVercelHandler(handler));
          mounted.push(route);
        }
      } catch (err) {
        console.error(`[api-loader] erro carregando ${fullPath}:`, err.message);
      }
    }
  }
  return mounted;
}

export default mountApiRoutes;
