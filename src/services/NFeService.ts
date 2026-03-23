export interface NFePayload {
  emissor: {
    cnpj: string;
    razaoSocial: string;
  };
  destinatario: {
    nome: string;
    documento: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    inscricaoEstadual?: string;
  };
  itens: {
    descricao: string;
    quantidade: number;
    valorUnitario: number;
  }[];
  impostos: {
    icms: number;
    ipi: number;
  };
  ambiente: 1 | 2; // 1: Produção, 2: Homologação
}

export interface NFeResponse {
  status: 'sucesso' | 'erro';
  chaveAcesso?: string;
  recibo?: string;
  protocolo?: string;
  mensagem?: string;
}

export const transmitirNFe = async (dadosProjeto: any, ambiente: 1 | 2): Promise<NFeResponse> => {
  // Simula latência de rede
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Simulação de resposta
  if (Math.random() > 0.1) {
    return {
      status: 'sucesso',
      chaveAcesso: '352603' + Math.random().toString().slice(2, 40),
      recibo: '35000' + Math.random().toString().slice(2, 12),
      protocolo: '13526' + Math.random().toString().slice(2, 12)
    };
  } else {
    return {
      status: 'erro',
      mensagem: 'Erro na SEFAZ: Rejeição 539 - Duplicidade de NF-e.'
    };
  }
};
