import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Save } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const ClientRegistration: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inputData, setInputData] = useState('');
  
  // Manual form state
  const [manualData, setManualData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    address: ''
  });

  const saveToFirestore = async (data: any) => {
    await addDoc(collection(db, 'clients'), {
      ...data,
      createdAt: Date.now()
    });
  };

  const handleManualSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await saveToFirestore(manualData);
      setSuccess(true);
      setManualData({ name: '', email: '', phone: '', document: '', address: '' });
    } catch (err) {
      console.error("Detailed error:", err);
      setError(`Erro ao salvar manualmente: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const processData = async (data: string | File) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("Starting processData...");
      
      let contents: any = { parts: [] };
      
      if (data instanceof File) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(data);
        });
        contents.parts.push({
          inlineData: {
            mimeType: data.type,
            data: base64.split(',')[1]
          }
        });
        contents.parts.push({ text: "Extract client information: name, email, phone, document (CPF/CNPJ), address." });
      } else {
        contents.parts.push({ text: `Extract client information from this text: ${data}. Return JSON.` });
      }

      console.log("Calling Gemini API...");
      
      let clientData: any;
      if (process.env.GEMINI_API_KEY) {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                document: { type: Type.STRING },
                address: { type: Type.STRING },
              },
              required: ["name"]
            }
          }
        });
        console.log("Gemini response:", response);
        clientData = JSON.parse(response.text || '{}');
      } else {
        console.warn("GEMINI_API_KEY missing, using mock data");
        clientData = {
          name: "Cliente Exemplo (Mock)",
          email: "exemplo@email.com",
          phone: "(11) 99999-9999",
          document: "00.000.000/0001-00",
          address: "Rua Exemplo, 123"
        };
      }
      
      console.log("Parsed client data:", clientData);
      
      await saveToFirestore(clientData);
      console.log("Client saved to Firestore");

      setSuccess(true);
      setInputData('');
    } catch (err) {
      console.error("Detailed error:", err);
      setError(`Erro ao processar dados: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-8">
      {/* AI Section */}
      <div>
        <h2 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-widest">Cadastro Automático (IA)</h2>
        <div className="space-y-4">
          <textarea
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            placeholder="Cole aqui o texto do cartão CNPJ ou dados do cliente..."
            className="w-full h-32 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          
          <div className="flex gap-4">
            <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl cursor-pointer font-bold text-slate-700 transition-all">
              <Upload size={18} />
              Upload Print/CNPJ
              <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && processData(e.target.files[0])} />
            </label>
            
            <button
              onClick={() => processData(inputData)}
              disabled={loading || !inputData}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Processar Dados'}
            </button>
          </div>
        </div>
      </div>

      {/* Manual Section */}
      <div className="pt-8 border-t border-slate-100">
        <h2 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-widest">Cadastro Manual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="Nome" value={manualData.name} onChange={e => setManualData({...manualData, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl" />
          <input type="email" placeholder="Email" value={manualData.email} onChange={e => setManualData({...manualData, email: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl" />
          <input type="text" placeholder="Telefone" value={manualData.phone} onChange={e => setManualData({...manualData, phone: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl" />
          <input type="text" placeholder="CNPJ/CPF" value={manualData.document} onChange={e => setManualData({...manualData, document: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl" />
          <input type="text" placeholder="Endereço" value={manualData.address} onChange={e => setManualData({...manualData, address: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl col-span-1 md:col-span-2" />
          
          <button
            onClick={handleManualSave}
            disabled={loading || !manualData.name}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 col-span-1 md:col-span-2"
          >
            <Save size={18} />
            Salvar Manualmente
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-xs font-bold"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl flex items-center gap-2 text-xs font-bold"><CheckCircle size={16} /> Cliente cadastrado com sucesso!</div>}
    </div>
  );
};
