/**
 * Módulo de Engenharia Industrial
 * Implementa as lógicas de parametrização e regras de negócio descritas na arquitetura.
 */

// Densidades (kg/m³)
const DENSIDADE_ACO = 7850;
const DENSIDADE_ALUMINIO = 2700;
const DENSIDADE_INOX = 8000;

export interface EngineeringResult {
  pesoTotal: number;
  areaPintura: number;
  alertas: string[];
  dadosTecnicos: Record<string, any>;
}

/**
 * Cálculo de Escadas - Fórmula de Blondel
 * 2h + p = 64cm
 */
export function calcularBlondel(alturaTotal: number) {
  const alturaIdealEspelho = 180; // mm
  const numDegraus = Math.ceil(alturaTotal / alturaIdealEspelho);
  const espelhoReal = alturaTotal / numDegraus;
  const pisadaIdeal = 640 - (2 * espelhoReal); // mm
  
  return {
    numDegraus,
    espelho: espelhoReal,
    pisada: pisadaIdeal,
    confortavel: espelhoReal <= 190 && espelhoReal >= 150
  };
}

/**
 * Cálculo de Chapa Desenvolvida (K-Factor)
 * L = A + B - (2 * R + Ba)
 */
export function calcularDesenvolvimentoChapa(abas: number[], espessura: number, raioInterno: number = 2) {
  const kFactor = 0.448; // Padrão para aço carbono em dobra CNC
  const bA = (Math.PI / 2) * (raioInterno + (kFactor * espessura));
  
  let total = abas.reduce((acc, val) => acc + val, 0);
  // Simplificação: dedução de dobra
  const deducao = (2 * (raioInterno + espessura)) - bA;
  return total - (deducao * (abas.length - 1));
}

/**
 * Validação de Estrutura (Mezanino/Galpão)
 * Checa flambagem e necessidade de colunas extras
 */
export function validarVaoEstrutural(vao: number, perfilAltura: number): { seguro: boolean; sugestao?: string } {
  const relacaoVaoH = vao / perfilAltura;
  
  if (relacaoVaoH > 25) {
    return { 
      seguro: false, 
      sugestao: "Vão excessivo para este perfil. Aumente a alma da viga ou adicione uma coluna central." 
    };
  }
  return { seguro: true };
}

/**
 * Cálculo de Centro de Gravidade (Simplificado para Logística)
 */
export function calcularCentroMassa(largura: number, altura: number, profundidade: number, cargaKg: number) {
  // Assume carga distribuída ou base pesada
  return {
    x: largura / 2,
    y: (altura * 0.3), // Centro baixo para estabilidade
    z: profundidade / 2,
    estavel: true
  };
}

/**
 * Regras de Segurança NR-12 / Guarda-corpo
 */
export function validarSeguranca(espacamentoEntreBarras: number) {
  const MAX_ESPACAMENTO = 110; // mm (Norma)
  return {
    conforme: espacamentoEntreBarras <= MAX_ESPACAMENTO,
    erro: espacamentoEntreBarras > MAX_ESPACAMENTO ? `Espaçamento de ${espacamentoEntreBarras}mm excede o limite de 110mm da norma.` : null
  };
}
