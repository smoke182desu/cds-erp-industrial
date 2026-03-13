import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectState, User } from '../types';
import { 
  Save, FolderOpen, RotateCcw, Cloud, LogIn, LogOut, Box, Ruler, Weight, Layers, Library, X, ChevronRight,
  Warehouse, Triangle, DoorOpen, Fence, TrendingUp, AppWindow, Hammer, Grid, Trash2, ShoppingCart, Sparkles
} from 'lucide-react';
import { calculateWeight } from '../utils/calculations';
import { PROJECT_TEMPLATES, Template, PROJECT_CATEGORIES, ProjectCategory } from '../constants/templates';
import { motion, AnimatePresence } from 'motion/react';
import { useERP } from '../contexts/ERPContext';
import { CheckoutPropostaModal } from './CheckoutPropostaModal';

interface SidebarProps {
  project: ProjectState;
  user: User | null;
  onUpdate: (updates: Partial<ProjectState['dimensions']>) => void;
  onSave: () => void;
  onLoad: () => void;
  onCloudSave: () => void;
  onOpenCloud: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onReset: () => void;
  onLoadTemplate: (template: Partial<ProjectState>) => void;
  onClose?: () => void;
}

const TemplateIcon = ({ name, size }: { name: string; size: number }) => {
  switch (name) {
    case 'Warehouse': return <Warehouse size={size} />;
    case 'Triangle': return <Triangle size={size} />;
    case 'DoorOpen': return <DoorOpen size={size} />;
    case 'Fence': return <Fence size={size} />;
    case 'TrendingUp': return <TrendingUp size={size} />;
    case 'AppWindow': return <AppWindow size={size} />;
    case 'Hammer': return <Hammer size={size} />;
    case 'Grid': return <Grid size={size} />;
    case 'Trash2': return <Trash2 size={size} />;
    case 'Library': return <Library size={size} />;
    case 'Box': return <Box size={size} />;
    default: return <Box size={size} />;
  }
};

