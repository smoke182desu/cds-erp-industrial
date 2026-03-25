import React, { useState } from 'react';
import {
  X, FileText, CheckSquare, ClipboardList, Bell, ExternalLink,
  Plus, Trash2, Printer, Loader2, Check, Globe, Send, DollarSign,
  AlertCircle, ChevronDown
} from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { ContratacaoPNCP, formatarDataPNCP, formatarMoeda, urlPNCP } from '../../services/LicitacoesService';

// ── Tipos ─────────────────────────────────────────────────────────

export interface CheckItem {
  id: string;
  texto: string;
  feito: boolean;
}

export interface ItemProposta {
  id: string;
  descricao: string;
  unidade: string;
  qtd: number;
  valorUnit: number;
}

export interface LicitacaoExtra {
  numeroPregao?: string;
  urlEdital?: string;
  checklist: CheckItem[];
  itens: ItemProposta[];
  bdi: number;
  whatsappAlerta?: string; // número destino do alerta
}

const CHECKLIST_PADRAO: Omit<CheckItem, 'id'>[] = [
  { texto: 'Baixar Edital e todos os Anexos', feito: false },
  { texto: 'Verificar habilitação exigida (certidões, atestado técnico)', feito: false },
  { texto: 'Verificar prazo e local de entrega', feito: false },
  { texto: 'Calcular custo dos itens + BDI', feito: false },
  { texto: 'Verificar se possui os documentos de habilitação em dia', feito: false },
  { texto: 'Cadastrar proposta no portal', feito: false },
  { texto: 'Confirmar participação na sessão de disputa', feito: false },
  { texto: 'Enviar documentos de habilitação (se ganhou)', feito: false },
];

export function defaultExtra(): LicitacaoExtra {
  return {
    checklist: CHECKLIST_PADRAO.map((c, i) => ({ ...c, id: String(i + 1) })),
    itens: [{ id: '1', descricao: '', unidade: 'UN', qtd: 1, valorUnit: 0 }],
    bdi: 25,
  };
}

// ── ABA: EDITAL ───────────────────────────────────────────────────

