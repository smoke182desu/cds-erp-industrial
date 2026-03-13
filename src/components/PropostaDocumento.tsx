import React from 'react';
import { Cliente, Proposta } from '../types';

interface PropostaDocumentoProps {
  cliente: Cliente;
  proposta: Proposta;
  bdi?: number;
}

export const PropostaDocumento: React.FC<PropostaDocumentoProps> = ({ cliente, proposta, bdi = 25 }) => {
  const isGov = cliente.tipo === 'GOV';
  const title = isGov ? "PROPOSTA COMERCIAL B2G / PREGÃO" : "PROPOSTA DE INVESTIMENTO ESTRUTURAL";
  const paymentTerms = isGov ? "Empenho e TR" : "50% Entrada / 50% Entrega";
  const validity = isGov ? "60 dias" : "15 dias";

  return (
    <div className="bg-white text-black p-12 min-h-[1123px] w-[794px] mx-auto shadow-lg border border-slate-200">
      <div className="flex justify-between items-center mb-8 border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CDS INDUSTRIAL</h1>
          <p className="text-sm">CNPJ: 00.000.000/0001-00</p>
          <p className="text-sm">Contato: vendas@cdsindustrial.com.br</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm">Data: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-bold border-b border-slate-300 mb-2">Dados do Cliente</h3>
        <p><strong>Nome:</strong> {cliente.nome}</p>
        <p><strong>{cliente.tipo === 'GOV' ? 'UASG' : cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF'}:</strong> {cliente.documento}</p>
        <p><strong>Endereço:</strong> {cliente.endereco}</p>
      </div>

      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Produto</th>
            <th className="border p-2 text-right">Qtd</th>
            <th className="border p-2 text-right">Custo Base</th>
            {isGov && <th className="border p-2 text-right">BDI ({bdi}%)</th>}
            <th className="border p-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {proposta.items.map((item, index) => {
            const baseCost = item.price || item.preco || 0;
            const priceWithBDI = isGov ? baseCost * (1 + bdi / 100) : baseCost;
            return (
              <tr key={index}>
                <td className="border p-2">{item.name || item.nome}</td>
                <td className="border p-2 text-right">{item.qtd || 1}</td>
                <td className="border p-2 text-right">R$ {baseCost.toFixed(2)}</td>
                {isGov && <td className="border p-2 text-right">R$ {priceWithBDI.toFixed(2)}</td>}
                <td className="border p-2 text-right">R$ {(priceWithBDI * (item.qtd || 1)).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

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
