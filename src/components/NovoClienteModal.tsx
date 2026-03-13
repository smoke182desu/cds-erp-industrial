import React, { useState } from 'react';
import { useERP } from '../contexts/ERPContext';
import { Cliente } from '../types';

interface NovoClienteModalProps {
  onClose: () => void;
}

export const NovoClienteModal: React.FC<NovoClienteModalProps> = ({ onClose }) => {
  const { adicionarCliente } = useERP();
  const [tipo, setTipo] = useState<'PF' | 'PJ' | 'GOV'>('PF');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [endereco, setEndereco] = useState('');
  const [orgao, setOrgao] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');

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
      orgao: tipo === 'GOV' ? orgao : undefined,
      razaoSocial: tipo === 'PJ' ? razaoSocial : undefined,
    };
    adicionarCliente(novoCliente);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl text-slate-100 border border-slate-700">
        <h2 className="text-xl font-bold mb-4">Novo Cliente</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'PF' | 'PJ' | 'GOV')} className="w-full bg-slate-700 p-2 rounded-lg">
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
              <option value="GOV">Governo</option>
            </select>
          </div>
          <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-slate-700 p-2 rounded-lg" required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-700 p-2 rounded-lg" required />
          <input type="text" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full bg-slate-700 p-2 rounded-lg" required />
          <input type="text" placeholder={tipo === 'PF' ? 'CPF' : tipo === 'PJ' ? 'CNPJ' : 'UASG'} value={documento} onChange={(e) => setDocumento(e.target.value)} className="w-full bg-slate-700 p-2 rounded-lg" required />
          <input type="text" placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="w-full bg-slate-700 p-2 rounded-lg" required />
          {tipo === 'GOV' && <input type="text" placeholder="Órgão" value={orgao} onChange={(e) => setOrgao(e.target.value)} className="w-full bg-slate-700 p-2 rounded-lg" required />}
          {tipo === 'PJ' && <input type="text" placeholder="Razão Social" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="w-full bg-slate-700 p-2 rounded-lg" required />}
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 rounded-lg">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 rounded-lg">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};
