import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { UsuarioConfig, buscarConfiguracoes, defaultConfig, salvarConfiguracoes } from '../services/usuarioService';

interface ConfigContextType {
  config: UsuarioConfig;
  atualizarConfig: (novaConfig: Partial<UsuarioConfig>) => Promise<void>;
  isLoading: boolean;
  planoAtual: 'free' | 'pro';
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<UsuarioConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      if (user) {
        setIsLoading(true);
        const userConfig = await buscarConfiguracoes(user.uid);
        setConfig(userConfig);
        setIsLoading(false);
      } else {
        setConfig(defaultConfig);
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [user]);

  const atualizarConfig = async (novaConfig: Partial<UsuarioConfig>) => {
    if (!user) return;
    
    const updatedConfig = { ...config, ...novaConfig };
    setConfig(updatedConfig);
    
    try {
      await salvarConfiguracoes(user.uid, updatedConfig);
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
      // Revert on error? For now just log it.
    }
  };

  return (
    <ConfigContext.Provider value={{ config, atualizarConfig, isLoading, planoAtual: config.plano }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
