import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(email, password)) {
      setError('Credenciais inválidas. Tente novamente.');
    }
  };

  const quickLogin = (email: string, pass: string) => {
    setEmail(email);
    setPassword(pass);
    if (!login(email, pass)) {
      setError('Credenciais inválidas');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="bg-white p-10 rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/40">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">CDS INDUSTRIAL</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-semibold">Sistema de Gestão ERP</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail Corporativo</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="email" 
                placeholder="exemplo@cds.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all" 
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg text-center animate-pulse">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
          >
            ENTRAR NO SISTEMA
          </button>
        </form>

        <div className="mt-10">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute w-full h-px bg-slate-200"></div>
            <span className="relative bg-white px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Login Rápido</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <button 
              onClick={() => quickLogin('admin@cds.com', 'admin123')} 
              className="bg-slate-50 border border-slate-200 text-[10px] font-bold py-3 rounded-lg text-slate-600 hover:text-blue-600 hover:border-blue-600 transition-all uppercase tracking-tighter"
            >
              Diretor
            </button>
            <button 
              onClick={() => quickLogin('vendas@cds.com', 'vendas123')} 
              className="bg-slate-50 border border-slate-200 text-[10px] font-bold py-3 rounded-lg text-slate-600 hover:text-blue-600 hover:border-blue-600 transition-all uppercase tracking-tighter"
            >
              Vendedor
            </button>
            <button 
              onClick={() => quickLogin('fabrica@cds.com', 'fabrica123')} 
              className="bg-slate-50 border border-slate-200 text-[10px] font-bold py-3 rounded-lg text-slate-600 hover:text-blue-600 hover:border-blue-600 transition-all uppercase tracking-tighter"
            >
              Fábrica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
