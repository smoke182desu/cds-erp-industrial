// src/pages/Agencia.tsx — Visão geral de TODAS as empresas (clientes da agência)
// Card por empresa com KPIs resumidos, atalho pra trocar, e wizard de criar nova.

import { useEffect, useState, useMemo } from 'react';
import {
  Building2, Plus, TrendingUp, Plug, BarChart3, Users2, Search, AlertCircle,
  CheckCircle2, Loader2, ArrowRight, X, ChevronRight
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';
import {
  TrafegoCliente, TrafegoClienteInput, listarClientes, criarCliente,
} from '../services/trafegoService';

interface Stats {
  contas: number;
  campanhas: number;
  leads: number;
  posts: number;
}

interface CardEmpresaProps {
  cliente: TrafegoCliente;
  stats?: Stats;
  ativo: boolean;
  onSelecionar: () => void;
}

function CardEmpresa({ cliente, stats, ativo, onSelecionar }: CardEmpresaProps) {
  const iniciais = cliente.nome.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const cor = cliente.cor_destaque || '#6366f1';

  return (
    <div
      onClick={onSelecionar}
      className={`bg-white rounded-2xl border-2 transition cursor-pointer hover:shadow-lg ${
        ativo ? 'border-violet-500 shadow-md' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="p-4 flex items-start gap-3">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: cor }}
        >
          {iniciais}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-slate-900 truncate">{cliente.nome}</h3>
            {ativo && <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />}
          </div>
          <p className="text-xs text-slate-500 truncate">
            {cliente.responsavel || 'sem responsável'} {cliente.email_contato && `· ${cliente.email_contato}`}
          </p>
          <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
            cliente.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' :
            cliente.status === 'pausado' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-200 text-slate-600'
          }`}>
            {cliente.status}
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </div>

      {stats && (
        <div className="grid grid-cols-4 border-t border-slate-100">
          <KPI icon={Plug} label="Contas" value={stats.contas} />
          <KPI icon={TrendingUp} label="Campanhas" value={stats.campanhas} divider />
          <KPI icon={Users2} label="Leads" value={stats.leads} divider />
          <KPI icon={BarChart3} label="Posts" value={stats.posts} divider />
        </div>
      )}

      {cliente.fee_mensal != null && cliente.fee_mensal > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between text-xs">
          <span className="text-slate-500">Fee mensal</span>
          <span className="font-semibold text-slate-700">R$ {Number(cliente.fee_mensal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, divider }: { icon: any; label: string; value: number; divider?: boolean }) {
  return (
    <div className={`px-2 py-2 text-center ${divider ? 'border-l border-slate-100' : ''}`}>
      <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
      <div className="text-base font-bold text-slate-900 leading-none">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// === Wizard de cadastro de empresa nova (multi-step) ===

const CORES_SUGERIDAS = ['#dc2626','#ea580c','#d97706','#65a30d','#16a34a','#0891b2','#2563eb','#6366f1','#9333ea','#db2777'];

interface WizardProps {
  onClose: () => void;
  onCriado: (cliente: TrafegoCliente) => void;
}

function WizardNovaEmpresa({ onClose, onCriado }: WizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<TrafegoClienteInput>({
    nome: '', slug: '', cor_destaque: '#6366f1', status: 'ativo',
    fee_mensal: 0, responsavel: '', email_contato: '', telefone_contato: '', observacoes: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const podeAvancar = useMemo(() => {
    if (step === 1) return !!form.nome?.trim();
    if (step === 2) return true;
    if (step === 3) return true;
    return false;
  }, [step, form]);

  async function criar() {
    if (!form.nome?.trim()) { setErro('Nome é obrigatório'); return; }
    setSalvando(true); setErro('');
    try {
      const c = await criarCliente(form);
      onCriado(c);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao criar empresa');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Nova empresa</h3>
            <p className="text-xs text-slate-500 mt-0.5">Passo {step} de 4</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* progress */}
        <div className="px-6 pt-3">
          <div className="flex gap-2">
            {[1,2,3,4].map(n => (
              <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-violet-500' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4 min-h-[300px]">
          {step === 1 && (
            <>
              <h4 className="font-semibold text-slate-800">Identificação</h4>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Nome da empresa *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm({...form, nome: e.target.value})}
                  placeholder="ex: Padaria do João"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Slug (opcional, gera automaticamente)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm({...form, slug: e.target.value})}
                  placeholder="padaria-do-joao"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Cor de destaque</label>
                <div className="flex gap-2 flex-wrap">
                  {CORES_SUGERIDAS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({...form, cor_destaque: c})}
                      className={`w-8 h-8 rounded-lg border-2 ${form.cor_destaque === c ? 'border-slate-800' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h4 className="font-semibold text-slate-800">Responsável e contato</h4>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Responsável (quem cuida)</label>
                <input
                  type="text"
                  value={form.responsavel}
                  onChange={e => setForm({...form, responsavel: e.target.value})}
                  placeholder="ex: Tuany"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">E-mail de contato</label>
                <input
                  type="email"
                  value={form.email_contato}
                  onChange={e => setForm({...form, email_contato: e.target.value})}
                  placeholder="contato@empresa.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={form.telefone_contato}
                  onChange={e => setForm({...form, telefone_contato: e.target.value})}
                  placeholder="+55 11 99999-9999"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Fee mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.fee_mensal || ''}
                  onChange={e => setForm({...form, fee_mensal: Number(e.target.value) || 0})}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h4 className="font-semibold text-slate-800">Próximos passos sugeridos</h4>
              <p className="text-xs text-slate-500">Após criar, você poderá:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Plug className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                  <span>Conectar contas de <strong>Meta Ads, Google Ads, GA4, Search Console, TikTok</strong> e mais 14 plataformas em <em>Tráfego Pago → Contas</em></span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                  <span>Criar <strong>campanhas multi-canal</strong> isoladas por empresa em <em>Marketing IA</em></span>
                </li>
                <li className="flex items-start gap-2">
                  <Users2 className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                  <span>Importar <strong>leads e mensagens WhatsApp</strong> dessa empresa (CRM segregado)</span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                  <span>Ver <strong>analytics consolidado</strong> (em construção - Sprint 5)</span>
                </li>
              </ul>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block mt-3">Observações (opcional)</label>
                <textarea
                  value={form.observacoes}
                  onChange={e => setForm({...form, observacoes: e.target.value})}
                  placeholder="Notas, briefing, contrato, segmento..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h4 className="font-semibold text-slate-800">Revisar e criar</h4>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: form.cor_destaque }}
                  >
                    {form.nome.split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{form.nome}</div>
                    {form.responsavel && <div className="text-xs text-slate-500">{form.responsavel}</div>}
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-2 space-y-1 text-xs text-slate-600">
                  {form.email_contato && <div>📧 {form.email_contato}</div>}
                  {form.telefone_contato && <div>📱 {form.telefone_contato}</div>}
                  {form.fee_mensal && form.fee_mensal > 0 && (
                    <div>💰 Fee: R$ {Number(form.fee_mensal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês</div>
                  )}
                </div>
              </div>
              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {erro}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!podeAvancar}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={criar}
              disabled={salvando || !form.nome?.trim()}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar empresa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// === Página principal Agência ===

export function Agencia() {
  const { clientes, clienteAtivo, setClienteAtivoId, loading, recarregar } = useTrafego();
  const [busca, setBusca] = useState('');
  const [wizardAberto, setWizardAberto] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<string, Stats>>({});

  // Carrega stats por cliente em paralelo (fire-and-forget)
  useEffect(() => {
    if (!clientes.length) return;
    clientes.forEach(async c => {
      try {
        const [contasRes, campsRes, leadsRes, postsRes] = await Promise.all([
          fetch(`/api/trafego/contas?cliente_id=${c.id}`).then(r => r.ok ? r.json() : []),
          fetch(`/api/campaigns?cliente_id=${c.id}`).then(r => r.ok ? r.json() : []),
          fetch(`/api/leads?cliente_agencia_id=${c.id}`).then(r => r.ok ? r.json() : []),
          fetch(`/api/data?resource=extension-posts&cliente_id=${c.id}`).then(r => r.ok ? r.json() : []),
        ]);
        setStatsMap(prev => ({
          ...prev,
          [c.id]: {
            contas: Array.isArray(contasRes) ? contasRes.length : 0,
            campanhas: Array.isArray(campsRes) ? campsRes.length : 0,
            leads: Array.isArray(leadsRes) ? leadsRes.length : (leadsRes?.leads?.length || 0),
            posts: Array.isArray(postsRes) ? postsRes.length : (postsRes?.posts?.length || 0),
          },
        }));
      } catch {/* ignore */}
    });
  }, [clientes]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(c =>
      [c.nome, c.responsavel, c.email_contato].some(v => String(v || '').toLowerCase().includes(q))
    );
  }, [clientes, busca]);

  const totais = useMemo(() => {
    const s = { contas: 0, campanhas: 0, leads: 0, posts: 0, fee: 0 };
    clientes.forEach(c => {
      const st = statsMap[c.id];
      if (st) {
        s.contas += st.contas;
        s.campanhas += st.campanhas;
        s.leads += st.leads;
        s.posts += st.posts;
      }
      if (c.fee_mensal) s.fee += Number(c.fee_mensal);
    });
    return s;
  }, [clientes, statsMap]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Agência</h1>
            <p className="text-sm text-slate-500">
              {clientes.length} {clientes.length === 1 ? 'empresa atendida' : 'empresas atendidas'}
              {totais.fee > 0 && ` · MRR R$ ${totais.fee.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
            </p>
          </div>
          <button
            onClick={() => setWizardAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova empresa
          </button>
        </div>
      </div>

      {/* KPIs agregados */}
      {clientes.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICardGrande icon={Plug} label="Contas conectadas" value={totais.contas} />
          <KPICardGrande icon={TrendingUp} label="Campanhas ativas" value={totais.campanhas} />
          <KPICardGrande icon={Users2} label="Total de leads" value={totais.leads} />
          <KPICardGrande icon={BarChart3} label="Posts" value={totais.posts} />
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        {/* Busca */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar empresa..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
          />
        </div>

        {/* Grid de cards */}
        {loading && clientes.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Carregando empresas...
          </div>
        ) : visiveis.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 mb-3">
              {busca ? 'Nenhuma empresa encontrada.' : 'Sem empresas cadastradas ainda.'}
            </p>
            {!busca && (
              <button onClick={() => setWizardAberto(true)} className="text-sm font-semibold text-violet-600 hover:underline">
                Cadastrar a primeira →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visiveis.map(c => (
              <CardEmpresa
                key={c.id}
                cliente={c}
                stats={statsMap[c.id]}
                ativo={clienteAtivo?.id === c.id}
                onSelecionar={() => setClienteAtivoId(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {wizardAberto && (
        <WizardNovaEmpresa
          onClose={() => setWizardAberto(false)}
          onCriado={c => {
            setWizardAberto(false);
            recarregar();
            setClienteAtivoId(c.id);
          }}
        />
      )}
    </div>
  );
}

function KPICardGrande({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-violet-600" />
      </div>
      <div>
        <div className="text-xl font-bold text-slate-900 leading-none">{value}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export default Agencia;
