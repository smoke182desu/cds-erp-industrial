import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Save } from 'lucide-react';

export const ClientRegistration: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [manualData, setManualData] = useState({ name: '', email: '', phone: '', document: '', address: '' });

  const saveClient = async (data: any) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _collection: 'clients', ...data, createdAt: Date.now() }),
    });
    if (!res.ok) throw new Error('Erro ao salvar cliente');
  };

  const handleManualSave = async () => {
    setLoading(true); setError(null); setSuccess(false);
    try {
      await saveClient(manualData);
      setSuccess(true);
      setManualData({ name: '', email: '', phone: '', document: '', address: '' });
    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'name', label: 'Nome', placeholder: 'Nome completo' },
    { key: 'email', label: 'E-mail', placeholder: 'email@exemplo.com' },
    { key: 'phone', label: 'Telefone', placeholder: '(11) 99999-9999' },
    { key: 'document', label: 'CPF/CNPJ', placeholder: '00.000.000/0001-00' },
    { key: 'address', label: 'Endereco', placeholder: 'Rua, numero, cidade' },
  ] as const;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-800">Cadastro de Cliente</h2>
      </div>

      {success ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <p className="font-semibold text-slate-700">Cliente cadastrado com sucesso!</p>
          <button onClick={() => setSuccess(false)} className="text-sm text-blue-600 underline">Novo cadastro</button>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <input
                type="text"
                value={manualData[f.key]}
                onChange={e => setManualData(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <button
            onClick={handleManualSave}
            disabled={loading || !manualData.name}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Cliente
          </button>
        </div>
      )}
    </div>
  );
};
