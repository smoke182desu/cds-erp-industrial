// src/pages/CentroOperacao.tsx — Painel diário com TODAS pendências da agência
import { useEffect, useState, useMemo } from 'react';
import {
  Activity, AlertTriangle, Bell, CheckCircle2, Clock, DollarSign, FileText,
  Loader2, MessageCircle, Send, Target, Users2, WifiOff, Calendar, ExternalLink,
  AlertCircle, ChevronRight, Sparkles, ShieldAlert,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';

interface OperacaoData {
  resumo: {
    faturas_a_enviar: number;
    faturas_pendentes_pagamento: number;
    faturas_vencidas: number;
    posts_aguardando_revisao_agencia: number;
    posts_aprovados_aguardando_publicacao: number;
    posts_publicar_hoje: number;
    campanhas_aguardando_revisao: number;
    mensagens_hoje: number;
    leads_novos_24h: number;
    whatsapp_desconectados: number;
    certificados_vencendo: number;
    recebido_mes: number;
    a_receber: number;
    vencido: number;
  };
  pendencias: {
    faturas_pendentes: any[];
    faturas_vencidas: any[];
    posts_revisao: any[];
    posts_publicar_hoje: any[];
    campanhas_revisao: any[];
    whatsapp_desconectados: any[];
    certificados_vencendo: any[];
  };
  alertas_empresas: any[];
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n); }

