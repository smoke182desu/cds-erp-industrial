import React, { useState, useMemo, useEffect } from 'react';
import { Phone, Plus, MessageCircle, Edit, Search, User, LayoutGrid, List as ListIcon } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { NovoClienteModal } from '../components/NovoClienteModal';
import { WhatsAppAnalyzerModal } from '../components/WhatsAppAnalyzerModal';
import { Cliente } from '../types';

type ViewMode = 'list' | 'kanban';

const FUNNEL_STAGES: NonNullable<Cliente['funnelStage']>[] = [
  'Prospecção',
  'Qualificação',
  'Apresentação',
  'Negociação',
  'Fechamento',
  'Pós-venda',
];

const TIPO_LABEL: Record<string, string> = {
  PF: 'Física',
  PJ: 'Jurídica',
  GOV: 'Governo',
  FUNC: 'Funcionário',
  FORN: 'Fornecedor',
  PES: 'Pessoal',
};

const tituloPorFiltro = (filtroTipo?: string) => {
  if (!filtroTipo) return { titulo: 'Cadastros', subtitulo: 'Gerencie todos os seus contatos' };
  if (filtroTipo === 'FORN') return { titulo: 'Fornecedores', subtitulo: 'Gerencie seus fornecedores' };
  if (filtroTipo === 'GOV') return { titulo: 'Cadastro de Governo', subtitulo: 'Órgãos públicos e contatos governamentais' };
  if (filtroTipo === 'FUNC') return { titulo: 'Funcionários', subtitulo: 'Gerencie sua equipe' };
  return { titulo: 'Cadastro de Clientes', subtitulo: 'Gerencie todos os seus contatos e clientes em um só lugar' };
};

