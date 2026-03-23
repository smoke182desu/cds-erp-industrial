import React from 'react';
import { PieChart, TrendingUp, Target, ArrowDownRight, ArrowUpRight, Equal } from 'lucide-react';

interface DreItem {
  label: string;
  value: number;
  percentage: number;
  type: 'positive' | 'negative' | 'total';
  icon?: React.ReactNode;
}

const dreData: DreItem[] = [
  { label: 'Receita Bruta', value: 250000, percentage: 100, type: 'positive', icon: <ArrowUpRight size={20} /> },
  { label: '(-) Impostos (Simples/ICMS)', value: 37500, percentage: 15, type: 'negative', icon: <ArrowDownRight size={20} /> },
  { label: '(=) Receita Líquida', value: 212500, percentage: 85, type: 'total', icon: <Equal size={20} /> },
  { label: '(-) CMV (Custo de Aço/Insumos)', value: 100000, percentage: 40, type: 'negative', icon: <ArrowDownRight size={20} /> },
  { label: '(=) Margem de Contribuição', value: 112500, percentage: 45, type: 'total', icon: <Equal size={20} /> },
  { label: '(-) Despesas Fixas (Folha, Aluguel, Energia)', value: 62500, percentage: 25, type: 'negative', icon: <ArrowDownRight size={20} /> },
  { label: '(=) LUCRO LÍQUIDO', value: 50000, percentage: 20, type: 'total', icon: <Equal size={20} /> },
];

export const Contabilidade: React.FC = () => {
  return (
    <div className="h-full flex flex-col gap-6 p-2">
      <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <PieChart className="text-blue-500" /> DRE Gerencial
      </h2>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-lg text-emerald-700">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-slate-600 text-sm">Margem de Lucro Líquida</p>
            <p className="text-2xl font-bold text-emerald-400">20%</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-700">
            <Target size={24} />
          </div>
          <div>
            <p className="text-slate-600 text-sm">Ponto de Equilíbrio (Break-even)</p>
            <p className="text-2xl font-bold text-slate-900">R$ 138.888,00</p>
          </div>
        </div>
      </div>

      {/* DRE Funnel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {dreData.map((item, index) => {
          const colorClass = item.type === 'positive' ? 'text-emerald-400' : item.type === 'negative' ? 'text-rose-400' : 'text-blue-400';
          return (
            <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <div className={colorClass}>{item.icon}</div>
                <span className="font-medium text-slate-900">{item.label}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className={`font-bold text-lg ${colorClass}`}>
                  {item.type === 'negative' ? '- ' : ''}R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-slate-600 font-mono text-sm w-16 text-right">{item.percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
