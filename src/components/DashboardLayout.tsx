import React, { useState } from 'react';
import { LayoutDashboard, Users, FileText, Scissors, Box, DollarSign, BarChart3, Building2, LucideIcon, PaintBucket, Package, Truck, Upload, Layers, Hammer, Sparkles, ShoppingCart, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarItem {
  name: string;
  icon: LucideIcon;
  id: string;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const sections: SidebarSection[] = [
  {
    title: 'Vendas & Engenharia',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, id: 'dashboard' },
      { name: 'Assistente IA', icon: Sparkles, id: 'assistente-ia' },
      { name: 'Projetos 3D', icon: Box, id: 'projetos-3d' },
      { name: 'Clientes (CRM)', icon: Users, id: 'crm' },
      { name: 'Propostas', icon: FileText, id: 'propostas' },
      { name: 'Checkout', icon: ShoppingCart, id: 'checkout' },
      { name: 'Licitações (B2G)', icon: Building2, id: 'licitacoes' },
      { name: 'Locações', icon: Truck, id: 'locacoes' },
    ]
  },
  {
    title: 'Produção & Operações',
    items: [
      { name: 'Plano de Corte', icon: Scissors, id: 'corte' },
      { name: 'Plano de Dobra', icon: Layers, id: 'dobra' },
      { name: 'Solda & Montagem', icon: Hammer, id: 'solda' },
      { name: 'Plano de Pintura', icon: PaintBucket, id: 'pintura' },
      { name: 'Plano de Embalagem', icon: Package, id: 'embalagem' },
      { name: 'Plano de Entrega', icon: Truck, id: 'entrega' },
      { name: 'PCP - Kanban', icon: LayoutDashboard, id: 'pcp-kanban' },
      { name: 'Faturamento', icon: FileText, id: 'faturamento' },
      { name: 'Estoque Inteligente', icon: Box, id: 'estoque' },
      { name: 'Entrada Inteligente', icon: Upload, id: 'entrada-inteligente' },
    ]
  },
  {
    title: 'Financeiro & Controladoria',
    items: [
      { name: 'Fluxo de Caixa', icon: DollarSign, id: 'caixa' },
      { name: 'Contabilidade', icon: BarChart3, id: 'contabilidade' },
      { name: 'Patrimônio', icon: Building2, id: 'patrimonio' },
    ]
  }
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (!user) return false;
      if (user.role === 'DIRETOR') return true;
      if (user.role === 'VENDEDOR') {
        return ['projetos-3d', 'crm', 'assistente-ia', 'propostas', 'checkout', 'licitacoes', 'locacoes'].includes(item.id);
      }
      if (user.role === 'OPERADOR') {
        return ['corte', 'dobra', 'solda', 'pintura', 'embalagem', 'entrega', 'pcp-kanban', 'faturamento', 'estoque', 'entrada-inteligente'].includes(item.id);
      }
      return false;
    })
  })).filter(section => section.items.length > 0);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 border-r border-slate-200 bg-slate-50 flex flex-col
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">ERP Industrial</h1>
          <button 
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6">
          {filteredSections.map((section) => (
            <div key={section.title} className="mb-8">
              <h2 className="px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {section.title}
              </h2>
              <nav className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm transition-all border-l-2 ${
                      activeTab === item.id
                        ? 'bg-white border-blue-500 text-slate-900'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <item.icon size={18} />
                    {item.name}
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-slate-200">
          <p className="text-[10px] text-slate-600 mb-2 truncate">Logado como: {user?.name}</p>
          <button onClick={logout} className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 text-sm">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50">
        <header className="h-16 border-b border-slate-200 flex items-center px-4 lg:px-8 gap-4">
          <button 
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 bg-white rounded border border-slate-200"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-medium text-slate-900 truncate">
            {sections.flatMap(s => s.items).find(i => i.id === activeTab)?.name || 'Dashboard'}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
