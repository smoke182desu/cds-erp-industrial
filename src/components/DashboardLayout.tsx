import React from 'react';
import { LayoutDashboard, Users, FileText, Scissors, Box, DollarSign, BarChart3, Building2, LucideIcon, PaintBucket, Package, Truck, Upload, Layers, Hammer, Sparkles, ShoppingCart, LogOut } from 'lucide-react';
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
    <div className="flex h-screen bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white">ERP Industrial</h1>
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
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm transition-all border-l-2 ${
                      activeTab === item.id
                        ? 'bg-slate-900 border-blue-500 text-white'
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900'
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
        
        <div className="p-4 border-t border-slate-800">
          <p className="text-xs text-slate-400 mb-2">Logado como: {user?.name} - {user?.role}</p>
          <button onClick={logout} className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 text-sm">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-950">
        <header className="h-16 border-b border-slate-800 flex items-center px-8">
          <h2 className="text-lg font-medium text-white">
            {sections.flatMap(s => s.items).find(i => i.id === activeTab)?.name || 'Dashboard'}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
