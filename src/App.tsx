import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardLayout } from './components/DashboardLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ERPProvider } from './contexts/ERPContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { Login } from './pages/Login';
import { ProjectState } from './types';

// Pages
import { DashboardBI } from './pages/DashboardBI';
import { AssistenteIA } from './pages/AssistenteIA';
import { Clientes } from './pages/Clientes';
import { Propostas } from './pages/Propostas';
import { Licitacoes } from './pages/Licitacoes';
import { Locacoes } from './pages/Locacoes';
import { PlanoCorte } from './pages/PlanoCorte';
import { PlanoDobra } from './pages/PlanoDobra';
import { PlanoMontagemSolda } from './pages/PlanoMontagemSolda';
import { PlanoPintura } from './pages/PlanoPintura';
import { PlanoEmbalagem } from './pages/PlanoEmbalagem';
import { PlanoEntrega } from './pages/PlanoEntrega';
import { PCPKanban } from './pages/PCPKanban';
import { Faturamento } from './pages/Faturamento';
import { EstoqueInteligente } from './pages/EstoqueInteligente';
import { EntradaInteligente } from './pages/EntradaInteligente';
import { FluxoCaixa } from './pages/FluxoCaixa';
import { Contabilidade } from './pages/Contabilidade';
import { PatrimonioVisual } from './pages/PatrimonioVisual';
import { Leads } from './pages/Leads';
import { Configurador } from './components/Configurador';
import { CheckoutPropostaModal } from './components/CheckoutPropostaModal';

const defaultProject: ProjectState = {
  id: 'new',
  name: 'Novo Projeto',
  version: 1,
  lastModified: Date.now(),
  dimensions: { width: 1000, height: 1000, depth: 1000 },
  material: 'aco_carbono',
  components: [],
  processParameters: {
    cuttingMethod: 'chop-saw',
    weldingType: 'mig',
    weldingIntensity: 'medium',
    surfaceFinish: 'painted',
  },
};

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [project, setProject] = useState<ProjectState>(defaultProject);
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  const handleUpdateProject = (updates: Partial<ProjectState>) => {
    setProject(prev => ({ ...prev, ...updates }));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardBI />;
      case 'assistente-ia':
        return <AssistenteIA onTabChange={setActiveTab} />;
      case 'projetos-3d':
        return <Configurador project={project} onUpdate={handleUpdateProject} />;
      case 'crm':
        return <Clientes />;
      case 'propostas':
        return <Propostas />;
      case 'checkout':
        return <CheckoutPropostaModal isOpen={true} onClose={() => setActiveTab('dashboard')} />;
      case 'licitacoes':
        return <Licitacoes />;
      case 'locacoes':
        return <Locacoes />;
      case 'corte':
        return <PlanoCorte />;
      case 'dobra':
        return <PlanoDobra />;
      case 'solda':
        return <PlanoMontagemSolda />;
      case 'pintura':
        return <PlanoPintura />;
      case 'embalagem':
        return <PlanoEmbalagem />;
      case 'entrega':
        return <PlanoEntrega />;
      case 'pcp-kanban':
        return <PCPKanban />;
      case 'faturamento':
        return <Faturamento />;
      case 'estoque':
        return <EstoqueInteligente />;
      case 'entrada-inteligente':
        return <EntradaInteligente />;
      case 'caixa':
        return <FluxoCaixa />;
      case 'contabilidade':
        return <Contabilidade />;
      case 'patrimonio':
        return <PatrimonioVisual />;
      case 'leads':
        return <Leads />;
      default:
        return <DashboardBI />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfigProvider>
          <ERPProvider>
            <AppContent />
          </ERPProvider>
        </ConfigProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
