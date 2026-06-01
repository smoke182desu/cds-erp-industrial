// src/pages/Agencia.tsx — Dashboard consolidado de TODAS as empresas atendidas

import { useEffect, useState, useMemo } from 'react';
import {
  Building2, Plus, TrendingUp, Plug, BarChart3, Users2, Search, AlertCircle,
  CheckCircle2, Loader2, ArrowRight, X, ChevronRight, DollarSign, MessageCircle,
  Target, Briefcase, Calendar, Phone, Mail, ExternalLink, ShoppingBag,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';
import {
  TrafegoCliente, TrafegoClienteInput, criarCliente,
} from '../services/trafegoService';
import { WizardConectarLoja } from '../components/WizardConectarLoja';

interface StatsEmpresa {
  id: string;
  nome: string;
  slug: string;
  cor: string;
  fee_mensal: number;
  status: string;
  responsavel?: string;
  leads: { total: number; pipeline: number; ganhos: number; perdidos: number; ativos: number };
  campanhas: { total: number; publicadas: number; gasto_diario: number };
  contas_conectadas: number;
  propostas: { total: number; pendentes: number; aprovadas: number; valor_total: number };
  mensagens_7d: number;
}

interface WcLojaResumo {
  id: string;
  cliente_agencia_id: string;
  nome: string;
  url?: string;
  consumer_key?: string;
  consumer_secret?: string;
  webhook_token?: string;
  status_conexao?: string;
  ativo?: boolean;
}

interface Stats {
  total: {
    empresas: number;
    mrr: number;
    leads_total: number;
    leads_ganhos: number;
    pipeline_total: number;
    campanhas_total: number;
    campanhas_publicadas: number;
    gasto_diario_total: number;
    contas_conectadas_total: number;
    mensagens_7d_total: number;
    propostas_valor: number;
  };
  empresas: StatsEmpresa[];
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function iniciais(nome: string) {
  return nome.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Agencia() {
  const { clientes, clienteAtivo, setClienteAtivoId, recarregar } = useTrafego();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [wizardAberto, setWizardAberto] = useState(false);
  const [lojas, setLojas] = useState<WcLojaResumo[]>([]);
  const [lojaConectar, setLojaConectar] = useState<{ loja: WcLojaResumo; empresaNome: string } | null>(null);

  async function carregar() {
    try {
      setLoading(true);
      const [r1, r2] = await Promise.all([
        fetch('/api/agencia/stats').then(r => r.json()),
        fetch('/api/wc-lojas').then(r => r.ok ? r.json() : []),
      ]);
      setStats(r1);
      setLojas(Array.isArray(r2) ? r2 : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, [clientes.length]);

  const empresasVisiveis = useMemo(() => {
    if (!stats) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return stats.empresas;
    return stats.empresas.filter(e => e.nome.toLowerCase().includes(q));
  }, [stats, busca]);

  const t = stats?.total;

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-pink-600 px-6 py-6 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Dashboard da Agência</h1>
              <p className="text-sm text-white/80">
                {t ? `${t.empresas} empresas atendidas · MRR ${fmtBRL(t.mrr)}` : 'Carregando...'}
              </p>
            </div>
            <button onClick={() => setWizardAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-white text-violet-700 hover:bg-violet-50 text-sm font-semibold rounded-lg shadow">
              <Plus className="w-4 h-4" /> Nova empresa
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
      ) : t && (
        <>
          {/* KPIs grandes */}
          <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiBig label="MRR Mensal" value={fmtBRL(t.mrr)} icon={DollarSign} color="emerald" />
            <KpiBig label="Pipeline" value={fmtBRL(t.pipeline_total)} icon={Briefcase} color="blue" />
            <KpiBig label="Leads ativos" value={t.leads_total} icon={Users2} color="indigo" />
            <KpiBig label="Gasto Ads/dia" value={fmtBRL(t.gasto_diario_total)} icon={Target} color="pink" />
          </div>

          {/* Stats menores */}
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiMini label="Empresas ativas" value={t.empresas} icon={Building2} />
            <KpiMini label="Campanhas publicadas" value={`${t.campanhas_publicadas}/${t.campanhas_total}`} icon={Target} />
            <KpiMini label="Contas conectadas" value={t.contas_conectadas_total} icon={Plug} />
            <KpiMini label="Mensagens 7d" value={t.mensagens_7d_total} icon={MessageCircle} />
            <KpiMini label="Leads ganhos" value={t.leads_ganhos} icon={CheckCircle2} />
          </div>

          {/* Lista de empresas com cards expandidos */}
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text" value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar empresa..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <span className="text-sm text-slate-500">{empresasVisiveis.length} empresas</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {empresasVisiveis.map(e => (
                <CardEmpresaCompleta
                  key={e.id} stats={e}
                  ativo={clienteAtivo?.id === e.id}
                  loja={lojas.find(l => l.cliente_agencia_id === e.id)}
                  onSelecionar={() => setClienteAtivoId(e.id)}
                  onConectarLoja={(loja) => setLojaConectar({ loja, empresaNome: e.nome })}
                />
              ))}
            </div>

            {empresasVisiveis.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">
                  {busca ? 'Nenhuma empresa encontrada.' : 'Sem empresas cadastradas.'}
                </p>
                {!busca && (
                  <button onClick={() => setWizardAberto(true)} className="text-sm font-semibold text-violet-600 hover:underline">
                    Cadastrar a primeira →
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {wizardAberto && (
        <WizardNovaEmpresa
          onClose={() => setWizardAberto(false)}
          onCriado={c => {
            setWizardAberto(false);
            recarregar();
            setClienteAtivoId(c.id);
            carregar();
          }}
        />
      )}

      {lojaConectar && (
        <WizardConectarLoja
          loja={lojaConectar.loja}
          empresaNome={lojaConectar.empresaNome}
          onClose={() => { setLojaConectar(null); carregar(); }}
          onSucesso={() => { setLojaConectar(null); carregar(); }}
        />
      )}
    </div>
  );
}

function KpiBig({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  const colors: any = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    indigo: 'from-indigo-500 to-indigo-600',
    pink: 'from-pink-500 to-pink-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  );
}

function KpiMini({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2">
      <Icon className="w-4 h-4 text-slate-400" />
      <div>
        <div className="text-lg font-bold text-slate-800 leading-none">{value}</div>
        <div className="text-[10px] text-slate-500 uppercase mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function CardEmpresaCompleta({ stats, ativo, loja, onSelecionar, onConectarLoja }: {
  stats: StatsEmpresa;
  ativo: boolean;
  loja?: WcLojaResumo;
  onSelecionar: () => void;
  onConectarLoja: (loja: WcLojaResumo) => void;
}) {
  const lojaConectada = loja && loja.consumer_key && loja.url && loja.ativo;
  const lojaStub = loja && (!loja.consumer_key || !loja.url || !loja.ativo);
  return (
    <div onClick={onSelecionar}
      className={`bg-white rounded-2xl border-2 transition cursor-pointer hover:shadow-md ${
        ativo ? 'border-violet-500 shadow-md' : 'border-slate-200 hover:border-slate-300'
      }`}>
      <div className="p-4 flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
          style={{ backgroundColor: stats.cor }}>
          {iniciais(stats.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-slate-900 truncate">{stats.nome}</h3>
            {ativo && <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />}
          </div>
          <p className="text-xs text-slate-500 truncate">
            {stats.responsavel || 'sem responsável'} {stats.fee_mensal > 0 && `· ${fmtBRL(stats.fee_mensal)}/mês`}
          </p>
          {loja && (
            <div className="mt-1 flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 text-slate-400" />
              {lojaConectada ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">WC conectado</span>
              ) : (
                <button
                  onClick={(ev) => { ev.stopPropagation(); onConectarLoja(loja!); }}
                  className="text-[10px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 px-1.5 py-0.5 rounded"
                >
                  Conectar Loja WC
                </button>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </div>

      <div className="grid grid-cols-4 border-t border-slate-100 text-center">
        <Cell icon={Users2} label="Leads" value={stats.leads.total} sub={stats.leads.ganhos > 0 ? `${stats.leads.ganhos} ganhos` : ''} />
        <Cell icon={Target} label="Campanhas" value={stats.campanhas.total} sub={stats.campanhas.publicadas > 0 ? `${stats.campanhas.publicadas} ativas` : ''} divider />
        <Cell icon={Plug} label="Contas" value={stats.contas_conectadas} divider />
        <Cell icon={MessageCircle} label="Msgs 7d" value={stats.mensagens_7d} divider />
      </div>

      {stats.leads.pipeline > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between text-xs">
          <span className="text-slate-500">Pipeline</span>
          <span className="font-semibold text-emerald-700">{fmtBRL(stats.leads.pipeline)}</span>
        </div>
      )}
    </div>
  );
}

function Cell({ icon: Icon, label, value, sub, divider }: any) {
  return (
    <div className={`px-2 py-2 ${divider ? 'border-l border-slate-100' : ''}`}>
      <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
      <div className="text-base font-bold text-slate-900 leading-none">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">{sub}</div>}
    </div>
  );
}

// === Wizard nova empresa (igual ao anterior, mantido) ===
const CORES_SUGERIDAS = ['#dc2626','#ea580c','#d97706','#65a30d','#16a34a','#0891b2','#2563eb','#6366f1','#9333ea','#db2777'];

function WizardNovaEmpresa({ onClose, onCriado }: { onClose: () => void; onCriado: (c: TrafegoCliente) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<TrafegoClienteInput>({
    nome: '', slug: '', cor_destaque: '#6366f1', status: 'ativo', fee_mensal: 0,
    responsavel: '', email_contato: '', telefone_contato: '', observacoes: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function criar() {
    if (!form.nome?.trim()) { setErro('Nome é obrigatório'); return; }
    setSalvando(true); setErro('');
    try { onCriado(await criarCliente(form)); }
    catch (e: any) { setErro(e?.message || 'erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Nova empresa</h3>
            <p className="text-xs text-slate-500 mt-0.5">Passo {step} de 3</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pt-3"><div className="flex gap-2">{[1,2,3].map(n => <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-violet-500' : 'bg-slate-200'}`} />)}</div></div>
        <div className="p-6 space-y-4 min-h-[300px]">
          {step === 1 && <>
            <h4 className="font-semibold text-slate-800">Identificação</h4>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Nome da empresa *</label>
              <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="ex: Padaria do João" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Cor</label>
              <div className="flex gap-2 flex-wrap">{CORES_SUGERIDAS.map(c => (
                <button key={c} type="button" onClick={() => setForm({...form, cor_destaque: c})} className={`w-8 h-8 rounded-lg border-2 ${form.cor_destaque === c ? 'border-slate-800' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}</div>
            </div>
          </>}
          {step === 2 && <>
            <h4 className="font-semibold text-slate-800">Contato</h4>
            <div><label className="text-xs font-semibold text-slate-700 mb-1 block">Responsável</label><input value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></div>
            <div><label className="text-xs font-semibold text-slate-700 mb-1 block">E-mail</label><input type="email" value={form.email_contato} onChange={e => setForm({...form, email_contato: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></div>
            <div><label className="text-xs font-semibold text-slate-700 mb-1 block">Telefone/WhatsApp</label><input type="tel" value={form.telefone_contato} onChange={e => setForm({...form, telefone_contato: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></div>
            <div><label className="text-xs font-semibold text-slate-700 mb-1 block">Fee mensal (R$)</label><input type="number" step="0.01" value={form.fee_mensal || ''} onChange={e => setForm({...form, fee_mensal: Number(e.target.value) || 0})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></div>
          </>}
          {step === 3 && <>
            <h4 className="font-semibold text-slate-800">Revisar</h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: form.cor_destaque }}>{iniciais(form.nome || '?')}</div>
                <div><div className="font-semibold text-slate-900">{form.nome}</div>{form.responsavel && <div className="text-xs text-slate-500">{form.responsavel}</div>}</div>
              </div>
              {form.email_contato && <div className="text-xs text-slate-600">📧 {form.email_contato}</div>}
              {form.telefone_contato && <div className="text-xs text-slate-600">📱 {form.telefone_contato}</div>}
              {form.fee_mensal && form.fee_mensal > 0 && <div className="text-xs text-slate-600">💰 {fmtBRL(form.fee_mensal)}/mês</div>}
            </div>
            {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">{erro}</div>}
          </>}
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-between">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">{step === 1 ? 'Cancelar' : 'Voltar'}</button>
          {step < 3 ? <button onClick={() => setStep(step + 1)} disabled={!form.nome?.trim()} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">Próximo <ArrowRight className="w-4 h-4" /></button>
          : <button onClick={criar} disabled={salvando || !form.nome?.trim()} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">{salvando && <Loader2 className="w-4 h-4 animate-spin" />} Criar empresa</button>}
        </div>
      </div>
    </div>
  );
}

export default Agencia;
