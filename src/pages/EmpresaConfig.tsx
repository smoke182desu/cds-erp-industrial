// src/pages/EmpresaConfig.tsx — Configurações fiscais, numerações e bancárias por empresa
import { useEffect, useState, useCallback } from 'react';
import {
  Building2, Save, Loader2, AlertCircle, CheckCircle2, FileText, Hash, Banknote,
  ScrollText, MapPin, Globe,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';
import { AgenciaContextoBanner } from '../components/AgenciaContextoBanner';

type Aba = 'fiscal' | 'endereco' | 'numeracoes' | 'banco';

interface Empresa {
  id: string;
  cnpj?: string; cpf?: string; tipo_pessoa?: string;
  razao_social?: string; nome_fantasia?: string;
  inscricao_estadual?: string; inscricao_municipal?: string;
  regime_tributario?: string; cnae_principal?: string;

  endereco_logradouro?: string; endereco_numero?: string; endereco_complemento?: string;
  endereco_bairro?: string; endereco_cidade?: string; endereco_uf?: string; endereco_cep?: string;

  emite_nfe?: boolean; ambiente_nfe?: string;
  certificado_a1_path?: string; certificado_a1_validade?: string;
  proxima_serie_nfe?: number;

  banco_nome?: string; banco_agencia?: string; banco_conta?: string; banco_pix?: string;
}

interface Sequencia {
  cliente_agencia_id: string;
  tipo: string;
  prefixo: string;
  proximo_numero: number;
  formato: string;
  resetar_anualmente?: boolean;
  ano_atual?: number;
}

const ABAS: { id: Aba; label: string; icon: any }[] = [
  { id: 'fiscal',      label: 'Fiscal',       icon: FileText },
  { id: 'endereco',    label: 'Endereço',     icon: MapPin },
  { id: 'numeracoes',  label: 'Numerações',   icon: Hash },
  { id: 'banco',       label: 'Bancário/PIX', icon: Banknote },
];

const TIPOS_DOC = [
  { id: 'proposta', label: 'Propostas' },
  { id: 'pedido', label: 'Pedidos de venda' },
  { id: 'os', label: 'Ordens de serviço' },
  { id: 'pedido_compra', label: 'Pedidos de compra' },
  { id: 'nfe', label: 'NFe' },
  { id: 'nfse', label: 'NFSe' },
  { id: 'fatura', label: 'Faturas' },
  { id: 'contrato', label: 'Contratos' },
  { id: 'recibo', label: 'Recibos' },
];

export function EmpresaConfig() {
  const { clienteAtivo } = useTrafego();
  const [aba, setAba] = useState<Aba>('fiscal');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [sequencias, setSequencias] = useState<Sequencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{tipo: 'ok' | 'erro'; msg: string} | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteAtivo) return;
    setLoading(true);
    try {
      const [e, s] = await Promise.all([
        fetch(`/api/trafego/clientes`).then(r => r.json()),
        fetch(`/api/sequencias/listar?cliente_agencia_id=${clienteAtivo.id}`).then(r => r.json()),
      ]);
      const cli = (e?.clientes || e || []).find((c: any) => c.id === clienteAtivo.id);
      setEmpresa(cli || { id: clienteAtivo.id });
      setSequencias(Array.isArray(s) ? s : []);
    } finally { setLoading(false); }
  }, [clienteAtivo?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  function showMsg(tipo: 'ok' | 'erro', msg: string) {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function salvarEmpresa(patch: Partial<Empresa>) {
    if (!clienteAtivo || !empresa) return;
    setSalvando(true);
    try {
      const r = await fetch(`/api/trafego/clientes?id=${clienteAtivo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error('erro');
      const upd = await r.json();
      setEmpresa(upd?.cliente || upd?.[0] || upd);
      showMsg('ok', 'Salvo com sucesso');
    } catch (e: any) { showMsg('erro', e?.message || 'erro'); }
    finally { setSalvando(false); }
  }

  async function salvarSequencia(seq: Partial<Sequencia> & { tipo: string }) {
    if (!clienteAtivo) return;
    try {
      await fetch('/api/sequencias/listar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_agencia_id: clienteAtivo.id, ...seq }),
      });
      carregar();
      showMsg('ok', 'Numeração salva');
    } catch (e: any) { showMsg('erro', e?.message || 'erro'); }
  }

  if (!clienteAtivo) {
    return (
      <div className="h-full bg-slate-50 p-6">
        <div className="max-w-3xl mx-auto">
          <AgenciaContextoBanner contexto="configurações" />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 flex items-center gap-2 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4" /> Selecione uma empresa no banner.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Configurações da empresa</h1>
            <p className="text-sm text-slate-500">Fiscal, numerações e dados bancários de <strong>{clienteAtivo.nome}</strong></p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-4 flex gap-1 border-b border-slate-200">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold ${
                aba === id ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {feedback && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
            feedback.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedback.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {feedback.msg}
          </div>
        )}

        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto my-12" />
          : aba === 'fiscal' ? <FiscalForm empresa={empresa!} onSalvar={salvarEmpresa} salvando={salvando} />
          : aba === 'endereco' ? <EnderecoForm empresa={empresa!} onSalvar={salvarEmpresa} salvando={salvando} />
          : aba === 'numeracoes' ? <NumeracoesForm sequencias={sequencias} onSalvar={salvarSequencia} />
          : <BancoForm empresa={empresa!} onSalvar={salvarEmpresa} salvando={salvando} />
        }
      </div>
    </div>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function FiscalForm({ empresa, onSalvar, salvando }: any) {
  const [f, setF] = useState<any>(empresa);
  useEffect(() => setF(empresa), [empresa]);
  function up(k: string, v: any) { setF({...f, [k]: v}); }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Tipo">
          <select value={f.tipo_pessoa || 'PJ'} onChange={e => up('tipo_pessoa', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            <option value="PJ">Pessoa Jurídica</option>
            <option value="MEI">MEI</option>
            <option value="PF">Pessoa Física</option>
          </select>
        </Field>
        <Field label="CNPJ">
          <input value={f.cnpj || ''} onChange={e => up('cnpj', e.target.value)} placeholder="00.000.000/0000-00" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
        </Field>
        <Field label="CPF (se PF)">
          <input value={f.cpf || ''} onChange={e => up('cpf', e.target.value)} placeholder="000.000.000-00" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Razão Social">
          <input value={f.razao_social || ''} onChange={e => up('razao_social', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </Field>
        <Field label="Nome Fantasia">
          <input value={f.nome_fantasia || ''} onChange={e => up('nome_fantasia', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Inscrição Estadual">
          <input value={f.inscricao_estadual || ''} onChange={e => up('inscricao_estadual', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
        </Field>
        <Field label="Inscrição Municipal">
          <input value={f.inscricao_municipal || ''} onChange={e => up('inscricao_municipal', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
        </Field>
        <Field label="CNAE Principal">
          <input value={f.cnae_principal || ''} onChange={e => up('cnae_principal', e.target.value)} placeholder="00.00-0-00" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
        </Field>
      </div>
      <Field label="Regime Tributário">
        <select value={f.regime_tributario || ''} onChange={e => up('regime_tributario', e.target.value || null)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
          <option value="">— selecione —</option>
          <option value="simples">Simples Nacional</option>
          <option value="lucro_presumido">Lucro Presumido</option>
          <option value="lucro_real">Lucro Real</option>
          <option value="mei">MEI</option>
        </select>
      </Field>

      <h4 className="font-bold text-slate-700 pb-1 border-b mt-4">NFe</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Emite NFe">
          <select value={f.emite_nfe ? 'sim' : 'nao'} onChange={e => up('emite_nfe', e.target.value === 'sim')} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </Field>
        <Field label="Ambiente">
          <select value={f.ambiente_nfe || 'homologacao'} onChange={e => up('ambiente_nfe', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" disabled={!f.emite_nfe}>
            <option value="homologacao">Homologação (teste)</option>
            <option value="producao">Produção</option>
          </select>
        </Field>
        <Field label="Próxima série NFe">
          <input type="number" value={f.proxima_serie_nfe || 1} onChange={e => up('proxima_serie_nfe', +e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" disabled={!f.emite_nfe} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Path do certificado A1 (.pfx)" hint="Caminho no servidor — upload manual ainda">
          <input value={f.certificado_a1_path || ''} onChange={e => up('certificado_a1_path', e.target.value)} placeholder="/etc/cds-certs/empresa.pfx" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" disabled={!f.emite_nfe} />
        </Field>
        <Field label="Validade do certificado">
          <input type="date" value={f.certificado_a1_validade || ''} onChange={e => up('certificado_a1_validade', e.target.value || null)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" disabled={!f.emite_nfe} />
        </Field>
      </div>

      <button onClick={() => onSalvar(f)} disabled={salvando}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar dados fiscais
      </button>
    </div>
  );
}

function EnderecoForm({ empresa, onSalvar, salvando }: any) {
  const [f, setF] = useState<any>(empresa);
  useEffect(() => setF(empresa), [empresa]);
  function up(k: string, v: any) { setF({...f, [k]: v}); }
  return (
    <div className="space-y-3">
      <Field label="CEP">
        <input value={f.endereco_cep || ''} onChange={e => up('endereco_cep', e.target.value)} placeholder="00000-000" className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Logradouro"><input value={f.endereco_logradouro || ''} onChange={e => up('endereco_logradouro', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Número"><input value={f.endereco_numero || ''} onChange={e => up('endereco_numero', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Complemento"><input value={f.endereco_complemento || ''} onChange={e => up('endereco_complemento', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      </div>
      <Field label="Bairro"><input value={f.endereco_bairro || ''} onChange={e => up('endereco_bairro', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Cidade"><input value={f.endereco_cidade || ''} onChange={e => up('endereco_cidade', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="UF">
          <select value={f.endereco_uf || ''} onChange={e => up('endereco_uf', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            <option value="">—</option>
            {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf}>{uf}</option>)}
          </select>
        </Field>
      </div>
      <button onClick={() => onSalvar(f)} disabled={salvando}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar endereço
      </button>
    </div>
  );
}

function NumeracoesForm({ sequencias, onSalvar }: any) {
  const TIPOS = TIPOS_DOC;
  function getSeq(tipo: string): Sequencia | null {
    return (sequencias as Sequencia[]).find(s => s.tipo === tipo) || null;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 mb-3 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
        💡 Cada empresa tem sua própria sequência. Use <code className="bg-white px-1 rounded">{'{prefixo}'}</code> e <code className="bg-white px-1 rounded">{'{numero:04d}'}</code> no formato.
      </p>
      {TIPOS.map(({ id: tipo, label }) => {
        const seq = getSeq(tipo);
        return <NumeracaoRow key={tipo} tipo={tipo} label={label} seq={seq} onSalvar={onSalvar} />;
      })}
    </div>
  );
}

function NumeracaoRow({ tipo, label, seq, onSalvar }: any) {
  const [editando, setEditando] = useState(false);
  const [prefixo, setPrefixo] = useState(seq?.prefixo || '');
  const [formato, setFormato] = useState(seq?.formato || '{prefixo}-{numero:04d}');
  const [proximoNumero, setProximoNumero] = useState(seq?.proximo_numero ?? 1);

  useEffect(() => {
    if (seq) {
      setPrefixo(seq.prefixo || '');
      setFormato(seq.formato || '{prefixo}-{numero:04d}');
      setProximoNumero(seq.proximo_numero ?? 1);
    }
  }, [seq?.tipo, seq?.proximo_numero]);

  function preview() {
    return formato.replace('{prefixo}', prefixo).replace(/\{numero:0(\d+)d\}/, (_: any, n: any) => String(proximoNumero).padStart(+n, '0')).replace('{numero}', String(proximoNumero));
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        {!editando ? (
          <div className="text-xs text-slate-500 mt-0.5">
            {seq ? <>Próximo: <code className="bg-slate-100 px-1.5 rounded font-mono">{preview()}</code></> : <span className="italic">Não configurado</span>}
          </div>
        ) : (
          <div className="flex gap-2 mt-1 text-xs items-center">
            <span>Prefixo:</span>
            <input value={prefixo} onChange={e => setPrefixo(e.target.value)} className="px-2 py-1 border border-slate-300 rounded font-mono text-xs w-20" />
            <span>Formato:</span>
            <input value={formato} onChange={e => setFormato(e.target.value)} className="px-2 py-1 border border-slate-300 rounded font-mono text-xs w-48" />
            <span>Próximo nº:</span>
            <input type="number" value={proximoNumero} onChange={e => setProximoNumero(+e.target.value)} className="px-2 py-1 border border-slate-300 rounded font-mono text-xs w-20" />
            <span className="text-slate-500">→ {preview()}</span>
          </div>
        )}
      </div>
      {!editando ? (
        <button onClick={() => setEditando(true)} className="text-xs font-semibold text-blue-600 hover:underline">
          {seq ? 'editar' : 'configurar'}
        </button>
      ) : (
        <div className="flex gap-1">
          <button onClick={() => { setEditando(false); }} className="text-xs text-slate-500 hover:underline">cancelar</button>
          <button onClick={() => { onSalvar({ tipo, prefixo, formato, proximo_numero: proximoNumero }); setEditando(false); }}
            className="text-xs font-semibold text-emerald-600 hover:underline">salvar</button>
        </div>
      )}
    </div>
  );
}

function BancoForm({ empresa, onSalvar, salvando }: any) {
  const [f, setF] = useState<any>(empresa);
  useEffect(() => setF(empresa), [empresa]);
  function up(k: string, v: any) { setF({...f, [k]: v}); }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Banco"><input value={f.banco_nome || ''} onChange={e => up('banco_nome', e.target.value)} placeholder="Ex: Banco do Brasil" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Agência"><input value={f.banco_agencia || ''} onChange={e => up('banco_agencia', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" /></Field>
        <Field label="Conta"><input value={f.banco_conta || ''} onChange={e => up('banco_conta', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" /></Field>
      </div>
      <Field label="Chave PIX" hint="CPF/CNPJ/email/celular/aleatória"><input value={f.banco_pix || ''} onChange={e => up('banco_pix', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" /></Field>
      <button onClick={() => onSalvar(f)} disabled={salvando}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar dados bancários
      </button>
    </div>
  );
}

export default EmpresaConfig;
