import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { configEmpresa } from '../constants/configEmpresa';

export interface UsuarioConfig {
  nomeEmpresa: string;
  telefone: string;
  logoBase64: string;
  multiplicadorLucro: number;
  plano: 'free' | 'pro';
}

export const defaultConfig: UsuarioConfig = {
  nomeEmpresa: configEmpresa.razaoSocial,
  telefone: configEmpresa.telefone,
  logoBase64: '',
  multiplicadorLucro: 1.5,
  plano: 'free',
};

export const buscarConfiguracoes = async (userId: string): Promise<UsuarioConfig> => {
  const path = `usuarios_configs/${userId}`;
  try {
    const docRef = doc(db, 'usuarios_configs', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { ...defaultConfig, ...docSnap.data() } as UsuarioConfig;
    } else {
      return defaultConfig;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return defaultConfig;
  }
};

export const salvarConfiguracoes = async (userId: string, config: UsuarioConfig): Promise<void> => {
  const path = `usuarios_configs/${userId}`;
  try {
    const docRef = doc(db, 'usuarios_configs', userId);
    await setDoc(docRef, config, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};
