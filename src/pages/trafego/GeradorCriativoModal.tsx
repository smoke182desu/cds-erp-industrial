// src/pages/trafego/GeradorCriativoModal.tsx
import { useState } from 'react';
import { X, Sparkles, Loader2, AlertCircle, Wand2, CheckCircle2 } from 'lucide-react';

export interface Variacao {
  headline?: string;
  texto_principal?: string;
  descricao?: string;
  cta?: string;
}

interface Props {
  contexto: {
    clienteId?: string;
    clienteNome: string;
    objetivo: string;
    plataforma: string;
    briefing: string;
  };
  onClose: () => void;
  onUsar: (variacoes: Variacao[]) => void;
}

export function GeradorCriativoModal({ contexto, onClose, onUsar }: Props) {
  const [briefing, setBriefing] = useState(contexto.briefing || '');
  const [nVariacoes, setNVariacoes] = useState(3);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());

  async function gerar() {
    if (!briefing.trim()) { setErro('Escreva um briefing'); return; }
    setGerando(true); setErro(''); setVariacoes([]); setSelecionadas(new Set());
    try {
      const r = await fetch('/api/trafego/ia-criativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefing,
          cliente_id: contexto.clienteId,
          contexto_cliente: contexto.clienteNome,
          objetivo: contexto.objetivo,
          plataforma: contexto.plataforma,
          tipo: 'imagem',
          n_variacoes: nVariacoes,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.dica || 'falhou');
      setVariacoes(data.variacoes || []);
      // pré-selecionar todas
      setSelecionadas(new Set((data.variacoes || []).map((_: any, i: number) => i)));
    } catch (e: any) {
      setErro(e?.message || 'erro');
    } finally { setGerando(false); }
  }

  function usarSelecionadas() {
    const escolhidas = variacoes.filter((_, i) => selecionadas.has(i));
    onUsar(escolhidas);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Gerar criativos com IA</h3>
              <p className="text-xs text-slate-500">Plataforma: {contexto.plataforma} · Objetivo: {contexto.objetivo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Briefing</label>
            <textarea value={briefing} onChange={e => setBriefing(e.target.value)}
              placeholder="Ex: Promoção de portões industriais com 20% de desconto válido só esse mês. Foco em construtoras e condomínios de Brasília."
              rows={4} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-700">Variações:</label>
            <select value={nVariacoes} onChange={e => setNVariacoes(+e.target.value)} className="px-2 py-1 text-sm border border-slate-300 rounded-lg">
              {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={gerar} disabled={gerando || !briefing.trim()}
              className="ml-auto px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50">
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Gerar
            </button>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{erro}</div>
            </div>
          )}

          {variacoes.length > 0 && (
            <div className="space-y-2 mt-3">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>{variacoes.length} variações geradas — escolha as que quer usar:</span>
                <button onClick={() => setSelecionadas(new Set(variacoes.map((_,i)=>i)))} className="text-violet-600 hover:underline">selecionar todas</button>
              </div>
              {variacoes.map((v, i) => {
                const sel = selecionadas.has(i);
                return (
                  <div key={i}
                    onClick={() => {
                      const s = new Set(selecionadas);
                      sel ? s.delete(i) : s.add(i);
                      setSelecionadas(s);
                    }}
                    className={`p-3 border rounded-lg cursor-pointer transition ${sel ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        {sel ? <CheckCircle2 className="w-4 h-4 text-violet-600" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 text-sm">{v.headline}</div>
                        <div className="text-xs text-slate-700 mt-0.5">{v.texto_principal}</div>
                        {v.descricao && <div className="text-xs text-slate-500 mt-0.5 italic">{v.descricao}</div>}
                        <div className="text-[10px] font-bold text-violet-700 mt-1">CTA: {v.cta}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {variacoes.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 flex justify-between sticky bottom-0 bg-white">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button onClick={usarSelecionadas} disabled={selecionadas.size === 0}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
              Usar {selecionadas.size} {selecionadas.size === 1 ? 'criativo' : 'criativos'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