export function Sidebar({ 
  project, 
  user,
  onUpdate, 
  onSave, 
  onLoad, 
  onCloudSave,
  onOpenCloud,
  onLogin,
  onLogout,
  onReset,
  onLoadTemplate,
  onClose
}: SidebarProps) {
  const navigate = useNavigate();
  const { state, totalCarrinho, fecharProposta } = useERP();
  const weight = calculateWeight(project);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | 'Todos'>('Todos');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const handleTemplateSelect = (template: Template) => {
    // In iframe environment, avoid window.confirm
    onLoadTemplate(template.project);
    setIsTemplateModalOpen(false);
  };

  const filteredTemplates = PROJECT_TEMPLATES.filter(t => {
    const matchesCategory = selectedCategory === 'Todos' || t.category === selectedCategory;
    const matchesType = !project.tipoProduto || t.project.tipoProduto === project.tipoProduto;
    return matchesCategory && matchesType;
  });

  return (
    <>
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-10">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white flex justify-between items-center">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-200 shadow-lg">
              <Box size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">AçoFácil</h1>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full">Beta</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Braço Direito da Engenharia</p>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full lg:hidden text-slate-400"
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        {/* Mini Cart */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-emerald-400" />
            <span className="font-bold">{state.carrinhoAtual.length} itens</span>
          </div>
          <div className="text-sm font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCarrinho)}
          </div>
          <button 
            onClick={() => setIsCheckoutOpen(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg font-bold"
          >
            📄 Revisar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Quick Actions / Templates */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Library size={14} /> Repertório Rápido
            </h2>
            <button 
              onClick={() => setIsTemplateModalOpen(true)}
              className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 hover:border-blue-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg text-blue-600 shadow-sm">
                  <Library size={18} />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-slate-700">Modelos Prontos</span>
                  <span className="block text-xs text-slate-500">Comece com um clique</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>

          {/* Project Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Projeto Atual</h2>
              <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">v{project.version.toFixed(1)}</span>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={16} className="text-blue-500" />
                <h3 className="font-semibold text-slate-700 truncate" title={project.name}>{project.name}</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-400 block mb-1">Material</span>
                  <span className="font-medium text-slate-700">{project.material}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-400 block mb-1">Peso Est.</span>
                  <span className="font-medium text-slate-700">{weight} kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Ruler size={14} /> Dimensões (mm)
            </h2>
            
            <div className="space-y-3">
              <div className="group">
                <label className="text-xs font-medium text-slate-500 mb-1 block group-hover:text-blue-600 transition-colors">Largura (W)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={project.dimensions.width || 0}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600 focus:outline-none cursor-not-allowed"
                  />
                  <div className="absolute inset-0 bg-transparent" title="Use o Chat IA para alterar dimensões" />
                </div>
              </div>
              
              <div className="group">
                <label className="text-xs font-medium text-slate-500 mb-1 block group-hover:text-blue-600 transition-colors">Altura (H)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={project.dimensions.height || 0}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600 focus:outline-none cursor-not-allowed"
                  />
                  <div className="absolute inset-0 bg-transparent" title="Use o Chat IA para alterar dimensões" />
                </div>
              </div>

              <div className="group">
                <label className="text-xs font-medium text-slate-500 mb-1 block group-hover:text-blue-600 transition-colors">Profundidade (D)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={project.dimensions.depth || 0}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600 focus:outline-none cursor-not-allowed"
                  />
                  <div className="absolute inset-0 bg-transparent" title="Use o Chat IA para alterar dimensões" />
                </div>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 italic bg-blue-50 p-2 rounded border border-blue-100">
              * Para alterar medidas ou criar peças, peça ao seu Braço Direito técnico no chat.
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={onSave}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
              title="Salvar Localmente (JSON)"
            >
              <Save size={16} className="text-blue-500" /> Salvar
            </button>
            <button 
              onClick={onLoad}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
              title="Carregar Localmente (JSON)"
            >
              <FolderOpen size={16} className="text-amber-500" /> Abrir
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={onCloudSave}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
              title="Salvar na Nuvem"
            >
              <Cloud size={16} /> Salvar Cloud
            </button>
            <button 
              onClick={onOpenCloud}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
              title="Abrir da Nuvem"
            >
              <Cloud size={16} className="text-blue-500" /> Abrir Cloud
            </button>
          </div>

          <button 
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <RotateCcw size={14} /> Resetar Projeto
          </button>
        </div>
        
        {/* Checkout Modal */}
        <CheckoutPropostaModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />
      </div>

      {/* Templates Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                    <Library size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Repertório de Modelos</h2>
                    <p className="text-sm text-slate-500">Escolha um modelo base para começar rapidamente</p>
                  </div>
                </div>
                <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="flex flex-1 overflow-hidden">
                {/* Category Sidebar */}
                <div className="w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto p-4 space-y-2 shrink-0">
                  <button
                    onClick={() => setSelectedCategory('Todos')}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      selectedCategory === 'Todos' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                        : 'text-slate-600 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    Todos os Modelos
                  </button>
                  
                  <div className="pt-2 pb-1">
                    <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Categorias</p>
                  </div>

                  {PROJECT_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        selectedCategory === category 
                          ? 'bg-white text-blue-600 shadow-md border border-blue-100' 
                          : 'text-slate-600 hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Templates Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                  {filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <Library size={48} className="mb-4 opacity-20" />
                      <p>Nenhum modelo encontrado nesta categoria.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTemplates.map((template) => (
                        <button 
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className="group bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-5 rounded-xl transition-all text-left shadow-sm hover:shadow-md flex flex-col h-full"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 bg-slate-100 group-hover:bg-blue-100 rounded-lg text-slate-600 group-hover:text-blue-600 transition-colors">
                              <TemplateIcon name={template.icon} size={24} />
                            </div>
                            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600">
                              {template.project.components?.length} peças
                            </span>
                          </div>
                          
                          <h3 className="font-bold text-slate-800 mb-1 group-hover:text-blue-700">{template.name}</h3>
                          <p className="text-sm text-slate-500 mb-4 flex-1 line-clamp-2">{template.description}</p>
                          
                          <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">
                              {template.category.split(' ')[0]}...
                            </span>
                            <div className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                              Carregar <ChevronRight size={12} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
