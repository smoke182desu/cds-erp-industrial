import React from 'react';
import { Cliente, Proposta } from '../types';
import { useConfig } from '../contexts/ConfigContext';
import { configEmpresa } from '../constants/configEmpresa';

interface PropostaDocumentoProps {
  cliente: Cliente;
  proposta: Proposta;
  bdi?: number;
}

export const PropostaDocumento: React.FC<PropostaDocumentoProps> = ({ cliente, proposta, bdi = 25 }) => {
  const { config } = useConfig();
  const isGov = cliente.tipo === 'GOV';
  const title = isGov ? "PROPOSTA COMERCIAL B2G / PREGÃO" : "PROPOSTA DE INVESTIMENTO ESTRUTURAL";
  const paymentTerms = isGov ? "Empenho e TR" : "50% Entrada / 50% Entrega";
  const validity = isGov ? "60 dias" : "15 dias";

  return (
    <div className="bg-[#ffffff] text-[#000000] p-12 min-h-[1123px] w-[794px] mx-auto shadow-lg border border-gray-200">
      <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{config.nomeEmpresa || configEmpresa.razaoSocial}</h1>
          <p className="text-sm">CNPJ: {configEmpresa.cnpj}</p>
          <p className="text-sm">Contato: {config.telefone || configEmpresa.telefone} | {configEmpresa.email}</p>
        </div>
        <div className="flex flex-col items-end max-w-[50%]">
          {config.logoBase64 && (
            <img src={config.logoBase64} alt="Logo" className="h-16 max-w-[250px] object-contain object-right mb-2" />
          )}
          <div className="text-right">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm">Data: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-bold border-b border-slate-300 mb-2">Dados do Cliente</h3>
        <p><strong>Nome:</strong> {cliente.nome}</p>
        <p><strong>{cliente.tipo === 'GOV' ? 'UASG' : cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF'}:</strong> {cliente.documento}</p>
        <p><strong>Endereço:</strong> {cliente.logradouro}, {cliente.numero} - {cliente.bairro}, {cliente.cidade}/{cliente.uf} - CEP: {cliente.cep}</p>
      </div>

      <table className="w-full mb-8 border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Produto / Detalhamento</th>
            <th className="border p-2 text-right">Qtd</th>
            <th className="border p-2 text-right">Unitário</th>
            <th className="border p-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {proposta.items.map((item, index) => {
            const baseCost = item.price || item.preco || 0;
            const priceWithBDI = isGov ? baseCost * (1 + bdi / 100) : baseCost;
            return (
              <React.Fragment key={index}>
                <tr className="bg-slate-50 font-bold">
                  <td className="border p-2">
                    {item.name || item.nome}
                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                      Tier: {item.tier || 'Comercial'}
                    </span>
                  </td>
                  <td className="border p-2 text-right">{item.qtd || 1}</td>
                  <td className="border p-2 text-right">R$ {priceWithBDI.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="border p-2 text-right">R$ {(priceWithBDI * (item.qtd || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="border p-4 bg-white">
                    <div className="grid grid-cols-2 gap-6 text-[10px] leading-tight text-slate-700">
                      <div>
                        <p className="font-bold text-slate-900 uppercase mb-2 border-b border-slate-200 pb-1 flex items-center gap-1">
                          📋 Lista de Materiais (BOM)
                        </p>
                        <ul className="space-y-1">
                          {item.materiaisNecessarios && item.materiaisNecessarios.length > 0 ? (
                            item.materiaisNecessarios.map((m: any, i: number) => (
                              <li key={i} className="flex justify-between border-b border-slate-50 pb-0.5">
                                <span>{m.qtd} {m.unidade} - {m.nome}</span>
                                <span className="text-slate-400 italic text-[9px] uppercase tracking-wider text-right ml-2">(Estoque)</span>
                              </li>
                            ))
                          ) : item.bom && item.bom.length > 0 ? (
                            item.bom.map((p: any, i: number) => (
                              <li key={i} className="flex justify-between border-b border-slate-50 pb-0.5">
                                <span className="flex gap-2">
                                  <strong className="text-indigo-600 min-w-[20px]">{p.codigo}</strong>
                                  <span>{p.nome}</span>
                                </span>
                                <span className="text-slate-400 italic">Qtd: {p.qtd}</span>
                              </li>
                            ))
                          ) : (
                            item.pecas?.map((p: any, i: number) => (
                              <li key={i} className="flex justify-between border-b border-slate-50 pb-0.5">
                                <span>{p.qtd}x {p.nome}</span>
                                <span className="text-slate-400 italic">{p.medida}</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 uppercase mb-2 border-b border-slate-200 pb-1 flex items-center gap-1">
                          ⚡ Insumos e Fabricação
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                          <p><strong>Horas Trab.:</strong> {item.horasTrabalhadas || 0}h</p>
                          <p><strong>Peso Est.:</strong> {item.pesoFinal?.toFixed(1) || 0}kg</p>
                        </div>
                        <ul className="space-y-1">
                          {item.insumos?.map((ins: any, i: number) => (
                            <li key={i} className="flex justify-between border-b border-slate-50 pb-0.5">
                              <span>{ins.nome}</span>
                              <span className="font-mono">{ins.qtd}{ins.unidade}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="mb-8">
        <h3 className="font-bold border-b border-slate-300 mb-4 uppercase text-sm">Normas Técnicas e Segurança Aplicáveis</h3>
        <div className="grid grid-cols-1 gap-2">
          <p className="text-[10px] text-slate-600 italic">Normas técnicas aplicáveis conforme projeto e legislação vigente.</p>
        </div>
      </div>

      <div className="mb-8">
        <p><strong>Condições de Pagamento:</strong> {paymentTerms}</p>
        <p><strong>Validade da Proposta:</strong> {validity}</p>
      </div>

      <footer className="text-xs text-slate-600 border-t pt-4">
        <p><strong>Garantia:</strong> Garantia estrutural de 5 anos contra defeitos de fabricação e solda (conforme normas ABNT).</p>
        <p><strong>Tributos:</strong> Todos os impostos vigentes já estão inclusos no valor total.</p>
      </footer>
    </div>
  );
};
