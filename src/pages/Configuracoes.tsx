import React, { useState, useEffect } from 'react';
import { useConfig } from '../contexts/ConfigContext';
import { Save, Image as ImageIcon, Briefcase, Phone, Percent, FileText, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

export const Configuracoes: React.FC = () => {
  const { config, atualizarConfig, isLoading } = useConfig();
  const [nomeEmpresa, setNomeEmpresa] = useState(config.nomeEmpresa);
  const [telefone, setTelefone] = useState(config.telefone);
  const [multiplicadorLucro, setMultiplicadorLucro] = useState(config.multiplicadorLucro.toString());
  const [logoBase64, setLogoBase64] = useState(config.logoBase64);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dados fiscais NF-e
  const [cnpjEmissor, setCnpjEmissor] = useState(config.cnpjEmissor || '');
  const [ieEmissor, setIeEmissor] = useState(config.ieEmissor || 'ISENTO');
  const [crtEmissor, setCrtEmissor] = useState(config.crtEmissor || '1');
  const [logradouroEmissor, setLogradouroEmissor] = useState(config.logradouroEmissor || '');
  const [numeroEmissor, setNumeroEmissor] = useState(config.numeroEmissor || 'S/N');
  const [bairroEmissor, setBairroEmissor] = useState(config.bairroEmissor || '');
  const [municipioEmissor, setMunicipioEmissor] = useState(config.municipioEmissor || 'Brasília');
  const [codMunEmissor, setCodMunEmissor] = useState(config.codMunEmissor || '5300108');
  const [ufEmissor, setUfEmissor] = useState(config.ufEmissor || 'DF');
  const [cepEmissor, setCepEmissor] = useState(config.cepEmissor || '');

  useEffect(() => {
    setNomeEmpresa(config.nomeEmpresa);
    setTelefone(config.telefone);
    setMultiplicadorLucro(config.multiplicadorLucro.toString());
    setLogoBase64(config.logoBase64);
    setCnpjEmissor(config.cnpjEmissor || '');
    setIeEmissor(config.ieEmissor || 'ISENTO');
    setCrtEmissor(config.crtEmissor || '1');
    setLogradouroEmissor(config.logradouroEmissor || '');
    setNumeroEmissor(config.numeroEmissor || 'S/N');
    setBairroEmissor(config.bairroEmissor || '');
    setMunicipioEmissor(config.municipioEmissor || 'Brasília');
    setCodMunEmissor(config.codMunEmissor || '5300108');
    setUfEmissor(config.ufEmissor || 'DF');
    setCepEmissor(config.cepEmissor || '');
  }, [config]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to max 400x400 to save Firestore space
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/png');
        setLogoBase64(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      await atualizarConfig({
        nomeEmpresa,
        telefone,
        logoBase64,
        multiplicadorLucro: parseFloat(multiplicadorLucro) || 1.5,
        cnpjEmissor,
        ieEmissor,
        crtEmissor,
        logradouroEmissor,
        numeroEmissor,
        bairroEmissor,
        municipioEmissor,
        codMunEmissor,
        ufEmissor,
        cepEmissor,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-8 border-b border-gray-100 bg-gray-50/50">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            Configurações da Empresa
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Personalize a sua marca e defina a sua margem de lucro padrão para os orçamentos.
          </p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-8">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">Logo da Empresa</label>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                {logoBase64 ? (
                  <img src={logoBase64} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-slate-900 text-xs font-medium">Alterar</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">
                  Faça upload da sua logo para que ela apareça no cabeçalho dos PDFs gerados.
                  Recomendamos imagens quadradas ou retangulares com fundo transparente (PNG).
                </p>
                {logoBase64 && (
                  <button
                    type="button"
                    onClick={() => setLogoBase64('')}
                    className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remover Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome da Empresa */}
            <div>
              <label htmlFor="nomeEmpresa" className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Empresa
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="nomeEmpresa"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="CDS Industrial"
                  required
                />
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">
                Telefone / WhatsApp
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Margem de Lucro */}
            <div className="md:col-span-2">
              <label htmlFor="multiplicadorLucro" className="block text-sm font-medium text-gray-700 mb-1">
                Margem de Mão de Obra (Multiplicador)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Percent className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  id="multiplicadorLucro"
                  value={multiplicadorLucro}
                  onChange={(e) => setMultiplicadorLucro(e.target.value)}
                  className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                O valor do material será multiplicado por este número para calcular a Mão de Obra. 
                Ex: 1.5 significa 50% a mais sobre o material. 2.0 significa 100% (o dobro).
              </p>
            </div>
          </div>

          {/* ── SEÇÃO FISCAL NF-e ── */}
          <div className="pt-6 border-t border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-5">
              <FileText className="w-5 h-5 text-indigo-500" />
              Dados Fiscais para Emissão de NF-e
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* CNPJ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ do Emissor *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <input type="text" value={cnpjEmissor} onChange={e => setCnpjEmissor(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
              </div>

              {/* IE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Estadual (IE)</label>
                <input type="text" value={ieEmissor} onChange={e => setIeEmissor(e.target.value)}
                  placeholder="ISENTO ou número da IE"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2" />
              </div>

              {/* CRT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regime Tributário (CRT)</label>
                <select value={crtEmissor} onChange={e => setCrtEmissor(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2">
                  <option value="1">1 — Simples Nacional</option>
                  <option value="2">2 — Simples Nacional — Excesso de Receita</option>
                  <option value="3">3 — Regime Normal (Lucro Real/Presumido)</option>
                </select>
              </div>

              {/* CEP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEP do Estabelecimento</label>
                <input type="text" value={cepEmissor} onChange={e => setCepEmissor(e.target.value)}
                  placeholder="70000-000"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2" />
              </div>

              {/* Logradouro + Número */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                <input type="text" value={logradouroEmissor} onChange={e => setLogradouroEmissor(e.target.value)}
                  placeholder="Rua, Avenida, etc."
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                <input type="text" value={numeroEmissor} onChange={e => setNumeroEmissor(e.target.value)}
                  placeholder="S/N"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2" />
              </div>

              {/* Bairro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                <input type="text" value={bairroEmissor} onChange={e => setBairroEmissor(e.target.value)}
                  placeholder="Centro"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2" />
              </div>

              {/* Município */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Município</label>
                <input type="text" value={municipioEmissor} onChange={e => setMunicipioEmissor(e.target.value)}
                  placeholder="Brasília"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2" />
              </div>

              {/* UF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                <select value={ufEmissor} onChange={e => setUfEmissor(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2">
                  {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              {/* Código IBGE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código IBGE do Município (7 dígitos)</label>
                <input type="text" value={codMunEmissor} onChange={e => setCodMunEmissor(e.target.value)}
                  placeholder="5300108 (Brasília-DF)"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2" />
                <p className="mt-1 text-xs text-gray-400">Consulte em ibge.gov.br. Ex: Brasília-DF = 5300108, São Paulo-SP = 3550308</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
            {saveSuccess && (
              <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Salvo com sucesso!
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};
