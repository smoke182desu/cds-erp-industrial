// src/pages/WooCommerce.tsx — Integração WooCommerce + Pedidos + Comprovantes
import { useEffect, useState, useMemo } from 'react';
import {
  ShoppingBag, Store, FileCheck, Loader2, Plus, Edit3, Trash2, X, Save,
  RefreshCw, AlertCircle, CheckCircle2, Eye, ExternalLink, Filter, Upload,
  Calendar, DollarSign, Package, Truck, User, MessageCircle, Receipt,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';
import { AgenciaContextoBanner } from '../components/AgenciaContextoBanner';

type Aba = 'pedidos' | 'lojas' | 'comprovantes';

interface Loja {
  id: string; cliente_agencia_id: string; nome: string; url: string;
  consumer_key?: string; consumer_secret?: string; webhook_secret?: string;
  ativo: boolean; ultimo_sync?: string; ultimo_pedido_id?: number;
}
interface Pedido {
  id: string; cliente_agencia_id: string; loja_id?: string;
  wc_order_id: number; numero_wc?: string; status?: string;
  total?: number; subtotal?: number;
  payment_method_title?: string;
  cliente_nome?: string; cliente_email?: string; cliente_telefone?: string;
  itens?: any[]; data_pedido?: string; data_pago?: string;
  endereco_entrega?: any; endereco_cobranca?: any;
  notas_cliente?: string;
  wc_lojas?: { nome: string; url: string };
}
interface Comprovante {
  id: string; cliente_agencia_id: string; tipo: string;
  titulo?: string; descricao?: string; valor?: number;
  data_pagamento?: string; arquivo_url?: string;
  status: string; observacoes?: string;
  pedido_wc_id?: string; fatura_agencia_id?: string;
  trafego_clientes?: { nome: string; cor_destaque?: string };
  wc_pedidos?: { numero_wc?: string; total?: number; cliente_nome?: string };
  faturas_agencia?: { competencia?: string; valor_total?: number };
}

function fmt(n?: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0); }
function fmtData(s?: string) { return s ? new Date(s).toLocaleDateString('pt-BR') : ''; }

