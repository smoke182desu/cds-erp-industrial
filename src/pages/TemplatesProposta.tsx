// src/pages/TemplatesProposta.tsx — biblioteca de templates + geração rápida de proposta
import { useEffect, useState, useMemo } from 'react';
import {
  ScrollText, FileText, Plus, Loader2, Eye, Copy, Edit3, Trash2, Save, X,
  Download, CheckCircle2, AlertCircle, Sparkles, DollarSign, Calendar,
  FileDown, MessageCircle,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTrafego } from '../contexts/TrafegoContext';
import { AgenciaContextoBanner } from '../components/AgenciaContextoBanner';

interface Template {
  id: string;
  nome: string;
  categoria: string;
  descricao?: string;
  introducao_md?: string;
  conteudo_md?: string;
  itens_padrao?: any[];
  condicoes_md?: string;
  cor_destaque?: string;
  duracao_validade_dias?: number;
  global: boolean;
  ativo: boolean;
  cliente_agencia_id?: string;
}

interface ItemProposta { descricao: string; quantidade: number; valor_unit: number; }

function fmt(n: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n); }

export function TemplatesProposta() {
  const { clienteAtivo, clientes } = useTrafego();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Template | null>(null);
  const [usando, setUsando] = useState<Template | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const url = clienteAtivo ? `/api/templates/proposta?cliente_id=${clienteAtivo.id}` : `/api/templates/proposta`;
      const r = await fetch(url);
      const d = await r.json();
      setTemplates(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, [clienteAtivo?.id]);

  async function salvar(t: Template) {
    const url = t.id ? `/api/templates/proposta?id=${t.id}` : '/api/templates/proposta';
    const method = t.id ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
    setEditando(null);
    carregar();
  }
  async function remover(id: string) {
    if (!confirm('Remover template?')) return;
    await fetch(`/api/templates/proposta?id=${id}`, { method: 'DELETE' });
    carregar();
  }
  async function clonar(t: Template) {
    const novo = { ...t, nome: `${t.nome} (cópia)`, global: false, cliente_agencia_id: clienteAtivo?.id };
    delete (novo as any).id;
    await fetch('/api/templates/proposta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo) });
    carregar();
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Templates de Proposta</h1>
            <p className="text-sm text-slate-500">Modelos pré-prontos para fechar novos clientes rápido</p>
          </div>
          <button onClick={() => setEditando({ nome: '', categoria: 'agencia', global: false, ativo: true } as Template)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg">
            <Plus className="w-4 h-4" /> Novo template
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {clienteAtivo && (
          <div className="mb-4">
            <AgenciaContextoBanner contexto="templates" />
          </div>
        )}

        {loading ? (
          <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map(t => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition">
                <div className="px-4 py-3 text-white" style={{ backgroundColor: t.cor_destaque || '#6366f1' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold truncate">{t.nome}</h3>
                    {t.global && <span className="text-[10px] bg-white/30 px-1.5 py-0.5 rounded uppercase font-bold">Global</span>}
                  </div>
                  <p className="text-xs opacity-90 mt-0.5">{t.categoria}</p>
                </div>
                <div className="p-4">
                  {t.descricao && <p className="text-sm text-slate-600 mb-3">{t.descricao}</p>}
                  {(t.itens_padrao || []).length > 0 && (
                    <div className="space-y-1 mb-3">
                      {(t.itens_padrao || []).slice(0,3).map((it: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-slate-50 px-2 py-1 rounded">
                          <span className="text-slate-700 truncate">{it.descricao}</span>
                          <span className="font-semibold text-slate-900 ml-2">{fmt(Number(it.valor_unit))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 pt-2 border-t border-slate-100">
                    <button onClick={() => setUsando(t)} className="flex-1 text-xs font-semibold px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" /> Usar
                    </button>
                    <button onClick={() => setEditando(t)} className="px-2 py-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={() => clonar(t)} className="px-2 py-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded" title="Duplicar para essa empresa">
                      <Copy className="w-3 h-3" />
                    </button>
                    {!t.global && (
                      <button onClick={() => remover(t.id)} className="px-2 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && <ModalEditarTemplate t={editando} onClose={() => setEditando(null)} onSalvar={salvar} clientes={clientes} />}
      {usando && <ModalUsarTemplate template={usando} cliente={clienteAtivo} onClose={() => setUsando(null)} />}
    </div>
  );
}

function ModalEditarTemplate({ t, onClose, onSalvar, clientes }: any) {
  const [f, setF] = useState<Template>(t);
  const [itensJson, setItensJson] = useState(JSON.stringify(t.itens_padrao || [], null, 2));
  function up(k: any, v: any) { setF({ ...f, [k]: v }); }

  async function salvar() {
    try {
      const itens = JSON.parse(itensJson);
      await onSalvar({ ...f, itens_padrao: itens });
    } catch (e: any) {
      alert('JSON dos itens inválido: ' + e.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-800">{f.id ? 'Editar' : 'Novo'} template</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Nome *</label>
              <input value={f.nome} onChange={e => up('nome', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Categoria</label>
              <select value={f.categoria} onChange={e => up('categoria', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                {['agencia','industrial','servico','produto','assinatura','outro'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Descrição curta</label>
            <input value={f.descricao || ''} onChange={e => up('descricao', e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Introdução (markdown)</label>
            <textarea value={f.introducao_md || ''} onChange={e => up('introducao_md', e.target.value)} rows={3} className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg" placeholder="# Proposta para {{cliente_nome}}" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Conteúdo (markdown)</label>
            <textarea value={f.conteudo_md || ''} onChange={e => up('conteudo_md', e.target.value)} rows={7} className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Condições</label>
            <textarea value={f.condicoes_md || ''} onChange={e => up('condicoes_md', e.target.value)} rows={2} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Itens padrão (JSON)</label>
            <textarea value={itensJson} onChange={e => setItensJson(e.target.value)} rows={4} className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg" />
            <p className="text-[10px] text-slate-400 mt-1">Formato: [{`{"descricao":"...","quantidade":1,"valor_unit":100}`}]</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Cor destaque</label>
              <input type="color" value={f.cor_destaque || '#6366f1'} onChange={e => up('cor_destaque', e.target.value)} className="w-full h-10 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Validade (dias)</label>
              <input type="number" value={f.duracao_validade_dias || 30} onChange={e => up('duracao_validade_dias', +e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="checkbox" checked={!!f.ativo} onChange={e => up('ativo', e.target.checked)} className="accent-amber-600" />
                <span>Ativo</span>
              </label>
            </div>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={salvar} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ModalUsarTemplate({ template, cliente, onClose }: any) {
  const [nomeContato, setNomeContato] = useState(cliente?.responsavel || '');
  const [empresaContato, setEmpresaContato] = useState(cliente?.nome || '');
  const [itens, setItens] = useState<ItemProposta[]>(template.itens_padrao || []);
  const [observacoes, setObservacoes] = useState('');
  const [validadeDias, setValidadeDias] = useState(template.duracao_validade_dias || 30);
  const [feedback, setFeedback] = useState('');

  const total = useMemo(() => itens.reduce((s, i) => s + (i.quantidade * i.valor_unit), 0), [itens]);

  function atualizarItem(i: number, k: keyof ItemProposta, v: any) {
    const arr = [...itens]; (arr[i] as any)[k] = v; setItens(arr);
  }
  function addItem() { setItens([...itens, { descricao: '', quantidade: 1, valor_unit: 0 }]); }
  function removerItem(i: number) { setItens(itens.filter((_, j) => j !== i)); }

  function substitui(s: string) {
    return (s || '')
      .replace(/\{\{cliente_nome\}\}/g, empresaContato || '<<cliente>>')
      .replace(/\{\{contato_nome\}\}/g, nomeContato || '');
  }

  function gerarPDF() {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const cor = template.cor_destaque || '#6366f1';
    const hoje = new Date();
    const valid = new Date(hoje.getTime() + (validadeDias * 24*60*60*1000));

    // Header colorido
    pdf.setFillColor(cor);
    pdf.rect(0, 0, 210, 45, 'F');
    pdf.setTextColor(255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('PROPOSTA COMERCIAL', 14, 12);
    pdf.setFontSize(22);
    const split = pdf.splitTextToSize(template.nome, 180);
    pdf.text(split, 14, 22);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Para: ${empresaContato}${nomeContato ? ' (' + nomeContato + ')' : ''}`, 14, 38);

    let y = 55;
    pdf.setTextColor(60);

    // Intro
    if (template.introducao_md) {
      const intro = substitui(template.introducao_md).replace(/^#\s+.*$/gm, '').trim();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const sp = pdf.splitTextToSize(intro, 182);
      pdf.text(sp, 14, y);
      y += sp.length * 5 + 4;
    }

    // Conteúdo
    if (template.conteudo_md) {
      const linhas = substitui(template.conteudo_md).split('\n');
      for (const l of linhas) {
        const t = l.trim();
        if (!t) { y += 2; continue; }
        if (y > 270) { pdf.addPage(); y = 20; }
        if (t.startsWith('## ')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(13);
          pdf.text(t.replace('## ', ''), 14, y);
          y += 6;
        } else if (t.startsWith('# ')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.text(t.replace('# ', ''), 14, y);
          y += 8;
        } else if (t.startsWith('- ')) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          const sp = pdf.splitTextToSize('• ' + t.replace('- ', '').replace(/\*\*/g, ''), 180);
          pdf.text(sp, 16, y);
          y += sp.length * 4.5 + 1;
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          const sp = pdf.splitTextToSize(t.replace(/\*\*/g, ''), 182);
          pdf.text(sp, 14, y);
          y += sp.length * 4.5 + 1;
        }
      }
      y += 4;
    }

    // Tabela de itens
    if (itens.length > 0) {
      if (y > 230) { pdf.addPage(); y = 20; }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Investimento', 14, y);
      y += 4;
      autoTable(pdf, {
        startY: y,
        head: [['Descrição', 'Qtd', 'Valor Unit', 'Subtotal']],
        body: itens.map(it => [
          it.descricao,
          String(it.quantidade),
          fmt(Number(it.valor_unit)),
          fmt(it.quantidade * it.valor_unit),
        ]),
        foot: [['', '', 'Total', fmt(total)]],
        theme: 'striped',
        headStyles: { fillColor: cor as any },
        footStyles: { fillColor: cor as any, textColor: 255, fontStyle: 'bold' },
      });
      y = (pdf as any).lastAutoTable.finalY + 10;
    }

    // Condições
    if (template.condicoes_md) {
      if (y > 260) { pdf.addPage(); y = 20; }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Condições', 14, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(80);
      const sp = pdf.splitTextToSize(template.condicoes_md, 182);
      pdf.text(sp, 14, y);
      y += sp.length * 4 + 4;
    }

    if (observacoes) {
      if (y > 260) { pdf.addPage(); y = 20; }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(60);
      pdf.text('Observações', 14, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(80);
      const sp = pdf.splitTextToSize(observacoes, 182);
      pdf.text(sp, 14, y);
      y += sp.length * 4 + 4;
    }

    // Rodapé com validade
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`Proposta válida até ${valid.toLocaleDateString('pt-BR')} · Gerado em ${hoje.toLocaleString('pt-BR')}`, 14, 290);
      pdf.text(`Página ${i} de ${pages}`, 196, 290, { align: 'right' });
    }

    pdf.save(`proposta-${(empresaContato || 'cliente').toLowerCase().replace(/\s+/g,'-')}-${hoje.toISOString().slice(0,10)}.pdf`);
    setFeedback('PDF gerado!');
    setTimeout(() => setFeedback(''), 2000);
  }

  function copiarMensagemWhatsapp() {
    const msg = `Olá ${nomeContato || ''}!\n\nSegue em anexo nossa *Proposta Comercial* — ${template.nome}.\n\n💰 Investimento total: ${fmt(total)}\n📅 Validade: ${validadeDias} dias\n\nAlguma dúvida, me avise!`;
    navigator.clipboard.writeText(msg);
    setFeedback('Mensagem WhatsApp copiada!');
    setTimeout(() => setFeedback(''), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Gerar proposta</h3>
            <p className="text-xs text-slate-500">a partir de: <strong>{template.nome}</strong></p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Empresa cliente</label>
              <input value={empresaContato} onChange={e => setEmpresaContato(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Contato (nome)</label>
              <input value={nomeContato} onChange={e => setNomeContato(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700">Itens da proposta</label>
              <button onClick={addItem} className="text-xs text-amber-600 hover:underline">+ adicionar item</button>
            </div>
            <div className="space-y-2">
              {itens.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={it.descricao} onChange={e => atualizarItem(i, 'descricao', e.target.value)} placeholder="Descrição" className="col-span-7 px-2 py-1 text-sm border border-slate-300 rounded" />
                  <input type="number" value={it.quantidade} onChange={e => atualizarItem(i, 'quantidade', +e.target.value)} className="col-span-2 px-2 py-1 text-sm border border-slate-300 rounded text-center" />
                  <input type="number" step="0.01" value={it.valor_unit} onChange={e => atualizarItem(i, 'valor_unit', +e.target.value)} className="col-span-2 px-2 py-1 text-sm border border-slate-300 rounded text-right" />
                  <button onClick={() => removerItem(i)} className="col-span-1 text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            {itens.length > 0 && (
              <div className="mt-3 flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Total:</span>
                <span className="text-xl font-bold text-slate-900">{fmt(total)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Validade (dias)</label>
              <input type="number" value={validadeDias} onChange={e => setValidadeDias(+e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Observações adicionais</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Algum detalhe específico pra essa proposta?" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>

          {feedback && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {feedback}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={copiarMensagemWhatsapp} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={gerarPDF} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Baixar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplatesProposta;
