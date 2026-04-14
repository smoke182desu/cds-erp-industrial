// Frontend service: calls the serverless endpoint /api/gemini-welding.
// The Gemini API key is never shipped to the browser - it lives only in the
// server env var GEMINI_API_KEY (configured in Vercel).

function fallbackStrategy(intersectionCount: number): string {
    return (
          "Estrategia de soldagem simulada (Gemini indisponivel): para esta peca, " +
          "recomenda-se ponteamento inicial nos " + intersectionCount +
          " pontos de contato, seguido de cordoes de solda intermitentes (~30mm) " +
          "para minimizar empenamento. Processo sugerido: MIG para producao ou TIG " +
          "para melhor acabamento em chapa fina."
        );
}

export async function generateWeldingStrategy(
    partName: string,
    partType: string,
    dimensions: string,
    thickness: number,
    intersectionCount: number,
  ): Promise<string> {
    try {
          const resp = await fetch('/api/gemini-welding', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ partName, partType, dimensions, thickness, intersectionCount }),
          });

      if (!resp.ok) {
              const data = await resp.json().catch(() => ({}));
              console.warn('[geminiService] endpoint retornou erro:', data?.error || resp.status);
              return fallbackStrategy(intersectionCount);
      }

      const data = await resp.json();
          const text = (data && data.text) ? String(data.text).trim() : '';
          return text || fallbackStrategy(intersectionCount);
    } catch (err) {
          console.error('[geminiService] falha ao chamar /api/gemini-welding', err);
          return fallbackStrategy(intersectionCount);
    }
}