const TabEdital: React.FC<{
  item: ContratacaoPNCP;
  extra: LicitacaoExtra;
  onChange: (e: Partial<LicitacaoExtra>) => void;
}> = ({ item, extra, onChange }) => {
  const [urlInput, setUrlInput] = useState(extra.urlEdital || '');
  const [mostraVisor, setMostraVisor] = useState(false);

  const salvarUrl = () => {
    onChange({ urlEdital: urlInput });
    setMostraVisor(!!urlInput);
  };

  return (
    <div className="space-y-4">
      {/* Dados básicos do PNCP */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          ['Órgão', item.orgaoEntidade.razaoSocial],
          ['Município/UF', `${item.unidadeOrgao.municipioNome} — ${item.unidadeOrgao.ufSigla}`],
          ['Publicação', formatarDataPNCP(item.dataPublicacaoPncp)],
          ['Encerramento Proposta', formatarDataPNCP(item.dataEncerramentoProposta)],
          ['Valor Estimado', formatarMoeda(item.valorTotalEstimado)],
          ['Situação', item.situacaoCompraNome],
        ].map(([label, value]) => (
          <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="font-semibold text-slate-800 text-xs mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <a href={urlPNCP(item)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
          <Globe size={14} /> Ver no PNCP
        </a>
      </div>

      {/* URL do edital */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
          URL do Edital (PDF ou link do portal)
        </label>
        <div className="flex gap-2">
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvarUrl()}
            placeholder="https://compras.gov.br/edital/..."
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          <button onClick={salvarUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">
            {mostraVisor ? 'Atualizar' : 'Abrir'}
          </button>
        </div>
      </div>

      {/* Visor inline */}
      {mostraVisor && extra.urlEdital && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between text-xs text-slate-500">
            <span className="truncate">{extra.urlEdital}</span>
            <a href={extra.urlEdital} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 ml-2 shrink-0 hover:text-blue-600"><ExternalLink size={12} /> Abrir aba</a>
          </div>
          <iframe src={extra.urlEdital} className="w-full h-96" title="Edital" />
        </div>
      )}
    </div>
  );
};

// ── ABA: CHECKLIST ────────────────────────────────────────────────

const TabChecklist: React.FC<{
  extra: LicitacaoExtra;
  onChange: (e: Partial<LicitacaoExtra>) => void;
}> = ({ extra, onChange }) => {
  const [novoItem, setNovoItem] = useState('');

  const feitos = extra.checklist.filter(c => c.feito).length;
  const pct = extra.checklist.length > 0 ? Math.round((feitos / extra.checklist.length) * 100) : 0;

  const toggle = (id: string) => onChange({
    checklist: extra.checklist.map(c => c.id === id ? { ...c, feito: !c.feito } : c)
  });

  const remover = (id: string) => onChange({ checklist: extra.checklist.filter(c => c.id !== id) });

  const adicionar = () => {
    if (!novoItem.trim()) return;
    onChange({ checklist: [...extra.checklist, { id: Date.now().toString(), texto: novoItem.trim(), feito: false }] });
    setNovoItem('');
  };

  return (
    <div className="space-y-3">
      {/* Barra de progresso */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{feitos} de {extra.checklist.length} concluídos</span>
          <span className={`font-bold ${pct === 100 ? 'text-emerald-600' : pct > 50 ? 'text-amber-600' : 'text-slate-500'}`}>{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {extra.checklist.map(item => (
          <div key={item.id} className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${item.feito ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <button onClick={() => toggle(item.id)}
              className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition ${item.feito ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-blue-400'}`}>
              {item.feito && <Check size={12} />}
            </button>
            <span className={`flex-1 text-sm ${item.feito ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.texto}</span>
            <button onClick={() => remover(item.id)} className="text-slate-300 hover:text-rose-400 transition"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      {/* Adicionar item */}
      <div className="flex gap-2">
        <input value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionar()}
          placeholder="Adicionar item ao checklist..."
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button onClick={adicionar} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

// ── ABA: PROPOSTA ─────────────────────────────────────────────────

const TabProposta: React.FC<{
  item: ContratacaoPNCP;
  extra: LicitacaoExtra;
  onChange: (e: Partial<LicitacaoExtra>) => void;
}> = ({ item, extra, onChange }) => {
  const { config } = useConfig();

  const total = extra.itens.reduce((s, i) => s + i.qtd * i.valorUnit * (1 + extra.bdi / 100), 0);

  const addItem = () => onChange({
    itens: [...extra.itens, { id: Date.now().toString(), descricao: '', unidade: 'UN', qtd: 1, valorUnit: 0 }]
  });

  const updItem = (id: string, campo: string, valor: string | number) => onChange({
    itens: extra.itens.map(i => i.id === id ? { ...i, [campo]: valor } : i)
  });

  const delItem = (id: string) => onChange({ itens: extra.itens.filter(i => i.id !== id) });

  const imprimir = () => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const linhas = extra.itens.map((it, idx) => {
      const vUnit = it.valorUnit * (1 + extra.bdi / 100);
      const sub = vUnit * it.qtd;
      return `<tr><td>${idx+1}</td><td>${it.descricao}</td><td>${it.qtd}</td><td>${it.unidade}</td><td>R$ ${vUnit.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Proposta</title>
<style>body{font-family:Arial,sans-serif;font-size:11pt;padding:20mm}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px}th{background:#f0f0f0}tfoot td{font-weight:bold}.info{margin:10px 0;line-height:1.6}.ass{margin-top:50px;text-align:center}</style>
</head><body>
<div style="display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:16px">
<div><strong>${config.nomeEmpresa || 'CDS Industrial'}</strong><br>CNPJ: ${config.cnpjEmissor || '—'}<br>Tel: ${config.telefone || '—'}</div>
<div style="text-align:right"><strong>PROPOSTA COMERCIAL</strong><br>Data: ${hoje}<br>Validade: 60 dias</div>
</div>
<h3 style="margin:0 0 10px">Pregão Eletrônico Nº ${extra.numeroPregao || '—'}</h3>
<p class="info">Ao Pregoeiro: <strong>${item.orgaoEntidade.razaoSocial}</strong><br>
Objeto: ${item.objetoCompra}</p>
<table><thead><tr><th>#</th><th>Descrição</th><th>Qtd</th><th>Un</th><th>Vl. Unit (c/ BDI ${extra.bdi}%)</th><th>Subtotal</th></tr></thead>
<tbody>${linhas}</tbody>
<tfoot><tr><td colspan="5" style="text-align:right">TOTAL</td><td>R$ ${total.toFixed(2)}</td></tr></tfoot></table>
<div class="info" style="margin-top:16px;font-size:10pt;color:#444">
• Nos preços propostos estão inclusos todos os tributos, fretes, encargos sociais e trabalhistas.<br>
• Validade da Proposta: 60 (sessenta) dias.<br>
• Prazo de Entrega: Conforme Termo de Referência (TR).<br>
• Dados Bancários para Empenho: ${(config as any).dadosBancarios || 'Banco — Ag — CC —'}.
</div>
<div class="ass"><div style="width:200px;border-top:1px solid #000;margin:0 auto"></div><p style="margin-top:6px">${config.nomeEmpresa || 'CDS Industrial'}<br>Representante Legal</p></div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="space-y-4">
      {/* Nº Pregão + BDI */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Nº do Pregão</label>
          <input value={extra.numeroPregao || ''} onChange={e => onChange({ numeroPregao: e.target.value })}
            placeholder="Ex: 045/2026" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="w-48">
          <label className="block text-xs font-semibold text-slate-500 mb-1">BDI: {extra.bdi}%</label>
          <input type="range" min="0" max="60" value={extra.bdi} onChange={e => onChange({ bdi: Number(e.target.value) })} className="w-full" />
        </div>
      </div>

      {/* Tabela de itens */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-xs text-slate-500 font-semibold">
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 w-16">Qtd</th>
              <th className="px-3 py-2 w-16">Un</th>
              <th className="px-3 py-2 w-24">Vl. Unit (R$)</th>
              <th className="px-3 py-2 w-24">c/ BDI</th>
              <th className="px-3 py-2 w-24">Subtotal</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {extra.itens.map(it => {
              const comBdi = it.valorUnit * (1 + extra.bdi / 100);
              return (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    <input value={it.descricao} onChange={e => updItem(it.id, 'descricao', e.target.value)}
                      className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={it.qtd} onChange={e => updItem(it.id, 'qtd', parseFloat(e.target.value) || 0)}
                      className="w-full border-0 bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-300 rounded" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={it.unidade} onChange={e => updItem(it.id, 'unidade', e.target.value)}
                      className="w-full border-0 bg-transparent text-sm text-center focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={it.valorUnit} onChange={e => updItem(it.id, 'valorUnit', parseFloat(e.target.value) || 0)}
                      className="w-full border-0 bg-transparent text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-300 rounded" />
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600 text-xs">{comBdi.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{(comBdi * it.qtd).toFixed(2)}</td>
                  <td className="px-1 py-1.5">
                    <button onClick={() => delItem(it.id)} className="text-slate-300 hover:text-rose-400"><Trash2 size={13} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-emerald-50">
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-sm font-bold text-slate-700">TOTAL</td>
              <td className="px-3 py-2 text-right font-bold text-emerald-700">R$ {total.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-between">
        <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Plus size={15} /> Adicionar item
        </button>
        <button onClick={imprimir}
          className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-sm">
          <Printer size={16} /> Gerar Proposta PDF
        </button>
      </div>
    </div>
  );
};

// ── ABA: ALERTAS WHATSAPP ─────────────────────────────────────────

const TabAlertas: React.FC<{
  item: ContratacaoPNCP;
  extra: LicitacaoExtra;
  onChange: (e: Partial<LicitacaoExtra>) => void;
}> = ({ item, extra, onChange }) => {
  const [zapiInstance, setZapiInstance] = useState(localStorage.getItem('@cds-zapi-instance') || '');
  const [zapiToken, setZapiToken] = useState(localStorage.getItem('@cds-zapi-token') || '');
  const [numero, setNumero] = useState(extra.whatsappAlerta || '');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const salvarConfig = () => {
    localStorage.setItem('@cds-zapi-instance', zapiInstance);
    localStorage.setItem('@cds-zapi-token', zapiToken);
    onChange({ whatsappAlerta: numero });
    setFeedback('Configurações salvas!');
    setTimeout(() => setFeedback(''), 2000);
  };

  const enviarTeste = async () => {
    if (!zapiInstance || !zapiToken || !numero) {
      setFeedback('Preencha todos os campos antes de testar.');
      return;
    }
    setLoading(true);
    try {
      const phone = numero.replace(/\D/g, '');
      const msg = `🏛️ *CDS Industrial — Alerta de Licitação*\n\n📋 *${item.objetoCompra}*\n🏢 ${item.orgaoEntidade.razaoSocial}\n📍 ${item.unidadeOrgao.municipioNome}/${item.unidadeOrgao.ufSigla}\n💰 ${formatarMoeda(item.valorTotalEstimado)}\n📅 Encerra: ${formatarDataPNCP(item.dataEncerramentoProposta)}\n\n🔗 Acompanhe no ERP CDS Industrial`;
      const res = await fetch(`https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: msg }),
      });
      if (res.ok) setFeedback('✅ Mensagem enviada com sucesso!');
      else setFeedback(`❌ Erro Z-API: ${res.status}`);
    } catch {
      setFeedback('❌ Erro de conexão com a Z-API');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        <strong>Z-API</strong> — serviço brasileiro de WhatsApp Business. Crie uma conta gratuita em <a href="https://z-api.io" target="_blank" rel="noopener noreferrer" className="underline">z-api.io</a> e cole as credenciais abaixo.
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ID da Instância</label>
          <input value={zapiInstance} onChange={e => setZapiInstance(e.target.value)}
            placeholder="Ex: 3D7G9A1B2C3D4E5F" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Token da Instância</label>
          <input type="password" value={zapiToken} onChange={e => setZapiToken(e.target.value)}
            placeholder="Token gerado no painel Z-API" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Número WhatsApp (com DDD, sem +)</label>
          <input value={numero} onChange={e => setNumero(e.target.value)}
            placeholder="Ex: 61981234567" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {feedback && (
        <div className={`rounded-lg p-2.5 text-sm font-medium text-center ${feedback.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {feedback}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={salvarConfig} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
          Salvar Configuração
        </button>
        <button onClick={enviarTeste} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-60 transition">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {loading ? 'Enviando...' : 'Enviar Alerta de Teste'}
        </button>
      </div>
    </div>
  );
};

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────

interface Props {
  item: ContratacaoPNCP;
  extra: LicitacaoExtra;
  onChangeExtra: (e: Partial<LicitacaoExtra>) => void;
  onClose: () => void;
}

const ABAS = [
  { id: 'edital',    label: 'Edital',    icon: <FileText size={15}/> },
  { id: 'checklist', label: 'Checklist', icon: <CheckSquare size={15}/> },
  { id: 'proposta',  label: 'Proposta',  icon: <ClipboardList size={15}/> },
  { id: 'alertas',   label: 'Alertas WhatsApp', icon: <Bell size={15}/> },
] as const;

export const LicitacaoWorkspace: React.FC<Props> = ({ item, extra, onChangeExtra, onClose }) => {
  const [aba, setAba] = useState<'edital' | 'checklist' | 'proposta' | 'alertas'>('edital');
  const pct = extra.checklist.length > 0
    ? Math.round((extra.checklist.filter(c => c.feito).length / extra.checklist.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">

        {/* Cabeçalho */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">{item.modalidadeNome}</p>
              <h2 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug">{item.objetoCompra}</h2>
              <p className="text-xs text-slate-500 mt-1">{item.orgaoEntidade.razaoSocial} · {item.unidadeOrgao.ufSigla}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-400">Checklist</div>
                <div className={`text-sm font-bold ${pct === 100 ? 'text-emerald-600' : 'text-slate-700'}`}>{pct}%</div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={22}/></button>
            </div>
          </div>

          {/* Abas */}
          <div className="flex gap-1 mt-3">
            {ABAS.map(a => (
              <button key={a.id} onClick={() => setAba(a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  aba === a.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">
          {aba === 'edital'    && <TabEdital item={item} extra={extra} onChange={onChangeExtra} />}
          {aba === 'checklist' && <TabChecklist extra={extra} onChange={onChangeExtra} />}
          {aba === 'proposta'  && <TabProposta item={item} extra={extra} onChange={onChangeExtra} />}
          {aba === 'alertas'   && <TabAlertas item={item} extra={extra} onChange={onChangeExtra} />}
        </div>
      </div>
    </div>
  );
};
