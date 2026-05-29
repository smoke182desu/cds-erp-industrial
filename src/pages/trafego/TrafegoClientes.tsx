// src/pages/trafego/TrafegoClientes.tsx
// CRUD de clientes (tenants) gerenciados pela área de tráfego.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Archive, Search, AlertCircle, Loader2, X, Users2, CheckCircle2 } from 'lucide-react';
import { useTrafego } from '../../contexts/TrafegoContext';
import { arquivarCliente, atualizarCliente, criarCliente, TrafegoCliente, TrafegoClienteInput } from '../../services/trafegoService';

const CORES_SUGERIDAS = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#0891b2', '#2563eb', '#6366f1', '#9333ea', '#db2777'];

const STATUS_LABEL: Record<string, { texto: string; classes: string }> = {
  ativo:    { texto: 'Ativo',    classes: 'bg-emerald-100 text-emerald-700' },
  pausado:  { texto: 'Pausado',  classes: 'bg-amber-100 text-amber-700' },
  arquivado:{ texto: 'Arquivado',classes: 'bg-slate-200 text-slate-600' },
};

function vazio(): TrafegoClienteInput {
  return {
    nome: '',
    slug: '',
    logo_url: '',
    cor_destaque: '#6366f1',
    status: 'ativo',
    fee_mensal: 0,
    responsavel: '',
    email_contato: '',
    telefone_contato: '',
    observacoes: '',
  };
}

interface Props {
  forcarCadastroInicial?: boolean;
  onCadastroFeito?: () => void;
}

export function TrafegoClientes({ forcarCadastroInicial, onCadastroFeito }: Props) {
  const { clientes, loading, erro: erroLista, recarregar, setClienteAtivoId } = useTrafego();
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TrafegoCliente | null>(null);
  const [form, setForm] = useState<TrafegoClienteInput>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (forcarCadastroInicial) {
      abrirNovo();
      onCadastroFeito?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcarCadastroInicial]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(c =>
      [c.nome, c.responsavel, c.email_contato, c.telefone_contato]
        .some(v => String(v || '').toLowerCase().includes(q))
    );
  }, [clientes, busca]);

  function abrirNovo() {
    setEditando(null);
    setForm(vazio());
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEdicao(c: TrafegoCliente) {
    setEditando(c);
    setForm({
      nome: c.nome,
      slug: c.slug,
      logo_url: c.logo_url || '',
      cor_destaque: c.cor_destaque || '#6366f1',
      status: c.status,
      fee_mensal: c.fee_mensal || 0,
      responsavel: c.responsavel || '',
      email_contato: c.email_contato || '',
      telefone_contato: c.telefone_contato || '',
      observacoes: c.observacoes || '',
    });
    setErroForm('');
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErroForm('Nome é obrigatório.');
      return;
    }
    setSalvando(true);
    setErroForm('');
    try {
      let cliente: TrafegoCliente;
      if (editando) {
        cliente = await atualizarCliente(editando.id, form);
        setFeedback(`Cliente "${cliente.nome}" atualizado.`);
      } else {
        cliente = await criarCliente(form);
        setFeedback(`Cliente "${cliente.nome}" criado.`);
        setClienteAtivoId(cliente.id);
      }
      setModalAberto(false);
      await recarregar();
      setTimeout(() => setFeedback(''), 3500);
    } catch (e: any) {
      setErroForm(e?.message || 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function arquivar(c: TrafegoCliente) {
    if (!confirm(`Arquivar "${c.nome}"? Ele some das listas, mas o histórico fica preservado.`)) return;
    try {
      await arquivarCliente(c.id);
      setFeedback(`"${c.nome}" arquivado.`);
      await recarregar();
      setTimeout(() => setFeedback(''), 3500);
    } catch (e: any) {
      alert(e?.message || 'Falha ao arquivar');
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, responsável, contato..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
          />
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={14} /> {feedback}
        </div>
      )}
      {erroLista && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle size={14} /> {erroLista}
        </div>
      )}

      {/* Lista */}
      {loading && clientes.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Carregando clientes...
        </div>
      )}

      {!loading && visiveis.length === 0 && (
        <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
          <Users2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-slate-700">Nenhum cliente {busca ? 'encontrado para essa busca' : 'cadastrado'}.</p>
          {!busca && (
            <button onClick={abrirNovo} className="mt-3 text-indigo-600 hover:underline text-sm font-medium">
              Cadastrar o primeiro cliente
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visiveis.map(c => {
          const status = STATUS_LABEL[c.status] || STATUS_LABEL.ativo;
          return (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: c.cor_destaque || '#6366f1' }}
                >
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{c.nome}</p>
                  {c.responsavel && <p className="text-xs text-slate-500 truncate">Gestor: {c.responsavel}</p>}
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${status.classes}`}>{status.texto}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                {c.fee_mensal ? (
                  <div className="bg-slate-50 rounded px-2 py-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Fee/mês</span>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.fee_mensal)}
                  </div>
                ) : null}
                {c.email_contato && (
                  <div className="bg-slate-50 rounded px-2 py-1 truncate" title={c.email_contato}>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">E-mail</span>
                    {c.email_contato}
                  </div>
                )}
                {c.telefone_contato && (
                  <div className="bg-slate-50 rounded px-2 py-1 truncate" title={c.telefone_contato}>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Telefone</span>
                    {c.telefone_contato}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  onClick={() => setClienteAtivoId(c.id)}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Selecionar
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirEdicao(c)}
                    className="text-slate-400 hover:text-indigo-600 p-1.5 rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => arquivar(c)}
                    className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors"
                    title="Arquivar"
                  >
                    <Archive size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal cadastrar/editar */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <h3 className="font-bold">{editando ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button onClick={() => setModalAberto(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nome *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: CDS Industrial"
                  className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as any })}
                    className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="pausado">Pausado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fee mensal (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={form.fee_mensal ?? 0}
                    onChange={e => setForm({ ...form, fee_mensal: Number(e.target.value) || 0 })}
                    className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cor de destaque</label>
                <div className="flex gap-1.5 mt-1">
                  {CORES_SUGERIDAS.map(cor => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setForm({ ...form, cor_destaque: cor })}
                      className={`w-7 h-7 rounded-lg transition-all ${form.cor_destaque === cor ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                      style={{ backgroundColor: cor }}
                      title={cor}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Responsável (gestor)</label>
                <input
                  value={form.responsavel || ''}
                  onChange={e => setForm({ ...form, responsavel: e.target.value })}
                  placeholder="Quem da equipe cuida desse cliente"
                  className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">E-mail</label>
                  <input
                    value={form.email_contato || ''}
                    onChange={e => setForm({ ...form, email_contato: e.target.value })}
                    placeholder="contato@empresa.com"
                    className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Telefone</label>
                  <input
                    value={form.telefone_contato || ''}
                    onChange={e => setForm({ ...form, telefone_contato: e.target.value })}
                    placeholder="(61) 99999-9999"
                    className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Logo (URL)</label>
                <input
                  value={form.logo_url || ''}
                  onChange={e => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Observações</label>
                <textarea
                  value={form.observacoes || ''}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Histórico, condições contratuais, contexto..."
                  rows={3}
                  className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>

              {erroForm && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} /> {erroForm}
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setModalAberto(false)}
                disabled={salvando}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-60"
              >
                {salvando && <Loader2 size={14} className="animate-spin" />}
                {editando ? 'Salvar alterações' : 'Criar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
