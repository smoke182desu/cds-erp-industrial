// ... imports ...
import "dotenv/config";
import express from "express";
// import { createServer as createViteServer } from "vite"; // Removed static import
import axios from "axios";
import * as cheerio from "cheerio";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
// import { GoogleGenAI, Type } from "@google/genai"; // Removed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("projects.db");

// SYSTEM_INSTRUCTION moved to src/constants.ts

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    picture TEXT
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    data TEXT,
    updated_at INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // --- Auth Middleware ---
  const getUser = (req: express.Request) => {
    const userId = req.cookies.user_id;
    if (!userId) return null;
    return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  };

  // --- OAuth Routes ---
  app.get("/api/auth/url", (req, res) => {
    const rootUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${rootUrl}/auth/callback`;
    
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent"
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const code = req.query.code as string;
    const rootUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${rootUrl}/auth/callback`;

    try {
      const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      });

      const { access_token } = tokenResponse.data;
      const userResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const userData = userResponse.data;
      
      // Upsert user
      db.prepare(`
        INSERT INTO users (id, email, name, picture) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, picture=excluded.picture
      `).run(userData.id, userData.email, userData.name, userData.picture);

      res.cookie("user_id", userData.id, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000 
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticação bem-sucedida. Fechando janela...</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("OAuth error:", error.response?.data || error.message);
      res.status(500).send("Erro na autenticação Google");
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const user = getUser(req);
    res.json(user || null);
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("user_id", { sameSite: 'none', secure: true });
    res.json({ success: true });
  });

  app.post("/api/log-error", (req, res) => {
    console.error("❌ [Frontend Error]:", JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  });

  // --- PROXY PNCP (Portal Nacional de Contratações Públicas) ---
  // Endpoint de busca: pncp.gov.br/api/search/?tipos_documento=edital
  // O domínio api.pncp.gov.br não resolve — usar pncp.gov.br diretamente
  app.get("/pncp-api/*", async (req, res) => {
    const pncpPath = req.originalUrl.replace("/pncp-api", "");
    const targetUrl = `https://pncp.gov.br${pncpPath}`;
    try {
      const response = await axios.get(targetUrl, {
        headers: { "Accept": "application/json" },
        timeout: 15000,
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 502;
      const data = error.response?.data || { error: "Erro ao consultar PNCP" };
      console.error(`[PNCP Proxy] ${targetUrl} → ${status}`, error.message);
      res.status(status).json(data);
    }
  });

  // --- Project Routes ---
  app.get("/api/projects", (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const projects = db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC").all(user.id);
    res.json(projects.map((p: any) => ({ ...p, data: JSON.parse(p.data) })));
  });

  app.get("/api/cnpj/:cnpj", async (req, res) => {
    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${req.params.cnpj}`);
      res.json(response.data);
    } catch (error: any) {
      console.error("Erro ao buscar CNPJ:", error.message);
      res.status(500).json({ error: "Erro ao buscar CNPJ" });
    }
  });

  app.post("/api/projects", (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id, name, data } = req.body;
    db.prepare(`
      INSERT INTO projects (id, user_id, name, data, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, data=excluded.data, updated_at=excluded.updated_at
    `).run(id, user.id, name, JSON.stringify(data), Date.now());

    res.json({ success: true });
  });

  app.delete("/api/projects/:id", (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(req.params.id, user.id);
    res.json({ success: true });
  });

  // --- AI Routes ---
  // AI logic moved to client-side (src/services/aiService.ts)
  /*
  app.post("/api/ai/analyze", async (req, res) => {
    // ... removed ...
    res.status(404).json({ error: "Endpoint deprecated. Use client-side AI service." });
  });
  */

  // --- Backend Logic: /extract Endpoint ---
  app.get("/extract", async (req, res) => {
    const url = req.query.url as string;

    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Basic URL validation (http/https only)
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "Invalid URL protocol. Only http/https allowed." });
    }

    try {
      // Fetch HTML with timeout and size limit (simulated by axios maxContentLength)
      const response = await axios.get(url, {
        timeout: 10000, // 10 seconds timeout
        maxContentLength: 5 * 1024 * 1024, // 5MB max size
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extract basic metadata
      const title = $("title").text().trim() || $("meta[property='og:title']").attr("content") || "";
      const description = $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "";
      
      // Extract main text content (heuristic: look for common content containers)
      // This is a simplified approach. Real extraction is complex.
      // We'll grab text from body, but prioritize article, main, or product-description classes if found.
      let mainText = "";
      const contentSelectors = ["article", "main", ".product-description", "#description", ".description"];
      for (const selector of contentSelectors) {
        if ($(selector).length > 0) {
          mainText += $(selector).text() + "\n";
        }
      }
      if (!mainText) {
        mainText = $("body").text(); // Fallback to full body text if specific containers not found
      }
      
      // Clean up text (remove excessive whitespace)
      mainText = mainText.replace(/\s+/g, " ").trim().substring(0, 5000); // Limit text length for processing

      // Extract specs from tables
      let specsText = "";
      $("table").each((i, table) => {
        $(table).find("tr").each((j, tr) => {
          const rowText = $(tr).text().replace(/\s+/g, " ").trim();
          specsText += rowText + "\n";
        });
      });

      // Extract images (prioritize og:image, then large images in body)
      const images: string[] = [];
      const ogImage = $("meta[property='og:image']").attr("content");
      if (ogImage) images.push(ogImage);

      $("img").each((i, img) => {
        const src = $(img).attr("src");
        if (src && !src.startsWith("data:") && (src.startsWith("http") || src.startsWith("//"))) {
           // Simple filter to avoid icons/tracking pixels
           const width = $(img).attr("width");
           const height = $(img).attr("height");
           if ((!width || parseInt(width) > 100) && (!height || parseInt(height) > 100)) {
             images.push(src.startsWith("//") ? "https:" + src : src);
           }
        }
      });

      // --- Parser Logic (Simulated LLM & Dimension Parser) ---
      
      // 1. Parse Dimensions
      const dimensions = parseDimensions(title + " " + description + " " + specsText + " " + mainText);

      // 2. Classify Product (Simulated LLM)
      const classification = classifyProduct({ title, description, specsText });

      // Combine results
      const result = {
        title,
        description,
        specs_text: specsText.substring(0, 1000), // Truncate for response
        images: [...new Set(images)].slice(0, 5), // Unique images, max 5
        extracted_data: {
          dimensions,
          classification
        }
      };

      res.json(result);

    } catch (error: any) {
      console.error("Extraction error:", error.message);
      res.status(500).json({ error: "Failed to extract data from URL", details: error.message });
    }
  });

  // --- Helper Functions ---

  function parseDimensions(text: string): { width: number | null, height: number | null, depth: number | null } {
    // Normalize text
    const lowerText = text.toLowerCase();
    
    // Regex for patterns like "150 x 60 x 90 cm", "1500x600x900 mm"
    // We look for 3 numbers separated by 'x' or 'by', optionally followed by unit
    const threeDimsRegex = /(\d+[.,]?\d*)\s*(?:x|by|\*)\s*(\d+[.,]?\d*)\s*(?:x|by|\*)\s*(\d+[.,]?\d*)\s*(cm|mm|m)?/i;
    const match3 = lowerText.match(threeDimsRegex);

    if (match3) {
      let [_, d1, d2, d3, unit] = match3;
      let v1 = parseFloat(d1.replace(',', '.'));
      let v2 = parseFloat(d2.replace(',', '.'));
      let v3 = parseFloat(d3.replace(',', '.'));
      
      // Default unit to cm if not found, unless numbers are large (>1000 usually mm)
      if (!unit) {
        if (v1 > 1000 || v2 > 1000 || v3 > 1000) unit = 'mm';
        else unit = 'cm';
      }

      // Convert to mm
      const factor = unit === 'm' ? 1000 : (unit === 'cm' ? 10 : 1);
      v1 *= factor;
      v2 *= factor;
      v3 *= factor;

      // Heuristic mapping: usually W x D x H or L x W x H
      // We'll assume standard furniture: H is usually 400-2500mm. W is usually largest. D is usually 300-1000mm.
      // Let's sort them to make a best guess if not labeled.
      // Actually, standard notation is often W x D x H or L x W x H.
      // Let's return them as is for now, mapped to W, D, H in order found.
      return { width: v1, depth: v2, height: v3 };
    }

    // Look for labeled dimensions
    const widthRegex = /(?:largura|comprimento|width|length|l|w)[\s:]*(\d+[.,]?\d*)\s*(cm|mm|m)/i;
    const heightRegex = /(?:altura|height|h)[\s:]*(\d+[.,]?\d*)\s*(cm|mm|m)/i;
    const depthRegex = /(?:profundidade|depth|d|p)[\s:]*(\d+[.,]?\d*)\s*(cm|mm|m)/i;

    const wMatch = lowerText.match(widthRegex);
    const hMatch = lowerText.match(heightRegex);
    const dMatch = lowerText.match(depthRegex);

    const parseValue = (m: RegExpMatchArray | null) => {
      if (!m) return null;
      let val = parseFloat(m[1].replace(',', '.'));
      const unit = m[2].toLowerCase();
      const factor = unit === 'm' ? 1000 : (unit === 'cm' ? 10 : 1);
      return val * factor;
    };

    return {
      width: parseValue(wMatch),
      height: parseValue(hMatch),
      depth: parseValue(dMatch)
    };
  }

  function classifyProduct(data: { title: string, description: string, specsText: string }) {
    const text = (data.title + " " + data.description + " " + data.specsText).toLowerCase();
    
    // 1. Category
    let category = "Outros";
    if (text.includes("mesa") || text.includes("escrivaninha")) category = "Mesa";
    else if (text.includes("estante") || text.includes("prateleira")) category = "Estante";
    else if (text.includes("bancada")) category = "Bancada";
    else if (text.includes("armário") || text.includes("armario")) category = "Armário";
    else if (text.includes("nicho")) category = "Nicho";

    // 2. Features
    const hasShelves = text.includes("prateleira") || text.includes("nicho");
    const hasDoors = text.includes("porta");
    const hasDrawers = text.includes("gaveta");
    const hasMesh = text.includes("tela") || text.includes("expandida");
    const hasWheels = text.includes("rodízio") || text.includes("rodinha");

    // 3. Material hints
    const material = {
      metalon: text.includes("metalon") || text.includes("tubo") ? "20x20" : "20x20", // Default
      wood: text.includes("madeira") || text.includes("mdf") || text.includes("pinus"),
      mesh: hasMesh
    };

    return {
      category,
      features: { hasShelves, hasDoors, hasDrawers, hasMesh, hasWheels },
      material
    };
  }

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
