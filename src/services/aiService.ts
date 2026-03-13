import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ProjectState } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";
import { COMPONENT_LIBRARY } from "../constants/componentLibrary";

export async function analyzeProjectInput(prompt: string, currentProject?: ProjectState, imagesBase64?: string[]): Promise<Partial<ProjectState>> {
  try {
    // Helper for timeout
    const withTimeout = (promise: Promise<any>, ms: number, msg: string) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
        ]);
    };

    // 1. Check/Request API Key via AI Studio (Platform specific)
    if (typeof window !== 'undefined' && (window as any).aistudio) {
        try {
            const hasKey = await withTimeout(
                (window as any).aistudio.hasSelectedApiKey(),
                5000, 
                "Timeout checking API key"
            );
            
            if (!hasKey) {
                try {
                    await withTimeout(
                        (window as any).aistudio.openSelectKey(),
                        60000, // User needs time to select, but not forever
                        "Timeout waiting for key selection"
                    );
                    // Race condition handling: assume success immediately after openSelectKey returns
                } catch (e) {
                    console.error("Key selection dialog failed or was cancelled", e);
                    throw new Error("A seleção da chave de API é necessária para usar este recurso.");
                }
            }
        } catch (e) {
             console.warn("AI Studio API check timed out or failed, proceeding to check env vars...", e);
        }
    }

    // 2. Get API Key
    // Try multiple sources. process.env.API_KEY is the standard for this platform.
    let apiKey = "";
    try {
        // Check process.env first (injected by platform or vite define)
        apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || "";
        
        // If empty, try import.meta.env (Vite standard)
        if (!apiKey && (import.meta as any).env) {
            apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.VITE_GOOGLE_API_KEY || "";
        }
    } catch (e) {
        console.warn("Error accessing environment variables", e);
    }

    if (!apiKey) {
        console.error("API Key not found in process.env or import.meta.env");
        // If still no key, try to prompt again (if not already prompted) or fail
        throw new Error("Chave de API não encontrada. Por favor, verifique se a chave está configurada no ambiente ou selecione uma nas configurações.");
    }

    // Log (masked) key for debugging
    console.log(`API Key found: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

    // 3. Initialize Client
    // Create a new instance right before making the call to ensure it uses the latest key
    const ai = new GoogleGenAI({ apiKey });

    // 4. Prepare Request
    // Using gemini-3.1-pro-preview para melhor raciocínio estrutural e complexidade
    const model = "gemini-3.1-pro-preview"; 
    
    const fabricationReadinessInstruction = `
FABRICATION READINESS (CRÍTICO - PROIBIDO "PALITOS"):
1. NUNCA gere estruturas que pareçam "palitos" ou esqueletos simplificados.
2. OBRIGATÓRIO incluir componentes de união e reforço: chapas de ligação (gussets), chapas de base (base plates) em pés, parafusos/fixadores visíveis, e travamentos diagonais (bracing) em estruturas metálicas.
3. Peças de metalon/tubo DEVEM ter espessura de parede realista (ex: 1.2mm, 1.5mm, 2.0mm) e não devem ser apenas linhas.
4. O modelo final deve parecer um produto pronto, não um esboço. Se for uma mesa, deve ter o tampo, pés, quadro e fixadores. Se for um galpão, deve ter pilares, vigas, terças e chapas de base.
5. Se a IA gerar algo simples demais, a validação semântica falhará e forçará a re-geração.`;

    const validateAndEnforceGrid = (data: any): any => {
        if (!data) return data;
        
        // We no longer force 5mm grid on dimensions to respect real material measures
        // But we keep basic sanity checks
        if (data.dimensions) {
            data.dimensions.width = Math.max(1, Math.round(data.dimensions.width || 1));
            data.dimensions.height = Math.max(1, Math.round(data.dimensions.height || 1));
            data.dimensions.depth = Math.max(1, Math.round(data.dimensions.depth || 1));
        }

        let globalMinY = Infinity;

        // Round components and ensure positive
        if (Array.isArray(data.components)) {
            data.components.forEach((comp: any) => {
                comp.width = Math.max(1, Math.round(comp.width || 1));
                comp.height = Math.max(1, Math.round(comp.height || 1));
                
                // Validate Thickness for MDF
                const isMDF = (comp.material || '').toLowerCase().includes('mdf') || (comp.name || '').toLowerCase().includes('mdf');
                if (isMDF) {
                    if (!comp.thickness || comp.thickness < 6) {
                        comp.thickness = 15;
                    }
                } else {
                    if (!comp.thickness) {
                        comp.thickness = 2;
                    }
                }

                if (comp.position) {
                    // Keep some rounding for 3D alignment but less restrictive
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

                // Calculate Min Y for Grounding
                let halfHeight = 0;
                const isVertical = Math.abs(comp.rotation.z || 0) < 0.1 && Math.abs(comp.rotation.x || 0) < 0.1;
                
                if (comp.type === 'Flat') {
                     // Flat usually horizontal
                     halfHeight = (comp.thickness || 15) / 2;
                } else {
                    // Tubes
                    if (isVertical) {
                        halfHeight = comp.height / 2;
                    } else {
                        // Horizontal tube
                        halfHeight = (comp.width || 20) / 2;
                    }
                }
                
                const bottomY = comp.position.y - halfHeight;
                if (bottomY < globalMinY) {
                    globalMinY = bottomY;
                }
            });

            // Apply Grounding (Shift Y)
            // If the model is floating (minY > 5) or buried (minY < -5), shift it to 0.
            if (globalMinY !== Infinity && Math.abs(globalMinY) > 5) {
                const shiftY = -globalMinY;
                console.log(`Grounding model: Shifting Y by ${shiftY}mm`);
                data.components.forEach((comp: any) => {
                    comp.position.y += shiftY;
                });
            }
        }
    
    // Map weldConnections to weldConfig
    if (Array.isArray(data.weldConnections)) {
        data.weldConfig = {};
        data.weldConnections.forEach((conn: any) => {
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
};

    let fullPrompt = prompt;
    const foldablePieceInstruction = `
REGRAS RÍGIDAS PARA PEÇAS DOBRÁVEIS (BANDEJAS, CAIXAS, ETC.):
1. SEMPRE que o usuário pedir uma peça que pode ser dobrada de uma chapa única (como uma bandeja, caixa, suporte em U ou L), você DEVE gerar como UMA ÚNICA PEÇA (use 'Bent' para peças com dobras).
2. NÃO gere peças separadas para o fundo e as laterais se elas puderem ser feitas de uma única chapa dobrada.
3. A "visão dobrada" (folded view) deve mostrar a peça dobrada, e a "visão planificada" (unfolded view) deve mostrar a peça aberta.
4. Se for uma bandeja, ela deve ser uma única chapa com as abas dobradas para cima.
5. BANDEJAS TÊM 4 LADOS POR PADRÃO (a menos que especificado 3 lados).
6. O PLANO DE CORTE (visão planificada) DEVE ser calculado e gerado pensando na bandeja ABERTA (chapa plana antes das dobras).
7. AS DIMENSÕES (width, height) DO COMPONENTE NO JSON DEVEM SER AS DIMENSÕES DA CHAPA PLANA (UNFOLDED), NÃO AS DIMENSÕES DA PEÇA DOBRADA.`;

    const completenessInstruction = `
REGRAS DE COMPLETUDE E MONTAGEM (CRÍTICO):
1. PROJETO COMPLETO: Se o usuário pede "Mesa", "Estante", "Bancada", gere O MÓVEL INTEIRO.
   - NÃO gere apenas o esqueleto metálico.
   - INCLUA O TAMPO (MDF/Madeira) para mesas.
   - INCLUA AS PRATELEIRAS (MDF/Madeira) para estantes.
   - INCLUA PÉS NIVELADORES (Componente 'LevelingFoot' ou descrição "Pé Nivelador") para qualquer móvel de chão.
2. ESTRUTURA MISTA: Móveis de MDF precisam de estrutura de aço.
   - Ex: Mesa = Pés de Aço + Quadro de Aço + Tampo de MDF.
3. CONEXÕES FÍSICAS (SEM FLUTUAÇÃO):
   - O tampo deve estar APOIADO no quadro (z = altura do quadro).
   - As prateleiras devem estar APOIADAS nas travessas.
   - Os pés devem tocar o chão.
   - USE O SISTEMA DE COORDENADAS: Y=0 é o chão. Position é o CENTRO da peça.
4. NÃO SIMPLIFIQUE DEMAIS: "Básico" significa "Design Padrão", não "Incompleto".`;


    const gridInstruction = `
GRID E SIMPLIFICAÇÃO:
1. O uso de múltiplos de 5mm é APENAS para simplificação visual no 3D e melhor disposição do desenho.
2. NÃO trate o grid de 5mm como uma restrição de material real. Use as medidas reais solicitadas pelo usuário para o cálculo de materiais.`;

    const miterCutInstruction = `
REGRAS RÍGIDAS DE CORTES (MEIA ESQUADRIA VS RETO):
1. QUADROS/MOLDURAS (Estruturas retangulares fechadas): 
   - OBRIGATÓRIO usar 'cutType': 'miter-both' (45 graus) em TODAS as 4 peças.
   - O comprimento da peça deve ser a MEDIDA EXTERNA TOTAL.
   - LÓGICA DE ROTAÇÃO E POSIÇÃO PARA QUADROS (MUITO IMPORTANTE):
     Para que os cortes de 45 graus se encontrem perfeitamente, a face "externa" (longa) deve ficar para fora.
     - Peça na posição ESQUERDA (x negativo): OBRIGATÓRIO rotation: { x: 0, y: 0, z: 0 }
     - Peça na posição DIREITA (x positivo): OBRIGATÓRIO rotation: { x: 0, y: 0, z: 3.14 } (180°)
     - Peça na posição SUPERIOR (y positivo): OBRIGATÓRIO rotation: { x: 0, y: 0, z: -1.57 } (-90°)
     - Peça na posição INFERIOR (y negativo): OBRIGATÓRIO rotation: { x: 0, y: 0, z: 1.57 } (90°)
     NÃO INVERTA ESTAS ROTAÇÕES. Se você colocar a peça esquerda com rotação 180, o quadro ficará invertido!
2. COLUNAS/PÉS (Estruturas verticais): OBRIGATÓRIO usar 'cutType': 'straight' (corte reto).
3. TRAVESSAS DE LIGAÇÃO (Entre colunas): OBRIGATÓRIO usar 'cutType': 'straight'.
SE O PROJETO É UM QUADRO, USE 45 GRAUS. SE É UMA COLUNA, USE RETO. NÃO FALHE NISSO.
4. PAINÉIS DE CAIXA/LIXEIRA (Meia Esquadria nas bordas):
   - Para unir chapas a 90° com acabamento invisível, use 'cutType': 'miter-both' e 'miterAxis': 'x'.
   - Isso fará o corte de 45° ao longo da espessura da chapa.`;

    const trapdoorInstruction = `
ESTRUTURA DE ALÇAPÃO (TRAPDOOR):
Se o usuário pedir um ALÇAPÃO, TAMPA DE POÇO ou similar, você DEVE gerar DUAS estruturas independentes:
1. MARCO EXTERNO (Fixo): Um quadro retangular feito de cantoneira (L-Shape) ou tubo, que será chumbado no chão.
   - Use 'cutType': 'miter-both' (45°) nos cantos.
   - Dimensões: Exatamente o tamanho do buraco solicitado.
2. FOLHA/TAMPA (Móvel): Um segundo quadro interno que abre e fecha.
   - Deve ser ligeiramente menor que o marco (folga de 5mm a 10mm).
   - Use 'cutType': 'miter-both' (45°) nos cantos.
   - Preenchimento: Pode ter travessas internas para reforço.
3. POSICIONAMENTO: A folha deve estar DENTRO do marco, nivelada com o topo.
NÃO GERE APENAS UM QUADRO. Um alçapão precisa de Marco + Tampa.`;

    const tubeInstruction = `
REGRAS PARA TUBOS E PERFIS (PADRÃO GRAVIA.COM):
1. NOMENCLATURA COMPLETA: Use o padrão "30x30x6000 chapa 1,5mm" ou "50x30x6000 chapa 1,2mm".
2. COMPRIMENTO PADRÃO: Barras de metalon têm 6000mm.
3. DIMENSÕES PARA 3D:
   - 'height': COMPRIMENTO da peça (longo eixo).
   - 'width': Largura da seção.
   - 'details.depth': Profundidade da seção.
4. ROTAÇÃO: Para peças horizontais, rotacione o componente (ex: z: 1.57) em vez de trocar width por height.
5. CORTES: Siga rigorosamente a regra de Meia Esquadria para quadros.`;

    const materialInstruction = `
REGRAS DE MATERIAIS E ACABAMENTOS:
1. Especifique o material de CADA componente individualmente no campo 'material'.
2. MDF/MADEIRA:
   - ESPESSURA: Use SEMPRE 15mm ou 18mm para caixarias e estruturas padrão. NUNCA use 2mm para MDF (isso é apenas para fundos de gaveta ou chapa dura).
   - NOME: Use "MDF 15mm Branco", "MDF 18mm Amadeirado", etc.
   - MONTAGEM: Peças de MDF são parafusadas. Adicione "Parafusos" na descrição se necessário, mas o sistema calculará os insumos.
3. METAL:
   - Use "Aço", "Aço Galvanizado", "Chapa 14" (1.9mm), "Chapa 18" (1.2mm).
   - Tubos: "Tubo 30x30", "Tubo 50x30".
4. VIDRO:
   - Se houver vidro, especifique "Vidro Temperado 8mm" ou similar.
5. FERRAGENS (Hardware):
   - Para MESA: Use sapatas niveladoras ou rodízios. NUNCA use dobradiças ou gonzos em mesas fixas.
   - Para ARMÁRIOS/PORTAS: Use dobradiças.
   - Para PRATELEIRAS: Use suportes mão francesa ou invisíveis.
6. PÉS E NIVELADORES:
   - TODO móvel de chão (mesas, estantes, balcões) DEVE ter pés niveladores ou rodízios. Não desenhe a peça tocando diretamente o chão sem proteção.
7. SEPARE CLARAMENTE o que é estrutura metálica do que é marcenaria.
`;

    const ergonomicsInstruction = `
NORMAS TÉCNICAS E ERGONOMIA (NR-17):
1. Altura de Bancada de Trabalho: 720mm a 750mm.
2. Altura de Bancada de Cozinha/Refeição: 900mm a 1100mm.
3. Espaço para Pernas: Mínimo 450mm de profundidade e 600mm de largura.
4. Alcance Confortável: Prateleiras de uso frequente entre 600mm e 1600mm de altura.
5. Segurança: Cantos vivos em áreas de circulação devem ser evitados ou protegidos.
`;

    const designLevelInstruction = `
NÍVEIS DE DESIGN (Quando não houver especificações detalhadas):
O usuário pode solicitar um nível de design. Se não especificado, assuma NÍVEL 1.

NÍVEL 1 (BÁSICO - PADRÃO):
- Estrutura puramente funcional e ortogonal.
- Materiais padrão (Metalon cru/pintado, MDF simples).
- Sem elementos decorativos.
- Foco em economia e facilidade de construção.

NÍVEL 2 (MÉDIO):
- Adicione alguns detalhes estéticos simples (ex: pés reguláveis visíveis, puxadores embutidos).
- Mistura de materiais mais harmoniosa.
- Pode incluir travamentos diagonais para estilo industrial.
- Acabamento sugerido um pouco mais refinado.

NÍVEL 3 (ALTO NÍVEL):
- Design premium e sofisticado.
- Geometria mais complexa ou interessante (assimetria, balanços).
- Materiais nobres ou combinações elegantes (ex: madeira maciça com metal preto fosco).
- Detalhes de marcenaria fina.
- Foco em estética de alto padrão ("Pinterest/ArchDaily").
`;

    const negationRules = `
REGRAS DE NEGAÇÃO E OTIMIZAÇÃO (PARA VELOCIDADE MÁXIMA):
1. NÃO explique o que você fez.
2. NÃO dê dicas de segurança.
3. NÃO sugira ferramentas.
4. NÃO crie introduções como "Aqui está o projeto...".
5. NÃO inclua campos nulos ou vazios no JSON para economizar tokens.
6. NÃO invente peças decorativas desnecessárias se não solicitado.
7. NÃO use markdown (exceto o bloco de código JSON se necessário).
8. SEJA DIRETO: Sua única função é gerar o JSON de dados.
9. Se o usuário pedir algo impossível, gere o melhor aproximado possível e adicione um aviso curto no campo 'message'.
`;

    if (currentProject) {
        fullPrompt = `CONTEXTO ATUAL DO PROJETO:
Name: ${currentProject.name}
Dimensões: ${currentProject.dimensions.width}x${currentProject.dimensions.height}x${currentProject.dimensions.depth}mm
Material: ${currentProject.material}
Componentes Atuais: ${JSON.stringify(currentProject.components, null, 2)}
Biblioteca de Componentes Disponíveis (USE SE POSSÍVEL): ${JSON.stringify(COMPONENT_LIBRARY, null, 2)}

SOLICITAÇÃO DO USUÁRIO:
${prompt}

${negationRules}
${designLevelInstruction}
${foldablePieceInstruction}
${completenessInstruction}
${miterCutInstruction}
${trapdoorInstruction}
${tubeInstruction}
${materialInstruction}
${gridInstruction}
${fabricationReadinessInstruction}

Se o usuário enviou uma imagem, você DEVE:
1. Identificar e medir todos os METALONS (tubos metálicos). Use 'SquareTube' ou 'RectangularTube' para eles.
2. Identificar e medir todas as CHAPAS DE MDF/MADEIRA. Use 'Flat' para elas, e especifique "MDF" ou "Madeira" no nome ou descrição.
3. Estimar as proporções para recriar a peça fielmente no 3D.
4. Se for uma alteração, ajuste os componentes existentes. Se for um novo projeto, ignore o contexto anterior.

IMPORTANTE: Verifique rigorosamente a lógica de montagem 3D.
- GRID E SIMPLIFICAÇÃO: Use múltiplos de 5mm para posições (x, y, z) para alinhamento visual.
- Calcule as coordenadas (x, y, z) para que as peças se toquem fisicamente (sem flutuar).
- Use a lógica de "Bounding Box": Defina os limites externos e posicione as peças dentro deles.
- Garanta que prateleiras e travessas estejam conectadas aos pilares.
- VERIFIQUE SE O PROJETO ESTÁ COMPLETO (Tampo, Pés, etc).`;
    } else {
        fullPrompt = `SOLICITAÇÃO DO USUÁRIO:
${prompt}

${negationRules}
${designLevelInstruction}
${foldablePieceInstruction}
${completenessInstruction}
${miterCutInstruction}
${trapdoorInstruction}
${tubeInstruction}
${materialInstruction}
${gridInstruction}
${fabricationReadinessInstruction}

Se o usuário enviou uma imagem, você DEVE:
1. Identificar e medir todos os METALONS (tubos metálicos). Use 'SquareTube' ou 'RectangularTube' para eles.
2. Identificar e medir todas as CHAPAS DE MDF/MADEIRA. Use 'Flat' para elas, e especifique "MDF" ou "Madeira" no nome ou descrição.
3. Estimar as proporções para recriar a peça fielmente no 3D.

IMPORTANTE: Verifique rigorosamente a lógica de montagem 3D.
- GRID E SIMPLIFICAÇÃO: Use múltiplos de 5mm para posições (x, y, z) para alinhamento visual.
- Calcule as coordenadas (x, y, z) para que as peças se toquem fisicamente (sem flutuar).
- Use a lógica de "Bounding Box": Defina os limites externos e posicione as peças dentro deles.
- Garanta que prateleiras e travessas estejam conectadas aos pilares.
- VERIFIQUE SE O PROJETO ESTÁ COMPLETO (Tampo, Pés, etc).`;
    }
    
    const parts: any[] = [{ text: fullPrompt }];
    if (imagesBase64 && imagesBase64.length > 0) {
        imagesBase64.forEach(img => {
            // Extract mime type from base64 string (e.g., "data:image/png;base64,...")
            let mimeType = "image/jpeg";
            let data = img;
            
            if (img.startsWith('data:')) {
                const matches = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    mimeType = matches[1];
                    data = matches[2];
                } else {
                    // Fallback if regex fails but it has a comma
                    data = img.split(',')[1] || img;
                }
            }
            
            parts.push({
                inlineData: {
                    data: data,
                    mimeType: mimeType
                }
            });
        });
    }

    // 5. Call API
    console.log(`Sending request to Gemini model: ${model}...`);
    
    // Use a simple timeout wrapper for the generateContent call
    const generateContentWithTimeout = async () => {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        message: { type: Type.STRING, description: "Resumo técnico curto." },
                        dimensions: {
                            type: Type.OBJECT,
                            properties: {
                                width: { type: Type.NUMBER },
                                height: { type: Type.NUMBER },
                                depth: { type: Type.NUMBER }
                            }
                        },
                        material: { type: Type.STRING },
                        components: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    material: { type: Type.STRING },
                                    width: { type: Type.NUMBER },
                                    height: { type: Type.NUMBER },
                                    quantity: { type: Type.NUMBER },
                                    thickness: { type: Type.NUMBER },
                                    description: { type: Type.STRING },
                                    type: { 
                                        type: Type.STRING, 
                                        enum: ["L-Shape", "U-Profile", "Flat", "Trapezoid", "Bent", "RoundTube", "SquareTube", "RectangularTube", "Profile", "Hinge", "Parametric"]
                                    },
                                    cutType: {
                                        type: Type.STRING,
                                        enum: ["straight", "miter-start", "miter-end", "miter-both"]
                                    },
                                    miterAxis: {
                                        type: Type.STRING,
                                        enum: ["x", "y"]
                                    },
                                    position: {
                                        type: Type.OBJECT,
                                        properties: {
                                            x: { type: Type.NUMBER },
                                            y: { type: Type.NUMBER },
                                            z: { type: Type.NUMBER }
                                        }
                                    },
                                    rotation: {
                                        type: Type.OBJECT,
                                        properties: {
                                            x: { type: Type.NUMBER },
                                            y: { type: Type.NUMBER },
                                            z: { type: Type.NUMBER }
                                        }
                                    },
                                    details: {
                                        type: Type.OBJECT,
                                        properties: {
                                            angle: { type: Type.NUMBER },
                                            top: { type: Type.NUMBER },
                                            bottom: { type: Type.NUMBER },
                                            flange2: { type: Type.NUMBER },
                                            depth: { type: Type.NUMBER }
                                        }
                                    }
                                },
                                required: ["id", "name", "width", "height", "quantity", "type", "position", "rotation"]
                            }
                        }
                    },
                    required: ["name", "dimensions", "message", "components"]
                }
            }
        });
        return response;
    };

    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`Retrying AI analysis (attempt ${attempt})...`);
            }

            const response: any = await withTimeout(
                generateContentWithTimeout(),
                300000, // 300 seconds timeout
                "A análise demorou mais que o esperado. Por favor, tente novamente."
            );

            // 6. Parse Response
            console.log("Gemini response received.");
            let text = response.text || "{}";
            
            // Clean up markdown code blocks if present (though responseMimeType should prevent this)
            if (text.startsWith("```json")) {
                text = text.replace(/^```json\n/, "").replace(/\n```$/, "");
            } else if (text.startsWith("```")) {
                text = text.replace(/^```\n/, "").replace(/\n```$/, "");
            }

            const parsedData = JSON.parse(text);
            const validatedData = validateAndEnforceGrid(parsedData);

            // 7. Semantic Validation (Completeness Check)
            const promptLower = prompt.toLowerCase();
            const isTable = promptLower.includes('mesa') || promptLower.includes('table') || promptLower.includes('bancada') || promptLower.includes('desk');
            const isShelf = promptLower.includes('estante') || promptLower.includes('prateleira') || promptLower.includes('shelf') || promptLower.includes('rack');
            const isShed = promptLower.includes('galpão') || promptLower.includes('shed') || promptLower.includes('cobertura');
            
            if (isTable || isShelf || isShed) {
                const hasFlat = validatedData.components.some((c: any) => c.type === 'Flat' || (c.name || '').toLowerCase().includes('tampo') || (c.name || '').toLowerCase().includes('prateleira') || (c.name || '').toLowerCase().includes('telha') || (c.name || '').toLowerCase().includes('cobertura') || (c.name || '').toLowerCase().includes('mdf') || (c.name || '').toLowerCase().includes('madeira'));
                if (!hasFlat) {
                    // Throw error to trigger retry
                    throw new Error("O projeto gerado está incompleto: Falta o Tampo, Prateleiras ou Cobertura (Telha/MDF/Madeira). O modelo deve incluir todas as partes.");
                }
            }

            return validatedData;

        } catch (error: any) {
            lastError = error;
            console.warn(`Attempt ${attempt + 1} failed:`, error.message);
            
            // Only retry on timeout, network errors, or 503 (Service Unavailable)
            const isTimeout = error.message && error.message.includes("demorou mais que o esperado");
            const isNetwork = error.message && (error.message.includes("fetch") || error.message.includes("network"));
            const isServiceUnavailable = error.message && (error.message.includes("503") || error.message.includes("UNAVAILABLE") || error.message.includes("high demand"));
            
            if (attempt < MAX_RETRIES && (isTimeout || isNetwork || isServiceUnavailable)) {
                // Wait a bit before retrying (longer wait for 503)
                const retryDelay = isServiceUnavailable ? 5000 : 2000;
                console.log(`Waiting ${retryDelay}ms before retry due to ${isServiceUnavailable ? 'high demand' : 'timeout/network'}...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            
            // If we're here, we've exhausted retries or it's a non-retryable error
            if (isTimeout) {
                throw new Error("A análise demorou mais que o esperado após várias tentativas. Por favor, tente simplificar sua descrição ou tente novamente mais tarde.");
            }

            if (isServiceUnavailable) {
                throw new Error("O serviço de IA está com alta demanda no momento. Por favor, aguarde alguns instantes e tente novamente.");
            }
            
            console.error("Gemini API Error:", error);
            throw new Error(`Erro na IA: ${error.message || "Falha desconhecida"}`);
        }
    }

    throw lastError || new Error("Falha ao analisar o projeto.");

  } catch (e: any) {
    console.error("AI Analysis Failed", e);
    
    // Handle specific API errors
    if (e.message?.includes("API key not valid") || e.message?.includes("API_KEY_INVALID")) {
         if (typeof window !== 'undefined' && (window as any).aistudio) {
            try {
                await (window as any).aistudio.openSelectKey();
                throw new Error("Chave de API inválida. Por favor, selecione uma chave válida e tente novamente.");
            } catch (err) {
                // ignore
            }
         }
    }

    throw new Error(e.message || "Falha ao analisar o projeto.");
  }
}

