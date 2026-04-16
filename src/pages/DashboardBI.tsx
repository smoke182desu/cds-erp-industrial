import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, Factory, AlertTriangle, TrendingUp } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';

const KPI = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-lg shadow-slate-300/50">
    <div className={`p-4 rounded-xl ${color} bg-opacity-10`}>
      <Icon className={color.replace('bg-', 'text-')} size={28} />
    </div>
    <div>
      <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold">{title}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export const DashboardBI: React.FC = () => {
  const { state } = useERP();

  const kpis = useMemo(() => {
    const faturamento = state.transacoesFinanceiras
      .filter(t => t.tipo === 'RECEITA')
      .reduce((acc, t) => acc + t.valor, 0);
    
    const emProducao = state.ordensServico.filter(os => os.status !== 'Expedição/Pronto').length;
    
    const alertasEstoque = state.inventoryItems.filter(i => (state.inventory[i.id] || 0) <= i.estoqueMinimo).length;
    
    const propostasAprovadas = state.propostas.filter(p => p.status === 'Aprovada/Produção').length;
    const taxaConversao = state.propostas.length > 0 ? (propostasAprovadas / state.propostas.length) * 100 : 0;

    return { faturamento, emProducao, alertasEstoque, taxaConversao };
  }, [state]);

  const financeData = useMemo(() => {
    const receitas = state.transacoesFinanceiras.filter(t => t.tipo === 'RECEITA').reduce((acc, t) => acc + t.valor, 0);
    const despesas = state.transacoesFinanceiras.filter(t => t.tipo === 'DESPESA').reduce((acc, t) => acc + t.valor, 0);
    return [{ name: 'Financeiro', Receita: receitas, Despesa: despesas }];
  }, [state.transacoesFinanceiras]);

  const productionData = useMemo(() => {
    const colunas = ['Fila de Produção', 'Corte e Dobra', 'Solda e Montagem', 'Pintura e Acabamento', 'Expedição/Pronto'];
    return colunas.map(coluna => ({
      name: coluna,
      value: state.ordensServico.filter(os => os.status === coluna).length
    })).filter(d => d.value > 0);
  }, [state.ordensServico]);

  const atividades = useMemo(() => {
    return [
      ...state.propostas.map(p => ({ desc: `Nova Proposta: ${p.clienteNome || p.empresa || 'Cliente'}`, valor: p.total, date: p.data })),
      ...state.ordensServico.map(os => ({ desc: `O.S. Gerada: ${os.clienteNome}`, valor: 0, date: os.dataEntrega })),
      ...state.transacoesFinanceiras.map(t => ({ desc: `${t.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}: ${t.descricao}`, valor: t.valor, date: t.dataVencimento }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [state]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-900 space-y-6">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Cockpit Executivo</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI title="Faturamento Mensal" value={`R$ ${kpis.faturamento.toLocaleString('pt-BR')}`} icon={DollarSign} color="bg-green-500" />
        <KPI title="Em Produção" value={kpis.emProducao.toString()} icon={Factory} color="bg-blue-500" />
        <KPI title="Alertas de Estoque" value={kpis.alertasEstoque.toString()} icon={AlertTriangle} color="bg-red-500" />
        <KPI title="Taxa de Conversão" value={`${kpis.taxaConversao.toFixed(1)}%`} icon={TrendingUp} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="text-lg font-bold mb-6">Saúde Financeira (Receitas vs Despesas)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={financeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
              <Legend />
              <Bar dataKey="Receita" fill="#22c55e" />
              <Bar dataKey="Despesa" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="text-lg font-bold mb-6">Status da Produção</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={productionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                {productionData.map((entry, index) => <Cell key={index} fill={['#3b82f6', '#eab308', '#f97316', '#a855f7', '#22c55e'][index % 5]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h3 className="text-lg font-bold mb-4">Atividades Recentes</h3>
        <div className="space-y-4">
          {atividades.map((a, i) => (
            <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-2">
              <p className="text-slate-700">{a.desc}</p>
              <span className="text-slate-500 text-sm">{new Date(a.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
