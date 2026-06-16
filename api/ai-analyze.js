import { chamarIA, parseIAResponse } from './_lib/ai-fallback.js';

function validateAndEnforceGrid(data) {
  if (!data) return data;

  if (data.dimensions) {
    data.dimensions.width = Math.max(1, Math.round(data.dimensions.width || 1));
    data.dimensions.height = Math.max(1, Math.round(data.dimensions.height || 1));
    data.dimensions.depth = Math.max(1, Math.round(data.dimensions.depth || 1));
  }

  let globalMinY = Infinity;

  if (Array.isArray(data.components)) {
    data.components.forEach(comp => {
      comp.width = Math.max(1, Math.round(comp.width || 1));
      comp.height = Math.max(1, Math.round(comp.height || 1));

      const isMDF = (comp.material || '').toLowerCase().includes('mdf') || (comp.name || '').toLowerCase().includes('mdf');
      if (isMDF) {
        if (!comp.thickness || comp.thickness < 6) comp.thickness = 15;
      } else {
        if (!comp.thickness) comp.thickness = 2;
      }

      if (comp.position) {
        comp.position.x = Math.round(comp.position.x || 0);
        comp.position.y = Math.round(comp.position.y || 0);
        comp.position.z = Math.round(comp.position.z || 0);
      } else {
        comp.position = { x: 0, y: 0, z: 0 };
      }

      if (comp.rotation) {
        comp.rotation.x = comp.rotation.x || 0;
        comp.rotation.y = comp.rotation.y || 0;
        comp.rotation.z = comp.rotation.z || 0;
      } else {
        comp.rotation = { x: 0, y: 0, z: 0 };
      }

      let halfHeight = 0;
      const isVertical = Math.abs(comp.rotation.z || 0) < 0.1 && Math.abs(comp.rotation.x || 0) < 0.1;

      if (comp.type === 'Flat') {
        halfHeight = (comp.thickness || 15) / 2;
      } else {
        if (isVertical) {
          halfHeight = comp.height / 2;
        } else {
          halfHeight = (comp.width || 20) / 2;
        }
      }

      const bottomY = comp.position.y - halfHeight;
      if (bottomY < globalMinY) globalMinY = bottomY;
    });

    if (globalMinY !== Infinity && Math.abs(globalMinY) > 5) {
      const shiftY = -globalMinY;
      data.components.forEach(comp => {
        comp.position.y += shiftY;
      });
    }
  }

  if (Array.isArray(data.weldConnections)) {
    data.weldConfig = {};
    data.weldConnections.forEach(conn => {
      if (conn.partId) {
        data.weldConfig[conn.partId] = {
          points: conn.points || {},
          links: conn.links || []
        };
      }
    });
    delete data.weldConnections;
  }

  return data;
}

const SYSTEM_INSTRUCTION = `
ATUE COMO UM MOTOR DE ENGENHARIA DE ALTA PERFORMANCE.
SUA PRIORIDADE ABSOLUTA E VELOCIDADE, PRECISAO DE DADOS E VIABILIDADE DE FABRICACAO.

1. OBJETIVO:
   - Gerar modelos 3D precisos e planos de corte otimizados.
   - Sua saida alimenta diretamente um visualizador 3D e uma maquina de corte.
   - O usuario quer ver o projeto COMPLETO e FUNCIONAL.

2. REGRAS DE OURO:
   - JSON-FIRST: Sua resposta deve ser puramente estrutural.
   - MESSAGE CURTA: O campo 'message' deve ter no maximo 2 frases tecnicas resumindo a alteracao.
   - COMPLETUDE: Se o usuario pede "Mesa", gere pes + travessas + tampo. Se "Estante", gere estrutura + prateleiras.

3. SISTEMA DE COORDENADAS:
   - Y=0 e o CHAO.
   - A 'position' (x, y, z) e o CENTRO GEOMETRICO da peca.
   - Peca de 700mm apoiada no chao: position.y = 350.
   - Tampo a 750mm do chao: position.y = 750 + (espessura/2).
   - Pecas nao flutuam. Tudo conectado fisicamente.

4. COMPONENTES:
   - METALONS: 'SquareTube' ou 'RectangularTube'. Nome padrao "30x30 chapa 18".
   - MDF/MADEIRA: 'Flat'. Nome "MDF 15mm".
   - CHAPAS DOBRADAS: 'Bent', 'L-Shape', 'U-Profile'.
   - Todo movel de chao DEVE ter base inferior de travamento.

5. CORTES:
   - QUADROS: 'cutType': 'miter-both' (45 graus). Medida EXTERNA total.
   - COLUNAS/TRAVESSAS: 'cutType': 'straight' (reto).

6. FORMATO DE RESPOSTA (JSON ESTRITO):
{
  "name": "Nome do Projeto",
  "message": "Resumo tecnico ultra-curto.",
  "dimensions": { "width": number, "height": number, "depth": number },
  "material": "string",
  "components": [
    {
      "id": "string_unico",
      "name": "Nome",
      "width": number,
      "height": number,
      "quantity": number,
      "type": "SquareTube | Flat | RectangularTube | L-Shape | U-Profile | Bent | RoundTube | Profile | Hinge | Parametric",
      "cutType": "straight | miter-both | miter-start | miter-end",
      "material": "string",
      "thickness": number,
      "position": { "x": number, "y": number, "z": number },
      "rotation": { "x": number, "y": number, "z": number },
      "details": { "depth": number }
    }
  ]
}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  const { prompt, currentProject, images } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt obrigatorio' });

  try {
    let fullPrompt = prompt;

    if (currentProject) {
      fullPrompt = `CONTEXTO ATUAL DO PROJETO:
Name: ${currentProject.name}
Dimensoes: ${currentProject.dimensions?.width}x${currentProject.dimensions?.height}x${currentProject.dimensions?.depth}mm
Material: ${currentProject.material}
Componentes Atuais: ${JSON.stringify(currentProject.components, null, 2)}

SOLICITACAO DO USUARIO:
${prompt}

REGRAS:
1. NAO explique o que voce fez.
2. NAO de dicas de seguranca.
3. NAO crie introducoes.
4. NAO inclua campos nulos ou vazios no JSON.
5. SEJA DIRETO: Sua unica funcao e gerar o JSON de dados.
6. NUNCA gere estruturas simplificadas. Inclua componentes de uniao e reforco.
7. Se o usuario enviou uma imagem, identifique os metalons, chapas de MDF, e estime proporcoes.
8. Calcule coordenadas para que as pecas se toquem fisicamente (sem flutuar).
9. Verifique se o projeto esta completo (Tampo, Pes, etc).`;
    }

    const userPrompt = `Gere um projeto 3D completo baseado na seguinte solicitacao. Responda APENAS com JSON valido:

${fullPrompt}

${images && images.length > 0 ? `\nImagens foram fornecidas (${images.length} imagem(ns)). Identifique os componentes e medidas.` : ''}`;

    const result = await chamarIA(SYSTEM_INSTRUCTION, userPrompt, { maxTokens: 3000, temperature: 0.2 });
    const parsed = parseIAResponse(result.content);
    const validated = validateAndEnforceGrid(parsed);

    return res.status(200).json({
      ok: true,
      data: validated,
      provider: result.provider,
      model: result.model,
    });

  } catch (err) {
    console.error('[ai-analyze] erro:', err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Erro interno',
    });
  }
}
