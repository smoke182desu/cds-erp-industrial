export const acabamentosMetal = {
  aco_carbono: { color: '#4a4a4a', metalness: 0.7, roughness: 0.5, nome: 'Aço Carbono (Natural)', precoKg: 14.0 },
  galvanizado: { color: '#f0f0f0', metalness: 0.9, roughness: 0.2, nome: 'Aço Galvanizado', precoKg: 18.0 },
  inox_304: { color: '#f5f5f5', metalness: 1.0, roughness: 0.1, nome: 'Aço Inox 304 (Escovado)', precoKg: 70.0 },
  inox_430: { color: '#e8e8e8', metalness: 1.0, roughness: 0.15, nome: 'Aço Inox 430 (Brilhante)', precoKg: 50.0 },
  aluminio: { color: '#d1d1d1', metalness: 0.9, roughness: 0.3, nome: 'Alumínio (Natural)', precoKg: 50.0 },
  corten: { color: '#8a3324', metalness: 0.6, roughness: 0.9, nome: 'Aço Corten (Enferrujado)', precoKg: 20.0 },
  preto_fosco: { color: '#1a1a1a', metalness: 0.8, roughness: 0.6, nome: 'Pintura Preto Fosco', precoKg: 24.0 },
  branco_brilhante: { color: '#ffffff', metalness: 0.5, roughness: 0.1, nome: 'Pintura Branco Brilhante', precoKg: 24.0 },
};

export const materiaisDegrau = {
  madeira_clara: { color: '#d2b48c', metalness: 0.1, roughness: 0.8, nome: 'Madeira Clara (Pinus/Tauari)', multiplicadorPreco: 1.0 },
  madeira_escura: { color: '#5c4033', metalness: 0.1, roughness: 0.9, nome: 'Madeira Escura (Ipê/Imbuia)', multiplicadorPreco: 1.3 },
  chapa_aco: { color: '#2c2c2c', metalness: 0.7, roughness: 0.5, nome: 'Chapa de Aço Metálica', multiplicadorPreco: 1.1 },
};

export type AcabamentoMetalKey = keyof typeof acabamentosMetal;
export type MaterialDegrauKey = keyof typeof materiaisDegrau;