export function CentroOperacao() {
  const { setClienteAtivoId } = useTrafego();
  const [data, setData] = useState<OperacaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function carregar(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const r = await fetch('/api/agencia/operacao');
      const d = await r.json();
      setData(d);
    } finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => {
    carregar();
    // Auto-refresh a cada 60s
    const id = setInterval(() => carregar(true), 60000);
    return () => clearInterval(id);
  }, []);

  const r = data?.resumo;
  const totalPendencias = useMemo(() => {
    if (!r) return 0;
    return r.faturas_a_enviar + r.faturas_vencidas + r.posts_aguardando_revisao_agencia +
           r.campanhas_aguardando_revisao + r.whatsapp_desconectados + r.certificados_vencendo;
  }, [r]);

  function abrirCliente(clienteId: string, tabId?: string) {
    setClienteAtivoId(clienteId);
    if (tabId) {
      // Hack: força navegação setando hash que o App pode escutar
      window.location.hash = tabId;
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 px-6 py-6 text-white">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Centro de Operações</h1>
            <p className="text-sm text-white/80">
              Tudo que precisa da sua atenção hoje · {totalPendencias} pendências
            </p>
          </div>
          <button onClick={() => carregar(true)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg backdrop-blur disabled:opacity-50">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
      ) : r && (
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* KPIs financeiros */}
          <div className="grid grid-cols-3 gap-3">
            <CardKpi label="Recebido este mês" value={fmt(r.recebido_mes)} icon={DollarSign} color="emerald" />
            <CardKpi label="A receber" value={fmt(r.a_receber)} icon={Clock} color="amber" subtitle={`${r.faturas_a_enviar + r.faturas_pendentes_pagamento} faturas`} />
            <CardKpi label="Vencido" value={fmt(r.vencido)} icon={AlertTriangle} color={r.vencido > 0 ? 'red' : 'slate'} subtitle={`${r.faturas_vencidas} faturas vencidas`} />
          </div>

          {/* Pendências críticas */}
          {(r.faturas_vencidas > 0 || r.whatsapp_desconectados > 0 || r.certificados_vencendo > 0) && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <h2 className="font-bold text-red-900 flex items-center gap-2 mb-3"><ShieldAlert className="w-5 h-5" /> Atenção urgente</h2>
              <div className="space-y-2">
                {data!.pendencias.faturas_vencidas.map(f => (
                  <ItemPendencia
                    key={f.id} cor={f.trafego_clientes?.cor_destaque}
                    titulo={`Fatura vencida: ${f.trafego_clientes?.nome}`}
                    descricao={`${fmt(Number(f.valor_total))} · venceu em ${f.data_vencimento}`}
                    onClick={() => window.location.hash = 'faturas-agencia'}
                    icon={DollarSign}
                  />
                ))}
                {data!.pendencias.whatsapp_desconectados.map(w => (
                  <ItemPendencia
                    key={w.id} cor={w.trafego_clientes?.cor_destaque}
                    titulo={`WhatsApp desconectado: ${w.trafego_clientes?.nome}`}
                    descricao="Reconectar via QR code"
                    onClick={() => window.location.hash = 'whatsapp-agencia'}
                    icon={WifiOff}
                  />
                ))}
                {data!.pendencias.certificados_vencendo.map(c => (
                  <ItemPendencia
                    key={c.id} cor="#dc2626"
                    titulo={`Certificado A1 vencendo: ${c.nome}`}
                    descricao={`Validade até ${c.certificado_a1_validade} · renovar`}
                    onClick={() => window.location.hash = 'empresa-config'}
                    icon={AlertTriangle}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grid de ações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CardAcao
              titulo="Faturas a enviar pros clientes"
              count={r.faturas_a_enviar}
              icon={Send}
              color="blue"
              empty="Todas faturas enviadas"
              cta="Ver e enviar"
              onClick={() => window.location.hash = 'faturas-agencia'}
              items={data!.pendencias.faturas_pendentes.filter(f => f.status === 'pendente').slice(0, 3)}
              renderItem={(f: any) => `${f.trafego_clientes?.nome} · ${fmt(Number(f.valor_total))}`}
            />
            <CardAcao
              titulo="Posts aguardando minha revisão"
              count={r.posts_aguardando_revisao_agencia}
              icon={FileText}
              color="purple"
              empty="Sem posts em revisão"
              cta="Ver no calendário"
              onClick={() => window.location.hash = 'calendario'}
              items={data!.pendencias.posts_revisao.slice(0, 3)}
              renderItem={(p: any) => `${p.trafego_clientes?.nome} · ${p.titulo}`}
            />
            <CardAcao
              titulo="Campanhas aguardando aprovação"
              count={r.campanhas_aguardando_revisao}
              icon={Target}
              color="pink"
              empty="Sem campanhas pendentes"
              cta="Ver campanhas"
              onClick={() => window.location.hash = 'trafego-pago'}
              items={data!.pendencias.campanhas_revisao.slice(0, 3)}
              renderItem={(c: any) => `${c.trafego_clientes?.nome} · ${c.nome}`}
            />
            <CardAcao
              titulo="Posts a publicar hoje"
              count={r.posts_publicar_hoje}
              icon={Calendar}
              color="emerald"
              empty="Sem posts agendados hoje"
              cta="Ver agenda"
              onClick={() => window.location.hash = 'calendario'}
              items={data!.pendencias.posts_publicar_hoje.slice(0, 3)}
              renderItem={(p: any) => `${p.trafego_clientes?.nome} · ${p.titulo}`}
            />
            <CardAcao
              titulo="Mensagens novas hoje"
              count={r.mensagens_hoje}
              icon={MessageCircle}
              color="indigo"
              empty="Sem mensagens novas hoje"
              cta="Ver WhatsApp CRM"
              onClick={() => window.location.hash = 'leads'}
            />
            <CardAcao
              titulo="Leads novos nas últimas 24h"
              count={r.leads_novos_24h}
              icon={Users2}
              color="amber"
              empty="Sem leads novos"
              cta="Ver funil"
              onClick={() => window.location.hash = 'leads'}
            />
          </div>

          {/* Alertas por empresa */}
          {data!.alertas_empresas.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Bell className="w-5 h-5" /> Atividade das empresas (24h)</h2>
              <div className="space-y-2">
                {data!.alertas_empresas.map(e => (
                  <div key={e.id} onClick={() => abrirCliente(e.id)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <div className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: e.cor_destaque }}>
                      {e.nome.split(/\s+/).map((p: string) => p[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{e.nome}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        {e.mensagens_hoje > 0 && <span>📩 {e.mensagens_hoje} msgs hoje</span>}
                        {e.leads_24h > 0 && <span>👤 {e.leads_24h} leads novos</span>}
                        {e.wpp_desconectado && <span className="text-red-600">⚠️ WhatsApp desconectado</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalPendencias === 0 && r.mensagens_hoje === 0 && r.leads_novos_24h === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <h3 className="font-bold text-emerald-900">Tudo em dia! 🎉</h3>
              <p className="text-sm text-emerald-700 mt-1">Nada pendente no momento. Bom trabalho!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CardKpi({ label, value, icon: Icon, color, subtitle }: any) {
  const colors: any = {
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    slate: 'from-slate-400 to-slate-500',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          {subtitle && <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

function CardAcao({ titulo, count, icon: Icon, color, empty, cta, onClick, items, renderItem }: any) {
  const cores: any = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', btn: 'bg-blue-600 hover:bg-blue-700' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', btn: 'bg-purple-600 hover:bg-purple-700' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', btn: 'bg-pink-600 hover:bg-pink-700' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', btn: 'bg-indigo-600 hover:bg-indigo-700' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', btn: 'bg-amber-600 hover:bg-amber-700' },
  };
  const c = cores[color];
  return (
    <div className={`bg-white border-2 ${count > 0 ? c.border : 'border-slate-200'} rounded-xl p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${c.text}`} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">{titulo}</div>
            <div className={`text-2xl font-bold ${count > 0 ? c.text : 'text-slate-300'} leading-tight`}>{count}</div>
          </div>
        </div>
      </div>
      {count > 0 ? (
        <>
          {items && items.length > 0 && (
            <div className="space-y-1 mt-2">
              {items.map((it: any, i: number) => (
                <div key={i} className="text-xs text-slate-600 px-2 py-1 bg-slate-50 rounded truncate">
                  {renderItem(it)}
                </div>
              ))}
            </div>
          )}
          <button onClick={onClick} className={`mt-3 w-full text-xs font-semibold text-white px-3 py-1.5 rounded-lg ${c.btn}`}>
            {cta} →
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-400 italic mt-1">{empty}</p>
      )}
    </div>
  );
}

function ItemPendencia({ cor, titulo, descricao, onClick, icon: Icon }: any) {
  return (
    <div onClick={onClick}
      className="flex items-center gap-3 p-2 bg-white rounded-lg hover:bg-red-100/40 cursor-pointer border border-red-100">
      <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: cor || '#dc2626' }}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{titulo}</div>
        <div className="text-xs text-slate-500 truncate">{descricao}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400" />
    </div>
  );
}

export default CentroOperacao;
