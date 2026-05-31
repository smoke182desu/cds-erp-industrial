// src/components/ClienteAgenciaSelector.tsx
// Dropdown no topo do módulo Marketing pra trocar o cliente da agência ativo.
// Lê do TrafegoContext (cliente persistido em localStorage).

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Plus, CheckCircle2, Loader2 } from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';

interface Props {
  /** Compacto: só avatar + chevron (pra header pequeno). Default false = mostra nome também. */
  compacto?: boolean;
  /** Callback quando "Novo cliente" é clicado (abre modal externo). Default = navega pra Tráfego>Clientes */
  onNovoCliente?: () => void;
  className?: string;
}

function avatarLabel(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ClienteAgenciaSelector({ compacto = false, onNovoCliente, className = '' }: Props) {
  const { clientes, clienteAtivo, setClienteAtivoId, loading } = useTrafego();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const ativos = clientes.filter(c => c.status !== 'arquivado');
  const corAtivo = clienteAtivo?.cor_destaque || '#6366f1';
  const labelAtivo = clienteAtivo?.nome || (loading ? 'Carregando…' : 'Selecione');

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition shadow-sm"
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: corAtivo }}
        >
          {clienteAtivo ? avatarLabel(clienteAtivo.nome) : <Building2 className="w-4 h-4" />}
        </span>
        {!compacto && (
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 leading-none">
              Cliente da agência
            </span>
            <span className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">
              {labelAtivo}
            </span>
          </div>
        )}
        {loading
          ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          : <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        }
      </button>

      {aberto && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              {ativos.length} cliente{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {ativos.length === 0 && !loading && (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                Nenhum cliente cadastrado ainda.
              </div>
            )}
            {ativos.map(c => {
              const selecionado = c.id === clienteAtivo?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => { setClienteAtivoId(c.id); setAberto(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                    selecionado ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: c.cor_destaque || '#6366f1' }}
                  >
                    {avatarLabel(c.nome)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.nome}</div>
                    {c.responsavel && (
                      <div className="text-xs text-gray-500 truncate">{c.responsavel}</div>
                    )}
                  </div>
                  {selecionado && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          {onNovoCliente && (
            <button
              type="button"
              onClick={() => { setAberto(false); onNovoCliente(); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 border-t border-gray-100"
            >
              <Plus className="w-4 h-4" />
              Novo cliente
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ClienteAgenciaSelector;
