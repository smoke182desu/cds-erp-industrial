// src/pages/trafego/CampanhaWizard.tsx — multi-step de criação de campanha
import { useState, useMemo } from 'react';
import {
  X, ArrowRight, ArrowLeft, Loader2, AlertCircle, Sparkles, CheckCircle2,
  Target, Users2, DollarSign, Image as ImgIcon, Eye, Globe,
} from 'lucide-react';
import type { Campanha } from './TrafegoCampanhas';
import { GeradorCriativoModal, type Variacao } from './GeradorCriativoModal';

interface Props {
  clienteAgenciaId: string;
  clienteNome: string;
  onClose: () => void;
  onCriada: (c: Campanha) => void;
}

const OBJETIVOS = [
  { id: 'vendas',        label: 'Vendas',         desc: 'Conversões em produto/serviço' },
  { id: 'leads',         label: 'Leads',          desc: 'Captura de contatos via formulário' },
  { id: 'trafego',       label: 'Tráfego',        desc: 'Visitas no site/landing page' },
  { id: 'alcance',       label: 'Alcance',        desc: 'Mostrar pra mais pessoas' },
  { id: 'engajamento',   label: 'Engajamento',    desc: 'Curtidas, comentários, shares' },
  { id: 'messages',      label: 'Mensagens',      desc: 'Conversas no WhatsApp/Direct' },
  { id: 'consideracao',  label: 'Consideração',   desc: 'Mais tempo na página' },
  { id: 'video_views',   label: 'Views de vídeo', desc: 'Reproduções de criativo em vídeo' },
];

const PLATAFORMAS = [
  { id: 'meta',       label: 'Facebook + Instagram', color: '#1877f2' },
  { id: 'google_ads', label: 'Google Ads',           color: '#fbbc04' },
  { id: 'youtube',    label: 'YouTube',              color: '#ff0000' },
  { id: 'tiktok',     label: 'TikTok Ads',           color: '#000' },
  { id: 'linkedin',   label: 'LinkedIn Ads',         color: '#0a66c2' },
];

const CTAS = ['SAIBA_MAIS','COMPRAR_AGORA','CADASTRE_SE','SOLICITAR_ORCAMENTO','FALAR_AGORA','BAIXAR_AGORA','ENVIAR_MENSAGEM','VER_OFERTA'];

