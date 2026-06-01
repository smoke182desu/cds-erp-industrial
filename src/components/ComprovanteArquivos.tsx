// Componente: upload de arquivos + lista + OCR pra um comprovante específico
import { useState, useEffect, useRef } from 'react';
import { Upload, Sparkles, FileText, Image as ImgIcon, Trash2, Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react';

interface ArquivoComprovante {
  id: string;
  comprovante_id: string;
  nome_original: string;
  url_publica?: string;
  mime_type?: string;
  tamanho_bytes?: number;
  ocr_status?: string;
  ocr_resultado?: any;
  ocr_provider?: string;
  criado_em?: string;
}

export function ComprovanteArquivos({ comprovanteId, onAtualizar }: { comprovanteId: string; onAtualizar?: () => void }) {
  const [arquivos, setArquivos] = useState<ArquivoComprovante[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [ocrEmAndamento, setOcrEmAndamento] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    try {
      const r = await fetch(`/api/comprovantes_arquivos?comprovante_id=eq.${comprovanteId}&order=criado_em.desc`);
      if (!r.ok) return;
      const data = await r.json();
      setArquivos(Array.isArray(data) ? data : []);
    } catch {}
  }
  useEffect(() => { carregar(); }, [comprovanteId]);

  async function enviar(files: FileList | File[]) {
    setErro(null); setEnviando(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('comprovante_id', comprovanteId);
        fd.append('file', file);
        const r = await fetch('/api/comprovantes/upload', { method: 'POST', body: fd });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setErro(d.error || `Erro HTTP ${r.status}`);
        }
      }
      await carregar();
      onAtualizar?.();
    } catch (e: any) {
      setErro(e?.message || 'erro ao enviar');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function executarOCR(arq: ArquivoComprovante) {
    setOcrEmAndamento(arq.id); setErro(null);
    try {
      const r = await fetch('/api/comprovantes/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivo_id: arq.id })
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error || 'OCR falhou');
      } else {
        await carregar();
        onAtualizar?.();
      }
    } catch (e: any) {
      setErro(e?.message || 'erro OCR');
    } finally {
      setOcrEmAndamento(null);
    }
  }

  async function remover(arq: ArquivoComprovante) {
    if (!confirm('Remover arquivo?')) return;
    await fetch(`/api/comprovantes_arquivos?id=eq.${arq.id}`, { method: 'DELETE' });
    carregar();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files?.length) enviar(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50/50 rounded-xl p-6 text-center cursor-pointer transition"
      >
        {enviando ? (
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Enviando…
          </div>
        ) : (
          <>
            <Upload className="w-7 h-7 mx-auto text-slate-400 mb-1" />
            <p className="text-sm text-slate-700 font-semibold">Clique ou arraste arquivos aqui</p>
            <p className="text-xs text-slate-500 mt-0.5">PDF, JPG, PNG, WEBP, HEIC até 15MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => e.target.files && enviar(e.target.files)}
        />
      </div>

      {erro && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-4 h-4" /> {erro}
        </div>
      )}

      {arquivos.length > 0 && (
        <div className="space-y-2">
          {arquivos.map((a) => {
            const isPdf = a.mime_type === 'application/pdf';
            const Icon = isPdf ? FileText : ImgIcon;
            const ocr = a.ocr_resultado || {};
            return (
              <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.nome_original}</p>
                      <span className="text-[10px] text-slate-500">{((a.tamanho_bytes || 0) / 1024).toFixed(0)} KB</span>
                      {a.ocr_status === 'concluido' && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> OCR {a.ocr_provider}
                        </span>
                      )}
                      {a.ocr_status === 'falhou' && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">OCR falhou</span>
                      )}
                      {a.ocr_status === 'sem_chave_ia' && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Configure chave IA</span>
                      )}
                    </div>
                    {a.ocr_status === 'concluido' && Object.keys(ocr).length > 0 && (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1 text-[11px] bg-slate-50 rounded-md p-2">
                        {ocr.valor != null && <div><span className="text-slate-500">Valor:</span> <strong>R$ {Number(ocr.valor).toFixed(2)}</strong></div>}
                        {ocr.data && <div><span className="text-slate-500">Data:</span> {ocr.data}</div>}
                        {ocr.banco && <div><span className="text-slate-500">Banco:</span> {ocr.banco}</div>}
                        {ocr.pagador_nome && <div className="truncate"><span className="text-slate-500">Pagador:</span> {ocr.pagador_nome}</div>}
                        {ocr.beneficiario_nome && <div className="truncate"><span className="text-slate-500">Recebedor:</span> {ocr.beneficiario_nome}</div>}
                        {ocr.txid && <div className="truncate col-span-full"><span className="text-slate-500">TxID:</span> <code className="text-[10px]">{ocr.txid}</code></div>}
                        {ocr.confianca != null && <div><span className="text-slate-500">Confiança:</span> {(Number(ocr.confianca) * 100).toFixed(0)}%</div>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {a.url_publica && (
                      <a href={a.url_publica} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600" title="Abrir arquivo">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    {a.ocr_status !== 'concluido' && (
                      <button
                        onClick={() => executarOCR(a)}
                        disabled={ocrEmAndamento === a.id}
                        title="Extrair dados com IA"
                        className="px-2 py-1 text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 rounded flex items-center gap-1 disabled:opacity-50"
                      >
                        {ocrEmAndamento === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        IA
                      </button>
                    )}
                    <button onClick={() => remover(a)} className="p-1.5 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
