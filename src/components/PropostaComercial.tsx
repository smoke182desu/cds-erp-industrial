import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Save, CheckCircle, Loader2, FileText, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useConfig } from '../contexts/ConfigContext';
import { configEmpresa } from '../constants/configEmpresa';

interface Client {
  id: string;
  name: string;
  email: string;
}

export const PropostaComercial: React.FC<{ projectSummary: any }> = ({ projectSummary }) => {
  const { config } = useConfig();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/projects?action=clients')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.clients || []).map((c: any) => ({
          id: c.id,
          name: c.name || c.nome || '',
          email: c.email || '',
        }));
        setClients(mapped);
      })
      .catch(err => console.error('Erro ao buscar clientes:', err));
  }, []);

  const generatePDF = async () => {
    setError(null);
    try {
      if (!previewRef.current) throw new Error('Area de visualizacao nao encontrada.');
      const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`proposta_${projectSummary.nome || 'projeto'}.pdf`);
    } catch (err: any) {
      setError(`Erro ao gerar PDF: ${err.message}`);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!selectedClientId || sigCanvas.current?.isEmpty()) {
      setError('Selecione um cliente e assine a proposta.');
      return;
    }
    setSaving(true);
    try {
      const signatureData = sigCanvas.current?.toDataURL();
      if (!signatureData) throw new Error('Falha ao capturar assinatura.');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _collection: 'proposals',
          clientId: selectedClientId,
          projectSummary,
          signature: signatureData,
          createdAt: Date.now(),
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar proposta');
      setSuccess(true);
    } catch (err: any) {
      setError(`Erro ao salvar proposta: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white text-slate-900 p-8 rounded-3xl border border-slate-200 shadow-xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold">Proposta Comercial</h2>
      </div>

      {success ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <p className="text-lg font-semibold text-slate-700">Proposta salva com sucesso!</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Cliente</label>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Assinatura</label>
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ width: 500, height: 150, className: 'w-full' }}
              />
            </div>
            <button
              onClick={() => sigCanvas.current?.clear()}
              className="mt-1 text-xs text-slate-500 underline"
            >
              Limpar
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={generatePDF}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-xl transition"
            >
              <FileText className="w-4 h-4" /> Gerar PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Proposta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