export function WizardNovaCampanha({ clienteAgenciaId, clienteNome, onClose, onCriada }: Props) {
  const [step, setStep] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [iaAberto, setIaAberto] = useState(false);

  const [nome, setNome] = useState('');
  const [objetivo, setObjetivo] = useState('leads');
  const [plataformas, setPlataformas] = useState<string[]>(['meta']);

  const [audiencia, setAudiencia] = useState({
    idade_min: 18, idade_max: 65, generos: ['todos'] as string[],
    localizacoes: '', interesses: '', linguagens: 'pt_BR',
  });

  const [orcamentoTipo, setOrcamentoTipo] = useState<'diario' | 'total'>('diario');
  const [orcamentoValor, setOrcamentoValor] = useState<number>(50);
  const [dataInicio, setDataInicio] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState<string>('');

  const [criativos, setCriativos] = useState<Variacao[]>([
    { headline: '', texto_principal: '', descricao: '', cta: 'SAIBA_MAIS' },
  ]);
  const [linkDestino, setLinkDestino] = useState('');

  const podeAvancar = useMemo(() => {
    if (step === 1) return !!nome.trim() && !!objetivo && plataformas.length > 0;
    if (step === 2) return true;
    if (step === 3) return orcamentoValor > 0 && !!dataInicio;
    if (step === 4) return criativos.some(c => c.headline?.trim() || c.texto_principal?.trim());
    return true;
  }, [step, nome, objetivo, plataformas, orcamentoValor, dataInicio, criativos]);

  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  }

  async function salvar(publicar: boolean) {
    setSalvando(true); setErro('');
    try {
      const briefing = [
        `# ${nome}`, `**Cliente:** ${clienteNome}`, `**Objetivo:** ${objetivo}`,
        `**Plataformas:** ${plataformas.join(', ')}`,
        ``, `## Audiência`,
        `- Idade: ${audiencia.idade_min}-${audiencia.idade_max}`,
        `- Gênero: ${audiencia.generos.join(', ')}`,
        audiencia.localizacoes ? `- Localizações: ${audiencia.localizacoes}` : '',
        audiencia.interesses ? `- Interesses: ${audiencia.interesses}` : '',
        ``, `## Orçamento`,
        `- ${orcamentoTipo === 'diario' ? 'Diário' : 'Total'}: R$ ${orcamentoValor.toFixed(2)}`,
        `- Início: ${dataInicio}` + (dataFim ? ` · Fim: ${dataFim}` : ''),
        ``, `## Criativos`,
        ...criativos.map((c, i) => `**Criativo ${i+1}:**\n- Headline: ${c.headline}\n- Texto: ${c.texto_principal}\n- CTA: ${c.cta}`),
      ].filter(Boolean).join('\n');

      const r = await fetch('/api/trafego/campanhas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_agencia_id: clienteAgenciaId,
          nome, objetivo, plataformas,
          orcamento_diario: orcamentoTipo === 'diario' ? orcamentoValor : null,
          orcamento_total: orcamentoTipo === 'total' ? orcamentoValor : null,
          data_inicio: dataInicio, data_fim: dataFim || null,
          audiencia_spec: audiencia,
          status: publicar ? 'revisao' : 'rascunho',
          briefing_md: briefing,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${r.status}`);
      }
      const campanha = await r.json();

      for (const c of criativos.filter(x => x.headline?.trim() || x.texto_principal?.trim())) {
        await fetch('/api/trafego/criativos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campanha_id: campanha.id, cliente_agencia_id: clienteAgenciaId,
            tipo: 'imagem',
            headline: c.headline, texto_principal: c.texto_principal,
            descricao: c.descricao, cta: c.cta,
            link_destino: linkDestino || null,
            status: publicar ? 'aprovado' : 'rascunho',
            fonte: (c as any).fonte || 'manual',
          }),
        });
      }

      onCriada(campanha);
    } catch (e: any) {
      setErro(e?.message || 'erro');
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Nova campanha de tráfego</h3>
            <p className="text-xs text-slate-500">Cliente: <strong>{clienteNome}</strong> · Passo {step}/5</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 pt-3">
          <div className="flex gap-1.5">
            {[1,2,3,4,5].map(n => <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-pink-500' : 'bg-slate-200'}`} />)}
          </div>
        </div>

        <div className="p-6 space-y-4 min-h-[400px]">
          {step === 1 && (
            <>
              <SectionTitle icon={Target} title="Objetivo e plataformas" />
              <Field label="Nome da campanha *">
                <input value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Promoção Outubro - Portões Industriais"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" autoFocus />
              </Field>
              <Field label="Objetivo principal *">
                <div className="grid grid-cols-2 gap-2">
                  {OBJETIVOS.map(o => (
                    <button key={o.id} type="button" onClick={() => setObjetivo(o.id)}
                      className={`p-2 text-left border rounded-lg text-xs transition ${
                        objetivo === o.id ? 'border-pink-500 bg-pink-50' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <div className="font-semibold text-slate-800">{o.label}</div>
                      <div className="text-slate-500 text-[11px]">{o.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Plataformas *">
                <div className="grid grid-cols-2 gap-2">
                  {PLATAFORMAS.map(p => (
                    <label key={p.id} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer text-sm ${
                      plataformas.includes(p.id) ? 'border-pink-500 bg-pink-50' : 'border-slate-200'
                    }`}>
                      <input type="checkbox" checked={plataformas.includes(p.id)}
                        onChange={() => setPlataformas(toggleArr(plataformas, p.id))} className="accent-pink-600" />
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: p.color }} />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <SectionTitle icon={Users2} title="Audiência (segmentação)" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Idade mínima">
                  <input type="number" min={13} max={99} value={audiencia.idade_min}
                    onChange={e => setAudiencia({...audiencia, idade_min: +e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </Field>
                <Field label="Idade máxima">
                  <input type="number" min={13} max={99} value={audiencia.idade_max}
                    onChange={e => setAudiencia({...audiencia, idade_max: +e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </Field>
              </div>
              <Field label="Gênero">
                <div className="flex gap-2">
                  {['todos','homens','mulheres'].map(g => (
                    <button key={g} type="button"
                      onClick={() => setAudiencia({...audiencia, generos: [g]})}
                      className={`px-3 py-1.5 text-sm rounded-lg border ${
                        audiencia.generos[0] === g ? 'bg-pink-500 text-white border-pink-500' : 'border-slate-200'
                      }`}>{g}</button>
                  ))}
                </div>
              </Field>
              <Field label="Localizações (cidades/estados/CEPs, separados por vírgula)">
                <input value={audiencia.localizacoes} onChange={e => setAudiencia({...audiencia, localizacoes: e.target.value})}
                  placeholder="Ex: Brasília-DF, Goiânia-GO, raio 50km"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </Field>
              <Field label="Interesses (palavras-chave)">
                <textarea value={audiencia.interesses} onChange={e => setAudiencia({...audiencia, interesses: e.target.value})}
                  placeholder="Ex: construção civil, engenheiros, arquitetos, condomínios"
                  rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <SectionTitle icon={DollarSign} title="Orçamento e datas" />
              <Field label="Tipo de orçamento">
                <div className="flex gap-2">
                  {['diario','total'].map(t => (
                    <button key={t} type="button" onClick={() => setOrcamentoTipo(t as any)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                        orcamentoTipo === t ? 'bg-pink-500 text-white border-pink-500' : 'border-slate-200'
                      }`}>{t === 'diario' ? 'Diário' : 'Total'}</button>
                  ))}
                </div>
              </Field>
              <Field label={`Valor (R$ ${orcamentoTipo === 'diario' ? 'por dia' : 'total da campanha'})`}>
                <input type="number" step="0.01" min={1} value={orcamentoValor}
                  onChange={e => setOrcamentoValor(+e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data início *">
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </Field>
                <Field label="Data fim (opcional)">
                  <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </Field>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle icon={ImgIcon} title="Criativos (textos e CTAs)" />
                <button onClick={() => setIaAberto(true)}
                  className="text-xs font-semibold text-pink-600 hover:bg-pink-50 px-2 py-1 rounded flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Gerar com IA
                </button>
              </div>
              <Field label="Link de destino (onde leva ao clicar)">
                <input value={linkDestino} onChange={e => setLinkDestino(e.target.value)}
                  placeholder="https://cdsind.com.br/promocao"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </Field>
              {criativos.map((c, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Criativo {i+1}{(c as any).fonte === 'ia' && ' ✨ IA'}</span>
                    {criativos.length > 1 && (
                      <button onClick={() => setCriativos(criativos.filter((_, j) => j !== i))}
                        className="text-xs text-red-600 hover:underline">remover</button>
                    )}
                  </div>
                  <input value={c.headline || ''} onChange={e => {
                    const arr = [...criativos]; arr[i].headline = e.target.value; setCriativos(arr);
                  }} placeholder="Headline (até 60 caracteres)" maxLength={80}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded font-semibold" />
                  <textarea value={c.texto_principal || ''} onChange={e => {
                    const arr = [...criativos]; arr[i].texto_principal = e.target.value; setCriativos(arr);
                  }} placeholder="Texto principal (até 130 caracteres)" maxLength={200} rows={2}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded" />
                  <input value={c.descricao || ''} onChange={e => {
                    const arr = [...criativos]; arr[i].descricao = e.target.value; setCriativos(arr);
                  }} placeholder="Descrição (até 90 caracteres)" maxLength={120}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded" />
                  <select value={c.cta || 'SAIBA_MAIS'} onChange={e => {
                    const arr = [...criativos]; arr[i].cta = e.target.value; setCriativos(arr);
                  }} className="px-3 py-1.5 text-sm border border-slate-300 rounded">
                    {CTAS.map(cta => <option key={cta} value={cta}>{cta.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              ))}
              <button onClick={() => setCriativos([...criativos, { headline: '', texto_principal: '', descricao: '', cta: 'SAIBA_MAIS' }])}
                className="text-sm text-pink-600 hover:underline">+ Adicionar variação manual (A/B test)</button>
            </>
          )}

          {step === 5 && (
            <>
              <SectionTitle icon={Eye} title="Revisar e criar" />
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
                <div><span className="text-slate-500">Campanha:</span> <strong>{nome}</strong></div>
                <div><span className="text-slate-500">Objetivo:</span> {OBJETIVOS.find(o => o.id === objetivo)?.label}</div>
                <div><span className="text-slate-500">Plataformas:</span> {plataformas.map(p => PLATAFORMAS.find(x => x.id === p)?.label).join(', ')}</div>
                <div><span className="text-slate-500">Audiência:</span> {audiencia.idade_min}-{audiencia.idade_max} anos, {audiencia.generos.join(',')}{audiencia.localizacoes && `, ${audiencia.localizacoes}`}</div>
                <div><span className="text-slate-500">Orçamento:</span> R$ {orcamentoValor.toFixed(2)} {orcamentoTipo === 'diario' ? '/dia' : 'total'}</div>
                <div><span className="text-slate-500">Período:</span> {dataInicio}{dataFim && ` → ${dataFim}`}</div>
                <div><span className="text-slate-500">Criativos:</span> {criativos.filter(c => c.headline || c.texto_principal).length}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                <Globe className="w-4 h-4 inline mr-1" />
                <strong>Publicação automática nas plataformas requer OAuth aprovado</strong> — por enquanto, a campanha será salva como rascunho aqui no ERP e você publica manualmente no Ads Manager seguindo o briefing gerado.
              </div>
              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {erro}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-between sticky bottom-0 bg-white">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1">
            {step === 1 ? <>Cancelar</> : <><ArrowLeft className="w-4 h-4" /> Voltar</>}
          </button>
          {step < 5 ? (
            <button onClick={() => setStep(step + 1)} disabled={!podeAvancar}
              className="px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => salvar(false)} disabled={salvando}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded-lg disabled:opacity-50">
                Salvar rascunho
              </button>
              <button onClick={() => salvar(true)} disabled={salvando}
                className="px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCircle2 className="w-4 h-4" /> Criar e enviar pra revisão
              </button>
            </div>
          )}
        </div>
      </div>

      {iaAberto && (
        <GeradorCriativoModal
          contexto={{ clienteNome, objetivo, plataforma: plataformas[0] || 'meta', briefing: nome }}
          onClose={() => setIaAberto(false)}
          onUsar={(variacoes) => {
            const novos = variacoes.map(v => ({ ...v, fonte: 'ia' }));
            setCriativos(prev => [...prev.filter(c => c.headline || c.texto_principal), ...novos]);
            setIaAberto(false);
          }}
        />
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
      <Icon className="w-4 h-4 text-pink-600" /> {title}
    </h4>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
