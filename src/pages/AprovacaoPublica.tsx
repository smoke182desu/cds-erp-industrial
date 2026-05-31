// src/pages/AprovacaoPublica.tsx — página pública sem login pra cliente aprovar
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle, Send } from 'lucide-react';

export function AprovacaoPublica({ token }: { token: string }) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [acao, setAcao] = useState<'pendente' | 'enviando' | 'aprovado' | 'rejeitado'>('pendente');
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/posts/calendario?token=${token}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'visualizar' }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Token inválido');
        setPost(d);
        if (d.status === 'aprovado_cliente') setAcao('aprovado');
        else if (d.status === 'rejeitado_cliente') setAcao('rejeitado');
      } catch (e: any) { setErro(e?.message || 'erro'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function decidir(quero: 'aprovar' | 'rejeitar') {
    setAcao('enviando');
    try {
      const r = await fetch(`/api/posts/calendario?token=${token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: quero, nome_aprovador: nome.trim() || 'Sem identificação', comentarios: comentarios.trim() || null }),
      });
      if (!r.ok) throw new Error('erro');
      setAcao(quero === 'aprovar' ? 'aprovado' : 'rejeitado');
    } catch (e: any) {
      setErro(e?.message || 'erro');
      setAcao('pendente');
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>;
  }
  if (erro || !post) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-800 mb-1">Link inválido</h1>
        <p className="text-sm text-slate-500">{erro || 'Não foi possível abrir esse link de aprovação.'}</p>
      </div>
    </div>;
  }

  const cor = post.trafego_clientes?.cor_destaque || '#6366f1';
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-6 py-4 text-white" style={{ backgroundColor: cor }}>
            <p className="text-xs opacity-80">{post.trafego_clientes?.nome}</p>
            <h1 className="text-xl font-bold">Aprovação de post</h1>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Título</p>
              <h2 className="text-lg font-bold text-slate-900">{post.titulo}</h2>
            </div>
            {post.texto && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Texto</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">{post.texto}</p>
              </div>
            )}
            {post.plataformas?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Plataformas</p>
                <div className="flex gap-1 flex-wrap">
                  {post.plataformas.map((p: string) => (
                    <span key={p} className="text-xs bg-slate-100 px-2 py-1 rounded uppercase">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {post.agendado_para && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Agendado para</p>
                <p className="text-sm text-slate-700">{new Date(post.agendado_para).toLocaleString('pt-BR')}</p>
              </div>
            )}

            {acao === 'aprovado' ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <p className="font-bold text-emerald-900">Aprovado! Obrigada</p>
                <p className="text-xs text-emerald-700 mt-1">O post será publicado na data programada.</p>
              </div>
            ) : acao === 'rejeitado' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <XCircle className="w-10 h-10 text-red-600 mx-auto mb-2" />
                <p className="font-bold text-red-900">Rejeitado</p>
                <p className="text-xs text-red-700 mt-1">A agência foi notificada e fará os ajustes necessários.</p>
              </div>
            ) : (
              <>
                <div className="pt-4 border-t border-slate-200">
                  <label className="text-xs font-semibold text-slate-700">Seu nome (opcional)</label>
                  <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Como devemos te identificar" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Comentários (opcional)</label>
                  <textarea value={comentarios} onChange={e => setComentarios(e.target.value)} placeholder="Algo a acrescentar?" rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => decidir('rejeitar')} disabled={acao === 'enviando'}
                    className="flex-1 px-4 py-3 bg-white border border-red-300 hover:bg-red-50 text-red-700 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    {acao === 'enviando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Rejeitar
                  </button>
                  <button onClick={() => decidir('aprovar')} disabled={acao === 'enviando'}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    {acao === 'enviando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Aprovar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">Powered by Cds Agency</p>
      </div>
    </div>
  );
}

export default AprovacaoPublica;
