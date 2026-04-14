// Serverless endpoint (Vercel) - proxies Gemini calls so the API key stays on the server.
// Keeps GEMINI_API_KEY out of the client bundle (do NOT rename to VITE_GEMINI_API_KEY).
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return res.status(405).json({ error: 'Method not allowed' });
    }

  if (!GEMINI_API_KEY) {
        return res.status(500).json({
                error: 'GEMINI_API_KEY nao configurada no servidor. Configure em Vercel > Settings > Environment Variables e faca Redeploy.',
        });
  }

  try {
        const {
                partName = '',
                partType = '',
                dimensions = '',
                thickness = 0,
                intersectionCount = 0,
        } = req.body || {};

      const prompt = `
      Atue como um Engenheiro de Soldagem Senior.
      Preciso de uma estrategia de soldagem de alta qualidade para a seguinte peca metalica que sera unida a estrutura principal:
      - Peca: ${partName}
      - Tipo/Formato: ${partType}
      - Dimensoes: ${dimensions}
      - Espessura da chapa: ${thickness}mm
      - Numero de pontos de interseccao/contato com a estrutura: ${intersectionCount}

      Determine a melhor estrategia de soldagem considerando:
      1. O processo ideal (ex: MIG, TIG, Eletrodo Revestido).
      2. O tipo de solda (ex: ponteamento para travamento, cordao continuo, cordao intermitente/zigue-zague).
      3. Uma recomendacao pratica de execucao (ex: "pontear nos ${intersectionCount} pontos p1, p2... e depois aplicar cordao de X cm").
      4. Foco em evitar empenamento (distorcao termica) e garantir padrao de qualidade estrutural.

      Responda em portugues, de forma objetiva e tecnica, em ate 6 linhas.
          `.trim();

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
        });

      const text = result?.text || result?.response?.text?.() || '';
        return res.status(200).json({ text });
  } catch (err) {
        console.error('[api/gemini-welding] erro', err);
        return res.status(500).json({ error: err?.message || 'Erro ao chamar Gemini' });
  }
}
