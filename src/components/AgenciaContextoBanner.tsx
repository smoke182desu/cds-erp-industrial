// src/components/AgenciaContextoBanner.tsx
// Banner global compacto que mostra qual empresa da agência está ativa.
// Drop-in pra topo de qualquer página (CRM, WhatsApp, Leads, etc.)
// Quando o usuário troca, filtra automaticamente via context.

import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, CheckCircle2, Plus, AlertCircle } from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';

interface Props {
  /** Mensagem que aparece após "filtrando dados para:" — ex: "leads", "conversas". Default "dados" */
  contexto?: string;
  /** Permite "Ver tudo" (sem filtro). Quando true, mostra opção All. Default true. */
  permiteTodos?: boolean;
  /** Callback quando user clica "+ Nova empresa". Default: navega pra Agência. */
  onNovaEmpresa?: () => void;
  className?: string;
}

export function AgenciaContextoBanner({
  contexto = 'dados',
  permiteTodos = true,
  onNovaEmpresa,
  className = '',
}: Props) {
  const { clientes, clienteAtivo, setClienteAtivoId, loading } = useTrafego();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
  const iniciais = clienteAtivo?.nome.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';

  // Sem empresas cadastradas — call to action
  if (!loading && ativos.length === 0) {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-800">
            Nenhuma empresa cadastrada. Cadastre a primeira pra usar o modo agência.
          </span>
        </div>
        <button
          onClick={() => onNovaEmpresa?.()}
          className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Cadastrar
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center gap-2 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg px-3 py-2 transition"
      >
        <Building2 className="w-3.5 h-3.5 text-violet-700 flex-shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-violet-700 font-semibold">
          {contexto} de
        </span>
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ backgroundColor: corAtivo }}
        >
          {iniciais}
        </div>
        <span className="text-sm font-semibold text-slate-800 truncate flex-1 text-left">
          {clienteAtivo?.nome || (permiteTodos ? 'Todas empresas' : '—')}
        </span>
        <ChevronDown className={`w-4 h-4 text-violet-600 transition ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {permiteTodos && (
            <button
              onClick={() => { setClienteAtivoId(null); setAberto(false); }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${!clienteAtivo ? 'bg-slate-100' : ''}`}
            >
              <div className="w-5 h-5 rounded-md bg-slate-300 flex items-center justify-center text-white text-[10px] font-bold">∀</div>
              <span className="flex-1">Todas empresas</span>
              {!clienteAtivo && <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />}
            </button>
          )}
          {ativos.map(c => {
            const init = c.nome.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
            const ativo = clienteAtivo?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setClienteAtivoId(c.id); setAberto(false); }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${ativo ? 'bg-violet-50' : ''}`}
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: c.cor_destaque || '#6366f1' }}
                >
                  {init}
                </div>
                <span className="flex-1 truncate">{c.nome}</span>
                {ativo && <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />}
              </button>
            );
          })}
          <div className="border-t border-slate-100">
            <button
              onClick={() => { setAberto(false); onNovaEmpresa?.(); }}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-violet-700 hover:bg-violet-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova empresa</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgenciaContextoBanner;
