import React, { useState } from 'react';
import {
  FileText, Loader2, Download, Send, PlusCircle, X,
  CheckCircle2, XCircle, AlertTriangle, Eye, FileDown,
  ShieldCheck, Settings2
} from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { useConfig } from '../contexts/ConfigContext';
import {
  DadosNFe, ItemNFe, NFeResponse,
  transmitirNFe, abrirDanfe, downloadXml
} from '../services/NFeService';

// ──────────────────────────────────────────────────────────────
// TIPOS LOCAIS
// ──────────────────────────────────────────────────────────────
interface NFeHistorico {
  id: string;
  dados: DadosNFe;
  resultado: NFeResponse;
  emitidaEm: string;
  numero: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  autorizado:   { label: 'Autorizada',    color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={14} /> },
  rejeitado:    { label: 'Rejeitada',     color: 'bg-rose-100 text-rose-700',       icon: <XCircle size={14} /> },
  erro:         { label: 'Erro',          color: 'bg-red-100 text-red-700',         icon: <XCircle size={14} /> },
  processando:  { label: 'Aguard. Cert.', color: 'bg-amber-100 text-amber-700',     icon: <AlertTriangle size={14} /> },
};

// Estados brasileiros com código IBGE para DF
const MUNICIPIOS_PADRAO: Record<string, { municipio: string; codigoMunicipio: string; uf: string }> = {
  DF: { municipio: 'Brasília', codigoMunicipio: '5300108', uf: 'DF' },
  SP: { municipio: 'São Paulo', codigoMunicipio: '3550308', uf: 'SP' },
  MG: { municipio: 'Belo Horizonte', codigoMunicipio: '3106200', uf: 'MG' },
  RJ: { municipio: 'Rio de Janeiro', codigoMunicipio: '3304557', uf: 'RJ' },
  GO: { municipio: 'Goiânia', codigoMunicipio: '5208707', uf: 'GO' },
  MT: { municipio: 'Cuiabá', codigoMunicipio: '5103403', uf: 'MT' },
};

