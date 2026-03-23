export interface DadosConexao {
  ligacao: string;
  peca_origem: string;
  peca_destino: string;
  espessura_origem_mm: number;
  espessura_destino_mm: number;
  material_origem: string;
  material_destino: string;
  angulo_graus: number;
  comprimento_contato_mm: number;
  distancia_mm: number;
}

export interface DecisaoSolda {
  ligacao: string;
  tipo_solda: 'Vazio' | 'Ponteado' | 'Cordão' | 'Cordao_Intermitente';
  justificativa: string;
}

export function analisarSolda(dados: DadosConexao): DecisaoSolda {
  const {
    ligacao,
    espessura_origem_mm,
    espessura_destino_mm,
    material_origem,
    material_destino,
    angulo_graus,
    comprimento_contato_mm,
    distancia_mm
  } = dados;

  // 1. Distância
  if (distancia_mm > 1.0) {
    return {
      ligacao,
      tipo_solda: 'Vazio',
      justificativa: 'Distância maior que 1.0mm, as peças não se tocam o suficiente.'
    };
  }

  // 2. Compatibilidade de Material
  const matOrigem = material_origem.toLowerCase().replace(/[^a-z]/g, '');
  const matDestino = material_destino.toLowerCase().replace(/[^a-z]/g, '');
  
  const isAcoAluminio = (matOrigem.includes('aco') && matDestino.includes('aluminio')) ||
                        (matOrigem.includes('aluminio') && matDestino.includes('aco'));

  if (isAcoAluminio) {
    return {
      ligacao,
      tipo_solda: 'Vazio',
      justificativa: 'Materiais incompatíveis para soldagem simples (ex: aço com alumínio).'
    };
  }

  // 3. Espessura (Chapas Finas)
  if (espessura_origem_mm <= 2.0 || espessura_destino_mm <= 2.0) {
    return {
      ligacao,
      tipo_solda: 'Ponteado',
      justificativa: 'Espessura menor ou igual a 2.0mm, alto risco de empenamento.'
    };
  }

  // 4 & 5. Espessura e Ângulo (Chapas Grossas) e Comprimento
  if (angulo_graus === 90 || angulo_graus === 180) {
    if (comprimento_contato_mm > 1000) {
      return {
        ligacao,
        tipo_solda: 'Cordao_Intermitente',
        justificativa: 'União exige cordão, mas o comprimento de contato é maior que 1000mm. Intermitente para evitar excesso de calor.'
      };
    } else {
      const tipoJunta = angulo_graus === 90 ? 'junta em T' : 'junta de topo';
      return {
        ligacao,
        tipo_solda: 'Cordão',
        justificativa: `Espessura maior que 2mm, materiais compatíveis e ângulo de ${angulo_graus} graus formam ${tipoJunta} ideal para cordão.`
      };
    }
  }

  // Fallback para outros ângulos
  return {
    ligacao,
    tipo_solda: 'Ponteado',
    justificativa: `Ângulo de ${angulo_graus} graus não é ideal para cordão contínuo padrão. Recomendado ponteamento ou análise manual.`
  };
}
