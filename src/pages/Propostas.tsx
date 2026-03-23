import React, { useState } from 'react';
import { FileText, Printer, X, MessageCircle, Send, Clock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useERP } from '../contexts/ERPContext';
import { useConfig } from '../contexts/ConfigContext';
import { configEmpresa } from '../constants/configEmpresa';
import { Proposta } from '../types';

export const Propostas: React.FC = () => {
  const { config } = useConfig();
  const { state, gerarOS } = useERP();
  const [selectedProposta, setSelectedProposta] = useState<Proposta | null>(null);

  const propostasSorted = [...(state.propostas || [])].sort((a, b) => 
    new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  const handleWhatsApp = (proposta: Proposta) => {
    const message = `Olá ${proposta.clienteNome}, segue o resumo da sua proposta nº ${proposta.id} no valor de R$ ${proposta.total.toLocaleString('pt-BR')}. Estamos à disposição para qualquer dúvida!`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Aprovada/Produção':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rascunho':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Em Negociação':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Aprovada/Produção':
        return <CheckCircle2 size={14} />;
      case 'Rascunho':
        return <Clock size={14} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200/50">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Histórico de Propostas</h2>
          <p className="text-slate-600 text-sm mt-1">Gerencie seus orçamentos e pedidos aprovados</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] uppercase text-slate-500 font-bold">Total Propostas</p>
              <p className="text-xl font-mono text-slate-900">{state.propostas.length}</p>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="text-center">
              <p className="text-[10px] uppercase text-slate-500 font-bold">Aprovadas</p>
              <p className="text-xl font-mono text-emerald-400">
                {state.propostas.filter(p => p.status === 'Aprovada/Produção').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/50 border border-slate-200 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">ID / Data</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Itens</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {propostasSorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                    Nenhuma proposta encontrada no histórico.
                  </td>
                </tr>
              ) : (
                propostasSorted.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-100/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-mono text-blue-400 text-xs">{p.id}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {new Date(p.data).toLocaleDateString('pt-BR')} {new Date(p.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {p.clienteNome || 'Cliente não identificado'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex -space-x-2">
                        {p.items?.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-600 ring-2 ring-slate-900">
                            {(item?.name || 'P')?.charAt(0)}
                          </div>
                        ))}
                        {(p.items?.length || 0) > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] font-bold text-slate-900 ring-2 ring-slate-900">
                            +{(p.items?.length || 0) - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-900">
                      R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(p.status)}`}>
                        {getStatusIcon(p.status)}
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedProposta(p)}
                          className="p-2 bg-slate-100 hover:bg-blue-600 text-white hover:text-white rounded-lg transition-all"
                          title="Ver PDF"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={() => handleWhatsApp(p)}
                          className="p-2 bg-slate-100 hover:bg-emerald-600 text-white hover:text-white rounded-lg transition-all"
                          title="Compartilhar WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </button>
                        {p.status === 'Rascunho' && (
                          <button 
                            onClick={() => gerarOS(p)}
                            className="p-2 bg-slate-100 hover:bg-amber-600 text-white hover:text-white rounded-lg transition-all"
                            title="Enviar para Produção"
                          >
                            <Send size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedProposta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-[#ffffff] w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl shadow-2xl text-gray-900 relative"
            >
              {/* PDF Header Controls */}
              <div className="sticky top-0 z-10 bg-gray-100/80 backdrop-blur-md px-8 py-4 flex justify-between items-center border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg text-white">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Visualização de Documento</h3>
                    <p className="text-xs text-gray-500">Proposta Técnica Comercial #{selectedProposta.id}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-2 bg-[#ffffff] border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  >
                    <Printer size={18} /> Imprimir
                  </button>
                  <button 
                    onClick={() => setSelectedProposta(null)} 
                    className="p-2 bg-gray-200 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              {/* A4 Document Simulation */}
              <div className="p-12 bg-[#ffffff] min-h-[1123px] w-full max-w-[794px] mx-auto shadow-inner">
                {/* Header */}
                <div className="flex justify-between items-start mb-12 border-b-2 border-gray-900 pb-8">
                  <div className="space-y-1">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">{config.nomeEmpresa || configEmpresa.razaoSocial}</h1>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Serralheria de Precisão & Estruturas</p>
                    <div className="mt-4 text-[10px] text-gray-600 leading-relaxed">
                      <p>{config.nomeEmpresa || configEmpresa.razaoSocial}</p>
                      <p>{configEmpresa.logradouro}, {configEmpresa.numero} - {configEmpresa.cidade}/{configEmpresa.uf}</p>
                      <p>CNPJ: {configEmpresa.cnpj}</p>
                      <p>Tel: {config.telefone || configEmpresa.telefone} | {configEmpresa.email}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    {config.logoBase64 && (
                      <img src={config.logoBase64} alt="Logo" className="h-16 w-auto object-contain mb-4" />
                    )}
                    <div className="bg-gray-900 text-[#ffffff] px-4 py-2 rounded-lg mb-4 inline-block">
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Proposta Nº</p>
                      <p className="text-xl font-mono font-bold tracking-tighter">{selectedProposta.id}</p>
                    </div>
                    <p className="text-xs text-gray-500">Data de Emissão: {new Date(selectedProposta.data).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {/* Client Info */}
                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4">Dados do Cliente</h4>
                    <p className="text-lg font-bold text-gray-900">{selectedProposta.clienteNome}</p>
                    <p className="text-sm text-gray-600 mt-1">ID do Cliente: {selectedProposta.clienteId}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4">Validade e Status</h4>
                    <p className="text-lg font-bold text-gray-900">30 Dias Corridos</p>
                    <p className="text-sm text-gray-600 mt-1">Status Atual: <span className="font-bold text-blue-600">{selectedProposta.status}</span></p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-12">
                  <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4">Detalhamento do Orçamento</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        <th className="py-3 text-left font-black uppercase text-[10px]">Item / Descrição</th>
                        <th className="py-3 text-center font-black uppercase text-[10px]">Qtd</th>
                        <th className="py-3 text-right font-black uppercase text-[10px]">Unitário</th>
                        <th className="py-3 text-right font-black uppercase text-[10px]">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedProposta.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-4">
                            <p className="font-bold text-gray-900">{item?.name || item?.nome || 'Item sem nome'}</p>
                            <p className="text-[9px] text-gray-500 italic">
                              NCM: {item?.ncm || '7308.90.10'} | CFOP: {item?.cfop || '5101'} (MEI)
                            </p>
                            
                            {/* Quebra de Custos (Orçamento Aberto) */}
                            {item?.custos && (
                              <div className="mt-2 grid grid-cols-4 gap-2 text-[8px] text-gray-400 border-t border-gray-50 pt-2">
                                <span>Material: R$ {(item.custos.material || 0).toLocaleString('pt-BR')}</span>
                                <span>Insumos: R$ {(item.custos.insumos || 0).toLocaleString('pt-BR')}</span>
                                <span>Mão de Obra: R$ {(item.custos.maoDeObra || 0).toLocaleString('pt-BR')}</span>
                                <span>Frete: R$ {(item.custos.frete || 0).toLocaleString('pt-BR')}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-4 text-center font-mono">01</td>
                          <td className="py-4 text-right font-mono text-gray-600">
                            R$ {(item?.price || item?.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 text-right font-bold font-mono">
                            R$ {(item?.price || item?.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-900">
                        <td colSpan={3} className="py-6 text-right font-black uppercase text-xs tracking-widest">Valor Total do Investimento</td>
                        <td className="py-6 text-right font-black text-2xl text-blue-900">
                          R$ {selectedProposta.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Technical Notes */}
                <div className="grid grid-cols-2 gap-8 mb-12">
                  <section>
                    <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-3">Memorial Descritivo (BOM)</h4>
                    <ul className="space-y-1 text-[10px] text-gray-600">
                      {(() => {
                        const lines: string[] = [];
                        selectedProposta.items.forEach(item => {
                          if (Array.isArray(item.pecas)) {
                            item.pecas.forEach((p: any) => lines.push(`${p.quantity || 1}x ${p.name} (${p.width}x${p.height}mm)`));
                          }
                          if (item.insumos) {
                            if (Array.isArray(item.insumos)) {
                              item.insumos.forEach((i: any) => lines.push(`${i.quantity || 1}${i.unit || 'x'} ${i.name}`));
                            } else if (typeof item.insumos === 'object') {
                              Object.entries(item.insumos).forEach(([key, val]: [string, any]) => {
                                lines.push(`${val.quantidade || val.quantity || 1}${val.unidade || val.unit || 'x'} ${key}`);
                              });
                            }
                          }
                        });
                        
                        if (lines.length > 0) {
                          return lines.map((line, i) => (
                            <li key={i} className="flex gap-2"><span>•</span> {line}</li>
                          ));
                        }
                        
                        return (
                          <>
                            <li className="flex gap-2"><span>•</span> Estrutura metálica padrão {config.nomeEmpresa || configEmpresa.razaoSocial}</li>
                            <li className="flex gap-2"><span>•</span> Soldagem MIG/MAG com acabamento fino</li>
                            <li className="flex gap-2"><span>•</span> Tratamento anticorrosivo e pintura</li>
                          </>
                        );
                      })()}
                    </ul>
                  </section>
                  <section>
                    <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-3">Condições de Pagamento</h4>
                    <p className="text-[10px] text-gray-600 leading-relaxed">
                      50% de entrada no fechamento do pedido e 50% na entrega técnica dos materiais. 
                      Aceitamos PIX, Cartão de Crédito (até 12x) e Boleto Bancário.
                    </p>
                  </section>
                </div>

                {/* Footer / Signature */}
                <div className="mt-24 pt-12 border-t border-gray-100 flex justify-between items-end">
                  <div className="space-y-4">
                    <div className="w-48 h-px bg-gray-300" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assinatura do Cliente</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-black text-gray-900 italic">{config.nomeEmpresa || configEmpresa.razaoSocial}</p>
                    <p className="text-[10px] text-gray-500">Documento gerado eletronicamente via ERP CDS</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
