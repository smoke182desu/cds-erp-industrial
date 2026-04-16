import { useState, useEffect, useCallback } from 'react';
import {
  Brain, User, Building2, Phone, Mail, FileText, MapPin,
  Package, ShoppingCart, AlertCircle, CheckCircle2, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Plus, DollarSign,
  Sparkles, Search, BadgeCheck, BadgePlus
} from 'lucide-react';

interface ClienteExtraido {
  nome?: string | null;
  empresa?: string | null;
  telefone?: string | null;
  email?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  inscricaoEstadual?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface ProdutoExtraido {
  nome: string;
  descricao?: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  produtoPadrao: boolean;
  skuCatalogo?: string | null;
  produtoId?: string | null;
  nomeCatalogo?: string | null;
}

interface AnaliseConversa {
  cliente: ClienteExtraido;
  produtos: ProdutoExtraido[];
  observacoes: string;
  resumoConversa: string;
  camposFaltando: string[];
  confianca: number;
  prontoParaProposta: boolean;
}

interface ConversaInteligenteProps {
  telefone: string;
  leadNome?: string;
  leadEmpresa?: string;
  onGerarProposta: (analise: AnaliseConversa) => void;
  onCadastrarProduto?: (produto: ProdutoExtraido) => void;
}

export default function ConversaInteligente({
  telefone, leadNome, leadEmpresa, onGerarProposta, onCadastrarProduto,
}: ConversaInteligenteProps) {
  const [analise, setAnalise] = useState<AnaliseConversa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [expandido, setExpandido] = useState({ cliente: true, produtos: true, faltando: false });
  const [meta, setMeta] = useState({ totalMsgs: 0, msgsUsadas: 0, produtosCatalogo: 0 });

  const analisar = useCallback(async () => {
    if (!telefone) return;
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch('/api/conversa-inteligencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao analisar');
      setAnalise(json.analise);
      setMeta({
        totalMsgs: json.totalMensagens || 0,
        msgsUsadas: json.mensagensUsadas || 0,
        produtosCatalogo: json.produtosCatalogo || 0,
      });
    } catch (e: any) {
      setErro(e.message || 'Erro desconhecido');
    } finally {
      setCarregando(false);
    }
  }, [telefone]);

  useEffect(() => {
    if (telefone) analisar();
  }, [telefone, analisar]);

  if (!telefone) return null;

