// src/pages/Conhecimento.tsx
// Módulo de conhecimento por empresa — alimenta a IA da agência
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Save, Loader2, Plus, Trash2, Edit3, X, FileText,
  Building2, Target, Users2, Package, Swords, Eye, Sparkles, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';
import { AgenciaContextoBanner } from '../components/AgenciaContextoBanner';

type Aba = 'identidade' | 'mercado_icp' | 'produtos' | 'concorrentes' | 'documentos';

interface Empresa {
  cliente_agencia_id: string;
  missao?: string; visao?: string; valores?: string[];
  tom_voz?: string; personalidade_marca?: string; proposta_valor?: string;
  slogan?: string; historia?: string;
  segmento?: string; industria?: string; ticket_medio?: number;
  sazonalidade?: any; geografia?: any;
  icp_perfil?: string; icp_dor?: string; icp_objetivo?: string;
  icp_objecoes?: string[]; icp_jornada?: string;
  diferenciais?: string[]; beneficios_principais?: string[];
  garantias?: string[]; prova_social?: string;
  paleta_cores?: string[]; fonte_marca?: string; logo_url?: string; guidelines_url?: string;
  objetivos_negocio?: string; metas_marketing?: string;
  palavras_chave?: string[]; hashtags_marca?: string[]; evitar_palavras?: string[];
  historico_aprendido?: string;
}

interface Produto { id?: string; nome: string; descricao?: string; categoria?: string; preco_por?: number; publico_alvo?: string; beneficios?: string[]; }
interface Concorrente { id?: string; nome: string; url?: string; posicionamento?: string; pontos_fortes?: string[]; pontos_fracos?: string[]; diferencas_voce?: string; }
interface Documento { id?: string; titulo: string; tipo: string; conteudo_md?: string; tags?: string[]; }

const ABAS: { id: Aba; label: string; icon: any }[] = [
  { id: 'identidade',    label: 'Identidade',  icon: Building2 },
  { id: 'mercado_icp',   label: 'Mercado & ICP', icon: Target },
  { id: 'produtos',      label: 'Produtos',    icon: Package },
  { id: 'concorrentes',  label: 'Concorrentes',icon: Swords },
  { id: 'documentos',    label: 'Documentos',  icon: FileText },
];

