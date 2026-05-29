// src/contexts/TrafegoContext.tsx
// Mantém o cliente de tráfego ativo (selecionado no header do módulo)
// e a lista cacheada para os sub-componentes consumirem.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listarClientes, TrafegoCliente } from '../services/trafegoService';

interface TrafegoContextValue {
  clientes: TrafegoCliente[];
  loading: boolean;
  erro: string;
  clienteAtivo: TrafegoCliente | null;
  setClienteAtivoId: (id: string | null) => void;
  recarregar: () => Promise<void>;
}

const TrafegoContext = createContext<TrafegoContextValue | null>(null);

const STORAGE_KEY = 'trafego.clienteAtivoId';

export function TrafegoProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<TrafegoCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [clienteAtivoId, _setClienteAtivoId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  const setClienteAtivoId = useCallback((id: string | null) => {
    _setClienteAtivoId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const lista = await listarClientes(false);
      setClientes(lista);
      // Se o cliente ativo foi arquivado ou não existe mais, escolhe o primeiro ativo
      if (clienteAtivoId && !lista.find(c => c.id === clienteAtivoId)) {
        setClienteAtivoId(lista[0]?.id ?? null);
      } else if (!clienteAtivoId && lista.length > 0) {
        setClienteAtivoId(lista[0].id);
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, [clienteAtivoId, setClienteAtivoId]);

  useEffect(() => { recarregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const clienteAtivo = useMemo(
    () => clientes.find(c => c.id === clienteAtivoId) ?? null,
    [clientes, clienteAtivoId]
  );

  const value = useMemo<TrafegoContextValue>(() => ({
    clientes,
    loading,
    erro,
    clienteAtivo,
    setClienteAtivoId,
    recarregar,
  }), [clientes, loading, erro, clienteAtivo, setClienteAtivoId, recarregar]);

  return <TrafegoContext.Provider value={value}>{children}</TrafegoContext.Provider>;
}

export function useTrafego() {
  const ctx = useContext(TrafegoContext);
  if (!ctx) throw new Error('useTrafego deve ser usado dentro de <TrafegoProvider>');
  return ctx;
}
