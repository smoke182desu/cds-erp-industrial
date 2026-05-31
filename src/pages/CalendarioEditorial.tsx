// src/pages/CalendarioEditorial.tsx
import { useEffect, useState, useMemo } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Loader2, X, Save, Send,
  CheckCircle2, AlertCircle, Eye, ExternalLink, Trash2, Edit3,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';

interface PostCal {
  id: string;
  cliente_agencia_id: string;
  titulo: string;
  texto?: string;
  plataformas?: string[];
  tipo?: string;
  agendado_para?: string;
  status: 'rascunho' | 'revisao' | 'aprovado_cliente' | 'rejeitado_cliente' | 'publicado' | 'cancelado';
  token_aprovacao?: string;
  aprovado_em?: string;
  aprovado_por?: string;
  comentarios_cliente?: string;
  trafego_clientes?: { id: string; nome: string; slug: string; cor_destaque?: string };
}

const STATUS_COR: Record<string, string> = {
  rascunho:          'bg-slate-200',
  revisao:           'bg-amber-300',
  aprovado_cliente:  'bg-emerald-400',
  rejeitado_cliente: 'bg-red-400',
  publicado:         'bg-blue-500',
  cancelado:         'bg-slate-300',
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', revisao: 'Em revisão', aprovado_cliente: 'Aprovado',
  rejeitado_cliente: 'Rejeitado', publicado: 'Publicado', cancelado: 'Cancelado',
};