export function Conhecimento() {
  const { clienteAtivo } = useTrafego();
  const [aba, setAba] = useState<Aba>('identidade');
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [concorrentes, setConcorrentes] = useState<Concorrente[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [contextoModal, setContextoModal] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteAtivo) return;
    setLoading(true);
    try {
      const [e, p, c, d] = await Promise.all([
        fetch(`/api/conhecimento/empresa?cliente_id=${clienteAtivo.id}`).then(r => r.json()),
        fetch(`/api/conhecimento/produtos?cliente_id=${clienteAtivo.id}`).then(r => r.json()).catch(() => []),
        fetch(`/api/conhecimento/concorrentes?cliente_id=${clienteAtivo.id}`).then(r => r.json()).catch(() => []),
        fetch(`/api/conhecimento/documentos?cliente_id=${clienteAtivo.id}`).then(r => r.json()).catch(() => []),
      ]);
      setEmpresa(e);
      setProdutos(Array.isArray(p) ? p : []);
      setConcorrentes(Array.isArray(c) ? c : []);
      setDocumentos(Array.isArray(d) ? d : []);
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
      const r = await fetch(`/api/conhecimento/empresa?cliente_id=${clienteAtivo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'erro');
      const updated = await r.json();
      setEmpresa(updated);
      showMsg('ok', 'Salvo');
    } catch (e: any) { showMsg('erro', e?.message || 'erro'); }
    finally { setSalvando(false); }
  }

  if (!clienteAtivo) {
    return (
      <div className="h-full bg-slate-50 p-6">
        <div className="max-w-3xl mx-auto">
          <AgenciaContextoBanner contexto="conhecimento" />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 flex items-center gap-2 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4" /> Selecione uma empresa no banner pra editar o conhecimento dela.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Conhecimento</h1>
            <p className="text-sm text-slate-500">Cérebro da IA de <strong>{clienteAtivo.nome}</strong> · alimenta criativos, copy e estratégia</p>
          </div>
          <button onClick={() => setContextoModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg">
            <Eye className="w-4 h-4" /> Ver contexto IA
          </button>
        </div>
        <div className="max-w-5xl mx-auto mt-4 flex gap-1 border-b border-slate-200 overflow-x-auto">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                aba === id ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Icon className="w-4 h-4" /> {label}
              {id === 'produtos' && produtos.length > 0 && <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-full">{produtos.length}</span>}
              {id === 'concorrentes' && concorrentes.length > 0 && <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-full">{concorrentes.length}</span>}
              {id === 'documentos' && documentos.length > 0 && <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-full">{documentos.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {feedback && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
            feedback.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedback.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {feedback.msg}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : aba === 'identidade' ? (
          <IdentidadeForm empresa={empresa!} onSalvar={salvarEmpresa} salvando={salvando} />
        ) : aba === 'mercado_icp' ? (
          <MercadoIcpForm empresa={empresa!} onSalvar={salvarEmpresa} salvando={salvando} />
        ) : aba === 'produtos' ? (
          <ProdutosCrud
            clienteId={clienteAtivo.id} produtos={produtos} onChange={carregar}
            showMsg={showMsg}
          />
        ) : aba === 'concorrentes' ? (
          <ConcorrentesCrud
            clienteId={clienteAtivo.id} concorrentes={concorrentes} onChange={carregar}
            showMsg={showMsg}
          />
        ) : (
          <DocumentosCrud
            clienteId={clienteAtivo.id} documentos={documentos} onChange={carregar}
            showMsg={showMsg}
          />
        )}
      </div>

      {contextoModal && <ContextoIaModal clienteId={clienteAtivo.id} onClose={() => setContextoModal(false)} />}
    </div>
  );
}

// ===== Helpers de UI =====
function Field({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function CsvField({ value, onChange, placeholder }: { value: string[] | undefined; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <input type="text" value={(value || []).join(', ')}
      onChange={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
  );
}

// ===== Aba: Identidade =====
function IdentidadeForm({ empresa, onSalvar, salvando }: { empresa: Empresa; onSalvar: (p: Partial<Empresa>) => Promise<void>; salvando: boolean }) {
  const [form, setForm] = useState(empresa);
  useEffect(() => setForm(empresa), [empresa]);
  function up<K extends keyof Empresa>(k: K, v: Empresa[K]) { setForm({ ...form, [k]: v }); }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Slogan"><input value={form.slogan || ''} onChange={e => up('slogan', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Tom de voz" hint="Ex: profissional, casual, técnico, divertido"><input value={form.tom_voz || ''} onChange={e => up('tom_voz', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      </div>
      <Field label="Proposta de valor" hint="Em uma frase, por que escolher essa empresa"><textarea value={form.proposta_valor || ''} onChange={e => up('proposta_valor', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Missão"><textarea value={form.missao || ''} onChange={e => up('missao', e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Visão"><textarea value={form.visao || ''} onChange={e => up('visao', e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      </div>
      <Field label="Valores (separe por vírgula)"><CsvField value={form.valores} onChange={v => up('valores', v)} placeholder="confiança, qualidade, inovação" /></Field>
      <Field label="Personalidade da marca"><textarea value={form.personalidade_marca || ''} onChange={e => up('personalidade_marca', e.target.value)} rows={2} placeholder="Ex: como um amigo expert do setor, direto, sem enrolação..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      <Field label="História da empresa"><textarea value={form.historia || ''} onChange={e => up('historia', e.target.value)} rows={4} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>

      <h4 className="font-bold text-slate-700 mt-5 pb-1 border-b">Branding visual</h4>
      <Field label="Paleta de cores (hex, separe por vírgula)"><CsvField value={form.paleta_cores} onChange={v => up('paleta_cores', v)} placeholder="#dc2626, #1f2937, #f59e0b" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="URL do logo"><input value={form.logo_url || ''} onChange={e => up('logo_url', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="URL das guidelines (PDF)"><input value={form.guidelines_url || ''} onChange={e => up('guidelines_url', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      </div>

      <button onClick={() => onSalvar(form)} disabled={salvando}
        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar identidade
      </button>
    </div>
  );
}

// ===== Aba: Mercado & ICP =====
function MercadoIcpForm({ empresa, onSalvar, salvando }: { empresa: Empresa; onSalvar: (p: Partial<Empresa>) => Promise<void>; salvando: boolean }) {
  const [form, setForm] = useState(empresa);
  useEffect(() => setForm(empresa), [empresa]);
  function up<K extends keyof Empresa>(k: K, v: any) { setForm({ ...form, [k]: v }); }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Segmento" hint="B2B, B2C, B2G"><input value={form.segmento || ''} onChange={e => up('segmento', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Indústria" hint="construção, varejo, saúde…"><input value={form.industria || ''} onChange={e => up('industria', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Ticket médio (R$)"><input type="number" value={form.ticket_medio || ''} onChange={e => up('ticket_medio', +e.target.value || null)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      </div>
      <Field label="Geografia primária"><input value={form.geografia?.primaria || ''} onChange={e => up('geografia', {...(form.geografia || {}), primaria: e.target.value})} placeholder="Ex: Brasília-DF e Entorno" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      <Field label="Geografia secundária"><input value={form.geografia?.secundaria || ''} onChange={e => up('geografia', {...(form.geografia || {}), secundaria: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>

      <h4 className="font-bold text-slate-700 mt-5 pb-1 border-b">Cliente Ideal (ICP)</h4>
      <Field label="Perfil do cliente ideal" hint="Quem ele é, idade, profissão, porte, hábitos"><textarea value={form.icp_perfil || ''} onChange={e => up('icp_perfil', e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Principal dor" hint="O que o cliente quer resolver"><textarea value={form.icp_dor || ''} onChange={e => up('icp_dor', e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        <Field label="Objetivo do cliente"><textarea value={form.icp_objetivo || ''} onChange={e => up('icp_objetivo', e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      </div>
      <Field label="Objeções comuns (separe por vírgula)" hint="Ex: caro demais, prazo longo, demora pra responder"><CsvField value={form.icp_objecoes} onChange={v => up('icp_objecoes', v)} /></Field>
      <Field label="Jornada do cliente" hint="Como ele descobre, considera e decide comprar"><textarea value={form.icp_jornada || ''} onChange={e => up('icp_jornada', e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>

      <h4 className="font-bold text-slate-700 mt-5 pb-1 border-b">Posicionamento</h4>
      <Field label="Diferenciais (separe por vírgula)"><CsvField value={form.diferenciais} onChange={v => up('diferenciais', v)} placeholder="entrega em 48h, garantia vitalícia, fabricação própria" /></Field>
      <Field label="Benefícios principais"><CsvField value={form.beneficios_principais} onChange={v => up('beneficios_principais', v)} /></Field>
      <Field label="Garantias"><CsvField value={form.garantias} onChange={v => up('garantias', v)} placeholder="7 dias de teste, devolução grátis" /></Field>
      <Field label="Prova social" hint="Casos, números, depoimentos"><textarea value={form.prova_social || ''} onChange={e => up('prova_social', e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>

      <h4 className="font-bold text-slate-700 mt-5 pb-1 border-b">Estratégia & palavras-chave</h4>
      <Field label="Objetivos de negócio"><textarea value={form.objetivos_negocio || ''} onChange={e => up('objetivos_negocio', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      <Field label="Metas de marketing"><textarea value={form.metas_marketing || ''} onChange={e => up('metas_marketing', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
      <Field label="Palavras-chave da marca (SEO + mensagem)"><CsvField value={form.palavras_chave} onChange={v => up('palavras_chave', v)} /></Field>
      <Field label="Hashtags da marca"><CsvField value={form.hashtags_marca} onChange={v => up('hashtags_marca', v)} placeholder="#cdsindustrial, #portoes" /></Field>
      <Field label="Palavras que a IA deve EVITAR" hint="Ex: barato, simples, comum"><CsvField value={form.evitar_palavras} onChange={v => up('evitar_palavras', v)} /></Field>
      <Field label="Aprendizado histórico" hint="O que funcionou ou falhou em campanhas anteriores"><textarea value={form.historico_aprendido || ''} onChange={e => up('historico_aprendido', e.target.value)} rows={4} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>

      <button onClick={() => onSalvar(form)} disabled={salvando}
        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar mercado & ICP
      </button>
    </div>
  );
}

// ===== CRUD Produtos =====
function ProdutosCrud({ clienteId, produtos, onChange, showMsg }: any) {
  const [editando, setEditando] = useState<Produto | null>(null);
  async function salvar(p: Produto) {
    const isNew = !p.id;
    const url = isNew ? '/api/conhecimento/produtos' : `/api/conhecimento/produtos?id=${p.id}`;
    const body: any = isNew ? { ...p, cliente_agencia_id: clienteId } : p;
    delete body.id;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { setEditando(null); onChange(); showMsg('ok', 'Salvo'); }
    else showMsg('erro', 'Erro ao salvar');
  }
  async function remover(id: string) {
    if (!confirm('Remover produto?')) return;
    await fetch(`/api/conhecimento/produtos?id=${id}`, { method: 'DELETE' });
    onChange();
  }
  return (
    <div className="space-y-3">
      <button onClick={() => setEditando({ nome: '' })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
        <Plus className="w-4 h-4" /> Novo produto/serviço
      </button>
      {produtos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Cadastre os produtos/serviços que a IA precisa conhecer</p>
        </div>
      ) : produtos.map((p: Produto) => (
        <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-slate-800">{p.nome}</h3>
            {p.descricao && <p className="text-xs text-slate-600 mt-0.5">{p.descricao}</p>}
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              {p.categoria && <span>{p.categoria}</span>}
              {p.preco_por && <span>R$ {p.preco_por}</span>}
              {p.publico_alvo && <span>público: {p.publico_alvo}</span>}
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setEditando(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => remover(p.id!)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}

      {editando && (
        <ModalEdicao titulo={editando.id ? 'Editar produto' : 'Novo produto'} onClose={() => setEditando(null)} onSalvar={() => salvar(editando!)}>
          <Field label="Nome *"><input value={editando.nome} onChange={e => setEditando({...editando, nome: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Categoria"><input value={editando.categoria || ''} onChange={e => setEditando({...editando, categoria: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Descrição"><textarea value={editando.descricao || ''} onChange={e => setEditando({...editando, descricao: e.target.value})} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Preço (R$)"><input type="number" step="0.01" value={editando.preco_por || ''} onChange={e => setEditando({...editando, preco_por: +e.target.value || undefined})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Público-alvo"><input value={editando.publico_alvo || ''} onChange={e => setEditando({...editando, publico_alvo: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Benefícios (separe por vírgula)"><CsvField value={editando.beneficios} onChange={v => setEditando({...editando, beneficios: v})} /></Field>
        </ModalEdicao>
      )}
    </div>
  );
}

// ===== CRUD Concorrentes =====
function ConcorrentesCrud({ clienteId, concorrentes, onChange, showMsg }: any) {
  const [editando, setEditando] = useState<Concorrente | null>(null);
  async function salvar(c: Concorrente) {
    const isNew = !c.id;
    const url = isNew ? '/api/conhecimento/concorrentes' : `/api/conhecimento/concorrentes?id=${c.id}`;
    const body: any = isNew ? { ...c, cliente_agencia_id: clienteId } : c;
    delete body.id;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { setEditando(null); onChange(); showMsg('ok', 'Salvo'); }
  }
  async function remover(id: string) { if (confirm('Remover?')) { await fetch(`/api/conhecimento/concorrentes?id=${id}`, { method: 'DELETE' }); onChange(); } }
  return (
    <div className="space-y-3">
      <button onClick={() => setEditando({ nome: '' })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
        <Plus className="w-4 h-4" /> Novo concorrente
      </button>
      {concorrentes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <Swords className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Mapeie quem disputa o mercado com essa empresa</p>
        </div>
      ) : concorrentes.map((c: Concorrente) => (
        <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-slate-800">{c.nome}</h3>
            {c.url && <a href={c.url} target="_blank" className="text-xs text-blue-600 hover:underline">{c.url}</a>}
            {c.posicionamento && <p className="text-xs text-slate-600 mt-1">{c.posicionamento}</p>}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setEditando(c)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => remover(c.id!)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {editando && (
        <ModalEdicao titulo={editando.id ? 'Editar concorrente' : 'Novo concorrente'} onClose={() => setEditando(null)} onSalvar={() => salvar(editando!)}>
          <Field label="Nome *"><input value={editando.nome} onChange={e => setEditando({...editando, nome: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="URL"><input value={editando.url || ''} onChange={e => setEditando({...editando, url: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Posicionamento (como ele se apresenta)"><textarea value={editando.posicionamento || ''} onChange={e => setEditando({...editando, posicionamento: e.target.value})} rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Pontos fortes"><CsvField value={editando.pontos_fortes} onChange={v => setEditando({...editando, pontos_fortes: v})} /></Field>
          <Field label="Pontos fracos"><CsvField value={editando.pontos_fracos} onChange={v => setEditando({...editando, pontos_fracos: v})} /></Field>
          <Field label="Diferenças versus você"><textarea value={editando.diferencas_voce || ''} onChange={e => setEditando({...editando, diferencas_voce: e.target.value})} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
        </ModalEdicao>
      )}
    </div>
  );
}

// ===== CRUD Documentos =====
function DocumentosCrud({ clienteId, documentos, onChange, showMsg }: any) {
  const [editando, setEditando] = useState<Documento | null>(null);
  async function salvar(d: Documento) {
    const isNew = !d.id;
    const url = isNew ? '/api/conhecimento/documentos' : `/api/conhecimento/documentos?id=${d.id}`;
    const body: any = isNew ? { ...d, cliente_agencia_id: clienteId } : d;
    delete body.id;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { setEditando(null); onChange(); showMsg('ok', 'Salvo'); }
  }
  async function remover(id: string) { if (confirm('Remover documento?')) { await fetch(`/api/conhecimento/documentos?id=${id}`, { method: 'DELETE' }); onChange(); } }
  const TIPOS = ['briefing','contrato','brand_guidelines','manual','deck','planilha','faq','fluxo_atendimento','case','outro','documento'];
  return (
    <div className="space-y-3">
      <button onClick={() => setEditando({ titulo: '', tipo: 'briefing' })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
        <Plus className="w-4 h-4" /> Novo documento
      </button>
      {documentos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Adicione briefings, FAQs, manuais — tudo que a IA precisa ler</p>
        </div>
      ) : documentos.map((d: Documento) => (
        <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-slate-800">{d.titulo}</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase font-bold">{d.tipo}</span>
            </div>
            {d.conteudo_md && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{d.conteudo_md.slice(0, 200)}{d.conteudo_md.length > 200 && '…'}</p>}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setEditando(d)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => remover(d.id!)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {editando && (
        <ModalEdicao titulo={editando.id ? 'Editar documento' : 'Novo documento'} onClose={() => setEditando(null)} onSalvar={() => salvar(editando!)} grande>
          <Field label="Título *"><input value={editando.titulo} onChange={e => setEditando({...editando, titulo: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" /></Field>
          <Field label="Tipo"><select value={editando.tipo} onChange={e => setEditando({...editando, tipo: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">{TIPOS.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Conteúdo (markdown ou texto livre)"><textarea value={editando.conteudo_md || ''} onChange={e => setEditando({...editando, conteudo_md: e.target.value})} rows={14} placeholder="# Título\n\nConteúdo do documento..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" /></Field>
        </ModalEdicao>
      )}
    </div>
  );
}

// ===== Modais =====
function ModalEdicao({ titulo, children, onClose, onSalvar, grande }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`bg-white rounded-2xl shadow-2xl w-full ${grande ? 'max-w-3xl' : 'max-w-xl'} max-h-[90vh] overflow-y-auto`}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
        </div>
        <div className="p-6 space-y-3">{children}</div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={onSalvar} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ContextoIaModal({ clienteId, onClose }: { clienteId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [contexto, setContexto] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/conhecimento/contexto-ia?cliente_id=${clienteId}`).then(r => r.json()).then(d => { setContexto(d); setLoading(false); });
  }, [clienteId]);
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" /> Contexto que vai pra IA</h3>
            <p className="text-xs text-slate-500">Esse documento é injetado em todo prompt de IA</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
        </div>
        <div className="p-6">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (
            <>
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-3 text-xs text-violet-900 flex items-center gap-4 flex-wrap">
                <span><strong>{contexto?.contagens?.documentos || 0}</strong> documentos</span>
                <span><strong>{contexto?.contagens?.produtos || 0}</strong> produtos</span>
                <span><strong>{contexto?.contagens?.concorrentes || 0}</strong> concorrentes</span>
                <span><strong>{contexto?.contexto_md?.length || 0}</strong> caracteres</span>
              </div>
              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-wrap font-mono">{contexto?.contexto_md || '(vazio - preencha os campos)'}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Conhecimento;
