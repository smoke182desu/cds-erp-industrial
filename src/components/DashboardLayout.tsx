import React, { useState } from 'react';
import {
  LayoutDashboard, Users, FileText, Scissors, Box, DollarSign,
  BarChart3, Building2, LucideIcon, PaintBucket, Package, Truck,
  Upload, Layers, Hammer, Sparkles, ShoppingCart, LogOut, Menu, X,
  MessageSquare, ShoppingBag, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarItem { name: string; icon: LucideIcon; id: string; badge?: string; }
interface SidebarSection { title: string; items: SidebarItem[]; }

const sections: SidebarSection[] = [
  {
    title: 'CRM & Comercial',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, id: 'dashboard' },
      { name: 'Assistente IA', icon: Sparkles, id: 'assistente-ia' },
      { name: 'Funil de Vendas', icon: TrendingUp, id: 'leads', badge: 'CRM' },
      { name: 'Clientes', icon: Users, id: 'crm' },
      { name: 'Produtos', icon: ShoppingBag, id: 'produtos' },
      { name: 'Propostas', icon: FileText, id: 'propostas' },
      { name: 'Projetos 3D', icon: Box, id: 'projetos-3d' },
      { name: 'Licitações (B2G)', icon: Building2, id: 'licitacoes' },
      { name: 'Locações', icon: Truck, id: 'locacoes' },
    ],
  },
  {
    title: 'Produção & Operações',
    items: [
      { name: 'PCP - Kanban', icon: LayoutDashboard, id: 'pcp-kanban' },
      { name: 'Plano de Corte', icon: Scissors, id: 'corte' },
      { name: 'Plano de Dobra', icon: Layers, id: 'dobra' },
      { name: 'Solda & Montagem', icon: Hammer, id: 'solda' },
      { name: 'Plano de Pintura', icon: PaintBucket, id: 'pintura' },
      { name: 'Plano de Embalagem', icon: Package, id: 'embalagem' },
      { name: 'Plano de Entrega', icon: Truck, id: 'entrega' },
      { name: 'Estoque Inteligente', icon: Box, id: 'estoque' },
      { name: 'Entrada Inteligente', icon: Upload, id: 'entrada-inteligente' },
    ],
  },
  {
    title: 'Financeiro & Controladoria',
    items: [
      { name: 'Faturamento', icon: ShoppingCart, id: 'faturamento' },
      { name: 'Fluxo de Caixa', icon: DollarSign, id: 'caixa' },
      { name: 'Contabilidade', icon: BarChart3, id: 'contabilidade' },
      { name: 'Patrimônio', icon: Building2, id: 'patrimonio' },
    ],
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children, activeTab, onTabChange,
}) => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const crmIds = ['dashboard','projetos-3d','crm','assistente-ia','propostas','checkout','licitacoes','locacoes','leads','produtos'];
  const prodIds = ['corte','dobra','solda','pintura','embalagem','entrega','pcp-kanban','faturamento','estoque','entrada-inteligente'];

  const filteredSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (!user) return false;
        if (user.role === 'DIRETOR') return true;
        if (user.role === 'VENDEDOR') return crmIds.includes(item.id);
        if (user.role === 'OPERADOR') return prodIds.includes(item.id);
        return false;
      }),
    }))
    .filter(section => section.items.length > 0);

  const allItems = sections.flatMap(s => s.items);
  const activeItem = allItems.find(i => i.id === activeTab);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">CDS Industrial</h1>
            <p className="text-xs text-slate-400 mt-0.5">ERP Integrado</p>
          </div>
          <button className="lg:hidden p-2 text-slate-600 hover:text-slate-900" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          {filteredSections.map((section) => (
            <div key={section.title} className="mb-6">
              <h2 className="px-5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                {section.title}
              </h2>
              <nav className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onTabChange(item.id); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-5 py-2 text-sm transition-all border-l-2 ${
                      activeTab === item.id
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon size={16} />
                    <span className="flex-1 text-left">{item.name}</span>
                    {item.badge && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-200">
          <p className="text-[10px] text-slate-500 mb-2 truncate">{user?.name} · {user?.role}</p>
          <button onClick={logout} className="w-full flex items-center gap-2 text-red-500 hover:text-red-600 text-sm">
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 lg:px-6 gap-4 shadow-sm">
          <button
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded border border-slate-200"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            {activeItem?.name || 'Dashboard'}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