export function CalendarioEditorial() {
  const { clientes, clienteAtivo } = useTrafego();
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}`);
  const [posts, setPosts] = useState<PostCal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<PostCal | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const url = clienteAtivo
        ? `/api/posts/calendario?mes=${mes}&cliente_id=${clienteAtivo.id}`
        : `/api/posts/calendario?mes=${mes}`;
      const r = await fetch(url);
      const d = await r.json();
      setPosts(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, [mes, clienteAtivo?.id]);

  const { primeiroDiaSemana, diasNoMes, postsPorDia } = useMemo(() => {
    const [ano, m] = mes.split('-').map(Number);
    const primDia = new Date(ano, m - 1, 1).getDay();
    const dias = new Date(ano, m, 0).getDate();
    const por: Record<number, PostCal[]> = {};
    for (const p of posts) {
      if (!p.agendado_para) continue;
      const dt = new Date(p.agendado_para);
      const d = dt.getDate();
      (por[d] = por[d] || []).push(p);
    }
    return { primeiroDiaSemana: primDia, diasNoMes: dias, postsPorDia: por };
  }, [posts, mes]);

  function navegar(delta: number) {
    const [ano, m] = mes.split('-').map(Number);
    const novo = new Date(ano, m - 1 + delta, 1);
    setMes(`${novo.getFullYear()}-${String(novo.getMonth() + 1).padStart(2,'0')}`);
  }

  const nomeMes = useMemo(() => {
    const [ano, m] = mes.split('-').map(Number);
    return new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [mes]);

  function copyLinkAprovacao(p: PostCal) {
    const url = `${window.location.origin}/aprovacao/${p.token_aprovacao}`;
    navigator.clipboard.writeText(url);
    alert('Link copiado! Envia pro cliente aprovar.');
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Calendário Editorial</h1>
            <p className="text-sm text-slate-500">{posts.length} posts em {nomeMes} {clienteAtivo && ` · ${clienteAtivo.nome}`}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navegar(-1)} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-slate-700 capitalize min-w-[150px] text-center">{nomeMes}</span>
            <button onClick={() => navegar(1)} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setModalNovo(true)}
              className="ml-3 flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg">
              <Plus className="w-4 h-4" /> Novo post
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {loading ? <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div> :
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
                <div key={d} className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {/* preencher dias antes do dia 1 */}
              {Array(primeiroDiaSemana).fill(null).map((_, i) => (
                <div key={`v${i}`} className="border-r border-b border-slate-100 min-h-[100px] bg-slate-50/30" />
              ))}
              {/* dias do mês */}
              {Array(diasNoMes).fill(null).map((_, i) => {
                const dia = i + 1;
                const ps = postsPorDia[dia] || [];
                const dataIso = `${mes}-${String(dia).padStart(2, '0')}`;
                return (
                  <div key={dia}
                    onClick={() => { setDiaSelecionado(dataIso); setModalNovo(true); }}
                    className="border-r border-b border-slate-100 min-h-[100px] p-2 hover:bg-slate-50 cursor-pointer">
                    <div className="text-xs font-semibold text-slate-700 mb-1">{dia}</div>
                    <div className="space-y-1">
                      {ps.slice(0, 3).map(p => (
                        <div key={p.id} onClick={e => { e.stopPropagation(); setModalEditar(p); }}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate text-white cursor-pointer`}
                          style={{ backgroundColor: p.trafego_clientes?.cor_destaque || '#6366f1' }}
                          title={p.titulo}>
                          <span className="opacity-80">●</span> {p.titulo}
                        </div>
                      ))}
                      {ps.length > 3 && <div className="text-[10px] text-slate-500 px-1">+{ps.length - 3} mais</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }

        {/* legenda */}
        <div className="mt-4 flex gap-4 flex-wrap text-xs">
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${STATUS_COR[k]}`} />
              <span className="text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {modalNovo && <ModalNovoPost
        clientes={clientes}
        clienteAtivoId={clienteAtivo?.id}
        dataPadrao={diaSelecionado || undefined}
        onClose={() => { setModalNovo(false); setDiaSelecionado(null); }}
        onSalvo={() => { setModalNovo(false); setDiaSelecionado(null); carregar(); }} />}
      {modalEditar && <ModalEditarPost post={modalEditar} onClose={() => setModalEditar(null)} onSalvo={() => { setModalEditar(null); carregar(); }} onCopyLink={() => copyLinkAprovacao(modalEditar)} />}
    </div>
  );
}

function ModalNovoPost({ clientes, clienteAtivoId, dataPadrao, onClose, onSalvo }: any) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [agendado, setAgendado] = useState(dataPadrao ? `${dataPadrao}T10:00` : '');
  const [plataformas, setPlataformas] = useState<string[]>(['meta']);
  const [clienteId, setClienteId] = useState(clienteAtivoId || (clientes[0]?.id || ''));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim() || !clienteId) return;
    setSalvando(true);
    try {
      await fetch('/api/posts/calendario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_agencia_id: clienteId, titulo, texto, agendado_para: agendado || null, plataformas, status: 'revisao' }),
      });
      onSalvo();
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Novo post</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Empresa</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1">
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Promoção de Outubro" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Texto</label>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Agendado para</label>
            <input type="datetime-local" value={agendado} onChange={e => setAgendado(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Plataformas</label>
            <div className="flex gap-2 mt-1">
              {['meta','instagram','tiktok','linkedin'].map(p => (
                <label key={p} className={`px-3 py-1 text-xs rounded-lg border cursor-pointer ${plataformas.includes(p) ? 'bg-purple-100 border-purple-500' : 'border-slate-200'}`}>
                  <input type="checkbox" className="mr-1" checked={plataformas.includes(p)} onChange={() => setPlataformas(plataformas.includes(p) ? plataformas.filter(x => x !== p) : [...plataformas, p])} />{p}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !titulo.trim()} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" /> Criar e enviar pra revisão
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalEditarPost({ post, onClose, onSalvo, onCopyLink }: any) {
  const [titulo, setTitulo] = useState(post.titulo);
  const [texto, setTexto] = useState(post.texto || '');
  const [agendado, setAgendado] = useState(post.agendado_para ? post.agendado_para.slice(0, 16) : '');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await fetch(`/api/posts/calendario?id=${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo, texto, agendado_para: agendado || null }) });
      onSalvo();
    } finally { setSalvando(false); }
  }
  async function remover() {
    if (!confirm('Remover post?')) return;
    await fetch(`/api/posts/calendario?id=${post.id}`, { method: 'DELETE' });
    onSalvo();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Editar post</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: post.trafego_clientes?.cor_destaque }} />
              <span className="text-xs text-slate-500">{post.trafego_clientes?.nome}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded font-semibold uppercase">{post.status.replace('_',' ')}</span>
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <input value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-semibold" />
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input type="datetime-local" value={agendado} onChange={e => setAgendado(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />

          {post.aprovado_em && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-800">
              ✓ Aprovado em {new Date(post.aprovado_em).toLocaleString('pt-BR')} por {post.aprovado_por}
              {post.comentarios_cliente && <div className="italic mt-1">"{post.comentarios_cliente}"</div>}
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-between items-center gap-2">
          <button onClick={remover} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remover</button>
          <div className="flex gap-2">
            <button onClick={onCopyLink} className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Copiar link aprovação</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarioEditorial;
