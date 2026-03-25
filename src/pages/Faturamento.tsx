import React, { useState } from 'react';
import {
  FileText, Loader2, Download, Send, PlusCircle, X,
  CheckCircle2, XCircle, AlertTriangle, Eye, FileDown,
  ShieldCheck, Settings2, Zap, Ban, Edit3, Search, Trash2, RefreshCw
} from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { useConfig } from '../contexts/ConfigContext';
import {
  DadosNFe, ItemNFe, NFeResponse, EventoResponse,
  transmitirNFe, abrirDanfe, downloadXml,
  calcularCFOP, sugerirNCM, descricaoNCM,
  cancelarNFe, corrigirNFe, inutilizarNFe, consultarNFe
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
  statusEvento?: 'cancelada' | 'corrigida'; // Status após eventos
}

type ModalEvento = 'cancelar' | 'cce' | 'inutilizar' | 'consultar' | null;

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

  // ── Estados dos modais de evento ─────────────────────────────
  const [modalEvento, setModalEvento] = useState<ModalEvento>(null);
  const [nfeSelecionada, setNfeSelecionada] = useState<NFeHistorico | null>(null);
  const [loadingEvento, setLoadingEvento] = useState(false);
  const [resultadoEvento, setResultadoEvento] = useState<EventoResponse | null>(null);

  // Cancelamento
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  // CC-e
  const [textoCorrecao, setTextoCorrecao] = useState('');
  const [nSeqCCe, setNSeqCCe] = useState(1);
  // Inutilização
  const [serieInut, setSerieInut] = useState('001');
  const [nNFIni, setNNFIni] = useState('');
  const [nNFFin, setNNFFin] = useState('');
  const [justInut, setJustInut] = useState('');

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

  // Recalcula o CFOP de todos os itens quando a UF muda
  const recalcularCFOPs = (novaUfDest: string) => {
    const ufOrig = config.ufEmissor || 'DF';
    setItens(prev => prev.map(item => ({
      ...item,
      cfop: calcularCFOP(ufOrig, novaUfDest),
    })));
  };

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
    // UF — recalcula CFOP automaticamente
    const uf = cli.uf || 'DF';
    setDestUf(uf);
    const munPadrao = MUNICIPIOS_PADRAO[uf] || MUNICIPIOS_PADRAO['DF'];
    setDestMunicipio(cli.cidade || munPadrao.municipio);
    setDestCodMun(munPadrao.codigoMunicipio);
    recalcularCFOPs(uf);
  };

  // ── Atualizar item ───────────────────────────────────────────
  // Quando muda a descrição: sugere NCM automaticamente
  const atualizarItem = (idx: number, campo: string, valor: string | number) => {
    setItens(prev => {
      const novos = [...prev];
      const item = { ...novos[idx], [campo]: valor };
      if (campo === 'quantidade' || campo === 'valorUnitario') {
        item.valorTotal = parseFloat((item.quantidade * item.valorUnitario).toFixed(2));
      }
      // Auto-sugestão de NCM ao digitar a descrição
      if (campo === 'descricao' && typeof valor === 'string') {
        const ncmSugerido = sugerirNCM(valor);
        item.ncm = ncmSugerido;
      }
      novos[idx] = item;
      return novos;
    });
  };

  const adicionarItem = () => {
    const ufOrig = config.ufEmissor || 'DF';
    const cfopNovo = calcularCFOP(ufOrig, destUf);
    setItens(prev => [
      ...prev,
      { codigo: String(prev.length + 1).padStart(3, '0'), descricao: '', ncm: '73089010', cfop: cfopNovo, unidade: 'UN', quantidade: 1, valorUnitario: 0, valorTotal: 0, csosn: '400' }
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

  // ── Abrir modal de evento ────────────────────────────────────
  const abrirEvento = (tipo: ModalEvento, nfe: NFeHistorico) => {
    setNfeSelecionada(nfe);
    setModalEvento(tipo);
    setResultadoEvento(null);
    setMotivoCancelamento('');
    setTextoCorrecao('');
  };

  // ── Executar Cancelamento ────────────────────────────────────
  const handleCancelar = async () => {
    if (!nfeSelecionada) return;
    setLoadingEvento(true);
    const uf = config.ufEmissor || 'DF';
    const res = await cancelarNFe(
      {
        chaveAcesso: nfeSelecionada.resultado.chaveAcesso || '',
        nProtocolo: nfeSelecionada.resultado.nProtocolo || '',
        motivo: motivoCancelamento,
        certificado: certBase64 ? { pfxBase64: certBase64, senha: certSenha } : undefined,
      },
      uf,
      ambiente
    );
    setResultadoEvento(res);
    if (res.status === 'sucesso') {
      setHistorico(prev => prev.map(h =>
        h.id === nfeSelecionada.id ? { ...h, statusEvento: 'cancelada' } : h
      ));
    }
    setLoadingEvento(false);
  };

  // ── Executar CC-e ────────────────────────────────────────────
  const handleCCe = async () => {
    if (!nfeSelecionada) return;
    setLoadingEvento(true);
    const uf = config.ufEmissor || 'DF';
    const res = await corrigirNFe(
      {
        chaveAcesso: nfeSelecionada.resultado.chaveAcesso || '',
        xCorrecao: textoCorrecao,
        nSeqEvento: nSeqCCe,
        certificado: certBase64 ? { pfxBase64: certBase64, senha: certSenha } : undefined,
      },
      uf,
      ambiente
    );
    setResultadoEvento(res);
    if (res.status === 'sucesso') {
      setHistorico(prev => prev.map(h =>
        h.id === nfeSelecionada.id ? { ...h, statusEvento: 'corrigida' } : h
      ));
    }
    setLoadingEvento(false);
  };

  // ── Executar Consulta ────────────────────────────────────────
  const handleConsultar = async () => {
    if (!nfeSelecionada) return;
    setLoadingEvento(true);
    const uf = config.ufEmissor || 'DF';
    const res = await consultarNFe(
      nfeSelecionada.resultado.chaveAcesso || '',
      uf,
      ambiente
    );
    setResultadoEvento(res);
    setLoadingEvento(false);
  };

  // ── Executar Inutilização ────────────────────────────────────
  const handleInutilizar = async () => {
    setLoadingEvento(true);
    const res = await inutilizarNFe({
      cnpj: config.cnpjEmissor || '',
      justificativa: justInut,
      serie: serieInut,
      nNFIni: parseInt(nNFIni) || 0,
      nNFFin: parseInt(nNFFin) || 0,
      uf: config.ufEmissor || 'DF',
      ambiente,
    });
    setResultadoEvento(res);
    setLoadingEvento(false);
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

          {/* Botões: Inutilizar + Nova NF-e */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setNfeSelecionada(null); setModalEvento('inutilizar'); setResultadoEvento(null); }}
              title="Inutilizar numeração não utilizada"
              className="flex items-center gap-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
            >
              <Trash2 size={14} /> Inutilizar
            </button>
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-sm"
            >
              <PlusCircle size={18} /> Nova NF-e
            </button>
          </div>
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
                      {nfe.statusEvento === 'cancelada' && (
                        <span className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <Ban size={10} /> Cancelada
                        </span>
                      )}
                      {nfe.statusEvento === 'corrigida' && (
                        <span className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                          <Edit3 size={10} /> CC-e
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => abrirDanfe(nfe.dados, nfe.resultado)} title="Visualizar DANFE"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-1.5 py-1 rounded hover:bg-blue-50">
                          <Eye size={13} /> DANFE
                        </button>
                        {nfe.resultado.xmlAssinado && (
                          <button onClick={() => downloadXml(nfe.resultado.xmlAssinado!, nfe.resultado.chaveAcesso || nfe.id)}
                            title="Baixar XML" className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 font-medium px-1.5 py-1 rounded hover:bg-slate-100">
                            <FileDown size={13} /> XML
                          </button>
                        )}
                        {nfe.resultado.status === 'autorizado' && nfe.statusEvento !== 'cancelada' && (
                          <>
                            <button onClick={() => abrirEvento('cancelar', nfe)} title="Cancelar NF-e"
                              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium px-1.5 py-1 rounded hover:bg-rose-50">
                              <Ban size={13} /> Cancelar
                            </button>
                            <button onClick={() => abrirEvento('cce', nfe)} title="Carta de Correção"
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-1.5 py-1 rounded hover:bg-indigo-50">
                              <Edit3 size={13} /> CC-e
                            </button>
                            <button onClick={() => abrirEvento('consultar', nfe)} title="Consultar SEFAZ"
                              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium px-1.5 py-1 rounded hover:bg-emerald-50">
                              <Search size={13} /> Consultar
                            </button>
                          </>
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
                      const novaUf = e.target.value;
                      setDestUf(novaUf);
                      const mp = MUNICIPIOS_PADRAO[novaUf];
                      if (mp) { setDestMunicipio(mp.municipio); setDestCodMun(mp.codigoMunicipio); }
                      // ✦ CFOP automático ao trocar UF
                      recalcularCFOPs(novaUf);
                    }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                      {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-0.5">CFOP atualiza automaticamente</p>
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
                          <label className="text-xs text-slate-500 flex items-center gap-1">
                            NCM
                            <span title={descricaoNCM(item.ncm)} className="cursor-help text-blue-400">ⓘ</span>
                          </label>
                          <input value={item.ncm} onChange={e => atualizarItem(idx, 'ncm', e.target.value)}
                            placeholder="73089010"
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5 font-mono" />
                          <p className="text-xs text-blue-500 mt-0.5 leading-none flex items-center gap-0.5">
                            <Zap size={9} /> {descricaoNCM(item.ncm)}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 flex items-center gap-1">
                            CFOP
                            <span title={destUf === (config.ufEmissor || 'DF') ? 'Operação interna (mesmo estado)' : 'Operação interestadual'} className="cursor-help text-blue-400">ⓘ</span>
                          </label>
                          <select value={item.cfop} onChange={e => atualizarItem(idx, 'cfop', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-0.5">
                            <option value="5101">5101 – Venda (mesmo estado)</option>
                            <option value="5102">5102 – Venda p/ uso/consumo (mesmo estado)</option>
                            <option value="6101">6101 – Venda (outro estado)</option>
                            <option value="6102">6102 – Venda p/ uso/consumo (outro estado)</option>
                            <option value="5405">5405 – Venda s/ ST (mesmo estado)</option>
                            <option value="6949">6949 – Outra saída (outro estado)</option>
                          </select>
                          <p className="text-xs mt-0.5 leading-none">
                            {item.cfop.startsWith('5') ? <span className="text-emerald-600">✦ Interna</span> : item.cfop.startsWith('6') ? <span className="text-amber-600">✦ Interestadual</span> : <span className="text-blue-600">✦ Exportação</span>}
                          </p>
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

      {/* ═══════════════════════════════════════════════════════════
          MODAIS DE EVENTOS NF-e
      ═══════════════════════════════════════════════════════════ */}
      {modalEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">

            {/* ── Cabeçalho do modal de evento ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {modalEvento === 'cancelar'    && <><Ban size={20} className="text-rose-500" /> Cancelar NF-e</>}
                {modalEvento === 'cce'         && <><Edit3 size={20} className="text-indigo-500" /> Carta de Correção (CC-e)</>}
                {modalEvento === 'consultar'   && <><Search size={20} className="text-emerald-500" /> Consultar Status — SEFAZ</>}
                {modalEvento === 'inutilizar'  && <><Trash2 size={20} className="text-amber-500" /> Inutilizar Numeração</>}
              </h3>
              <button onClick={() => { setModalEvento(null); setResultadoEvento(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">

              {/* Chave da NF-e selecionada */}
              {nfeSelecionada && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">NF-e Nº {String(nfeSelecionada.numero).padStart(6,'0')} — {nfeSelecionada.dados.destinatario.nome}</p>
                  <p className="font-mono text-xs text-slate-600 break-all mt-0.5">{nfeSelecionada.resultado.chaveAcesso || '—'}</p>
                </div>
              )}

              {/* ── CANCELAMENTO ── */}
              {modalEvento === 'cancelar' && (
                <div className="space-y-3">
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700">
                    ⚠️ <strong>Prazo:</strong> até 24 horas após a autorização. Após cancelada, a nota não pode ser reativada.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Motivo do Cancelamento <span className="text-slate-400 text-xs">(mín. 15 caracteres)</span>
                    </label>
                    <textarea
                      value={motivoCancelamento}
                      onChange={e => setMotivoCancelamento(e.target.value)}
                      rows={3}
                      placeholder="Ex: Cancelamento a pedido do cliente, erro na emissão..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-rose-500 focus:border-rose-500"
                    />
                    <p className={`text-xs mt-0.5 ${motivoCancelamento.length < 15 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {motivoCancelamento.length}/15 caracteres mínimos
                    </p>
                  </div>
                </div>
              )}

              {/* ── CC-e ── */}
              {modalEvento === 'cce' && (
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-700">
                    ℹ️ <strong>Prazo:</strong> até 30 dias. <strong>Não pode corrigir:</strong> destinatário, valores, CFOP, data de emissão.
                    Máximo de 20 CC-e por NF-e.
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nº Sequencial</label>
                      <input type="number" min={1} max={20} value={nSeqCCe}
                        onChange={e => setNSeqCCe(parseInt(e.target.value) || 1)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Texto da Correção <span className="text-slate-400 text-xs">(mín. 15 · máx. 1000 caracteres)</span>
                    </label>
                    <textarea
                      value={textoCorrecao}
                      onChange={e => setTextoCorrecao(e.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder="Ex: Onde se lê 'Rua A', leia-se 'Rua B'..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className={`text-xs mt-0.5 ${textoCorrecao.length < 15 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {textoCorrecao.length}/1000 caracteres
                    </p>
                  </div>
                </div>
              )}

              {/* ── CONSULTA ── */}
              {modalEvento === 'consultar' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Consulta o status atual desta NF-e diretamente na SEFAZ e exibe se está autorizada, cancelada ou denegada.
                  </p>
                  {!resultadoEvento && (
                    <button
                      onClick={handleConsultar}
                      disabled={loadingEvento}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {loadingEvento ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      {loadingEvento ? 'Consultando SEFAZ...' : 'Consultar Agora'}
                    </button>
                  )}
                </div>
              )}

              {/* ── INUTILIZAÇÃO ── */}
              {modalEvento === 'inutilizar' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    ⚠️ Use quando números de NF-e foram pulados ou emitidos com erro e nunca transmitidos à SEFAZ. 
                    Ação <strong>irreversível</strong>.
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Série</label>
                      <input value={serieInut} onChange={e => setSerieInut(e.target.value)}
                        placeholder="001"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nº Inicial</label>
                      <input type="number" value={nNFIni} onChange={e => setNNFIni(e.target.value)}
                        placeholder="1"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nº Final</label>
                      <input type="number" value={nNFFin} onChange={e => setNNFFin(e.target.value)}
                        placeholder="5"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Justificativa <span className="text-slate-400 text-xs">(mín. 15 caracteres)</span>
                    </label>
                    <textarea
                      value={justInut}
                      onChange={e => setJustInut(e.target.value)}
                      rows={3}
                      placeholder="Ex: Números pulados por erro de sistema durante testes..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <p className={`text-xs mt-0.5 ${justInut.length < 15 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {justInut.length}/15 caracteres mínimos
                    </p>
                  </div>
                </div>
              )}

              {/* ── Resultado do evento ── */}
              {resultadoEvento && (
                <div className={`rounded-lg p-4 border text-sm font-medium flex items-start gap-3 ${
                  resultadoEvento.status === 'sucesso'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : resultadoEvento.status === 'rejeitado'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {resultadoEvento.status === 'sucesso' ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> :
                   resultadoEvento.status === 'rejeitado' ? <AlertTriangle size={20} className="shrink-0 mt-0.5" /> :
                   <XCircle size={20} className="shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-bold">{resultadoEvento.mensagem}</p>
                    {resultadoEvento.cStat && (
                      <p className="text-xs mt-1 opacity-70">cStat {resultadoEvento.cStat} · {resultadoEvento.xMotivo}</p>
                    )}
                    {resultadoEvento.nProtocolo && (
                      <p className="text-xs mt-0.5 opacity-70">Protocolo: {resultadoEvento.nProtocolo}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer do modal de evento ── */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => { setModalEvento(null); setResultadoEvento(null); }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                {resultadoEvento ? 'Fechar' : 'Cancelar'}
              </button>

              {!resultadoEvento && modalEvento !== 'consultar' && (
                <button
                  onClick={
                    modalEvento === 'cancelar'   ? handleCancelar   :
                    modalEvento === 'cce'        ? handleCCe        :
                    modalEvento === 'inutilizar' ? handleInutilizar : undefined
                  }
                  disabled={loadingEvento ||
                    (modalEvento === 'cancelar'   && motivoCancelamento.trim().length < 15) ||
                    (modalEvento === 'cce'        && textoCorrecao.trim().length < 15) ||
                    (modalEvento === 'inutilizar' && (justInut.trim().length < 15 || !nNFIni || !nNFFin))
                  }
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm text-white transition disabled:opacity-50 ${
                    modalEvento === 'cancelar'   ? 'bg-rose-600 hover:bg-rose-700'     :
                    modalEvento === 'cce'        ? 'bg-indigo-600 hover:bg-indigo-700' :
                    'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {loadingEvento && <Loader2 size={16} className="animate-spin" />}
                  {!loadingEvento && (
                    modalEvento === 'cancelar'   ? <Ban size={16} /> :
                    modalEvento === 'cce'        ? <Edit3 size={16} /> :
                    <Trash2 size={16} />
                  )}
                  {loadingEvento ? 'Enviando à SEFAZ...' :
                    modalEvento === 'cancelar'   ? 'Confirmar Cancelamento' :
                    modalEvento === 'cce'        ? 'Enviar CC-e'            :
                    'Inutilizar Números'
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

