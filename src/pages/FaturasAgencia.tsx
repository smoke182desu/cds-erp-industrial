// src/pages/FaturasAgencia.tsx
import { useEffect, useState, useMemo } from 'react';
import {
  Receipt, DollarSign, Loader2, Plus, CheckCircle2, X, Calendar, AlertCircle,
  ExternalLink, Filter, FileText, Send, Trash2,
} from 'lucide-react';

interface Fatura {
  id: string;
  cliente_agencia_id: string;
  competencia: string;
  data_emissao: string;
  data_vencimento?: string;
  valor_fee: number;
  valor_extras: number;
  valor_total: number;
  descricao?: string;
  status: 'pendente' | 'enviada' | 'paga' | 'vencida' | 'cancelada';
  forma_pagamento?: string;
  data_pagamento?: string;
  link_pagamento?: string;
  observacoes?: string;
  numero_fatura?: string;
  trafego_clientes?: {
    id: string;
    nome: string;
    slug: string;
    cor_destaque?: string;
    responsavel?: string;
  };
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n); }
function fmtMes(s: string) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
function fmtData(s?: string) { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('pt-BR'); }

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  pendente:  { color: 'bg-amber-100 text-amber-800',   label: 'Pendente' },
  enviada:   { color: 'bg-blue-100 text-blue-800',     label: 'Enviada' },
  paga:      { color: 'bg-emerald-100 text-emerald-800', label: 'Paga' },
  vencida:   { color: 'bg-red-100 text-red-800',       label: 'Vencida' },
  cancelada: { color: 'bg-slate-200 text-slate-500',   label: 'Cancelada' },
};

export function FaturasAgencia() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [gerando, setGerando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch('/api/faturas');
      const data = await r.json();
      setFaturas(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, []);

  function show(tipo: 'ok' | 'erro', msg: string) {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function gerarFaturasDoMes() {
    setGerando(true);
    try {
      const r = await fetch('/api/faturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'gerar_mes' }) });
      const d = await r.json();
      const novas = (d.resultado || []).filter((x: any) => x.criada).length;
      show('ok', `${novas} faturas geradas`);
      carregar();
    } catch (e: any) { show('erro', e?.message || 'erro'); }
    finally { setGerando(false); }
  }

  async function atualizarStatus(id: string, status: string) {
    await fetch(`/api/faturas?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    carregar();
  }
  async function remover(id: string) {
    if (!confirm('Remover fatura?')) return;
    await fetch(`/api/faturas?id=${id}`, { method: 'DELETE' });
    carregar();
  }

  function copyLinkPix(f: Fatura) {
    const empresa = f.trafego_clientes;
    const valor = fmt(f.valor_total);
    const msg = `Olá ${empresa?.responsavel || ''}!\n\nSegue a fatura referente a ${fmtMes(f.competencia)}:\n\n📄 ${f.descricao || 'Serviços de marketing'}\n💰 ${valor}\n📅 Vencimento: ${fmtData(f.data_vencimento)}\n\nQualquer dúvida, estou à disposição!`;
    navigator.clipboard.writeText(msg);
    show('ok', 'Mensagem copiada — cole no WhatsApp da empresa');
  }

  const visiveis = useMemo(() => {
    if (filtroStatus === 'todos') return faturas;
    return faturas.filter(f => f.status === filtroStatus);
  }, [faturas, filtroStatus]);

  const totais = useMemo(() => ({
    pendente: faturas.filter(f => f.status === 'pendente' || f.status === 'enviada').reduce((s, f) => s + Number(f.valor_total), 0),
    pago: faturas.filter(f => f.status === 'paga').reduce((s, f) => s + Number(f.valor_total), 0),
    vencido: faturas.filter(f => f.status === 'vencida').reduce((s, f) => s + Number(f.valor_total), 0),
    count: faturas.length,
  }), [faturas]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Receipt className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Faturas da Agência</h1>
            <p className="text-sm text-slate-500">Cobranças mensais das empresas atendidas</p>
          </div>
          <button onClick={gerarFaturasDoMes} disabled={gerando}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50">
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Gerar faturas do mês
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="max-w-6xl mx-auto px-6 pt-6 grid grid-cols-3 gap-3">
        <KpiCard label="Pendente/Enviada" value={fmt(totais.pendente)} color="amber" />
        <KpiCard label="Pago" value={fmt(totais.pago)} color="emerald" />
        <KpiCard label="Vencido" value={fmt(totais.vencido)} color="red" />
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {feedback && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
            feedback.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedback.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {feedback.msg}
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400 mt-2" />
          {['todos','pendente','enviada','paga','vencida'].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${
                filtroStatus === s ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}>{s}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
        ) : visiveis.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">Sem faturas {filtroStatus !== 'todos' ? `com status "${filtroStatus}"` : 'ainda'}</p>
            <button onClick={gerarFaturasDoMes} className="text-sm font-semibold text-emerald-600 hover:underline">
              Gerar faturas deste mês →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {visiveis.map(f => {
              const cli = f.trafego_clientes;
              return (
                <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: cli?.cor_destaque || '#6366f1' }}>
                      {(cli?.nome || '?').split(/\s+/).map(p => p[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-bold text-slate-900 truncate">{cli?.nome}</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_CFG[f.status]?.color}`}>
                          {STATUS_CFG[f.status]?.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Competência: <strong>{fmtMes(f.competencia)}</strong>
                        {f.data_vencimento && ` · Vence ${fmtData(f.data_vencimento)}`}
                        {f.data_pagamento && ` · Pago em ${fmtData(f.data_pagamento)}`}
                      </p>
                      {f.descricao && <p className="text-xs text-slate-600 mt-0.5">{f.descricao}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-slate-900">{fmt(Number(f.valor_total))}</div>
                      {f.valor_extras > 0 && (
                        <div className="text-[10px] text-slate-500">+ {fmt(Number(f.valor_extras))} extras</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 flex-wrap">
                    {f.status === 'pendente' && (
                      <button onClick={() => atualizarStatus(f.id, 'enviada')}
                        className="text-xs font-semibold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                        <Send className="w-3 h-3" /> Marcar como enviada
                      </button>
                    )}
                    {f.status !== 'paga' && f.status !== 'cancelada' && (
                      <button onClick={() => atualizarStatus(f.id, 'paga')}
                        className="text-xs font-semibold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Marcar pago
                      </button>
                    )}
                    <button onClick={() => copyLinkPix(f)}
                      className="text-xs font-semibold px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Copiar mensagem WhatsApp
                    </button>
                    <button onClick={() => remover(f.id)}
                      className="text-xs px-2 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: any) {
  const colors: any = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default FaturasAgencia;