const STATUS_PED: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-800' },
  'on-hold': { label: 'Aguardando', color: 'bg-slate-200 text-slate-700' },
  processing: { label: 'Processando', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  refunded: { label: 'Reembolsado', color: 'bg-slate-200 text-slate-500' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-800' },
};

export function WooCommerce() {
  const { clienteAtivo } = useTrafego();
  const [aba, setAba] = useState<Aba>('pedidos');
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [comprovantes, setComprovantes] = useState<Comprovante[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [editLoja, setEditLoja] = useState<Partial<Loja> | null>(null);
  const [editCompr, setEditCompr] = useState<Partial<Comprovante> | null>(null);
  const [verPedido, setVerPedido] = useState<Pedido | null>(null);
  const [feedback, setFeedback] = useState<{tipo: 'ok'|'erro'; msg: string} | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const url = clienteAtivo
        ? `?cliente_id=${clienteAtivo.id}`
        : '';
      const [l, p, c] = await Promise.all([
        fetch(`/api/wc-lojas${url}`).then(r => r.json()),
        fetch(`/api/wc-pedidos${url}`).then(r => r.json()),
        fetch(`/api/comprovantes${url}`).then(r => r.json()),
      ]);
      setLojas(Array.isArray(l) ? l : []);
      setPedidos(Array.isArray(p) ? p : []);
      setComprovantes(Array.isArray(c) ? c : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, [clienteAtivo?.id]);

  function showMsg(tipo: 'ok'|'erro', msg: string) {
    setFeedback({ tipo, msg }); setTimeout(() => setFeedback(null), 3000);
  }

  async function sincronizar(lojaId?: string) {
    setSincronizando(true);
    try {
      const r = await fetch('/api/wc-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lojaId ? { loja_id: lojaId } : (clienteAtivo ? { cliente_agencia_id: clienteAtivo.id } : {})) });
      const d = await r.json();
      if (d.resultado) {
        const novos = d.resultado.reduce((s: number, x: any) => s + (x.novos || 0), 0);
        const erros = d.resultado.filter((x: any) => x.erro);
        if (erros.length) showMsg('erro', `Erros em ${erros.length} lojas: ${erros.map((e:any) => e.erro).join(', ')}`);
        else showMsg('ok', `${novos} pedidos novos sincronizados`);
        carregar();
      } else {
        showMsg('erro', d.error || 'erro');
      }
    } catch (e: any) { showMsg('erro', e?.message || 'erro'); }
    finally { setSincronizando(false); }
  }

  async function salvarLoja(l: Partial<Loja>) {
    const isNew = !l.id;
    const url = isNew ? '/api/wc-lojas' : `/api/wc-lojas?id=${l.id}`;
    const body: any = isNew ? { ...l, cliente_agencia_id: clienteAtivo?.id } : l;
    delete body.id;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { showMsg('erro', 'Erro ao salvar loja'); return; }
    setEditLoja(null); carregar(); showMsg('ok', 'Loja salva');
  }
  async function removerLoja(id: string) {
    if (!confirm('Remover loja? Pedidos sincronizados permanecem.')) return;
    await fetch(`/api/wc-lojas?id=${id}`, { method: 'DELETE' });
    carregar();
  }

  async function salvarComprovante(c: Partial<Comprovante>) {
    const isNew = !c.id;
    const url = isNew ? '/api/comprovantes' : `/api/comprovantes?id=${c.id}`;
    const body: any = isNew ? { ...c, cliente_agencia_id: clienteAtivo?.id } : c;
    delete body.id;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { showMsg('erro', 'Erro ao salvar comprovante'); return; }
    setEditCompr(null); carregar(); showMsg('ok', 'Comprovante salvo');
  }

  const stats = useMemo(() => {
    const total = pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const pagos = pedidos.filter(p => p.status === 'completed' || p.data_pago).reduce((s, p) => s + (Number(p.total) || 0), 0);
    return {
      pedidosTotal: pedidos.length,
      ticketMedio: pedidos.length ? total / pedidos.length : 0,
      vendido: pagos,
      pendente: pedidos.filter(p => p.status === 'pending' || p.status === 'processing' || p.status === 'on-hold').length,
      comprovantesPendentes: comprovantes.filter(c => c.status === 'recebido').length,
    };
  }, [pedidos, comprovantes]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">WooCommerce & Vendas</h1>
            <p className="text-sm text-slate-500">Pedidos, lojas e comprovantes</p>
          </div>
          <button onClick={() => sincronizar()} disabled={sincronizando || lojas.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {sincronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar
          </button>
        </div>
        <div className="max-w-6xl mx-auto mt-4 flex gap-1 border-b border-slate-200">
          {([['pedidos','Pedidos',ShoppingBag],['lojas','Lojas WC',Store],['comprovantes','Comprovantes',FileCheck]] as [Aba,string,any][]).map(([id,label,Icon]) => (
            <button key={id} onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold ${aba === id ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {clienteAtivo && <AgenciaContextoBanner contexto="WooCommerce" />}
        {feedback && (
          <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${feedback.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {feedback.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {feedback.msg}
          </div>
        )}

        {/* KPIs */}
        {aba === 'pedidos' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total pedidos" value={stats.pedidosTotal} icon={ShoppingBag} />
            <Kpi label="Vendido (pago)" value={fmt(stats.vendido)} icon={DollarSign} />
            <Kpi label="Ticket médio" value={fmt(stats.ticketMedio)} icon={Receipt} />
            <Kpi label="Pendentes" value={stats.pendente} icon={Truck} />
          </div>
        )}

        {loading ? <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div> :
          aba === 'pedidos' ? (
            pedidos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-700 mb-1">Sem pedidos sincronizados</h3>
                <p className="text-sm text-slate-500">
                  {lojas.length === 0 ? 'Configure uma loja WC primeiro' : 'Clique em Sincronizar pra puxar pedidos da loja'}
                </p>
                {lojas.length === 0 && (
                  <button onClick={() => setAba('lojas')} className="mt-3 text-sm font-semibold text-violet-600 hover:underline">
                    Configurar loja →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {pedidos.map(p => (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-violet-300 cursor-pointer" onClick={() => setVerPedido(p)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-slate-900">#{p.numero_wc || p.wc_order_id}</h3>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_PED[p.status || '']?.color || 'bg-slate-100'}`}>
                            {STATUS_PED[p.status || '']?.label || p.status}
                          </span>
                          {p.wc_lojas && <span className="text-xs text-slate-500">{p.wc_lojas.nome}</span>}
                        </div>
                        <p className="text-sm text-slate-700">
                          {p.cliente_nome || 'Sem nome'} {p.cliente_email && `· ${p.cliente_email}`}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          {p.data_pedido && <span><Calendar className="w-3 h-3 inline" /> {fmtData(p.data_pedido)}</span>}
                          {p.payment_method_title && <span>💳 {p.payment_method_title}</span>}
                          <span>📦 {(p.itens || []).length} itens</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">{fmt(Number(p.total))}</div>
                        {p.data_pago && <div className="text-[10px] text-emerald-600 font-semibold">✓ Pago em {fmtData(p.data_pago)}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : aba === 'lojas' ? (
            <>
              <button onClick={() => setEditLoja({ nome: '', url: '', ativo: true })} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nova loja WC
              </button>
              {lojas.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Configure a loja WooCommerce desta empresa</p>
                </div>
              ) : lojas.map(l => (
                <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">{l.nome}</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${l.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                          {l.ativo ? 'ativo' : 'inativo'}
                        </span>
                        {(!l.consumer_key || !l.consumer_secret) && <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">⚠️ Sem credenciais</span>}
                      </div>
                      <a href={l.url} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1">{l.url} <ExternalLink className="w-3 h-3" /></a>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Último sync: {l.ultimo_sync ? new Date(l.ultimo_sync).toLocaleString('pt-BR') : 'nunca'} · Último pedido sincronizado: #{l.ultimo_pedido_id || 0}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {l.consumer_key && (
                        <button onClick={() => sincronizar(l.id)} disabled={sincronizando} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded" title="Sincronizar esta loja">
                          <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <button onClick={() => setEditLoja(l)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => removerLoja(l.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
                <strong>📘 Como obter as chaves do WooCommerce:</strong>
                <ol className="list-decimal list-inside mt-1 space-y-0.5">
                  <li>No WP-Admin da loja: WooCommerce → Configurações → Avançado → REST API</li>
                  <li>Adicionar chave → Permissões: Ler/Escrever → Gerar</li>
                  <li>Copiar Consumer Key + Consumer Secret e colar aqui</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setEditCompr({ tipo: 'pix', status: 'recebido' })} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
                <Plus className="w-4 h-4" /> Novo comprovante
              </button>
              {comprovantes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Sem comprovantes ainda</p>
                </div>
              ) : comprovantes.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">{c.titulo || `${c.tipo.toUpperCase()} ${c.id.slice(0,8)}`}</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700`}>{c.tipo}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          c.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' :
                          c.status === 'conferido' ? 'bg-blue-100 text-blue-700' :
                          c.status === 'rejeitado' ? 'bg-red-100 text-red-700' :
                          c.status === 'divergente' ? 'bg-orange-100 text-orange-700' :
                          'bg-amber-100 text-amber-800'
                        }`}>{c.status}</span>
                      </div>
                      {c.descricao && <p className="text-xs text-slate-600 mt-0.5">{c.descricao}</p>}
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        {c.valor && <span className="font-semibold text-slate-700">{fmt(Number(c.valor))}</span>}
                        {c.data_pagamento && <span><Calendar className="w-3 h-3 inline" /> {fmtData(c.data_pagamento)}</span>}
                        {c.wc_pedidos && <span>📦 Pedido #{c.wc_pedidos.numero_wc}</span>}
                        {c.faturas_agencia && <span>💼 Fatura {c.faturas_agencia.competencia}</span>}
                      </div>
                      {c.arquivo_url && <a href={c.arquivo_url} target="_blank" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1">📎 Anexo <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                    <div className="flex gap-1">
                      {c.status === 'recebido' && (
                        <button onClick={() => salvarComprovante({ ...c, status: 'aprovado' })} className="text-xs font-semibold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded">
                          ✓ Aprovar
                        </button>
                      )}
                      <button onClick={() => setEditCompr(c)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={async () => { if (confirm('Remover?')) { await fetch(`/api/comprovantes?id=${c.id}`, { method: 'DELETE' }); carregar(); }}} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )
        }
      </div>

      {editLoja && <ModalLoja loja={editLoja} onClose={() => setEditLoja(null)} onSalvar={salvarLoja} />}
      {editCompr && <ModalComprovante comprovante={editCompr} pedidos={pedidos} onClose={() => setEditCompr(null)} onSalvar={salvarComprovante} />}
      {verPedido && <ModalPedido pedido={verPedido} onClose={() => setVerPedido(null)} onCriarComprovante={() => { setEditCompr({ tipo: 'pix', status: 'recebido', pedido_wc_id: verPedido.id, valor: verPedido.total, titulo: `Pagamento pedido #${verPedido.numero_wc}` }); setVerPedido(null); }} />}
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-violet-600" />
      </div>
      <div>
        <div className="text-lg font-bold text-slate-900 leading-none">{value}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function ModalLoja({ loja, onClose, onSalvar }: any) {
  const [f, setF] = useState<Partial<Loja>>(loja);
  function up(k: any, v: any) { setF({ ...f, [k]: v }); }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">{f.id ? 'Editar loja WC' : 'Nova loja WC'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Nome interno</label>
            <input value={f.nome || ''} onChange={e => up('nome', e.target.value)} placeholder="Ex: Loja CDS" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">URL da loja (sem barra final)</label>
            <input value={f.url || ''} onChange={e => up('url', e.target.value)} placeholder="https://minhaloja.com.br" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Consumer Key</label>
            <input value={f.consumer_key || ''} onChange={e => up('consumer_key', e.target.value)} placeholder="ck_..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Consumer Secret</label>
            <input type="password" value={f.consumer_secret || ''} onChange={e => up('consumer_secret', e.target.value)} placeholder="cs_..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Webhook secret (opcional)</label>
            <input value={f.webhook_secret || ''} onChange={e => up('webhook_secret', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={!!f.ativo} onChange={e => up('ativo', e.target.checked)} className="accent-violet-600" />
            <span>Ativo (sincroniza automaticamente)</span>
          </label>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={() => onSalvar(f)} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ModalComprovante({ comprovante, pedidos, onClose, onSalvar }: any) {
  const [f, setF] = useState<Partial<Comprovante>>(comprovante);
  function up(k: any, v: any) { setF({ ...f, [k]: v }); }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-800">{f.id ? 'Editar comprovante' : 'Novo comprovante'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Tipo</label>
              <select value={f.tipo || 'pix'} onChange={e => up('tipo', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1">
                {['pix','boleto','transferencia','dinheiro','cartao','nfe','recibo','outro'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Status</label>
              <select value={f.status || 'recebido'} onChange={e => up('status', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1">
                {['recebido','conferido','aprovado','rejeitado','divergente'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Título</label>
            <input value={f.titulo || ''} onChange={e => up('titulo', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Descrição</label>
            <textarea value={f.descricao || ''} onChange={e => up('descricao', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Valor (R$)</label>
              <input type="number" step="0.01" value={f.valor || ''} onChange={e => up('valor', +e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Data pagamento</label>
              <input type="date" value={f.data_pagamento?.slice(0,10) || ''} onChange={e => up('data_pagamento', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">URL do anexo (comprovante/print)</label>
            <input value={f.arquivo_url || ''} onChange={e => up('arquivo_url', e.target.value)} placeholder="https://..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono" />
            <p className="text-[10px] text-slate-400 mt-1">Cole link do print/PDF (Google Drive, S3, etc). Upload direto vai pra próxima rodada.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Pedido vinculado (opcional)</label>
            <select value={f.pedido_wc_id || ''} onChange={e => up('pedido_wc_id', e.target.value || null)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1">
              <option value="">— sem vínculo —</option>
              {pedidos.map((p: Pedido) => <option key={p.id} value={p.id}>#{p.numero_wc} · {p.cliente_nome} · {fmt(Number(p.total))}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Observações</label>
            <textarea value={f.observacoes || ''} onChange={e => up('observacoes', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
          </div>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={() => onSalvar(f)} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ModalPedido({ pedido, onClose, onCriarComprovante }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Pedido #{pedido.numero_wc || pedido.wc_order_id}</h3>
            <p className="text-xs text-slate-500">{pedido.wc_lojas?.nome}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><strong>Cliente:</strong> {pedido.cliente_nome}</div>
            <div><strong>Status:</strong> {STATUS_PED[pedido.status]?.label || pedido.status}</div>
            <div><strong>Email:</strong> {pedido.cliente_email || '—'}</div>
            <div><strong>Telefone:</strong> {pedido.cliente_telefone || '—'}</div>
            <div><strong>Data:</strong> {fmtData(pedido.data_pedido)}</div>
            <div><strong>Pago em:</strong> {fmtData(pedido.data_pago) || '—'}</div>
            <div className="col-span-2"><strong>Pagamento:</strong> {pedido.payment_method_title || '—'}</div>
          </div>

          <h4 className="font-bold text-slate-800 pt-3 border-t border-slate-200">Itens</h4>
          {(pedido.itens || []).map((it: any, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100">
              <div>
                <div className="font-semibold">{it.nome}</div>
                {it.sku && <div className="text-[10px] text-slate-400">SKU: {it.sku}</div>}
              </div>
              <div className="text-right">
                <div>{it.qtd}x {fmt(Number(it.preco_unit))}</div>
                <div className="font-bold">{fmt(Number(it.total))}</div>
              </div>
            </div>
          ))}

          <div className="flex justify-between font-bold pt-2 border-t border-slate-300">
            <span>Total</span>
            <span className="text-xl text-slate-900">{fmt(Number(pedido.total))}</span>
          </div>

          {pedido.notas_cliente && (
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Nota do cliente</h4>
              <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-1">{pedido.notas_cliente}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Fechar</button>
          <button onClick={onCriarComprovante} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
            <FileCheck className="w-4 h-4" /> Anexar comprovante
          </button>
        </div>
      </div>
    </div>
  );
}

export default WooCommerce;
