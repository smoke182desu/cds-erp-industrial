import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Viewer3D } from '../components/Part3DViewer/Viewer3D';
import { perfisDB } from '../data/perfisDB';

export const VisualizadorPublico: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [anguloAberturaGraus, setAnguloAberturaGraus] = useState<number>(0);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      try {
        const res = await fetch(`/api/projects?id=${id}`);
        const json = await res.json();
        if (json.ok && json.project) {
          setProjectData(json.project);
        } else {
          setError('Projeto nao encontrado ou indisponivel');
        }
      } catch (err) {
        console.error('Erro ao buscar projeto:', err);
        setError('Projeto nao encontrado ou indisponivel');
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Carregando projeto 3D...</p>
        </div>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-300 max-w-md">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Ops!</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const config = projectData.data;
  const companyConfig = projectData.companyConfig || { nomeEmpresa: 'Serralheria', multiplicadorLucro: 1.5, telefone: '', logoBase64: '' };
  const perfilSelecionado = perfisDB.find((p: any) => p.id === config.perfilSelecionadoId) || perfisDB[0];

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans">
      <header className="h-16 bg-white border-b border-slate-300 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-3">
          {companyConfig.logoBase64 ? (
            <img src={companyConfig.logoBase64} alt="Logo" className="h-10 object-contain" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              {companyConfig.nomeEmpresa ? companyConfig.nomeEmpresa.charAt(0).toUpperCase() : 'A'}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-800">{companyConfig.nomeEmpresa || 'Proposta 3D'}</h1>
            <p className="text-xs text-slate-600">{projectData.name}</p>
          </div>
        </div>
        {companyConfig.telefone && (
          <div className="text-sm font-medium text-slate-600">{companyConfig.telefone}</div>
        )}
      </header>

      <main className="flex-1 relative flex flex-col md:flex-row">
        <div className="flex-1 h-full relative">
          <Viewer3D
            largura={config.largura}
            altura={config.altura}
            perfilData={perfilSelecionado}
            quantidadeGrades={config.quantidadeGrades}
            tipoMontagem={config.tipoMontagem}
            tipoProduto={config.tipoProduto}
            anguloAbertura={(anguloAberturaGraus * Math.PI) / 180}
            temGuardaCorpo={config.temGuardaCorpo}
            ladoGuardaCorpo={config.ladoGuardaCorpo}
            acabamentoMetal={config.acabamento}
            materialDegrau={config.materialDegrau}
          />
        </div>
        {config.tipoProduto === 'portao_basculante' && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4 md:static md:transform-none md:w-80 md:h-full md:border-l md:border-slate-300 md:bg-white md:p-6 md:flex md:flex-col md:justify-center">
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-slate-300/50">
              <h3 className="text-sm font-bold text-slate-800 mb-4 text-center md:text-left">Interacao</h3>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700 flex justify-between">
                  <span>Abrir Portao</span>
                  <span className="text-blue-600">{anguloAberturaGraus}deg</span>
                </label>
                <input
                  type="range" min="0" max="90" step="1"
                  value={anguloAberturaGraus}
                  onChange={(e) => setAnguloAberturaGraus(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-300 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 z-10">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-slate-600 font-medium">Dimensoes Totais</span>
            <span className="font-bold text-slate-800">{config.largura}mm x {config.altura}mm</span>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-slate-600 font-medium">Material</span>
            <span className="font-bold text-slate-800">{perfilSelecionado.nome}</span>
          </div>
        </div>
        {config.custoTotal && (
          <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
            <span className="text-sm text-blue-800 font-medium mr-2">Valor Estimado:</span>
            <span className="text-lg font-bold text-blue-700">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                config.custoTotal + (config.custoTotal * companyConfig.multiplicadorLucro)
              )}
            </span>
          </div>
        )}
      </footer>
    </div>
  );
};
