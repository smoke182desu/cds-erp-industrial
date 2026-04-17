import { configEmpresa } from '../constants/configEmpresa';

export interface UsuarioConfig {
  nomeEmpresa: string;
  telefone: string;
  logoBase64: string;
  multiplicadorLucro: number;
  plano: 'free' | 'pro';
  // Dados fiscais para NF-e
  cnpjEmissor?: string;
  ieEmissor?: string;
  crtEmissor?: string;          // '1'=Simples, '2'=Simples Excesso, '3'=Normal
  logradouroEmissor?: string;
  numeroEmissor?: string;
  bairroEmissor?: string;
  municipioEmissor?: string;
  codMunEmissor?: string;       // Código IBGE 7 dígitos
  ufEmissor?: string;
  cepEmissor?: string;
}

export const defaultConfig: UsuarioConfig = {
  nomeEmpresa: configEmpresa.razaoSocial,
  telefone: configEmpresa.telefone,
  logoBase64: '',
  multiplicadorLucro: 1.5,
  plano: 'free',
  cnpjEmissor: '',
  ieEmissor: 'ISENTO',
  crtEmissor: '1',
  logradouroEmissor: '',
  numeroEmissor: 'S/N',
  bairroEmissor: '',
  municipioEmissor: 'Brasília',
  codMunEmissor: '5300108',
  ufEmissor: 'DF',
  cepEmissor: '',
};

export const buscarConfiguracoes = async (userId: string): Promise<UsuarioConfig> => {
  try {
    const r = await fetch(`/api/config?col=usuarios_configs&doc=${encodeURIComponent(userId)}`);
    const d = await r.json();
    if (d.data) return { ...defaultConfig, ...d.data } as UsuarioConfig;
  } catch { /* fallback abaixo */ }
  return defaultConfig;
};

export const salvarConfiguracoes = async (userId: string, config: UsuarioConfig): Promise<void> => {
  try {
    await fetch(`/api/config?col=usuarios_configs&doc=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch (e) {
    console.error('[usuarioService] erro ao salvar:', e);
  }
};