export const Clientes: React.FC<{ filtroTipo?: string }> = ({ filtroTipo }) => {
  const { state } = useERP();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [clienteParaAnalisar, setClienteParaAnalisar] = useState<Cliente | undefined>(undefined);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | undefined>(undefined);
  const [busca, setBusca] = useState('');

  // Toggle Lista / Kanban — persistido por filtro no localStorage
  const storageKey = `cdsind:viewMode:${filtroTipo || 'all'}`;
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'list';
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'kanban' ? 'kanban' : 'list';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, viewMode);
    }
  }, [storageKey, viewMode]);

  const { titulo, subtitulo } = tituloPorFiltro(filtroTipo);
  const isClientesCRM = filtroTipo === 'PF,PJ' || !filtroTipo;

  // Helper para formatar ID numérico curto a partir do ID real (ex: CLI-173... -> #173...)
  const getShortId = (id: string) => {
    const numbers = id.replace(/\D/g, '');
    return numbers ? `#${numbers.slice(-5)}` : `#${id.slice(-5).toUpperCase()}`;
  };

  const clientesFiltrados = useMemo(() => {
    return state.clientes
      .filter(c => !filtroTipo || filtroTipo.split(',').includes(c.tipo))
      .filter(c => {
        if (!busca) return true;
        const termo = busca.toLowerCase();
        return (
          (c.nome || '').toLowerCase().includes(termo) ||
          (c.telefone || '').includes(termo) ||
          (c.documento || '').includes(termo) ||
          (c.razaoSocial || '').toLowerCase().includes(termo)
        );
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [state.clientes, filtroTipo, busca]);

  // Agrupa para Kanban
  const clientesPorEstagio = useMemo(() => {
    if (isClientesCRM) {
      const grupos: Record<string, Cliente[]> = {};
      FUNNEL_STAGES.forEach(s => { grupos[s] = []; });
      const semEstagio: Cliente[] = [];
      clientesFiltrados.forEach(c => {
        const stage = c.funnelStage;
        if (stage && grupos[stage]) grupos[stage].push(c);
        else semEstagio.push(c);
      });
      return { grupos, semEstagio };
    }
    // Para Fornecedores / Governo / Funcionários — agrupa por UF
    const grupos: Record<string, Cliente[]> = {};
    clientesFiltrados.forEach(c => {
      const uf = c.uf || 'Sem UF';
      if (!grupos[uf]) grupos[uf] = [];
      grupos[uf].push(c);
    });
    return { grupos, semEstagio: [] as Cliente[] };
  }, [clientesFiltrados, isClientesCRM]);

  const openWhatsApp = (client: Cliente) => {
    if (!client.telefone) return;
    const phone = client.telefone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const abrirAnalisadorWhatsApp = (cliente?: Cliente) => {
    setClienteParaAnalisar(cliente);
    setIsWhatsAppModalOpen(true);
  };

  const abrirModalEdicao = (cliente?: Cliente) => {
    setClienteParaEditar(cliente);
    setIsModalOpen(true);
  };

  const renderCardKanban = (cliente: Cliente) => (
    <div key={cliente.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-800 truncate" title={cliente.nome}>{cliente.nome || 'Sem Nome'}</h4>
          {cliente.razaoSocial && (
            <p className="text-xs text-slate-500 truncate" title={cliente.razaoSocial}>{cliente.razaoSocial}</p>
          )}
          {cliente.tipo === 'FUNC' && cliente.complemento && (
            <p className="text-xs text-indigo-600 font-medium truncate" title={cliente.complemento}>{cliente.complemento}</p>
          )}
        </div>
        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
          {getShortId(cliente.id)}
        </span>
      </div>
      <div className="space-y-1 text-xs text-slate-600 mb-3">
        {cliente.telefone && <div>📞 {cliente.telefone}</div>}
        {cliente.cidade && <div>📍 {cliente.cidade}{cliente.uf ? ` - ${cliente.uf}` : ''}</div>}
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-100">
            {TIPO_LABEL[cliente.tipo] || cliente.tipo}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
        {cliente.telefone && (
          <button
            onClick={() => openWhatsApp(cliente)}
            title="Chamar no WhatsApp"
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
          >
            <Phone size={16} />
          </button>
        )}
        <button
          onClick={() => abrirAnalisadorWhatsApp(cliente)}
          title="Analisar IA do WhatsApp"
          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
        >
          <MessageCircle size={16} />
        </button>
        <button
          onClick={() => abrirModalEdicao(cliente)}
          title="Ver / Editar"
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          <Edit size={16} />
        </button>
      </div>
    </div>
  );

  const renderKanban = () => {
    type Coluna = { titulo: string; itens: Cliente[] };
    let colunas: Coluna[];
    if (isClientesCRM) {
      colunas = FUNNEL_STAGES.map<Coluna>(s => ({ titulo: s, itens: clientesPorEstagio.grupos[s] || [] }));
      if (clientesPorEstagio.semEstagio.length) {
        colunas.push({ titulo: 'Sem Estágio', itens: clientesPorEstagio.semEstagio });
      }
    } else {
      colunas = Object.keys(clientesPorEstagio.grupos)
        .sort()
        .map<Coluna>(uf => ({ titulo: uf, itens: clientesPorEstagio.grupos[uf] }));
    }

    if (clientesFiltrados.length === 0) {
      return (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center p-12">
          <div className="text-center text-slate-500">
            <User size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium">Nenhum registro encontrado</p>
            <p className="text-sm">Tente mudar os filtros ou cadastre um novo.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full pb-2">
          {colunas.map(col => (
            <div key={col.titulo} className="w-72 flex-shrink-0 bg-slate-100/60 rounded-2xl p-3 flex flex-col border border-slate-200">
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="font-bold text-sm text-slate-700 truncate" title={col.titulo}>{col.titulo}</h3>
                <span className="text-xs font-mono bg-white border border-slate-200 text-slate-600 rounded px-2 py-0.5">
                  {col.itens.length}
                </span>
              </div>
              <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                {col.itens.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-2 py-4 text-center">Vazio</p>
                ) : (
                  col.itens.map(renderCardKanban)
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLista = () => (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
              <th className="px-6 py-4 rounded-tl-2xl">ID</th>
              <th className="px-6 py-4">Cliente / Empresa</th>
              <th className="px-6 py-4">Contato</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Localidade</th>
              <th className="px-6 py-4 text-right rounded-tr-2xl">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  <User size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium">Nenhum registro encontrado</p>
                  <p className="text-sm">Tente mudar os filtros ou cadastre um novo.</p>
                </td>
              </tr>
            ) : (
              clientesFiltrados.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 align-middle">
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {getShortId(cliente.id)}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="font-semibold text-slate-800">{cliente.nome || 'Sem Nome'}</div>
                    {cliente.razaoSocial && (
                      <div className="text-xs text-slate-500 truncate max-w-[200px]" title={cliente.razaoSocial}>
                        {cliente.razaoSocial}
                      </div>
                    )}
                    {cliente.tipo === 'FUNC' && cliente.complemento && (
                      <div className="text-xs text-indigo-600 font-medium truncate max-w-[200px]" title={cliente.complemento}>
                        {cliente.complemento}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="text-sm font-medium text-slate-700">{cliente.telefone || '-'}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{cliente.email || ''}</div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-100">
                      {TIPO_LABEL[cliente.tipo] || cliente.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-middle text-sm text-slate-600">
                    {cliente.cidade ? `${cliente.cidade} - ${cliente.uf}` : '-'}
                  </td>
                  <td className="px-6 py-4 align-middle text-right">
                    <div className="flex items-center justify-end gap-2">
                      {cliente.telefone && (
                        <button
                          onClick={() => openWhatsApp(cliente)}
                          title="Chamar no WhatsApp"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                        >
                          <Phone size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => abrirAnalisadorWhatsApp(cliente)}
                        title="Analisar IA do WhatsApp"
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                      >
                        <MessageCircle size={18} />
                      </button>
                      <button
                        onClick={() => abrirModalEdicao(cliente)}
                        title="Ver Informações Completas / Editar"
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-300"
                      >
                        <Edit size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{titulo}</h2>
          <p className="text-sm text-slate-500">{subtitulo}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle Lista/Kanban */}
          <div className="inline-flex items-center bg-white border border-slate-300 rounded-xl shadow-sm p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Visualização em lista"
            >
              <ListIcon size={14} />
              Lista
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'kanban'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Visualização em kanban"
            >
              <LayoutGrid size={14} />
              Kanban
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou documento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full sm:w-80 shadow-sm"
            />
          </div>
          <button
            onClick={() => abrirAnalisadorWhatsApp()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl shadow-lg transition-all"
            title="Importar do WhatsApp usando Inteligência Artificial"
          >
            <MessageCircle size={16} />
            <span className="hidden sm:inline">IA WhatsApp</span>
          </button>
          <button
            onClick={() => abrirModalEdicao()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' ? renderLista() : renderKanban()}

      {isModalOpen && (
        <NovoClienteModal
          onClose={() => {
            setIsModalOpen(false);
            setClienteParaEditar(undefined);
          }}
          initialData={clienteParaEditar}
        />
      )}

      {isWhatsAppModalOpen && (
        <WhatsAppAnalyzerModal
          clienteExistente={clienteParaAnalisar}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setClienteParaAnalisar(undefined);
          }}
        />
      )}
    </div>
  );
};
