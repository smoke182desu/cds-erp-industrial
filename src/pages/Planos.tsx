import React from 'react';
import { useConfig } from '../contexts/ConfigContext';
import { Check, Lock, Star, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export const Planos: React.FC = () => {
  const { config, atualizarConfig, isLoading, planoAtual } = useConfig();

  const handleAssinarPro = async () => {
    await atualizarConfig({ plano: 'pro' });
    alert('Parabéns! Você agora é um usuário PRO. Todos os recursos foram desbloqueados.');
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando planos...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
          Evolua sua Serralheria
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Escolha o plano ideal para o seu negócio. Profissionalize seus orçamentos e encante seus clientes com a sua própria marca.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Plano Free */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white rounded-3xl p-8 border-2 transition-all ${planoAtual === 'free' ? 'border-slate-300 shadow-md' : 'border-slate-100 shadow-sm opacity-80'}`}
        >
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Básico</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-900">Grátis</span>
            </div>
            <p className="text-slate-500 mt-2 text-sm">Para quem está começando a usar tecnologia na serralheria.</p>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex items-start gap-3 text-slate-700">
              <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Cálculo 3D de Estruturas</span>
            </li>
            <li className="flex items-start gap-3 text-slate-700">
              <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Geração de Lista de Corte</span>
            </li>
            <li className="flex items-start gap-3 text-slate-700">
              <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <span>PDF de Orçamento (com marca d'água)</span>
            </li>
            <li className="flex items-start gap-3 text-slate-600">
              <Lock className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Logo da sua empresa no PDF</span>
            </li>
            <li className="flex items-start gap-3 text-slate-600">
              <Lock className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Margem de Lucro Personalizada</span>
            </li>
            <li className="flex items-start gap-3 text-slate-600">
              <Lock className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Link Público White-Label</span>
            </li>
          </ul>

          <button 
            disabled
            className="w-full py-4 rounded-xl font-bold text-slate-500 bg-slate-100 border border-slate-200"
          >
            {planoAtual === 'free' ? 'Seu plano atual' : 'Plano Básico'}
          </button>
        </motion.div>

        {/* Plano PRO */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`bg-white rounded-3xl p-8 border-2 relative overflow-hidden ${planoAtual === 'pro' ? 'border-blue-500 shadow-2xl shadow-blue-900/20' : 'border-slate-200 shadow-xl'}`}
        >
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

          {planoAtual === 'pro' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-b-lg uppercase tracking-wider">
              Seu Plano
            </div>
          )}

          <div className="mb-8 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
              <h3 className="text-2xl font-bold text-slate-900">PRO</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-medium text-slate-600">R$</span>
              <span className="text-5xl font-extrabold text-slate-900 tracking-tight">49</span>
              <span className="text-xl font-medium text-slate-600">,90</span>
              <span className="text-slate-600 ml-1">/mês</span>
            </div>
            <p className="text-slate-600 mt-2 text-sm">A ferramenta definitiva para fechar mais negócios.</p>
          </div>

          <ul className="space-y-4 mb-8 relative z-10">
            <li className="flex items-start gap-3 text-slate-800">
              <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <span>Tudo do plano Básico</span>
            </li>
            <li className="flex items-start gap-3 text-slate-900 font-medium">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>Sua Logo no PDF (White-Label)</span>
            </li>
            <li className="flex items-start gap-3 text-slate-900 font-medium">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>Margem de Lucro Personalizada</span>
            </li>
            <li className="flex items-start gap-3 text-slate-900 font-medium">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>Link Público com a sua Marca</span>
            </li>
            <li className="flex items-start gap-3 text-slate-800">
              <Check className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <span>Suporte Prioritário (WhatsApp)</span>
            </li>
          </ul>

          <button 
            onClick={handleAssinarPro}
            disabled={planoAtual === 'pro'}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all relative z-10 ${
              planoAtual === 'pro' 
                ? 'bg-slate-100 text-slate-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5'
            }`}
          >
            {planoAtual === 'pro' ? 'Plano Ativo' : 'Assinar Plano PRO'}
          </button>
        </motion.div>
      </div>
    </div>
  );
};
