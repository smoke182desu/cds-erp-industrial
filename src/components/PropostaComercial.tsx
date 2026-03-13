import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import { Save, CheckCircle, Loader2, FileText, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Client {
  id: string;
  name: string;
  email: string;
}

export const PropostaComercial: React.FC<{ projectSummary: any }> = ({ projectSummary }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchClients = async () => {
      const querySnapshot = await getDocs(collection(db, 'clients'));
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email
      }));
      setClients(clientsData);
    };
    fetchClients();
  }, []);

  const generatePDF = async () => {
    console.log("Iniciando generatePDF...");
    setError(null);
    try {
      if (!previewRef.current) throw new Error("Área de visualização não encontrada.");
      
      const canvas = await html2canvas(previewRef.current, { 
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`proposta_${projectSummary.name || 'projeto'}.pdf`);
      console.log("PDF gerado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      setError(`Erro ao gerar PDF: ${error.message}`);
    }
  };

  const handleSave = async () => {
    console.log("Iniciando handleSave...");
    setError(null);
    if (!selectedClientId || sigCanvas.current?.isEmpty()) {
      setError("Selecione um cliente e assine a proposta.");
      return;
    }

    setSaving(true);
    try {
      const signatureData = sigCanvas.current?.toDataURL();
      if (!signatureData) throw new Error("Falha ao capturar assinatura.");

      await addDoc(collection(db, 'proposals'), {
        clientId: selectedClientId,
        projectSummary,
        signature: signatureData,
        createdAt: Date.now()
      });
      console.log("Proposta salva com sucesso.");
      setSuccess(true);
    } catch (error: any) {
      console.error("Erro ao salvar proposta:", error);
      setError(`Erro ao salvar proposta: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-8 rounded-3xl border border-slate-800 shadow-xl max-h-[80vh] overflow-y-auto">
      <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest">Proposta Comercial</h2>
      
      {/* Document Preview Area */}
      <div ref={previewRef} className="bg-white text-slate-900 p-12 mb-8 rounded-lg shadow-lg" style={{ width: '210mm', minHeight: '297mm' }}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8">
          <h1 className="text-4xl font-black uppercase text-slate-900">Minha Serralheria</h1>
          <p className="text-sm text-slate-600">CNPJ: 00.000.000/0001-00 | Telefone: (00) 0000-0000</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="font-bold text-slate-500 uppercase text-xs mb-1">Cliente</h3>
            <p className="font-bold text-lg">{clients.find(c => c.id === selectedClientId)?.name || 'Cliente não selecionado'}</p>
            <p className="text-sm">{clients.find(c => c.id === selectedClientId)?.email}</p>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-slate-500 uppercase text-xs mb-1">Data</h3>
            <p className="font-bold text-lg">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="font-bold text-lg mb-4 border-b border-slate-300 pb-2">Resumo do Projeto</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2">Item</th>
                <th className="p-2">Descrição</th>
                <th className="p-2 text-right">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {projectSummary.components?.map((comp: any, index: number) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="p-2 font-medium">{comp.name}</td>
                  <td className="p-2 text-slate-600">{comp.description || 'Sem descrição'}</td>
                  <td className="p-2 text-right">{comp.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-12 text-xs text-slate-600 space-y-2">
          <h3 className="font-bold text-slate-900 text-sm mb-2">Cláusulas e Condições</h3>
          <p>1. <strong>Validade:</strong> Esta proposta é válida por 15 dias a partir da data de emissão.</p>
          <p>2. <strong>Pagamento:</strong> 50% de entrada no ato da aprovação e 50% na entrega do serviço.</p>
          <p>3. <strong>Prazo:</strong> O prazo de entrega será de 20 dias úteis após a confirmação do pagamento da entrada.</p>
          <p>4. <strong>Garantia:</strong> Garantia de 1 ano contra defeitos de fabricação e instalação.</p>
          <p>5. <strong>Observações:</strong> Não estão inclusos serviços de alvenaria ou pintura final, salvo acordo prévio.</p>
        </div>

        <div className="mt-24 pt-6 border-t border-slate-900 flex justify-between">
          <div className="w-1/3 border-t border-slate-900 text-center pt-2 text-xs">Assinatura do Cliente</div>
          <div className="w-1/3 border-t border-slate-900 text-center pt-2 text-xs">Assinatura da Serralheria</div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-400 mb-2">Selecione o Cliente</label>
          <select 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Selecione...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-400 mb-2">Assinatura Digital</label>
          <div className="bg-white rounded-2xl overflow-hidden border-2 border-slate-700">
            <SignatureCanvas 
              ref={sigCanvas}
              penColor='black'
              canvasProps={{width: 500, height: 200, className: 'sigCanvas'}} 
            />
          </div>
          <button onClick={() => sigCanvas.current?.clear()} className="mt-2 text-xs text-slate-500 hover:text-white">Limpar Assinatura</button>
        </div>

        <div className="flex gap-4">
          <button
            onClick={generatePDF}
            className="flex-1 py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <FileText size={18} /> Gerar PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Salvar Proposta</>}
          </button>
        </div>

        {success && (
          <div className="p-4 bg-emerald-900/50 text-emerald-400 rounded-2xl flex items-center gap-2 font-bold">
            <CheckCircle size={20} /> Proposta salva com sucesso!
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-900/50 text-red-400 rounded-2xl flex items-center gap-2 font-bold">
            <AlertCircle size={20} /> {error}
          </div>
        )}
      </div>
    </div>
  );
};