  const confianca = analise?.confianca || 0;
  const corConfianca =
    confianca >= 70 ? 'bg-green-500' :
    confianca >= 40 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className="border-t border-gray-200 bg-gradient-to-b from-indigo-50/50 to-white">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-indigo-100">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
            Inteligencia da Conversa
          </span>
        </div>
        <button
          onClick={analisar}
          disabled={carregando}
          className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${carregando ? 'animate-spin' : ''}`} />
          {carregando ? 'Analisando...' : 'Atualizar'}
        </button>
      </div>

      {carregando && !analise && (
        <div className="p-4 flex flex-col items-center gap-2 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">IA analisando conversa...</span>
        </div>
      )}

      {erro && (
        <div className="mx-3 my-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {analise && (
        <div className="text-xs">
          {/* Barra de confianca */}
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500">Dados coletados</span>
              <span className="font-bold text-gray-700">{confianca}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${corConfianca} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(confianca, 100)}%` }}
              />
            </div>
            {analise.resumoConversa && (
              <p className="mt-1.5 text-gray-500 italic">{analise.resumoConversa}</p>
            )}
          </div>

          {/* Secao Cliente */}
          <div className="border-t border-gray-100">
            <button
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-gray-50"
              onClick={() => setExpandido(e => ({ ...e, cliente: !e.cliente }))}
            >
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold text-gray-700">Cliente</span>
                {analise.cliente.cnpj && (
                  <span className="bg-green-100 text-green-700 px-1 rounded text-[10px]">CNPJ</span>
                )}
              </div>
              {expandido.cliente ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {expandido.cliente && (
              <div className="px-3 pb-2 space-y-1">
                <DadoCliente icone={<User className="w-3 h-3" />} label="Nome" valor={analise.cliente.nome} />
                <DadoCliente icone={<Building2 className="w-3 h-3" />} label="Empresa" valor={analise.cliente.empresa || analise.cliente.nomeFantasia} />
                <DadoCliente icone={<Phone className="w-3 h-3" />} label="Telefone" valor={analise.cliente.telefone || telefone} />
                <DadoCliente icone={<Mail className="w-3 h-3" />} label="E-mail" valor={analise.cliente.email} />
                <DadoCliente icone={<FileText className="w-3 h-3" />} label="CNPJ" valor={analise.cliente.cnpj} destaque />
                {analise.cliente.razaoSocial && (
                  <DadoCliente icone={<Building2 className="w-3 h-3" />} label="Razao Social" valor={analise.cliente.razaoSocial} />
                )}
                <DadoCliente icone={<FileText className="w-3 h-3" />} label="IE" valor={analise.cliente.inscricaoEstadual} />
                {(analise.cliente.logradouro || analise.cliente.cidade) && (
                  <DadoCliente
                    icone={<MapPin className="w-3 h-3" />}
                    label="Endereco"
                    valor={[
                      analise.cliente.logradouro,
                      analise.cliente.numero,
                      analise.cliente.bairro,
                      analise.cliente.cidade && `${analise.cliente.cidade}/${analise.cliente.uf}`,
                      analise.cliente.cep && `CEP ${analise.cliente.cep}`,
                    ].filter(Boolean).join(', ')}
                  />
                )}
              </div>
            )}
          </div>

          {/* Secao Produtos */}
          <div className="border-t border-gray-100">
            <button
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-gray-50"
              onClick={() => setExpandido(e => ({ ...e, produtos: !e.produtos }))}
            >
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-violet-500" />
                <span className="font-semibold text-gray-700">
                  Produtos ({analise.produtos?.length || 0})
                </span>
              </div>
              {expandido.produtos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {expandido.produtos && (
              <div className="px-3 pb-2 space-y-1.5">
                {analise.produtos?.length ? analise.produtos.map((p, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded border ${
                      p.produtoPadrao
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1">
                        {p.produtoPadrao ? (
                          <BadgeCheck className="w-3.5 h-3.5 text-green-600" title="Produto do catalogo" />
                        ) : (
                          <BadgePlus className="w-3.5 h-3.5 text-amber-600" title="Produto novo" />
                        )}
                        <span className="font-medium text-gray-800">
                          {p.nomeCatalogo || p.nome}
                        </span>
                      </div>
                      {!p.produtoPadrao && onCadastrarProduto && (
                        <button
                          onClick={() => onCadastrarProduto(p)}
                          className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200 flex items-center gap-0.5"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          Cadastrar
                        </button>
                      )}
                    </div>
                    {p.descricao && <p className="text-gray-500 mt-0.5">{p.descricao}</p>}
                    <div className="flex items-center gap-3 mt-1 text-gray-600">
                      <span>{p.quantidade} {p.unidade}</span>
                      {p.precoUnitario > 0 && (
                        <span className="flex items-center gap-0.5 font-medium text-green-700">
                          <DollarSign className="w-3 h-3" />
                          R$ {p.precoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      {p.skuCatalogo && <span className="text-gray-400">SKU: {p.skuCatalogo}</span>}
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-400 italic">Nenhum produto identificado ainda</p>
                )}
              </div>
            )}
          </div>

          {/* Campos faltando */}
          {analise.camposFaltando?.length > 0 && (
            <div className="border-t border-gray-100">
              <button
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-gray-50"
                onClick={() => setExpandido(e => ({ ...e, faltando: !e.faltando }))}
              >
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                  <span className="font-semibold text-gray-700">Faltando ({analise.camposFaltando.length})</span>
                </div>
                {expandido.faltando ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expandido.faltando && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {analise.camposFaltando.map((c, i) => (
                    <span key={i} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px]">{c}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {analise.observacoes && (
            <div className="border-t border-gray-100 px-3 py-2">
              <p className="text-gray-500">
                <span className="font-semibold text-gray-600">Obs: </span>
                {analise.observacoes}
              </p>
            </div>
          )}

          {/* Botao Gerar Proposta */}
          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => onGerarProposta(analise)}
              disabled={!analise.prontoParaProposta && confianca < 30}
              className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                analise.prontoParaProposta
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                  : confianca >= 30
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {analise.prontoParaProposta ? (
                <><Sparkles className="w-4 h-4" /> Gerar Proposta</>
              ) : (
                <><ShoppingCart className="w-4 h-4" /> {confianca >= 30 ? 'Gerar Proposta (parcial)' : 'Dados insuficientes'}</>
              )}
            </button>
            <p className="text-center text-[10px] text-gray-400 mt-1">
              {meta.msgsUsadas} msgs analisadas | {meta.produtosCatalogo} produtos no catalogo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DadoCliente({
  icone, label, valor, destaque = false,
}: {
  icone: React.ReactNode;
  label: string;
  valor?: string | null;
  destaque?: boolean;
}) {
  if (!valor) return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-gray-400 mt-0.5">{icone}</span>
      <div>
        <span className="text-gray-400">{label}: </span>
        <span className={destaque ? 'font-semibold text-indigo-700' : 'text-gray-700'}>{valor}</span>
      </div>
    </div>
  );
}
