import React, { useMemo } from 'react';
import { Wrench, Truck, Settings, Building2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface Equipamento {
  id: string;
  nome: string;
  icon: React.ElementType;
  aquisicao: number;
  valorCompra: number;
  valorAtual: number;
  status: 'Operação' | 'Manutenção' | 'Quebrado';
  proximaManutencao: string;
}

const mockEquipamentos: Equipamento[] = [
  { id: '1', nome: 'Serra Fita de Bancada', icon: Settings, aquisicao: 2023, valorCompra: 8500, valorAtual: 6800, status: 'Operação', proximaManutencao: '15/04/2026' },
  { id: '2', nome: 'Máquina de Solda MIG/MAG 250A', icon: Wrench, aquisicao: 2024, valorCompra: 4200, valorAtual: 3900, status: 'Manutenção', proximaManutencao: 'AGORA' },
  { id: '3', nome: 'Caminhão Munck Ford Cargo', icon: Truck, aquisicao: 2020, valorCompra: 250000, valorAtual: 180000, status: 'Operação', proximaManutencao: '10/05/2026' },
];

export const PatrimonioVisual: React.FC = () => {
  const kpis = useMemo(() => {
    const totalInvestido = mockEquipamentos.reduce((sum, e) => sum + e.valorCompra, 0);
    const valorAtual = mockEquipamentos.reduce((sum, e) => sum + e.valorAtual, 0);
    const emManutencao = mockEquipamentos.filter(e => e.status !== 'Operação').length;
    return { totalInvestido, valorAtual, emManutencao };
  }, []);

  return (
    <div className="h-full flex flex-col gap-6 p-2">
      <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Building2 className="text-blue-500" /> Controle de Patrimônio
      </h2>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-6 rounded-xl">
          <p className="text-slate-600 text-sm flex items-center gap-2"><Building2 size={16} /> Total Investido</p>
          <p className="text-3xl font-bold text-slate-900">R$ {kpis.totalInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-xl">
          <p className="text-slate-600 text-sm flex items-center gap-2"><Clock size={16} className="text-blue-500" /> Valor Patrimonial Atual</p>
          <p className="text-3xl font-bold text-blue-400">R$ {kpis.valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-xl">
          <p className="text-slate-600 text-sm flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Equipamentos Parados/Manutenção</p>
          <p className="text-3xl font-bold text-amber-400">{kpis.emManutencao}</p>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockEquipamentos.map((eq) => {
          const Icon = eq.icon as React.ElementType;
          const depreciacao = ((eq.valorCompra - eq.valorAtual) / eq.valorCompra) * 100;
          const statusColor = eq.status === 'Operação' ? 'bg-emerald-500' : eq.status === 'Manutenção' ? 'bg-amber-500' : 'bg-rose-500';

          return (
            <div key={eq.id} className="bg-white border border-slate-200 p-6 rounded-xl flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-slate-100 rounded-lg text-blue-400">
                  {React.createElement(Icon, { size: 24 })}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-slate-900 ${statusColor}`}>
                  {eq.status === 'Operação' ? '🟢' : eq.status === 'Manutenção' ? '🟡' : '🔴'} {eq.status}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900">{eq.nome}</h3>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Depreciação</span>
                  <span>{depreciacao.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${depreciacao}%` }} />
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-200 text-sm text-slate-700">
                <p>Próxima Manutenção: <span className="font-bold text-slate-900">{eq.proximaManutencao}</span></p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
