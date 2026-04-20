import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, User, Building2, Phone, Mail, FileText, MapPin,
  Package, ShoppingCart, AlertCircle, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Plus, DollarSign,
  Sparkles, BadgeCheck, BadgePlus, Search, X, Edit3
} from 'lucide-react';
import { searchProdutos, fmtPreco, type Produto } from '../services/produtosService';

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

interface Alternativas {
  telefones?: string[];
  emails?: string[];
  cnpjs?: string[];
  cpfs?: string[];
  ceps?: string[];
}

interface ConversaInteligenteProps {
  telefone: string;
  leadNome?: string;
  leadEmpresa?: string;
  onGerarProposta: (analise: AnaliseConversa) => void;
  onCadastrarProduto?: (produto: ProdutoExtraido) => void;
}

export default function ConversaInteligente({
  telefone,
  leadNome,
  leadEmpresa,
  onGerarProposta,
  onCadastrarProduto,
}: ConversaInteligenteProps) {
  const [analise, setAnalise] = useState<AnaliseConversa | null>(null);
  const [alternativas, setAlternativas] = useState<Alternativas>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [expandido, setExpandido] = useState({ cliente: true, produtos: true, faltando: true });
  const [meta, setMeta] = useState({ totalMsgs: 0, msgsUsadas: 0, produtosCatalogo: 0 });

  const analisar = useCallback(async () => {
    if (!telefone) return;
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch('/api/conversa-inteligencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, leadNome, leadEmpresa }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao analisar');
      setAnalise(json.analise);
      setAlternativas(json.alternativas || {});
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
  }, [telefone, leadNome, leadEmpresa]);

  useEffect(() => {
    if (telefone) analisar();
  }, [telefone, analisar]);

  // --- Helpers para atualizar cliente/produtos localmente ---
  const atualizarCampoCliente = (campo: keyof ClienteExtraido, valor: string) => {
    setAnalise(prev => {
      if (!prev) return prev;
      const novoCliente = { ...prev.cliente, [campo]: valor || null };
      // Remove o campo de camposFaltando se foi preenchido
      const novosFaltando = (prev.camposFaltando || []).filter(c => !(c === campo && valor));
      return { ...prev, cliente: novoCliente, camposFaltando: novosFaltando };
    });
  };

  const adicionarProduto = (prod: Produto) => {
    setAnalise(prev => {
      if (!prev) return prev;
      // Evita duplicar
      const jaExiste = (prev.produtos || []).some(p => p.skuCatalogo === prod.sku);
      if (jaExiste) return prev;
      const novo: ProdutoExtraido = {
        nome: prod.nome,
        nomeCatalogo: prod.nome,
        descricao: prod.descricao || '',
        quantidade: 1,
        unidade: 'UN',
        precoUnitario: prod.preco || prod.precoRegular || 0,
        produtoPadrao: true,
        skuCatalogo: prod.sku,
        produtoId: prod.id,
      };
      return { ...prev, produtos: [...(prev.produtos || []), novo] };
    });
  };

  const removerProduto = (idx: number) => {
    setAnalise(prev => {
      if (!prev) return prev;
      return { ...prev, produtos: prev.produtos.filter((_, i) => i !== idx) };
    });
  };

  if (!telefone) return null;

  const confianca = analise?.confianca || 0;
  const corConfianca =
    confianca >= 70 ? 'bg-green-500' :
    confianca >= 40 ? 'bg-amber-500' : 'bg-red-400';

  // Alternativas por campo
  const altTelefones = alternativas.telefones || (telefone ? [telefone.replace(/\D/g, '')] : []);
  const altEmails    = alternativas.emails || [];
  const altCnpjs     = alternativas.cnpjs || [];
  const altCpfs      = alternativas.cpfs || [];
  const altCeps      = alternativas.ceps || [];

  return (
    <div className="border-t border-gray-200 bg-gradient-to-b from-indigo-50/50 to-white">
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
                <CampoEditavel
                  icone={<Building2 className="w-3 h-3" />}
                  label="Empresa"
                  valor={analise.cliente.empresa || analise.cliente.nomeFantasia || leadEmpresa || ''}
                  onSave={(v) => atualizarCampoCliente('empresa', v)}
                  destaque
                />
                {analise.cliente.razaoSocial && (
                  <CampoEditavel
                    icone={<Building2 className="w-3 h-3" />}
                    label="Razao Social"
                    valor={analise.cliente.razaoSocial}
                    onSave={(v) => atualizarCampoCliente('razaoSocial', v)}
                  />
                )}
                <CampoEditavel
                  icone={<FileText className="w-3 h-3" />}
                  label="CNPJ"
                  valor={analise.cliente.cnpj || ''}
                  alternativas={altCnpjs}
                  formatter={fmtCNPJ}
                  onSave={(v) => atualizarCampoCliente('cnpj', v)}
                  destaque
                />
                <CampoEditavel
                  icone={<FileText className="w-3 h-3" />}
                  label="CPF"
                  valor={analise.cliente.cpf || ''}
                  alternativas={altCpfs}
                  formatter={fmtCPF}
                  onSave={(v) => atualizarCampoCliente('cpf', v)}
                />
                <CampoEditavel
                  icone={<FileText className="w-3 h-3" />}
                  label="IE"
                  valor={analise.cliente.inscricaoEstadual || ''}
                  onSave={(v) => atualizarCampoCliente('inscricaoEstadual', v)}
                />
                <CampoEditavel
                  icone={<User className="w-3 h-3" />}
                  label="Responsavel"
                  valor={analise.cliente.nome || leadNome || ''}
                  onSave={(v) => atualizarCampoCliente('nome', v)}
                />
                <CampoEditavel
                  icone={<Phone className="w-3 h-3" />}
                  label="Telefone"
                  valor={analise.cliente.telefone || telefone || ''}
                  alternativas={altTelefones}
                  formatter={fmtTelefone}
                  onSave={(v) => atualizarCampoCliente('telefone', v)}
                />
                <CampoEditavel
                  icone={<Mail className="w-3 h-3" />}
                  label="E-mail"
                  valor={analise.cliente.email || ''}
                  alternativas={altEmails}
                  onSave={(v) => atualizarCampoCliente('email', v)}
                />
                <CampoEditavel
                  icone={<MapPin className="w-3 h-3" />}
                  label="CEP"
                  valor={analise.cliente.cep || ''}
                  alternativas={altCeps}
                  formatter={fmtCEP}
                  onSave={(v) => atualizarCampoCliente('cep', v)}
                />
                <CampoEditavel
                  icone={<MapPin className="w-3 h-3" />}
                  label="Endereco"
                  valor={analise.cliente.logradouro || ''}
                  onSave={(v) => atualizarCampoCliente('logradouro', v)}
                />
                <CampoEditavel
                  icone={<MapPin className="w-3 h-3" />}
                  label="Numero"
                  valor={analise.cliente.numero || ''}
                  onSave={(v) => atualizarCampoCliente('numero', v)}
                />
                <CampoEditavel
                  icone={<MapPin className="w-3 h-3" />}
                  label="Bairro"
                  valor={analise.cliente.bairro || ''}
                  onSave={(v) => atualizarCampoCliente('bairro', v)}
                />
                <CampoEditavel
                  icone={<MapPin className="w-3 h-3" />}
                  label="Cidade"
                  valor={analise.cliente.cidade || ''}
                  onSave={(v) => atualizarCampoCliente('cidade', v)}
                />
                <CampoEditavel
                  icone={<MapPin className="w-3 h-3" />}
                  label="UF"
                  valor={analise.cliente.uf || ''}
                  onSave={(v) => atualizarCampoCliente('uf', v.toUpperCase())}
                />
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
                    className={`p-2 rounded border relative group ${
                      p.produtoPadrao
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <button
                      onClick={() => removerProduto(i)}
                      title="Remover produto"
                      className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="flex items-start justify-between pr-5">
                      <div className="flex items-center gap-1">
                        {p.produtoPadrao ? (
                          <BadgeCheck className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <BadgePlus className="w-3.5 h-3.5 text-amber-600" />
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
                    {p.descricao && (
                      <p className="text-gray-500 mt-0.5">{p.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-gray-600">
                      <span>{p.quantidade} {p.unidade}</span>
                      {p.precoUnitario > 0 && (
                        <span className="flex items-center gap-0.5 font-medium text-green-700">
                          <DollarSign className="w-3 h-3" />
                          R$ {p.precoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      {p.skuCatalogo && (
                        <span className="text-gray-400">SKU: {p.skuCatalogo}</span>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-400 italic">Nenhum produto identificado ainda</p>
                )}

                {/* Buscador AJAX de produtos — adicionar do catalogo */}
                <BuscaProduto onSelect={adicionarProduto} />
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
                  <span className="font-semibold text-gray-700">
                    Faltando ({analise.camposFaltando.length})
                  </span>
                </div>
                {expandido.faltando ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expandido.faltando && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {analise.camposFaltando.map((c, i) => (
                    <span key={i} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px]">
                      {c}
                    </span>
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

// ---------- Campo editavel com dropdown de alternativas ----------
function CampoEditavel({
  icone,
  label,
  valor,
  alternativas,
  formatter,
  onSave,
  destaque = false,
}: {
  icone: React.ReactNode;
  label: string;
  valor: string;
  alternativas?: string[];
  formatter?: (v: string) => string;
  onSave: (v: string) => void;
  destaque?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [tempValor, setTempValor] = useState(valor);
  const [mostraAlt, setMostraAlt] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setTempValor(valor); }, [valor]);

  // fecha dropdown quando clica fora
  useEffect(() => {
    if (!mostraAlt && !editando) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMostraAlt(false);
        if (editando) {
          onSave(tempValor);
          setEditando(false);
        }
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [mostraAlt, editando, tempValor, onSave]);

  const alternativasExtras = (alternativas || []).filter(a => a && a !== valor);
  const temAlternativas = alternativasExtras.length > 0;

  const exibicao = valor ? (formatter ? formatter(valor) : valor) : '';

  return (
    <div ref={ref} className="relative flex items-start gap-1.5 group">
      <span className="text-gray-400 mt-0.5">{icone}</span>
      <div className="flex-1 min-w-0">
        <span className="text-gray-400">{label}: </span>
        {editando ? (
          <input
            autoFocus
            value={tempValor}
            onChange={(e) => setTempValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onSave(tempValor); setEditando(false); }
              if (e.key === 'Escape') { setTempValor(valor); setEditando(false); }
            }}
            onBlur={() => { onSave(tempValor); setEditando(false); }}
            className="inline-block border border-indigo-400 rounded px-1 py-0.5 text-xs w-40 outline-none focus:ring-1 focus:ring-indigo-300"
          />
        ) : (
          <button
            onClick={() => {
              if (temAlternativas) setMostraAlt(v => !v);
              else setEditando(true);
            }}
            className={`inline-flex items-center gap-1 hover:bg-indigo-50 rounded px-1 -mx-1 text-left ${
              destaque ? 'font-semibold text-indigo-700' : (valor ? 'text-gray-700' : 'text-gray-300 italic')
            }`}
            title={temAlternativas ? 'Clique para ver outras opcoes' : 'Clique para editar'}
          >
            {exibicao || '(vazio — clique para adicionar)'}
            {temAlternativas && <ChevronDown className="w-3 h-3 text-indigo-400" />}
            {!temAlternativas && <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />}
          </button>
        )}

        {mostraAlt && temAlternativas && (
          <div className="absolute z-10 left-6 top-5 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[200px]">
            <div className="px-2 py-1 text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
              Detectados na conversa
            </div>
            {valor && (
              <div className="px-2 py-1 text-[11px] bg-indigo-50 text-indigo-700 flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" />
                {formatter ? formatter(valor) : valor} <span className="text-[9px] text-indigo-400">(atual)</span>
              </div>
            )}
            {alternativasExtras.map((alt, i) => (
              <button
                key={i}
                onClick={() => { onSave(alt); setMostraAlt(false); }}
                className="w-full text-left px-2 py-1 text-[11px] hover:bg-indigo-50 text-gray-700"
              >
                {formatter ? formatter(alt) : alt}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-0.5">
              <button
                onClick={() => { setMostraAlt(false); setEditando(true); }}
                className="w-full text-left px-2 py-1 text-[11px] text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> Digitar outro valor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Busca AJAX de produto no catalogo ----------
function BuscaProduto({ onSelect }: { onSelect: (p: Produto) => void }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const timerRef = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setResultados([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        const r = await searchProdutos(q, 15);
        setResultados(r);
        setAberto(true);
      } catch {
        setResultados([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [q]);

  // fecha quando clica fora
  useEffect(() => {
    if (!aberto) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [aberto]);

  return (
    <div ref={boxRef} className="relative mt-1">
      <div className="flex items-center gap-1 px-2 py-1 border border-dashed border-indigo-200 rounded bg-white hover:border-indigo-400 transition-colors">
        <Search className="w-3 h-3 text-indigo-400 flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => resultados.length && setAberto(true)}
          placeholder="Buscar produto no catalogo..."
          className="flex-1 text-[11px] outline-none bg-transparent placeholder:text-gray-400"
        />
        {loading && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
        {q && !loading && (
          <button onClick={() => { setQ(''); setResultados([]); }} className="text-gray-300 hover:text-gray-500">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {aberto && resultados.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
          {resultados.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQ(''); setResultados([]); setAberto(false); }}
              className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 border-b border-gray-50 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-gray-800 truncate">{p.nome}</div>
                  <div className="text-[10px] text-gray-400 truncate">
                    SKU: {p.sku || '—'} {p.categoria && `| ${p.categoria}`}
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-green-700 flex-shrink-0">
                  {fmtPreco(p.preco || p.precoRegular)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {aberto && !loading && q.length >= 2 && resultados.length === 0 && (
        <div className="absolute z-10 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow px-2 py-1.5 text-[11px] text-gray-400 italic">
          Nenhum produto encontrado
        </div>
      )}
    </div>
  );
}

// ---------- Formatters ----------
function fmtTelefone(v: string): string {
  const d = String(v || '').replace(/\D/g, '');
  // Formato brasileiro: apenas numeros que comecem com 55
  if (d.length === 13 && d.startsWith('55')) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55')) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  // Internacional: exibe com prefixo + sem mascarar como BR
  if (d.length >= 10) return `+${d}`;
  return v;
}
function fmtCNPJ(v: string): string {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
function fmtCPF(v: string): string {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length !== 11) return v;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function fmtCEP(v: string): string {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length !== 8) return v;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
