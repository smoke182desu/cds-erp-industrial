import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(email, password)) {
      setError('Credenciais inválidas');
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">CDS Industrial</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-700" />
          <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-700" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-500">Entrar</button>
        </form>
        <div className="mt-6 space-y-2">
          <p className="text-slate-400 text-center text-sm">Login Rápido:</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => quickLogin('admin@cds.com', 'admin123')} className="bg-slate-800 text-xs p-2 rounded text-white">Diretor</button>
            <button onClick={() => quickLogin('vendas@cds.com', 'vendas123')} className="bg-slate-800 text-xs p-2 rounded text-white">Vendedor</button>
            <button onClick={() => quickLogin('fabrica@cds.com', 'fabrica123')} className="bg-slate-800 text-xs p-2 rounded text-white">Fábrica</button>
          </div>
        </div>
      </div>
    </div>
  );
};
