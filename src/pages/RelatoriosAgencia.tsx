// src/pages/RelatoriosAgencia.tsx — Gera relatórios mensais em PDF
import { useEffect, useState } from 'react';
import {
  FileBarChart, Download, Loader2, AlertCircle, CheckCircle2, Calendar,
  Send, Eye, Sparkles, MessageCircle, Users2, Target, FileText, ChevronDown,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTrafego } from '../contexts/TrafegoContext';

interface DadosRelatorio {
  empresa: any;
  periodo: any;
  resumo: {
    leads_novos: number; ganhos: number; valor_ganhos: number; taxa_conversao: string;
    mensagens_recebidas: number; mensagens_enviadas: number;
    posts_publicados: number; posts_aprovados: number;
    campanhas_ativas: number; orcamento_mes_estimado: number;
    propostas_enviadas: number; propostas_aprovadas: number;
  };
  por_etapa_funil: Record<string, number>;
  destaques: any;
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n); }

const ETAPA_LABEL: Record<string, string> = {
  lead_novo: 'Leads novos', contato_feito: 'Contato feito', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta enviada', negociacao: 'Em negociação',
  fechado_ganho: 'Fechado ganho', fechado_perdido: 'Fechado perdido',
};

export function RelatoriosAgencia() {
  const { clientes, clienteAtivo, setClienteAtivoId } = useTrafego();
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}`);
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  async function carregar() {
    if (!clienteAtivo) return;
    setLoading(true); setDados(null);
    try {
      const r = await fetch(`/api/relatorios/mensal?cliente_id=${clienteAtivo.id}&mes=${mes}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'erro');
      setDados(d);
    } catch (e: any) {
      setFeedback({ tipo: 'erro', msg: e?.message || 'erro' });
    } finally { setLoading(false); }
  }
  useEffect(() => { if (clienteAtivo) carregar(); }, [clienteAtivo?.id, mes]);

  function gerarPDF(): jsPDF | null {
    if (!dados) return null;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const cor = dados.empresa.cor || '#6366f1';

    // Cabeçalho colorido
    pdf.setFillColor(cor);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('RELATÓRIO MENSAL · AGÊNCIA', 14, 12);
    pdf.setFontSize(20);
    pdf.text(dados.empresa.nome, 14, 22);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(dados.periodo.mes_nome.toUpperCase(), 14, 30);

    // Resumo executivo
    let y = 55;
    pdf.setTextColor(40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Resumo Executivo', 14, y);
    y += 7;

    const r = dados.resumo;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60);

    const linhas = [
      `Foram captados ${r.leads_novos} leads novos no mês, com ${r.ganhos} negócios fechados (${r.taxa_conversao}% conversão).`,
      `Valor total fechado: ${fmt(r.valor_ganhos)}. ${r.propostas_enviadas} propostas enviadas, ${r.propostas_aprovadas} aprovadas.`,
      `Comunicação: ${r.mensagens_recebidas} mensagens recebidas e ${r.mensagens_enviadas} enviadas via WhatsApp.`,
      `Conteúdo: ${r.posts_publicados} posts publicados e ${r.campanhas_ativas} campanhas ativas com ${fmt(r.orcamento_mes_estimado)} de investimento estimado.`,
    ];
    for (const l of linhas) {
      const split = pdf.splitTextToSize(l, 182);
      pdf.text(split, 14, y);
      y += split.length * 5 + 1;
    }

    y += 5;
    // KPIs em cards
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(40);
    pdf.text('Indicadores Principais', 14, y);
    y += 5;

    autoTable(pdf, {
      startY: y,
      head: [['Indicador', 'Valor']],
      body: [
        ['Leads captados',          String(r.leads_novos)],
        ['Negócios fechados',       String(r.ganhos)],
        ['Taxa de conversão',       r.taxa_conversao + '%'],
        ['Valor fechado',           fmt(r.valor_ganhos)],
        ['Propostas enviadas',      String(r.propostas_enviadas)],
        ['Propostas aprovadas',     String(r.propostas_aprovadas)],
        ['Mensagens recebidas',     String(r.mensagens_recebidas)],
        ['Mensagens enviadas',      String(r.mensagens_enviadas)],
        ['Posts publicados',        String(r.posts_publicados)],
        ['Posts aprovados',         String(r.posts_aprovados)],
        ['Campanhas ativas',        String(r.campanhas_ativas)],
        ['Orçamento Ads estimado',  fmt(r.orcamento_mes_estimado)],
      ],
      theme: 'striped',
      headStyles: { fillColor: cor as any },
      styles: { fontSize: 10 },
    });

    y = (pdf as any).lastAutoTable.finalY + 10;

    // Funil de vendas
    if (Object.keys(dados.por_etapa_funil).length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Funil de Vendas', 14, y);
      y += 5;

      const etapas = Object.entries(dados.por_etapa_funil).map(([k, v]) => [ETAPA_LABEL[k] || k, String(v)]);
      autoTable(pdf, {
        startY: y,
        head: [['Etapa', 'Quantidade']],
        body: etapas as any,
        theme: 'striped',
        headStyles: { fillColor: cor as any },
      });
    }

    // Rodapé
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`${dados.empresa.nome} · ${dados.periodo.mes_nome} · página ${i} de ${pages}`, 14, 290);
      pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 196, 290, { align: 'right' });
    }

    return pdf;
  }

  function baixarPdf() {
    const pdf = gerarPDF();
    if (!pdf || !dados) return;
    pdf.save(`relatorio-${dados.empresa.slug}-${dados.periodo.mes}.pdf`);
  }

  function copiarMensagemWhatsapp() {
    if (!dados) return;
    const r = dados.resumo;
    const msg = `📊 *Relatório de ${dados.periodo.mes_nome}* — ${dados.empresa.nome}\n\n` +
      `✨ Resumo do mês:\n` +
      `• ${r.leads_novos} leads novos\n` +
      `• ${r.ganhos} negócios fechados (${r.taxa_conversao}%)\n` +
      `• ${fmt(r.valor_ganhos)} em valor fechado\n` +
      `• ${r.mensagens_recebidas} mensagens recebidas\n` +
      `• ${r.posts_publicados} posts publicados\n` +
      `• ${r.campanhas_ativas} campanhas ativas\n\n` +
      `📎 PDF completo em anexo. Qualquer dúvida estou à disposição!`;
    navigator.clipboard.writeText(msg);
    setFeedback({ tipo: 'ok', msg: 'Mensagem copiada! Cole no WhatsApp do cliente e anexe o PDF.' });
    setTimeout(() => setFeedback(null), 3000);
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <FileBarChart className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Relatórios Mensais</h1>
            <p className="text-sm text-slate-500">Gera PDFs prontos pra enviar pros clientes</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* Filtros */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-700">Empresa:</label>
          <select value={clienteAtivo?.id || ''} onChange={e => setClienteAtivoId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg flex-1 min-w-[200px]">
            <option value="">— selecione —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          <label className="text-xs font-semibold text-slate-700">Mês:</label>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </div>

        {feedback && (
          <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
            feedback.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedback.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {feedback.msg}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
        ) : !clienteAtivo ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            Selecione uma empresa pra gerar o relatório.
          </div>
        ) : dados && (
          <>
            {/* Preview do relatório */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 text-white" style={{ backgroundColor: dados.empresa.cor }}>
                <p className="text-xs uppercase tracking-wider opacity-80">Relatório · Agência</p>
                <h2 className="text-2xl font-bold mt-0.5">{dados.empresa.nome}</h2>
                <p className="text-sm opacity-90 mt-0.5 capitalize">{dados.periodo.mes_nome}</p>
              </div>

              <div className="p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-800">Resumo Executivo</h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Foram captados <strong>{dados.resumo.leads_novos}</strong> leads novos no mês, com <strong>{dados.resumo.ganhos}</strong> negócios fechados ({dados.resumo.taxa_conversao}% de conversão).
                  Valor total fechado: <strong>{fmt(dados.resumo.valor_ganhos)}</strong>.
                  Comunicação ativa com <strong>{dados.resumo.mensagens_recebidas}</strong> mensagens recebidas via WhatsApp.
                  Conteúdo: <strong>{dados.resumo.posts_publicados}</strong> posts publicados e <strong>{dados.resumo.campanhas_ativas}</strong> campanhas ativas
                  com <strong>{fmt(dados.resumo.orcamento_mes_estimado)}</strong> de investimento.
                </p>

                <h3 className="text-base font-bold text-slate-800 pt-3 border-t border-slate-200">Indicadores</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Leads novos" value={dados.resumo.leads_novos} icon={Users2} cor={dados.empresa.cor} />
                  <StatCard label="Negócios fechados" value={dados.resumo.ganhos} icon={CheckCircle2} cor={dados.empresa.cor} />
                  <StatCard label="Conversão" value={dados.resumo.taxa_conversao + '%'} icon={Sparkles} cor={dados.empresa.cor} />
                  <StatCard label="Valor fechado" value={fmt(dados.resumo.valor_ganhos)} icon={Target} cor={dados.empresa.cor} />
                  <StatCard label="Msgs recebidas" value={dados.resumo.mensagens_recebidas} icon={MessageCircle} cor={dados.empresa.cor} />
                  <StatCard label="Msgs enviadas" value={dados.resumo.mensagens_enviadas} icon={MessageCircle} cor={dados.empresa.cor} />
                  <StatCard label="Posts publicados" value={dados.resumo.posts_publicados} icon={FileText} cor={dados.empresa.cor} />
                  <StatCard label="Campanhas ativas" value={dados.resumo.campanhas_ativas} icon={Target} cor={dados.empresa.cor} />
                </div>

                {Object.keys(dados.por_etapa_funil).length > 0 && (
                  <>
                    <h3 className="text-base font-bold text-slate-800 pt-3 border-t border-slate-200">Funil de Vendas</h3>
                    <div className="space-y-1">
                      {Object.entries(dados.por_etapa_funil).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-3">
                          <span className="text-xs text-slate-600 w-40">{ETAPA_LABEL[k] || k}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (v / dados.resumo.leads_novos) * 100)}%`, backgroundColor: dados.empresa.cor }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-12 text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-2 justify-end">
                <button onClick={copiarMensagemWhatsapp} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Copiar mensagem WhatsApp
                </button>
                <button onClick={baixarPdf} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
                  <Download className="w-4 h-4" /> Baixar PDF
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, cor }: any) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <Icon className="w-4 h-4 text-slate-400 mb-1" />
      <div className="text-lg font-bold text-slate-900 leading-tight">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default RelatoriosAgencia;
