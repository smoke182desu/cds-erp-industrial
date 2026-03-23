import React, { useState, useCallback } from 'react';
import { useERP } from '../contexts/ERPContext';
import { Cliente } from '../types';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI, Type } from "@google/genai";
import { Loader2, Upload, Sparkles, User, Building2, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface NovoClienteModalProps {
  onClose: () => void;
}

export const NovoClienteModal: React.FC<NovoClienteModalProps> = ({ onClose }) => {
  const { adicionarCliente } = useERP();
  const [activeTab, setActiveTab] = useState<'manual' | 'ia'>('ia');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados do formulário
  const [tipo, setTipo] = useState<'PF' | 'PJ' | 'GOV'>('PF');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [endereco, setEndereco] = useState('');
  const [orgao, setOrgao] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');

  // Busca de dados por CNPJ (BrasilAPI)
  const buscarCNPJ = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      const data = response.data;
      setTipo('PJ');
      setNome(data.nome_fantasia || data.razao_social);
      setRazaoSocial(data.razao_social);
      setEndereco(`${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio} - ${data.uf}`);
      if (data.ddd_telefone_1) setTelefone(data.ddd_telefone_1);
    } catch (err) {
      setError('Não foi possível encontrar dados para este CNPJ.');
    } finally {
      setLoading(false);
    }
  };

  // Processamento com IA (Gemini)
  const processWithAI = async (content: string | File) => {
    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let parts: any[] = [];
      if (typeof content === 'string') {
        parts.push({ text: content });
      } else {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(content);
        });
        parts.push({
          inlineData: {
            data: base64,
            mimeType: content.type
          }
        });
      }

      const prompt = `Extraia os dados do cliente deste conteúdo (texto ou imagem). 
      Retorne um JSON com os seguintes campos:
      nome, email, telefone, tipo (PF ou PJ), documento (CPF ou CNPJ), endereco, razaoSocial (se PJ).
      Se não encontrar algum campo, deixe vazio.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [...parts, { text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nome: { type: Type.STRING },
              email: { type: Type.STRING },
              telefone: { type: Type.STRING },
              tipo: { type: Type.STRING, enum: ["PF", "PJ"] },
              documento: { type: Type.STRING },
              endereco: { type: Type.STRING },
              razaoSocial: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      if (result.tipo) setTipo(result.tipo as 'PF' | 'PJ');
      if (result.nome) setNome(result.nome);
      if (result.email) setEmail(result.email);
      if (result.telefone) setTelefone(result.telefone);
      if (result.documento) setDocumento(result.documento);
      if (result.endereco) setEndereco(result.endereco);
      if (result.razaoSocial) setRazaoSocial(result.razaoSocial);

      setActiveTab('manual'); // Muda para manual para revisão
    } catch (err) {
      setError('Erro ao processar com IA. Tente preencher manualmente ou verifique o arquivo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processWithAI(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/plain': ['.txt']
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const novoCliente: Cliente = {
      id: Date.now().toString(),
      nome,
      email,
      telefone,
      tipo,
      documento,
      endereco,
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      orgao: tipo === 'GOV' ? orgao : undefined,
      razaoSocial: tipo === 'PJ' ? razaoSocial : undefined,
    };
    adicionarCliente(novoCliente);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl text-slate-900 border border-slate-200 overflow-hidden">
        {/* Header Tabs */}
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('ia')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold transition-colors ${activeTab === 'ia' ? 'bg-slate-100 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Sparkles size={18} /> Cadastro Inteligente (IA)
          </button>
          <button 
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold transition-colors ${activeTab === 'manual' ? 'bg-slate-100 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <User size={18} /> Cadastro Manual
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'ia' ? (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-slate-800">Arraste e solte para cadastrar</h3>
                <p className="text-sm text-slate-600">Envie prints de conversas, mensagens de texto ou arquivos para que a IA preencha tudo para você.</p>
              </div>

              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer
                  ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-100/50'}`}
              >
                <input {...getInputProps()} />
                {loading ? (
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                ) : (
                  <Upload className={`w-12 h-12 ${isDragActive ? 'text-emerald-500' : 'text-slate-500'}`} />
                )}
                <p className="text-slate-700 font-medium">
                  {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste prints ou clique para selecionar'}
                </p>
                <p className="text-xs text-slate-500 uppercase tracking-widest">PNG, JPG ou TXT</p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500">Ou cole o texto abaixo</span></div>
              </div>

              <textarea 
                placeholder="Cole aqui a mensagem do cliente ou dados brutos..."
                className="w-full bg-slate-100 border border-slate-300 rounded-xl p-4 h-32 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                onBlur={(e) => e.target.value && processWithAI(e.target.value)}
              />

              {loading && (
                <div className="flex items-center justify-center gap-2 text-emerald-400 animate-pulse">
                  <Sparkles size={16} />
                  <span className="text-sm font-medium">IA processando e validando dados...</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex gap-2 p-1 bg-slate-100 rounded-lg">
                  {(['PF', 'PJ', 'GOV'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${tipo === t ? 'bg-slate-200 text-emerald-400 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      {t === 'PF' ? 'Pessoa Física' : t === 'PJ' ? 'Pessoa Jurídica' : 'Governo'}
                    </button>
                  ))}
                </div>

                <div className="col-span-2 relative">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Documento ({tipo === 'PF' ? 'CPF' : tipo === 'PJ' ? 'CNPJ' : 'UASG'})</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder={tipo === 'PF' ? '000.000.000-00' : tipo === 'PJ' ? '00.000.000/0000-00' : 'UASG'} 
                      value={documento} 
                      onChange={(e) => setDocumento(e.target.value)} 
                      className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-10" 
                      required 
                    />
                    {tipo === 'PJ' && (
                      <button 
                        type="button"
                        onClick={() => buscarCNPJ(documento)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-lg text-emerald-400 transition-colors"
                        title="Buscar dados do CNPJ"
                      >
                        <Search size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Nome / Fantasia</label>
                  <input type="text" placeholder="Nome do Cliente" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>

                {tipo === 'PJ' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Razão Social</label>
                    <input type="text" placeholder="Razão Social Completa" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Email</label>
                  <input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Telefone</label>
                  <input type="text" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Endereço Completo</label>
                  <input type="text" placeholder="Rua, Número, Bairro, Cidade - UF" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>

                {tipo === 'GOV' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Órgão Público</label>
                    <input type="text" placeholder="Nome do Órgão" value={orgao} onChange={(e) => setOrgao(e.target.value)} className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required />
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={onClose} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all">Cancelar</button>
                <button type="submit" className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2">
                  <CheckCircle2 size={18} /> Salvar Cliente
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
