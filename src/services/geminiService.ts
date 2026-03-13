import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export async function generateWeldingStrategy(partName: string, partType: string, dimensions: string, thickness: number, intersectionCount: number): Promise<string> {
  if (!apiKey) {
    return "Estratégia de soldagem simulada (API Key não configurada): Para esta peça, recomenda-se ponteamento inicial nos " + intersectionCount + " pontos de contato, seguido de cordões de solda MIG de 50mm intercalados a cada 150mm para evitar empenamento térmico, garantindo alta resistência estrutural.";
  }

  try {
    const prompt = `
Atue como um Engenheiro de Soldagem Sênior.
Preciso de uma estratégia de soldagem de alta qualidade para a seguinte peça metálica que será unida à estrutura principal:
- Peça: ${partName}
- Tipo/Formato: ${partType}
- Dimensões: ${dimensions}
- Espessura da chapa: ${thickness}mm
- Número de pontos de intersecção/contato com a estrutura: ${intersectionCount}

Determine a melhor estratégia de soldagem considerando:
1. O processo ideal (MIG, TIG, Eletrodo Revestido).
2. O tipo de solda (ex: ponteamento para travamento, cordão contínuo, cordão intermitente/zigue-zague).
3. Uma recomendação prática de execução (ex: "pontear nos ${intersectionCount} pontos p1, p2... e depois aplicar cordão de X cm").
4. Foco em evitar empenamento (distorção térmica) e garantir padrão de qualidade estrutural.

Responda de forma direta, técnica e profissional em português, em no máximo 1 parágrafo ou tópicos curtos.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.2,
      }
    });

    return response.text || "Não foi possível gerar a estratégia.";
  } catch (error) {
    console.error("Erro ao gerar estratégia de soldagem:", error);
    return "Erro ao consultar a IA para a estratégia de soldagem. Por favor, verifique a conexão ou a chave da API.";
  }
}
