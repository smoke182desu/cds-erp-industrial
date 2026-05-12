import { useState, useCallback } from 'react';
import { Loader2, Target, Palette, TrendingUp, BarChart3, Megaphone, RefreshCw, ChevronDown, ChevronUp, Copy, CheckCircle2, AlertCircle, Sparkles, Send } from 'lucide-react';

type Plataforma = 'instagram' | 'facebook' | 'google' | 'tiktok' | 'linkedin';
const PLATAFORMAS: { id: Plataforma; nome: string; icone: string }[] = [
  { id: 'instagram', nome: 'Instagram', icone: '📸' },
  { id: 'facebook', nome: 'Facebook', icone: '📘' },
  { id: 'google', nome: 'Google Ads', icone: '🔍' },
  { id: 'tiktok', nome: 'TikTok', icone: '🎵' },
  { id: 'linkedin', nome: 'LinkedIn', icone: '💼' },
];

const OBJETIVOS = ['Gerar leads qualificados', 'Awareness de marca', 'Trafego para site/WhatsApp', 'Remarketing', 'Lancamento de produto'];

export function Marketing() {
  const [produto, setProduto] = useState('');
  const [publicoAlvo, setPublicoAlvo] = useState('');
  const [objetivo, setObjetivo] = useState(OBJETIVOS[0]);
  const [budget, setBudget] = useState('');
  const [plataforma, setPlataforma] = useState<Plataforma>('instagram');
  const [contextoExtra, setContextoExtra] = useState('');

  // Abbacchio state
  const [abLoading, setAbLoading] = useState(false);
  const [abResult, setAbResult] = useState<any>(null);
  const [abErro, setAbErro] = useState('');
  const [abExpand, setAbExpand] = useState(true);

  // Narancia state
  const [naLoading, setNaLoading] = useState(false);
  const [naResult, setNaResult] = useState<any>(null);
  const [naErro, setNaErro] = useState('');
  const [naExpand, setNaExpand] = useState(true);

  const [copied, setCopied] = useState('');

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const chamarAbbacchio = useCallback(async () => {
    setAbLoading(true); setAbErro('');
    try {
      const res = await fetch('/api/assistente-vendas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'marketing-abbacchio', produto, publicoAlvo, objetivo, budget, plataforma: PLATAFORMAS.find(p => p.id === plataforma)?.nome, contextoExtra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro');
      setAbResult(json.resultado);
    } catch (e: any) { setAbErro(e.message); } finally { setAbLoading(false); }
  }, [produto, publicoAlvo, objetivo, budget, plataforma, contextoExtra]);

  const chamarNarancia = useCallback(async () => {
    setNaLoading(true); setNaErro('');
    try {
      const res = await fetch('/api/assistente-vendas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'marketing-narancia', produto, publicoAlvo, objetivo, plataforma: PLATAFORMAS.find(p => p.id === plataforma)?.nome, contextoExtra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro');
      setNaResult(json.resultado);
    } catch (e: any) { setNaErro(e.message); } finally { setNaLoading(false); }
  }, [produto, publicoAlvo, objetivo, plataforma, contextoExtra]);

  const gerarTudo = () => { chamarAbbacchio(); chamarNarancia(); };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-rose-600 via-pink-600 to-violet-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2"><Megaphone className="w-5 h-5" /> Marketing & Publicidade</h1>
            <p className="text-xs text-white/60 mt-0.5">Capture leads para alimentar o funil de vendas</p>
          </div>
          <button onClick={gerarTudo} disabled={abLoading || naLoading}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> Gerar Estrategia + Conteudo
          </button>
        </div>
      </div>

      {/* Briefing Form */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Produto / Servico</label>
            <input value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex: Escadas metalicas sob medida"
              className="w-full mt-0.5 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400 outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Publico-Alvo</label>
            <input value={publicoAlvo} onChange={e => setPublicoAlvo(e.target.value)} placeholder="Ex: Construtoras em Brasilia"
              className="w-full mt-0.5 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400 outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Objetivo</label>
            <select value={objetivo} onChange={e => setObjetivo(e.target.value)}
              className="w-full mt-0.5 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400 outline-none bg-white">
              {OBJETIVOS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Budget/mes</label>
              <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="R$ 500"
                className="w-full mt-0.5 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Plataforma</label>
              <div className="flex gap-1 mt-0.5">
                {PLATAFORMAS.map(p => (
                  <button key={p.id} onClick={() => setPlataforma(p.id)} title={p.nome}
                    className={`text-base w-8 h-8 rounded-lg flex items-center justify-center transition-all ${plataforma === p.id ? 'bg-pink-100 ring-2 ring-pink-400' : 'hover:bg-gray-100'}`}>
                    {p.icone}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <input value={contextoExtra} onChange={e => setContextoExtra(e.target.value)} placeholder="Contexto extra (opcional): campanha atual, sazonalidade, concorrentes..."
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-400 outline-none" />
        </div>
      </div>

      {/* Split Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Abbacchio Panel - Gestor de Trafego */}
        <div className="flex-1 border-r overflow-y-auto bg-slate-50">
          <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm flex items-center gap-1.5">🎯 Leone Abbacchio</p>
              <p className="text-[10px] text-white/50">Gestor de Marketing & Trafego · Metas · Cobranca</p>
            </div>
            <button onClick={chamarAbbacchio} disabled={abLoading} className="text-xs bg-white/20 hover:bg-white/30 w-8 h-8 rounded-lg flex items-center justify-center">
              {abLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
          <div className="p-4 space-y-3">
            {abLoading && !abResult && (
              <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" /><p className="text-xs text-gray-500 mt-2">Abbacchio analisando mercado...</p></div>
            )}
            {abErro && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{abErro}</div>}
            {abResult && (
              <>
                {abResult.diagnostico && (
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">📊 Diagnostico</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{abResult.diagnostico}</p>
                  </div>
                )}
                {abResult.estrategia && (
                  <div className="bg-white border rounded-xl p-3">
                    <button className="w-full flex items-center justify-between" onClick={() => setAbExpand(e => !e)}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">🎯 Estrategia</p>
                      {abExpand ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {abExpand && (
                      <div className="mt-2 space-y-2">
                        {abResult.estrategia.posicionamento && <p className="text-xs text-slate-700"><span className="font-semibold">Posicionamento:</span> {abResult.estrategia.posicionamento}</p>}
                        {abResult.estrategia.canaisPrioritarios?.map((c: any, i: number) => (
                          <div key={i} className="bg-slate-50 rounded-lg p-2 text-xs">
                            <p className="font-semibold text-slate-800">{c.canal}</p>
                            <p className="text-slate-600">{c.motivo}</p>
                            <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                              {c.budgetSugerido && <span>💰 {c.budgetSugerido}</span>}
                              {c.roiEsperado && <span>📈 ROI {c.roiEsperado}</span>}
                            </div>
                          </div>
                        ))}
                        {abResult.estrategia.funil && (
                          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2"><p className="font-bold text-blue-600">TOFU</p><p className="text-blue-700 mt-0.5">{abResult.estrategia.funil.tofu}</p></div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2"><p className="font-bold text-amber-600">MOFU</p><p className="text-amber-700 mt-0.5">{abResult.estrategia.funil.mofu}</p></div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2"><p className="font-bold text-green-600">BOFU</p><p className="text-green-700 mt-0.5">{abResult.estrategia.funil.bofu}</p></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {abResult.campanhas?.length > 0 && (
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">📢 Campanhas Sugeridas</p>
                    {abResult.campanhas.map((c: any, i: number) => (
                      <div key={i} className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 mb-1.5 last:mb-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-indigo-800">{c.nome}</p>
                          <span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">{c.plataforma}</span>
                        </div>
                        <p className="text-[11px] text-indigo-700 mt-0.5">{c.segmentacao}</p>
                        <div className="flex gap-3 mt-1 text-[10px] text-indigo-600">
                          {c.orcamentoDiario && <span>💰 {c.orcamentoDiario}/dia</span>}
                          {c.duracao && <span>⏱ {c.duracao}</span>}
                          {c.metricasAlvo?.cpl && <span>CPL: {c.metricasAlvo.cpl}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {abResult.kpis?.length > 0 && (
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">📏 Metas & KPIs</p>
                    <div className="space-y-1">
                      {abResult.kpis.map((k: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                          <span className="text-xs font-medium text-emerald-800">{k.nome}</span>
                          <div className="text-right">
                            <span className="text-xs font-bold text-emerald-700">{k.meta}</span>
                            {k.prazo && <span className="text-[10px] text-emerald-500 ml-1.5">({k.prazo})</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {abResult.alertas?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">⚠️ Alertas</p>
                    {abResult.alertas.map((a: string, i: number) => <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span>{a}</p>)}
                  </div>
                )}
                {abResult.proximosPassos?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">🚀 Proximos Passos</p>
                    {abResult.proximosPassos.map((p: string, i: number) => <p key={i} className="text-xs text-blue-700 flex items-start gap-1.5"><span className="font-bold">{i + 1}.</span>{p}</p>)}
                  </div>
                )}
              </>
            )}
            {!abResult && !abLoading && !abErro && (
              <div className="text-center py-12 text-gray-400">
                <Target className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Preencha o briefing e clique em Gerar</p>
                <p className="text-[10px] mt-1">Abbacchio criara a estrategia de trafego e metas</p>
              </div>
            )}
          </div>
        </div>

        {/* Narancia Panel - Criador de Conteudo */}
        <div className="flex-1 overflow-y-auto bg-orange-50/30">
          <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm flex items-center gap-1.5">🎨 Narancia Ghirga</p>
              <p className="text-[10px] text-white/50">Criador de Conteudo & Design · Copys · Anuncios</p>
            </div>
            <button onClick={chamarNarancia} disabled={naLoading} className="text-xs bg-white/20 hover:bg-white/30 w-8 h-8 rounded-lg flex items-center justify-center">
              {naLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
          <div className="p-4 space-y-3">
            {naLoading && !naResult && (
              <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-orange-400 mx-auto" /><p className="text-xs text-gray-500 mt-2">Narancia criando conteudo...</p></div>
            )}
            {naErro && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{naErro}</div>}
            {naResult && (
              <>
                {naResult.analiseCreativa && (
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1">🧠 Analise Criativa</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{naResult.analiseCreativa}</p>
                  </div>
                )}
                {naResult.copies?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">✍️ Copies Geradas</p>
                    {naResult.copies.map((c: any, i: number) => (
                      <div key={i} className="bg-white border rounded-xl p-3 group relative">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">{c.tipo}</span>
                            <span className="text-[10px] text-gray-400">{c.plataforma}</span>
                          </div>
                          <button onClick={() => copyText(`${c.headline}\n\n${c.corpo}\n\n${c.cta}${c.hashtags?.length ? '\n\n' + c.hashtags.join(' ') : ''}`, `copy-${i}`)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-500 transition-all" title="Copiar">
                            {copied === `copy-${i}` ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-sm font-bold text-gray-900 mb-1">{c.headline}</p>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{c.corpo}</p>
                        {c.cta && <p className="text-xs font-semibold text-orange-600 mt-1.5 flex items-center gap-1"><Send className="w-3 h-3" />{c.cta}</p>}
                        {c.hashtags?.length > 0 && <p className="text-[10px] text-blue-500 mt-1.5">{c.hashtags.join(' ')}</p>}
                        {c.observacao && <p className="text-[10px] text-gray-400 mt-1 italic">{c.observacao}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {naResult.variacoes?.length > 0 && (
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">🔬 Testes A/B</p>
                    {naResult.variacoes.map((v: any, i: number) => (
                      <div key={i} className="bg-violet-50 border border-violet-200 rounded-lg p-2.5 mb-1.5 last:mb-0">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><p className="text-[10px] font-bold text-violet-500">Versao A</p><p className="text-violet-800">{v.original}</p></div>
                          <div><p className="text-[10px] font-bold text-violet-500">Versao B</p><p className="text-violet-800">{v.variacao}</p></div>
                        </div>
                        <p className="text-[10px] text-violet-600 mt-1 italic">Hipotese: {v.hipotese}</p>
                      </div>
                    ))}
                  </div>
                )}
                {naResult.briefingDesign?.length > 0 && (
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-[10px] font-bold text-pink-500 uppercase tracking-wider mb-2">🎨 Briefing de Design</p>
                    {naResult.briefingDesign.map((b: any, i: number) => (
                      <div key={i} className="bg-pink-50 border border-pink-200 rounded-lg p-2.5 mb-1.5 last:mb-0 text-xs">
                        <p className="font-semibold text-pink-800">{b.peca} <span className="font-normal text-pink-500">({b.formato})</span></p>
                        <p className="text-pink-700 mt-0.5">{b.elementosVisuais}</p>
                        <div className="flex gap-3 mt-1 text-[10px] text-pink-600">
                          {b.paleta && <span>🎨 {b.paleta}</span>}
                          {b.tipografia && <span>🔤 {b.tipografia}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {naResult.calendarioSugerido?.length > 0 && (
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-2">📅 Calendario de Conteudo</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {naResult.calendarioSugerido.map((d: any, i: number) => (
                        <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <p className="font-semibold text-emerald-800">{d.dia}</p>
                          <p className="text-emerald-600 text-[10px]">{d.conteudo} · {d.formato}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {naResult.proximosPassos?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">🚀 Proximos Passos</p>
                    {naResult.proximosPassos.map((p: string, i: number) => <p key={i} className="text-xs text-blue-700 flex items-start gap-1.5"><span className="font-bold">{i + 1}.</span>{p}</p>)}
                  </div>
                )}
              </>
            )}
            {!naResult && !naLoading && !naErro && (
              <div className="text-center py-12 text-gray-400">
                <Palette className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Preencha o briefing e clique em Gerar</p>
                <p className="text-[10px] mt-1">Narancia criara copies, anuncios e briefings</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
