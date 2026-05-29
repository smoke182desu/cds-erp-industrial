// src/pages/TrafegoPago.tsx
// Container do módulo "Tráfego Pago" — multi-cliente (agência).
// Sprint 1: estrutura, seletor de cliente, aba Clientes funcional + placeholders.

import { useState } from 'react';
import { TrendingUp, Users2, Megaphone, Link2, FileText, Plug, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { TrafegoProvider, useTrafego } from '../contexts/TrafegoContext';
import { TrafegoClientes } from './trafego/TrafegoClientes';
import { TrafegoVisaoGeral } from './trafego/TrafegoVisaoGeral';
import { TrafegoCampanhas } from './trafego/TrafegoCampanhas';
import { TrafegoAtribuicao } from './trafego/TrafegoAtribuicao';
import { TrafegoRelatorios } from './trafego/TrafegoRelatorios';
import { TrafegoContas } from './trafego/TrafegoContas';

type Aba = 'visao-geral' | 'campanhas' | 'atribuicao' | 'relatorios' | 'contas' | 'clientes';

const ABAS: { id: Aba; nome: string; icon: any; badge?: string }[] = [
  { id: 'visao-geral', nome: 'Visão Geral', icon: TrendingUp, badge: 'S2' },
  { id: 'campanhas', nome: 'Campanhas', icon: Megaphone, badge: 'S2' },
  { id: 'atribuicao', nome: 'Atribuição', icon: Link2, badge: 'S3' },
  { id: 'relatorios', nome: 'Relatórios', icon: FileText, badge: 'futuro' },
  { id: 'contas', nome: 'Contas Conectadas', icon: Plug, badge: 'S2' },
  { id: 'clientes', nome: 'Clientes', icon: Users2 },
];

function ClienteSeletor({ onAbrirCadastro }: { onAbrirCadastro: () => void }) {
  const { clientes, clienteAtivo, setClienteAtivoId, loading } = useTrafego();
  const [aberto, setAberto] = useState(false);

  const ativos = clientes.filter(c => c.status !== 'arquivado');

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(a => !a)}
        className="flex items-center gap-3 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl px-4 py-2 shadow-sm transition-all min-w-[260px]"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: clienteAtivo?.cor_destaque || '#6366f1' }}
        >
          {clienteAtivo?.nome?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 text-left">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cliente</p>
          <p className="text-sm font-bold text-slate-800 truncate">
            {loading ? 'Carregando...' : clienteAtivo?.nome || 'Nenhum cliente'}
          </p>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-80 overflow-y-auto">
          {ativos.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Nenhum cliente cadastrado ainda.
            </div>
          )}
          {ativos.map(c => (
            <button
              key={c.id}
              onClick={() => { setClienteAtivoId(c.id); setAberto(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors ${
                c.id === clienteAtivo?.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: c.cor_destaque || '#6366f1' }}
              >
                {c.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                {c.responsavel && <p className="text-[11px] text-slate-500">Gestor: {c.responsavel}</p>}
              </div>
              {c.status === 'pausado' && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Pausado</span>
              )}
            </button>
          ))}
          <button
            onClick={() => { setAberto(false); onAbrirCadastro(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 text-indigo-600 hover:bg-indigo-50 font-medium text-sm"
          >
            <Plus size={14} /> Novo cliente
          </button>
        </div>
      )}
    </div>
  );
}

function TrafegoPagoInterno() {
  const [aba, setAba] = useState<Aba>('clientes');
  const [forcarCadastro, setForcarCadastro] = useState(false);
  const { clienteAtivo, loading } = useTrafego();

  const abrirCadastro = () => {
    setAba('clientes');
    setForcarCadastro(true);
  };

  const renderConteudo = () => {
    if (loading && !clienteAtivo) {
      return (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando módulo...
        </div>
      );
    }
    switch (aba) {
      case 'clientes':    return <TrafegoClientes forcarCadastroInicial={forcarCadastro} onCadastroFeito={() => setForcarCadastro(false)} />;
      case 'visao-geral': return <TrafegoVisaoGeral />;
      case 'campanhas':   return <TrafegoCampanhas />;
      case 'atribuicao':  return <TrafegoAtribuicao />;
      case 'relatorios':  return <TrafegoRelatorios />;
      case 'contas':      return <TrafegoContas />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Tráfego Pago
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Multi-cliente</span>
            </h1>
            <p className="text-xs text-white/70 mt-0.5">Campanhas, métricas e atribuição de leads para cada cliente que você gerencia</p>
          </div>
          <ClienteSeletor onAbrirCadastro={abrirCadastro} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 overflow-x-auto">
        <div className="flex gap-1">
          {ABAS.map(t => {
            const ativa = aba === t.id;
            const Icone = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setAba(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  ativa
                    ? 'border-indigo-500 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icone size={14} />
                {t.nome}
                {t.badge && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    ativa ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                  }`}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto bg-slate-50">
        {renderConteudo()}
      </div>
    </div>
  );
}

export function TrafegoPago() {
  return (
    <TrafegoProvider>
      <TrafegoPagoInterno />
    </TrafegoProvider>
  );
}