// ──────────────────────────────────────────────────────────────
// COMPONENTE
// ──────────────────────────────────────────────────────────────
export const Faturamento: React.FC = () => {
  const { state } = useERP();
  const { config } = useConfig();

  const [ambiente, setAmbiente] = useState<1 | 2>(2);
  const [historico, setHistorico] = useState<NFeHistorico[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configCertOpen, setConfigCertOpen] = useState(false);

  // Dados do certificado (armazenados em sessionStorage por segurança)
  const [certBase64, setCertBase64] = useState(sessionStorage.getItem('@cds-cert-b64') || '');
  const [certSenha, setCertSenha] = useState('');

  // Dados da NF-e em edição
  const [natureza, setNatureza] = useState('VENDA DE MERCADORIA');
  const [formaPagamento, setFormaPagamento] = useState<DadosNFe['formaPagamento']>('17');
  const [infoAdicionais, setInfoAdicionais] = useState('');

  // Destinatário
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [destNome, setDestNome] = useState('');
  const [destDoc, setDestDoc] = useState('');
  const [destIE, setDestIE] = useState('');
  const [destLogradouro, setDestLogradouro] = useState('');
  const [destNumero, setDestNumero] = useState('S/N');
  const [destBairro, setDestBairro] = useState('');
  const [destMunicipio, setDestMunicipio] = useState('Brasília');
  const [destCodMun, setDestCodMun] = useState('5300108');
  const [destUf, setDestUf] = useState('DF');
  const [destCep, setDestCep] = useState('');
  const [destEmail, setDestEmail] = useState('');

  // Itens da nota
  const [itens, setItens] = useState<Omit<ItemNFe, 'ordem'>[]>([
    { codigo: '001', descricao: '', ncm: '73089010', cfop: '5101', unidade: 'UN', quantidade: 1, valorUnitario: 0, valorTotal: 0, csosn: '400' }
  ]);

  // ── Preenchimento automático ao selecionar cliente ──────────
  const handleClienteChange = (clienteId: string) => {
    setClienteSelecionado(clienteId);
    const cli = state.clientes.find(c => c.id === clienteId);
    if (!cli) return;
    setDestNome(cli.nome);
    setDestDoc(cli.documento || '');
    setDestLogradouro(cli.logradouro || '');
    setDestNumero(cli.numero || 'S/N');
    setDestBairro(cli.bairro || '');
    setDestCep(cli.cep || '');
    setDestEmail(cli.email || '');
    // UF
    const uf = cli.uf || 'DF';
    setDestUf(uf);
    const munPadrao = MUNICIPIOS_PADRAO[uf] || MUNICIPIOS_PADRAO['DF'];
    setDestMunicipio(cli.cidade || munPadrao.municipio);
    setDestCodMun(munPadrao.codigoMunicipio);
  };

  // ── Atualizar item ───────────────────────────────────────────
  const atualizarItem = (idx: number, campo: string, valor: string | number) => {
    setItens(prev => {
      const novos = [...prev];
      const item = { ...novos[idx], [campo]: valor };
      if (campo === 'quantidade' || campo === 'valorUnitario') {
        item.valorTotal = parseFloat((item.quantidade * item.valorUnitario).toFixed(2));
      }
      novos[idx] = item;
      return novos;
    });
  };

  const adicionarItem = () => {
    setItens(prev => [
      ...prev,
      { codigo: String(prev.length + 1).padStart(3, '0'), descricao: '', ncm: '73089010', cfop: '5101', unidade: 'UN', quantidade: 1, valorUnitario: 0, valorTotal: 0, csosn: '400' }
    ]);
  };

  // ── Upload certificado ───────────────────────────────────────
  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = btoa(ev.target?.result as string);
      setCertBase64(b64);
      sessionStorage.setItem('@cds-cert-b64', b64);
    };
    reader.readAsBinaryString(file);
  };

  // ── Emitir NF-e ─────────────────────────────────────────────
  const handleEmitir = async () => {
    if (!destNome || itens.some(i => !i.descricao || i.valorTotal <= 0)) {
      alert('Preencha o destinatário e todos os itens com descrição e valor.');
      return;
    }

    setLoading(true);
    try {
      const numero = (historico.length + 1);
      const isCNPJ = destDoc.replace(/\D/g, '').length === 14;

      const dadosNFe: DadosNFe = {
        ambiente,
        naturezaOperacao: natureza,
        formaPagamento,
        serie: '001',
        numero,
        emissor: {
          cnpj: config.cnpjEmissor || '00.000.000/0001-00',
          razaoSocial: config.nomeEmpresa || 'CDS Industrial',
          ie: config.ieEmissor || 'ISENTO',
          crt: (config.crtEmissor as '1' | '2' | '3') || '1',
          logradouro: config.logradouroEmissor || 'Endereço não configurado',
          numero: config.numeroEmissor || 'S/N',
          bairro: config.bairroEmissor || 'Centro',
          municipio: config.municipioEmissor || 'Brasília',
          codigoMunicipio: config.codMunEmissor || '5300108',
          uf: config.ufEmissor || 'DF',
          cep: config.cepEmissor || '70000-000',
          telefone: config.telefone,
        },
        destinatario: {
          nome: destNome,
          ...(isCNPJ ? { cnpj: destDoc } : { cpf: destDoc }),
          ie: destIE || undefined,
          indIEDest: destIE ? '1' : '9',
          logradouro: destLogradouro || 'Endereço não informado',
          numero: destNumero,
          bairro: destBairro || 'Centro',
          municipio: destMunicipio,
          codigoMunicipio: destCodMun,
          uf: destUf,
          cep: destCep || '00000-000',
          email: destEmail || undefined,
        },
        itens: itens.map((item, idx) => ({ ...item, ordem: idx + 1 })),
        infoAdicionais: infoAdicionais || undefined,
        certificado: certBase64 ? { pfxBase64: certBase64, senha: certSenha } : undefined,
      };

      const resultado = await transmitirNFe(dadosNFe);

      const registro: NFeHistorico = {
        id: Date.now().toString(),
        dados: dadosNFe,
        resultado,
        emitidaEm: new Date().toLocaleString('pt-BR'),
        numero,
      };

      setHistorico(prev => [registro, ...prev]);
      setModalAberto(false);

      if (resultado.status === 'autorizado') {
        alert(`✅ NF-e Autorizada!\nProtocolo: ${resultado.nProtocolo}\nChave: ${resultado.chaveAcesso}`);
      } else if (resultado.status === 'processando') {
        alert(`📄 XML NF-e Gerado!\n\n${resultado.mensagem}`);
      } else {
        alert(`⚠️ ${resultado.mensagem}`);
      }
    } catch (err) {
      alert('Erro inesperado: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const totalModal = itens.reduce((s, i) => s + i.valorTotal, 0);

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-4 p-2">

      {/* Cabeçalho */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="text-blue-500" /> Faturamento e NF-e
        </h2>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle Ambiente */}
          <div className="bg-white p-2 rounded-lg border border-slate-300 flex items-center gap-3">
            <ShieldCheck size={16} className={ambiente === 1 ? 'text-rose-600' : 'text-amber-500'} />
            <span className="text-sm font-medium text-slate-600">Ambiente SEFAZ:</span>
            <button
              onClick={() => setAmbiente(a => a === 1 ? 2 : 1)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                ambiente === 1 ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {ambiente === 1 ? '🔴 PRODUÇÃO' : '🟡 HOMOLOGAÇÃO'}
            </button>
          </div>

          {/* Config Certificado */}
          <button
            onClick={() => setConfigCertOpen(o => !o)}
            title="Configurar Certificado Digital"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            <Settings2 size={16} />
            {certBase64 ? <span className="text-emerald-600 font-medium">Cert. A1 ✓</span> : 'Configurar Cert. A1'}
          </button>

          {/* Nova NF-e */}
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-sm"
          >
            <PlusCircle size={18} /> Nova NF-e
          </button>
        </div>
      </div>

      {/* Painel do Certificado (colapsável) */}
      {configCertOpen && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-blue-900 flex items-center gap-2">
            <ShieldCheck size={18} /> Certificado Digital A1 (.pfx)
          </h3>
          <p className="text-xs text-blue-700">
            Carregue seu certificado digital A1 para assinar e transmitir NF-e à SEFAZ. 
            O arquivo fica apenas na sessão atual (não é salvo em disco ou nuvem).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1">
              <span className="text-sm font-medium text-slate-700">Arquivo .pfx</span>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={handleCertUpload}
                className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
              />
            </label>
            <label className="flex-1">
              <span className="text-sm font-medium text-slate-700">Senha do Certificado</span>
              <input
                type="password"
                value={certSenha}
                onChange={e => setCertSenha(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
          </div>
          {certBase64 && (
            <p className="text-emerald-700 text-sm font-medium">✅ Certificado carregado. Pronto para assinar NF-e.</p>
          )}
        </div>
      )}

      {/* Tabela de Histórico */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1">
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-semibold text-slate-700">Notas Fiscais Emitidas</span>
          <span className="text-sm text-slate-500">{historico.length} nota(s) nesta sessão</span>
        </div>

        {historico.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText size={48} className="mb-3 opacity-30" />
            <p className="font-medium">Nenhuma NF-e emitida ainda.</p>
            <p className="text-sm">Clique em "Nova NF-e" para começar.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Destinatário</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {historico.map(nfe => {
                const st = STATUS_LABELS[nfe.resultado.status] || STATUS_LABELS['erro'];
                const total = nfe.dados.itens.reduce((s, i) => s + i.valorTotal, 0);
                return (
                  <tr key={nfe.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      #{String(nfe.numero).padStart(6, '0')}
                    </td>
                    <td className="px-4 py-3 font-medium">{nfe.dados.destinatario.nome}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{nfe.emitidaEm}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${st.color}`}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirDanfe(nfe.dados, nfe.resultado)}
                          title="Visualizar DANFE"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <Eye size={14} /> DANFE
                        </button>
                        {nfe.resultado.xmlAssinado && (
                          <button
                            onClick={() => downloadXml(nfe.resultado.xmlAssinado!, nfe.resultado.chaveAcesso || nfe.id)}
                            title="Baixar XML"
                            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 font-medium"
                          >
                            <FileDown size={14} /> XML
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL DE EMISSÃO ────────────────────────────────────── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Send size={20} className="text-blue-500" />
                Emitir Nova NF-e
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${ambiente === 1 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  {ambiente === 1 ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}
                </span>
              </h3>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>

            {/* Corpo do modal com scroll */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1">

              {/* Dados Gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Natureza da Operação</label>
                  <input
                    value={natureza}
                    onChange={e => setNatureza(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Forma de Pagamento</label>
                  <select
                    value={formaPagamento}
                    onChange={e => setFormaPagamento(e.target.value as DadosNFe['formaPagamento'])}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="17">PIX</option>
                    <option value="01">Dinheiro</option>
                    <option value="02">Cheque</option>
                    <option value="03">Cartão de Crédito</option>
                    <option value="04">Cartão de Débito</option>
                    <option value="15">Boleto Bancário</option>
                    <option value="10">Vale Alimentação</option>
                    <option value="99">Outros</option>
                    <option value="90">Sem Pagamento</option>
                  </select>
                </div>
              </div>

              {/* Destinatário */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 border-b pb-1">Destinatário</h4>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Buscar Cliente Cadastrado</label>
                  <select
                    value={clienteSelecionado}
                    onChange={e => handleClienteChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Selecione um cliente ou preencha manualmente —</option>
                    {state.clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} {c.documento ? `(${c.documento})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome / Razão Social *</label>
                    <input value={destNome} onChange={e => setDestNome(e.target.value)} required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CNPJ / CPF *</label>
                    <input value={destDoc} onChange={e => setDestDoc(e.target.value)} placeholder="00.000.000/0001-00"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Inscrição Estadual</label>
                    <input value={destIE} onChange={e => setDestIE(e.target.value)} placeholder="ISENTO"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Logradouro</label>
                    <input value={destLogradouro} onChange={e => setDestLogradouro(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Número</label>
                    <input value={destNumero} onChange={e => setDestNumero(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Bairro</label>
                    <input value={destBairro} onChange={e => setDestBairro(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CEP</label>
                    <input value={destCep} onChange={e => setDestCep(e.target.value)} placeholder="00000-000"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Município</label>
                    <input value={destMunicipio} onChange={e => setDestMunicipio(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">UF</label>
                    <select value={destUf} onChange={e => {
                      setDestUf(e.target.value);
                      const mp = MUNICIPIOS_PADRAO[e.target.value];
                      if (mp) { setDestMunicipio(mp.municipio); setDestCodMun(mp.codigoMunicipio); }
                    }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                      {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">E-mail</label>
                    <input value={destEmail} onChange={e => setDestEmail(e.target.value)} type="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b pb-1">
                  <h4 className="text-sm font-bold text-slate-700">Itens da Nota</h4>
                  <button onClick={adicionarItem}
                    className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800">
                    <PlusCircle size={14} /> Adicionar Item
                  </button>
                </div>

                <div className="space-y-3">
                  {itens.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500">ITEM {idx + 1}</span>
                        {itens.length > 1 && (
                          <button onClick={() => setItens(p => p.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-600"><X size={14} /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500">Descrição do Produto *</label>
                          <input value={item.descricao} onChange={e => atualizarItem(idx, 'descricao', e.target.value)}
                            placeholder="Ex: Portão de Ferro Duplo"
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">NCM</label>
                          <input value={item.ncm} onChange={e => atualizarItem(idx, 'ncm', e.target.value)}
                            placeholder="73089010"
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">CFOP</label>
                          <input value={item.cfop} onChange={e => atualizarItem(idx, 'cfop', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Unidade</label>
                          <input value={item.unidade} onChange={e => atualizarItem(idx, 'unidade', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Quantidade</label>
                          <input type="number" min="0.001" step="0.001" value={item.quantidade}
                            onChange={e => atualizarItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Vl. Unitário (R$)</label>
                          <input type="number" min="0" step="0.01" value={item.valorUnitario}
                            onChange={e => atualizarItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Total</label>
                          <div className="w-full border border-slate-200 bg-white rounded px-2 py-1.5 text-sm mt-0.5 font-bold text-slate-800">
                            R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Adicionais */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Informações Adicionais</label>
                <textarea value={infoAdicionais} onChange={e => setInfoAdicionais(e.target.value)} rows={2}
                  placeholder="Referência ao pedido, condições, etc."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Footer do modal */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm text-slate-500">Total da NF-e:</span>
                <span className="ml-2 text-xl font-bold text-slate-900">
                  R$ {totalModal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalAberto(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg">
                  Cancelar
                </button>
                <button
                  onClick={handleEmitir}
                  disabled={loading}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm text-white transition shadow-sm disabled:opacity-60 ${
                    ambiente === 1 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Conectando ao WebService SEFAZ...</>
                  ) : (
                    <><Send size={16} /> Assinar e Transmitir NF-e</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
