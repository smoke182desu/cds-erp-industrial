import React, { useState } from 'react';
import { AssistenteIA } from './pages/AssistenteIA';
import { DashboardLayout } from './components/DashboardLayout';
import { Clientes } from './pages/Clientes';
import { Propostas } from './pages/Propostas';
import { DashboardBI } from './pages/DashboardBI';
import { PlanoCorte } from './pages/PlanoCorte';
import { PlanoDobra } from './pages/PlanoDobra';
import { PlanoMontagemSolda } from './pages/PlanoMontagemSolda';
import { PlanoPintura } from './pages/PlanoPintura';
import { PlanoEmbalagem } from './pages/PlanoEmbalagem';
import { PlanoEntrega } from './pages/PlanoEntrega';
import { PCPKanban } from './pages/PCPKanban';
import { Faturamento } from './pages/Faturamento';
import { EntradaInteligente } from './pages/EntradaInteligente';
import { EstoqueInteligente } from './pages/EstoqueInteligente';
import { FluxoCaixa } from './pages/FluxoCaixa';
import { PatrimonioVisual } from './pages/PatrimonioVisual';
import { Contabilidade } from './pages/Contabilidade';
import { Locacoes } from './pages/Locacoes';
import { Licitacoes } from './pages/Licitacoes';
import { Configurador } from './components/Configurador';
import { Login } from './pages/Login';
import { ERPProvider } from './contexts/ERPContext';
import { ProjectState } from './types';
import { generateInitialProject } from './utils/calculations';
import { calculateCutPlan } from './utils/nesting';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';

function AppContent() {
  const [project, setProject] = useState<ProjectState>(() => {
    const initial = generateInitialProject();
    initial.cutPlan = calculateCutPlan(initial.components);
    return initial;
  });
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const { user } = useAuth();

  const handleAIProjectUpdate = React.useCallback((updates: Partial<ProjectState>) => {
    setProject(prev => {
      const newComponents = updates.components || prev.components;
      const newDimensions = updates.dimensions ? { ...prev.dimensions, ...updates.dimensions } : prev.dimensions;
      const newServiceDescription = updates.serviceDescription || prev.serviceDescription;
      
      const newState: ProjectState = {
        ...prev,
        ...updates,
        dimensions: newDimensions,
        components: newComponents,
        serviceDescription: newServiceDescription,
        lastModified: Date.now(),
        version: prev.version + 1
      };

      newState.cutPlan = calculateCutPlan(newComponents);
      
      return newState;
    });
  }, []);

  return (
    !user ? (
      <Login />
    ) : (
      <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'dashboard' && <DashboardBI />}
        {activeTab === 'assistente-ia' && <AssistenteIA onTabChange={setActiveTab} />}
        {activeTab === 'projetos-3d' && (
          <Configurador 
            project={project} 
            onUpdate={handleAIProjectUpdate} 
          />
        )}
        {activeTab === 'crm' && <Clientes />}
        {activeTab === 'propostas' && <Propostas />}
        {activeTab === 'checkout' && <Propostas />}
        {activeTab === 'licitacoes' && <Licitacoes />}
        {activeTab === 'locacoes' && <Locacoes />}
        {activeTab === 'corte' && <PlanoCorte />}
        {activeTab === 'dobra' && <PlanoDobra />}
        {activeTab === 'solda' && <PlanoMontagemSolda />}
        {activeTab === 'pintura' && <PlanoPintura />}
        {activeTab === 'embalagem' && <PlanoEmbalagem />}
        {activeTab === 'entrega' && <PlanoEntrega />}
        {activeTab === 'pcp-kanban' && <PCPKanban />}
        {activeTab === 'faturamento' && <Faturamento />}
        {activeTab === 'entrada-inteligente' && <EntradaInteligente />}
        {activeTab === 'estoque' && <EstoqueInteligente />}
        {activeTab === 'caixa' && <FluxoCaixa />}
        {activeTab === 'patrimonio' && <PatrimonioVisual />}
        {activeTab === 'contabilidade' && <Contabilidade />}
      </DashboardLayout>
    )
  );
}

function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <ERPProvider>
          <AppContent />
        </ERPProvider>
      </ConfigProvider>
    </AuthProvider>
  );
}

export default App;
