import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { Cliente, Proposta, OrdemServico, Receita, Faturamento, Component, TransacaoFinanceira, ChatMessage } from '../types';

// Tipos básicos para o estado global
export type EtapaProducao = 'Corte' | 'Dobra' | 'Solda/Montagem' | 'Pintura' | 'Embalagem' | 'Entrega';

export interface PedidoCompra {
  id: string;
  cliente: string;
  itens: { id: string; nome: string; qtd: number; preco: number }[];
  status: 'Aguardando Entrega' | 'Entregue';
  data: string;
}

interface BOMItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface InventoryItem {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  unidade: string;
  custo: number;
  precoVenda: number;
  quantidadeEstoque: number;
  estoqueMinimo: number;
}

interface ERPState {
  budget: {
    items: any[];
    totalCost: number;
  };
  carrinhoAtual: any[];
  inventory: {
    [key: string]: number;
  };
  inventoryItems: InventoryItem[];
  bom: BOMItem[];
  clientes: Cliente[];
  propostas: Proposta[];
  ordensServico: OrdemServico[];
  financeiro: Receita[];
  faturamento: Faturamento[];
  pedidosCompra: PedidoCompra[];
  transacoesFinanceiras: TransacaoFinanceira[];
  configFiscal: {
    regime: string;
    estadoOrigem: string;
    csosn: string;
    cfopPadrao: string;
  };
}

interface ERPContextType {
  state: ERPState;
  adicionarAoCarrinho: (produto: any) => void;
  removerDoCarrinho: (index: number) => void;
  fecharProposta: () => void;
  aprovarVenda: (clienteId: string, proposalId?: string) => void;
  salvarRascunho: (clienteId: string, proposalId?: string) => void;
  gerarOS: (proposta: Proposta) => void;
  moverEtapaOS: (osId: string, novaEtapa: OrdemServico['status']) => void;
  updateInventory: (itemId: string, quantity: number) => void;
  calculateBOM: (projectData: any) => BOMItem[];
  moverEtapaProjeto: (projetoId: string, direcao: 'avancar' | 'retroceder') => void;
  limparCarrinho: () => void;
  totalCarrinho: number;
  validarConciliacao: (pedidoId: string, itensConciliados: { itemId: string; qtd: number; preco: number }[]) => void;
  adicionarCliente: (cliente: Cliente) => void;
  adicionarProposta: (proposta: Proposta) => void;
  darEntradaEstoque: (itemId: string, quantidade: number, novoCusto: number) => void;
  registrarTransacao: (transacao: TransacaoFinanceira) => void;
  atualizarStatusTransacao: (id: string) => void;
  enviarMensagemAoAgente: (clienteId: string, message: string) => Promise<void>;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

const estoqueInicial: InventoryItem[] = [
  // 🏗️ TUBOS E PERFIS (AÇO CARBONO)
  { id: '1', codigo: 'AC001', nome: 'Metalon 20x20x1.2mm (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 45.00, precoVenda: 58.50, quantidadeEstoque: 200, estoqueMinimo: 50 },
  { id: '2', codigo: 'AC002', nome: 'Metalon 30x30x1.5mm (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 80.00, precoVenda: 104.00, quantidadeEstoque: 150, estoqueMinimo: 50 },
  { id: '3', codigo: 'AC003', nome: 'Metalon 50x30x1.5mm (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 95.00, precoVenda: 123.50, quantidadeEstoque: 120, estoqueMinimo: 40 },
  { id: '4', codigo: 'AC004', nome: 'Tubo Redondo 2" x 1.5mm (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 120.00, precoVenda: 156.00, quantidadeEstoque: 80, estoqueMinimo: 20 },
  { id: '5', codigo: 'AC005', nome: 'Cantoneira 1.1/2" x 1/8" (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 90.00, precoVenda: 117.00, quantidadeEstoque: 100, estoqueMinimo: 30 },
  { id: '6', codigo: 'AC006', nome: 'Ferro Chato 1" x 1/8" (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 40.00, precoVenda: 52.00, quantidadeEstoque: 150, estoqueMinimo: 50 },
  { id: '7', codigo: 'AC007', nome: 'Perfil U Enrijecido 100x50x17x2mm (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 150.00, precoVenda: 195.00, quantidadeEstoque: 100, estoqueMinimo: 30 },
  { id: '101', codigo: 'AC011', nome: 'Tubo Redondo Reforçado 2" x 2.0mm (Barra 6m)', categoria: 'Aço', unidade: 'barra', custo: 180.00, precoVenda: 234.00, quantidadeEstoque: 50, estoqueMinimo: 10 },
  // 🔲 CHAPAS
  { id: '8', codigo: 'CH001', nome: 'Chapa Lisa Preta 18 (1.2mm) 2x1m', categoria: 'Aço', unidade: 'chapa', custo: 210.00, precoVenda: 273.00, quantidadeEstoque: 40, estoqueMinimo: 10 },
  { id: '9', codigo: 'CH002', nome: 'Chapa Expandida 3mm Malha 50x25 (2x1m)', categoria: 'Aço', unidade: 'chapa', custo: 180.00, precoVenda: 234.00, quantidadeEstoque: 30, estoqueMinimo: 10 },
  { id: '10', codigo: 'CH003', nome: 'Chapa Xadrez/Piso (1/8") 2x1m', categoria: 'Aço', unidade: 'chapa', custo: 450.00, precoVenda: 585.00, quantidadeEstoque: 15, estoqueMinimo: 5 },
  { id: '102', codigo: 'CH004', nome: 'Chapa de Alumínio Antiderrapante 3mm (2x1m)', categoria: 'Alumínio', unidade: 'chapa', custo: 650.00, precoVenda: 845.00, quantidadeEstoque: 20, estoqueMinimo: 5 },
  { id: '103', codigo: 'AC012', nome: 'Sapata Flangeada Reforçada 150x150x1/2" (Un)', categoria: 'Aço', unidade: 'un', custo: 45.00, precoVenda: 58.50, quantidadeEstoque: 100, estoqueMinimo: 20 },
  { id: '104', codigo: 'FI008', nome: 'Chumbador Parabolt Reforçado 1/2" x 4" (Un)', categoria: 'Fixação', unidade: 'un', custo: 8.50, precoVenda: 11.05, quantidadeEstoque: 200, estoqueMinimo: 50 },
  // 🚪 FERRAGENS
  { id: '11', codigo: 'FE001', nome: 'Gonzo Torneado 5/8" c/ Aba (Par)', categoria: 'Ferragens', unidade: 'par', custo: 8.00, precoVenda: 10.40, quantidadeEstoque: 200, estoqueMinimo: 50 },
  { id: '12', codigo: 'FE002', nome: 'Dobradiça Pino Bola 3" (Un)', categoria: 'Ferragens', unidade: 'un', custo: 12.00, precoVenda: 15.60, quantidadeEstoque: 150, estoqueMinimo: 40 },
  { id: '13', codigo: 'FE003', nome: 'Fechadura Bico de Papagaio (Portão Correr)', categoria: 'Ferragens', unidade: 'un', custo: 45.00, precoVenda: 58.50, quantidadeEstoque: 40, estoqueMinimo: 10 },
  { id: '14', codigo: 'FE004', nome: 'Fechadura Sobrepor Stam (Portão Abrir)', categoria: 'Ferragens', unidade: 'un', custo: 55.00, precoVenda: 71.50, quantidadeEstoque: 30, estoqueMinimo: 10 },
  { id: '15', codigo: 'FE005', nome: 'Orelha para Cadeado (Porta Cadeado) 2.5mm', categoria: 'Ferragens', unidade: 'un', custo: 2.00, precoVenda: 2.60, quantidadeEstoque: 300, estoqueMinimo: 100 },
  { id: '16', codigo: 'FE006', nome: 'Trinco Ferrolho Chato 4"', categoria: 'Ferragens', unidade: 'un', custo: 15.00, precoVenda: 19.50, quantidadeEstoque: 100, estoqueMinimo: 30 },
  // 🛞 MOVIMENTAÇÃO
  { id: '17', codigo: 'RO001', nome: 'Roda de Portão Canal V 2.1/2" c/ Rolamento', categoria: 'Movimentação', unidade: 'un', custo: 28.00, precoVenda: 36.40, quantidadeEstoque: 80, estoqueMinimo: 20 },
  { id: '18', codigo: 'RO002', nome: 'Rodízio Giratório 4" Borracha Laranja c/ Freio', categoria: 'Movimentação', unidade: 'un', custo: 38.00, precoVenda: 49.40, quantidadeEstoque: 60, estoqueMinimo: 16 },
  { id: '19', codigo: 'RO003', nome: 'Pneu 3.50-8 c/ Roda Chapa (Carrinhos/Lixeiras)', categoria: 'Movimentação', unidade: 'un', custo: 55.00, precoVenda: 71.50, quantidadeEstoque: 40, estoqueMinimo: 10 },
  { id: '20', codigo: 'RO004', nome: 'Câmara de Ar 3.50-8', categoria: 'Movimentação', unidade: 'un', custo: 22.00, precoVenda: 28.60, quantidadeEstoque: 50, estoqueMinimo: 15 },
  { id: '21', codigo: 'RO005', nome: 'Rodízio Fixo 4" Poliuretano (Pesado)', categoria: 'Movimentação', unidade: 'un', custo: 45.00, precoVenda: 58.50, quantidadeEstoque: 40, estoqueMinimo: 12 },
  // 🔩 FIXAÇÃO
  { id: '22', codigo: 'FI001', nome: 'Parafuso Autobrocante para Telha 12x14 (Cento)', categoria: 'Fixação', unidade: 'cento', custo: 45.00, precoVenda: 58.50, quantidadeEstoque: 50, estoqueMinimo: 15 },
  { id: '23', codigo: 'FI002', nome: 'Chumbador de Expansão Parabolt 3/8" x 3"', categoria: 'Fixação', unidade: 'un', custo: 4.50, precoVenda: 5.85, quantidadeEstoque: 400, estoqueMinimo: 100 },
  { id: '24', codigo: 'FI003', nome: 'Ponteira Plástica Interna Quadrada 30x30mm (Cento)', categoria: 'Acessórios', unidade: 'cento', custo: 25.00, precoVenda: 32.50, quantidadeEstoque: 30, estoqueMinimo: 10 },
  { id: '25', codigo: 'FI004', nome: 'Ponteira Plástica Interna Redonda 2" (Un)', categoria: 'Acessórios', unidade: 'un', custo: 1.50, precoVenda: 1.95, quantidadeEstoque: 200, estoqueMinimo: 50 },
  // 🏠 COBERTURA
  { id: '26', codigo: 'CO001', nome: 'Telha Trapezoidal Galvalume 0.43mm (Metro)', categoria: 'Cobertura', unidade: 'm', custo: 35.00, precoVenda: 45.50, quantidadeEstoque: 500, estoqueMinimo: 100 },
  { id: '27', codigo: 'CO002', nome: 'Cumeeira Trapezoidal Galvalume (Metro)', categoria: 'Cobertura', unidade: 'm', custo: 40.00, precoVenda: 52.00, quantidadeEstoque: 60, estoqueMinimo: 20 },
  // ⚡ SOLDA E ABRASIVOS
  { id: '28', codigo: 'SO001', nome: 'Arame MIG 0.8mm (Rolo 15kg)', categoria: 'Solda', unidade: 'rolo', custo: 220.00, precoVenda: 286.00, quantidadeEstoque: 20, estoqueMinimo: 5 },
  { id: '29', codigo: 'SO002', nome: 'Eletrodo Revestido E6013 2.5mm (Caixa 5kg)', categoria: 'Solda', unidade: 'caixa', custo: 110.00, precoVenda: 143.00, quantidadeEstoque: 30, estoqueMinimo: 10 },
  { id: '30', codigo: 'AB001', nome: 'Disco de Corte Inox 4.1/2" x 1mm', categoria: 'Abrasivo', unidade: 'un', custo: 5.00, precoVenda: 6.50, quantidadeEstoque: 300, estoqueMinimo: 100 },
  { id: '31', codigo: 'AB002', nome: 'Disco de Desbaste 4.1/2"', categoria: 'Abrasivo', unidade: 'un', custo: 8.00, precoVenda: 10.40, quantidadeEstoque: 150, estoqueMinimo: 50 },
  { id: '32', codigo: 'AB003', nome: 'Disco Flap Grão 40 4.1/2" (Acabamento)', categoria: 'Abrasivo', unidade: 'un', custo: 12.00, precoVenda: 15.60, quantidadeEstoque: 120, estoqueMinimo: 40 },
  { id: '33', codigo: 'AB004', nome: 'Disco Policorte 12" x 1/8"', categoria: 'Abrasivo', unidade: 'un', custo: 25.00, precoVenda: 32.50, quantidadeEstoque: 80, estoqueMinimo: 20 },
  // 🖌️ PINTURA
  { id: '34', codigo: 'PI001', nome: 'Primer Fundo Anticorrosivo Zarcão (Galão 3.6L)', categoria: 'Pintura', unidade: 'galao', custo: 85.00, precoVenda: 110.50, quantidadeEstoque: 30, estoqueMinimo: 10 },
  { id: '35', codigo: 'PI002', nome: 'Fundo Preparador Galvite p/ Galvanizado (Galão 3.6L)', categoria: 'Pintura', unidade: 'galao', custo: 100.00, precoVenda: 130.00, quantidadeEstoque: 20, estoqueMinimo: 8 },
  { id: '36', codigo: 'PI003', nome: 'Esmalte Sintético Preto Brilhante (Galão 3.6L)', categoria: 'Pintura', unidade: 'galao', custo: 120.00, precoVenda: 156.00, quantidadeEstoque: 25, estoqueMinimo: 8 },
  { id: '37', codigo: 'PI004', nome: 'Esmalte Sintético Cinza Escuro (Galão 3.6L)', categoria: 'Pintura', unidade: 'galao', custo: 120.00, precoVenda: 156.00, quantidadeEstoque: 25, estoqueMinimo: 8 },
  { id: '38', codigo: 'PI005', nome: 'Thinner 1100 Limpeza e Diluição (Lata 5L)', categoria: 'Pintura', unidade: 'lata', custo: 70.00, precoVenda: 91.00, quantidadeEstoque: 40, estoqueMinimo: 15 },
  // ⚙️ AUTOMAÇÃO
  { id: '39', codigo: 'AU001', nome: 'Cremalheira Aço/Nylon para Motor (1,5m)', categoria: 'Automação', unidade: 'barra', custo: 35.00, precoVenda: 45.50, quantidadeEstoque: 40, estoqueMinimo: 10 },
  { id: '40', codigo: 'AU002', nome: 'Roldana Guia de Nylon c/ Parafuso (Portão Correr)', categoria: 'Ferragens', unidade: 'un', custo: 18.00, precoVenda: 23.40, quantidadeEstoque: 60, estoqueMinimo: 20 },
  { id: '41', codigo: 'FE007', nome: 'Fechadura Elétrica de Sobrepor 12V', categoria: 'Ferragens', unidade: 'un', custo: 140.00, precoVenda: 182.00, quantidadeEstoque: 15, estoqueMinimo: 5 },
  { id: '42', codigo: 'AC008', nome: 'Cabo de Aço Galvanizado 1/4" (Metro)', categoria: 'Aço', unidade: 'm', custo: 4.50, precoVenda: 5.85, quantidadeEstoque: 200, estoqueMinimo: 50 },
  { id: '43', codigo: 'FI005', nome: 'Clips/Grampo para Cabo de Aço 1/4"', categoria: 'Fixação', unidade: 'un', custo: 1.50, precoVenda: 1.95, quantidadeEstoque: 150, estoqueMinimo: 30 },
  // 🏠 ACABAMENTOS COBERTURA
  { id: '44', codigo: 'CO003', nome: 'Calha em Chapa Galvanizada 14 (Metro)', categoria: 'Cobertura', unidade: 'm', custo: 50.00, precoVenda: 65.00, quantidadeEstoque: 80, estoqueMinimo: 30 },
  { id: '45', codigo: 'CO004', nome: 'Rufo Pingadeira Galvanizado (Metro)', categoria: 'Cobertura', unidade: 'm', custo: 28.00, precoVenda: 36.40, quantidadeEstoque: 100, estoqueMinimo: 40 },
  { id: '46', codigo: 'QU001', nome: 'Selante PU 40 para Calhas (Tubo 400g)', categoria: 'Químicos', unidade: 'tubo', custo: 22.00, precoVenda: 28.60, quantidadeEstoque: 50, estoqueMinimo: 15 },
  { id: '47', codigo: 'QU002', nome: 'Fita Butílica para Vedação de Telhas (Rolo 10m)', categoria: 'Cobertura', unidade: 'rolo', custo: 35.00, precoVenda: 45.50, quantidadeEstoque: 20, estoqueMinimo: 5 },
  // 🛡️ CERCAMENTOS
  { id: '48', codigo: 'SE001', nome: 'Lança Perfurante Mandíbula (Barra 1m)', categoria: 'Segurança', unidade: 'm', custo: 18.00, precoVenda: 23.40, quantidadeEstoque: 100, estoqueMinimo: 30 },
  { id: '49', codigo: 'SE002', nome: 'Tela Soldada Galvanizada Malha 5x5cm (m²)', categoria: 'Segurança', unidade: 'm²', custo: 25.00, precoVenda: 32.50, quantidadeEstoque: 200, estoqueMinimo: 50 },
  // 🏗️ ESTRUTURAL PESADO
  { id: '50', codigo: 'AC009', nome: 'Chapa Grossa 1/2" (12.5mm) - Placa Base (m²)', categoria: 'Aço', unidade: 'm²', custo: 600.00, precoVenda: 780.00, quantidadeEstoque: 5, estoqueMinimo: 2 },
  { id: '51', codigo: 'AC010', nome: 'Barra Roscada Zincada 5/8" (1 Metro)', categoria: 'Fixação', unidade: 'barra', custo: 25.00, precoVenda: 32.50, quantidadeEstoque: 50, estoqueMinimo: 10 },
  { id: '52', codigo: 'QU003', nome: 'Chumbador Químico Ampola (Un)', categoria: 'Fixação', unidade: 'un', custo: 18.00, precoVenda: 23.40, quantidadeEstoque: 80, estoqueMinimo: 20 },
  // 🔩 FIXADORES E BROCAS
  { id: '53', codigo: 'FI006', nome: 'Parafuso Sextavado Soberbo 1/4" x 50mm (Cento)', categoria: 'Fixação', unidade: 'cento', custo: 25.00, precoVenda: 32.50, quantidadeEstoque: 20, estoqueMinimo: 5 },
  { id: '54', codigo: 'FI007', nome: 'Bucha de Nylon S10 (Cento)', categoria: 'Fixação', unidade: 'cento', custo: 15.00, precoVenda: 19.50, quantidadeEstoque: 30, estoqueMinimo: 10 },
  { id: '55', codigo: 'BR001', nome: 'Broca Aço Rápido 1/4" (Un)', categoria: 'Abrasivo', unidade: 'un', custo: 8.00, precoVenda: 10.40, quantidadeEstoque: 50, estoqueMinimo: 15 },
  { id: '56', codigo: 'BR002', nome: 'Broca SDS Plus para Concreto 10mm (Un)', categoria: 'Abrasivo', unidade: 'un', custo: 18.00, precoVenda: 23.40, quantidadeEstoque: 20, estoqueMinimo: 5 },
  // ⚡ CONSUMÍVEIS DE SOLDA
  { id: '57', codigo: 'SO003', nome: 'Gás Mistura MIG (Recarga Cilindro)', categoria: 'Solda', unidade: 'un', custo: 150.00, precoVenda: 195.00, quantidadeEstoque: 8, estoqueMinimo: 3 },
  { id: '58', codigo: 'QU004', nome: 'Spray Anti-Respingo de Solda sem Silicone', categoria: 'Químicos', unidade: 'un', custo: 16.00, precoVenda: 20.80, quantidadeEstoque: 40, estoqueMinimo: 10 }
];

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ERPState>(() => {
    const savedInventory = localStorage.getItem('@cds-inventoryItems');
    const savedClientes = localStorage.getItem('@cds-clientes');
    const savedOS = localStorage.getItem('@cds-ordensServico');
    const savedTransacoes = localStorage.getItem('@cds-transacoesFinanceiras');

    let inventoryItems = savedInventory ? JSON.parse(savedInventory) : estoqueInicial;
    
    inventoryItems = inventoryItems.map((item: any) => ({
      ...item,
      nome: typeof item.nome === 'string' 
        ? item.nome.replace('(1000mm)', '(Barra 6m)').replace('(1000 mm)', '(Barra 6m)')
        : item.nome
    }));
    const clientes = savedClientes ? JSON.parse(savedClientes) : [
      { id: '1', nome: 'Construtora Alpha', email: 'contato@alpha.com', telefone: '5511999999999', tipo: 'PJ', documento: '12.345.678/0001-90', cep: '01001-000', logradouro: 'Rua das Indústrias', numero: '100', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' },
      { id: '2', nome: 'Indústria Beta', email: 'vendas@beta.com', telefone: '5511888888888', tipo: 'PJ', documento: '98.765.432/0001-10', cep: '01002-000', logradouro: 'Av. Metalúrgica', numero: '200', bairro: 'Distrito Industrial', cidade: 'São Bernardo', uf: 'SP' },
      { id: '3', nome: 'Logística Gamma', email: 'contato@gamma.com', telefone: '5511777777777', tipo: 'PJ', documento: '45.678.901/0001-22', cep: '01003-000', logradouro: 'Rodovia Logística', numero: 'KM 10', bairro: 'Zona Rural', cidade: 'Guarulhos', uf: 'SP' }
    ];
    const ordensServico = savedOS ? JSON.parse(savedOS) : [];
    const transacoesFinanceiras = savedTransacoes ? JSON.parse(savedTransacoes) : [];

    const propostas: Proposta[] = [
      { id: 'P1', clienteId: '1', items: [{ name: 'Galpão 200m²' }], total: 50000, status: 'Rascunho', data: '2026-03-12T10:00:00Z' },
      { id: 'P2', clienteId: '2', items: [{ name: 'Cobertura 500m²' }], total: 120000, status: 'Em Negociação', data: '2026-03-10T14:30:00Z' },
      { id: 'P3', clienteId: '3', items: [{ name: 'Galpão 1000m²' }], total: 250000, status: 'Proposta Enviada', data: '2026-03-05T09:15:00Z' }
    ];

    return {
      budget: { items: [], totalCost: 0 },
      carrinhoAtual: [],
      inventory: inventoryItems.reduce((acc: any, item: any) => ({ ...acc, [item.id]: item.quantidadeEstoque }), {}),
      inventoryItems,
      bom: [],
      clientes,
      propostas,
      ordensServico,
      financeiro: [],
      faturamento: [],
      pedidosCompra: [
        { id: '142', cliente: 'Aços do Brasil', itens: [{ id: 'chapa-2mm', nome: 'Chapa Lisa 2mm', qtd: 50, preco: 100 }], status: 'Aguardando Entrega', data: '2026-03-10' }
      ],
      transacoesFinanceiras,
      configFiscal: { regime: 'MEI', estadoOrigem: 'DF', csosn: '400', cfopPadrao: '5101' }
    };
  });

  useEffect(() => {
    localStorage.setItem('@cds-inventoryItems', JSON.stringify(state.inventoryItems));
    localStorage.setItem('@cds-clientes', JSON.stringify(state.clientes));
    localStorage.setItem('@cds-ordensServico', JSON.stringify(state.ordensServico));
    localStorage.setItem('@cds-transacoesFinanceiras', JSON.stringify(state.transacoesFinanceiras));
  }, [state.inventoryItems, state.clientes, state.ordensServico, state.transacoesFinanceiras]);

  const totalCarrinho = useMemo(() => {
    return state.carrinhoAtual.reduce((acc, item) => acc + (Number(item.preco) || 0), 0);
  }, [state.carrinhoAtual]);

  const validarConciliacao = (pedidoId: string, itensConciliados: { itemId: string; qtd: number; preco: number }[]) => {
    setState(prev => {
      const novoEstoque = { ...prev.inventory };
      const novasTransacoes = [...(prev.transacoesFinanceiras || [])];
      
      itensConciliados.forEach(item => {
        novoEstoque[item.itemId] = (novoEstoque[item.itemId] || 0) + item.qtd;
        
        const itemEstoque = prev.inventoryItems.find(i => i.id === item.itemId);
        novasTransacoes.push({
          id: `DESP-CONC-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          tipo: 'DESPESA',
          descricao: `Conciliação de Compra - ${itemEstoque?.nome || 'Item'}`,
          valor: item.qtd * item.preco,
          dataVencimento: new Date().toISOString(),
          status: 'PENDENTE',
          origem: pedidoId
        });
      });

      return {
        ...prev,
        pedidosCompra: prev.pedidosCompra.map(p => p.id === pedidoId ? { ...p, status: 'Entregue' } : p),
        inventory: novoEstoque,
        transacoesFinanceiras: novasTransacoes
      };
    });
  };

  const calculateBOM = (projectData: any): BOMItem[] => {
    const bom: BOMItem[] = [];
    return bom;
  };

  const adicionarAoCarrinho = (produto: any) => {
    const material = produto.custos?.material ?? (Math.floor(Math.random() * 500) + 200);
    const insumos = produto.custos?.insumos ?? (Math.floor(Math.random() * 100) + 50);
    const maoDeObra = produto.custos?.maoDeObra ?? (Math.floor(Math.random() * 300) + 150);
    const frete = produto.custos?.frete ?? 120;
    
    const custoTotal = material + insumos + maoDeObra + frete;
    const margem = 1.3;
    const precoFinal = produto.preco ?? (custoTotal * margem);

    setState(prev => ({
      ...prev,
      carrinhoAtual: [...prev.carrinhoAtual, { 
        ...produto, 
        inventoryId: produto.id,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        ncm: '7308.90.10',
        impostos: 0,
        cfop: prev.configFiscal.cfopPadrao,
        custos: { material, insumos, maoDeObra, frete },
        preco: precoFinal
      }]
    }));
  };

  const limparCarrinho = () => {
    setState(prev => ({ ...prev, carrinhoAtual: [] }));
  };

  const removerDoCarrinho = (index: number) => {
    setState(prev => ({
      ...prev,
      carrinhoAtual: prev.carrinhoAtual.filter((_, i) => i !== index)
    }));
  };

  const fecharProposta = () => {
    const novaProposta: Proposta = {
      id: Date.now().toString(),
      clienteId: '',
      items: state.carrinhoAtual,
      total: totalCarrinho,
      status: 'Em Negociação',
      data: new Date().toISOString()
    };
    
    setState(prev => ({
      ...prev,
      propostas: [...prev.propostas, novaProposta],
      carrinhoAtual: []
    }));
  };

  const aprovarVenda = (clienteId: string, proposalId?: string) => {
    console.log('1. Iniciando aprovação...', state.carrinhoAtual);
    if (!state.carrinhoAtual || state.carrinhoAtual.length === 0) {
      console.log('Carrinho vazio, abortando.');
      alert('Carrinho vazio! Adicione itens antes de aprovar.');
      return;
    }

    const cliente = state.clientes.find(c => c.id === clienteId);

    try {
      console.log('2. Construindo objetos da venda...');
      const novaProposta: Proposta = {
        id: proposalId || `PROP-${Date.now()}`,
        clienteId: clienteId || 'sem-id',
        clienteNome: cliente?.nome || 'Cliente não identificado',
        items: (state.carrinhoAtual || []).map(item => ({
          ...item,
          name: item?.name || item?.nome || 'Produto sem nome',
          price: item?.price || item?.preco || 0
        })),
        total: totalCarrinho || 0,
        status: 'Aprovada/Produção',
        data: new Date().toISOString()
      };

      const pecasOS = state.carrinhoAtual.flatMap(item => item?.pecas || item?.insumos || []);

      const novaReceita: Receita = {
        id: Date.now().toString(),
        propostaId: novaProposta.id,
        valor: totalCarrinho || 0,
        status: 'Pendente',
        data: new Date().toISOString()
      };

      const novoFaturamento: Faturamento = {
        id: Date.now().toString(),
        propostaId: novaProposta.id,
        status: 'Aguardando'
      };

      console.log('3. Atualizando estado global...');
      setState(prev => {
        const novoEstoque = { ...(prev.inventory || {}) };
        const novosPedidosCompra = [...(prev.pedidosCompra || [])];
        let houveAutoCompra = false;
        
        const necessidades = new Map<string, { nome: string, qtd: number, custo: number }>();

        (prev.carrinhoAtual || []).forEach(item => {
          const materiais = item.materiaisNecessarios || [];
          
          if (materiais.length === 0) {
            const itemId = item?.inventoryId || item?.id || 'item-generico';
            const qtdDescontar = item?.qtd || item?.quantidade || 1;
            const nome = item?.nome || item?.name || 'Item Faltante';
            const custo = (item?.custos?.material || 100) * 0.9;
            
            const atual = necessidades.get(itemId) || { nome, qtd: 0, custo };
            atual.qtd += qtdDescontar;
            necessidades.set(itemId, atual);
          } else {
            materiais.forEach((mat: any) => {
              const itemId = mat.id;
              const atual = necessidades.get(itemId) || { nome: mat.nome, qtd: 0, custo: mat.custo || 100 };
              atual.qtd += mat.qtd;
              necessidades.set(itemId, atual);
            });
          }
        });

        necessidades.forEach((req, itemId) => {
          if (novoEstoque[itemId] === undefined) novoEstoque[itemId] = 0;
          
          const estoqueAnterior = novoEstoque[itemId];
          novoEstoque[itemId] -= req.qtd;

          let qtdComprar = 0;
          if (estoqueAnterior >= 0 && novoEstoque[itemId] < 0) {
            qtdComprar = Math.abs(novoEstoque[itemId]);
          } else if (estoqueAnterior < 0) {
            qtdComprar = req.qtd;
          }

          if (qtdComprar > 0) {
            houveAutoCompra = true;
            novosPedidosCompra.push({
              id: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              cliente: 'Fornecedor Padrão (Auto-Compra)',
              itens: [{ 
                id: itemId, 
                nome: req.nome, 
                qtd: qtdComprar, 
                preco: req.custo 
              }],
              status: 'Aguardando Entrega',
              data: new Date().toISOString()
            });
          }
        });

        if (houveAutoCompra) {
          setTimeout(() => alert('⚠️ Venda Aprovada! Itens faltantes foram enviados para a fila de Compras Urgentes.'), 500);
        }

        return {
          ...prev,
          propostas: [novaProposta, ...(prev.propostas || [])],
          ordensServico: [...(prev.ordensServico || []), {
            id: `OS-${Date.now()}`,
            propostaId: novaProposta.id,
            clienteNome: novaProposta.clienteNome,
            itens: novaProposta.items,
            dataEntrega: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'Fila de Produção'
          }],
          transacoesFinanceiras: [...(prev.transacoesFinanceiras || []), {
            id: `REC-${Date.now()}`,
            tipo: 'RECEITA',
            descricao: `Venda para ${cliente?.nome || 'Cliente'}`,
            valor: totalCarrinho || 0,
            dataVencimento: new Date().toISOString(),
            status: 'PENDENTE',
            origem: novaProposta.id
          }],
          financeiro: [...(prev.financeiro || []), novaReceita],
          faturamento: [...(prev.faturamento || []), novoFaturamento],
          inventory: novoEstoque,
          pedidosCompra: novosPedidosCompra,
          carrinhoAtual: []
        };
      });
      
      console.log('4. Aprovação concluída com sucesso!');
      alert('Venda aprovada e O.S. gerada com sucesso!');
    } catch (error) {
      console.error('Erro crítico em aprovarVenda:', error);
      alert('Erro ao processar venda: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  };

  const salvarRascunho = (clienteId: string, proposalId?: string) => {
    if (!state.carrinhoAtual || state.carrinhoAtual.length === 0) {
      alert('Carrinho vazio! Adicione itens antes de salvar rascunho.');
      return;
    }

    const cliente = state.clientes.find(c => c.id === clienteId);

    const novaProposta: Proposta = {
      id: proposalId || `RASC-${Date.now()}`,
      clienteId: clienteId || 'sem-id',
      clienteNome: cliente?.nome || 'Cliente não identificado',
      items: (state.carrinhoAtual || []).map(item => ({
        ...item,
        name: item?.name || item?.nome || 'Produto sem nome',
        price: item?.price || item?.preco || 0
      })),
      total: totalCarrinho || 0,
      status: 'Rascunho',
      data: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      propostas: [novaProposta, ...(prev.propostas || [])],
      carrinhoAtual: []
    }));

    alert('Rascunho salvo com sucesso!');
  };

  const gerarOS = (proposta: Proposta) => {
    try {
      const novaOS: OrdemServico = {
        id: `OS-${Date.now()}`,
        propostaId: proposta.id,
        clienteNome: proposta.clienteNome || 'Cliente',
        itens: proposta.items,
        dataEntrega: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Fila de Produção'
      };

      const novaReceita: Receita = {
        id: Date.now().toString(),
        propostaId: proposta.id,
        valor: proposta.total || 0,
        status: 'Pendente',
        data: new Date().toISOString()
      };

      const novoFaturamento: Faturamento = {
        id: Date.now().toString(),
        propostaId: proposta.id,
        status: 'Aguardando'
      };

      setState(prev => {
        const novoEstoque = { ...(prev.inventory || {}) };
        const novosPedidosCompra = [...(prev.pedidosCompra || [])];
        let houveAutoCompra = false;
        
        const necessidades = new Map<string, { nome: string, qtd: number, custo: number }>();

        (proposta.items || []).forEach(item => {
          const materiais = item.materiaisNecessarios || [];
          
          if (materiais.length === 0) {
            const itemId = item?.inventoryId || item?.id || 'item-generico';
            const qtdDescontar = item?.qtd || item?.quantidade || 1;
            const nome = item?.nome || item?.name || 'Item Faltante';
            const custo = (item?.custos?.material || 100) * 0.9;
            
            const atual = necessidades.get(itemId) || { nome, qtd: 0, custo };
            atual.qtd += qtdDescontar;
            necessidades.set(itemId, atual);
          } else {
            materiais.forEach((mat: any) => {
              const itemId = mat.id;
              const atual = necessidades.get(itemId) || { nome: mat.nome, qtd: 0, custo: mat.custo || 100 };
              atual.qtd += mat.qtd;
              necessidades.set(itemId, atual);
            });
          }
        });

        necessidades.forEach((req, itemId) => {
          if (novoEstoque[itemId] === undefined) novoEstoque[itemId] = 0;
          
          const estoqueAnterior = novoEstoque[itemId];
          novoEstoque[itemId] -= req.qtd;

          let qtdComprar = 0;
          if (estoqueAnterior >= 0 && novoEstoque[itemId] < 0) {
            qtdComprar = Math.abs(novoEstoque[itemId]);
          } else if (estoqueAnterior < 0) {
            qtdComprar = req.qtd;
          }

          if (qtdComprar > 0) {
            houveAutoCompra = true;
            novosPedidosCompra.push({
              id: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              cliente: 'Fornecedor Padrão (Auto-Compra)',
              itens: [{ 
                id: itemId, 
                nome: req.nome, 
                qtd: qtdComprar, 
                preco: req.custo 
              }],
              status: 'Aguardando Entrega',
              data: new Date().toISOString()
            });
          }
        });

        if (houveAutoCompra) {
          setTimeout(() => alert('⚠️ Venda Aprovada! Itens faltantes foram enviados para a fila de Compras Urgentes.'), 500);
        }

        return {
          ...prev,
          ordensServico: [...(prev.ordensServico || []), novaOS],
          propostas: prev.propostas.map(p => p.id === proposta.id ? { ...p, status: 'Aprovada/Produção' } : p),
          transacoesFinanceiras: [...(prev.transacoesFinanceiras || []), {
            id: `REC-${Date.now()}`,
            tipo: 'RECEITA',
            descricao: `Venda para ${proposta.clienteNome || 'Cliente'}`,
            valor: proposta.total || 0,
            dataVencimento: new Date().toISOString(),
            status: 'PENDENTE',
            origem: proposta.id
          }],
          financeiro: [...(prev.financeiro || []), novaReceita],
          faturamento: [...(prev.faturamento || []), novoFaturamento],
          inventory: novoEstoque,
          pedidosCompra: novosPedidosCompra
        };
      });
      alert('O.S. gerada com sucesso e venda aprovada!');
    } catch (error) {
      console.error('Erro crítico em gerarOS:', error);
      alert('Erro ao processar O.S.: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const moverEtapaOS = (osId: string, novaEtapa: OrdemServico['status']) => {
    setState(prev => {
      const os = prev.ordensServico.find(o => o.id === osId);
      let novoEstoque = { ...prev.inventory };
      
      if (novaEtapa === 'Corte e Dobra' && os && os.status === 'Fila de Produção') {
        os.itens.forEach(item => {
          const materiais = item.materiaisNecessarios || [];
          if (materiais.length === 0) {
            const itemId = item.id || 'item-generico';
            const itemEstoque = prev.inventoryItems.find(i => i.id === itemId);
            if (itemEstoque && novoEstoque[itemId] < itemEstoque.estoqueMinimo) {
              console.warn(`Estoque baixo para ${item.nome || item.name}: ${novoEstoque[itemId]}`);
            }
          } else {
            materiais.forEach((mat: any) => {
              const itemEstoque = prev.inventoryItems.find(i => i.id === mat.id);
              if (itemEstoque && novoEstoque[mat.id] < itemEstoque.estoqueMinimo) {
                console.warn(`Estoque baixo para ${mat.nome}: ${novoEstoque[mat.id]}`);
              }
            });
          }
        });
      }

      return {
        ...prev,
        ordensServico: prev.ordensServico.map(o => o.id === osId ? { ...o, status: novaEtapa } : o),
        inventory: novoEstoque
      };
    });
  };

  const moverEtapaProjeto = (projetoId: string, direcao: 'avancar' | 'retroceder') => {
    const etapas: EtapaProducao[] = ['Corte', 'Dobra', 'Solda/Montagem', 'Pintura', 'Embalagem', 'Entrega'];
    setState(prev => ({
      ...prev,
      budget: {
        ...prev.budget,
        items: prev.budget.items.map(item => {
          if (item.id !== projetoId) return item;
          const indexAtual = etapas.indexOf(item.etapaProducao);
          const novoIndex = direcao === 'avancar' ? Math.min(indexAtual + 1, etapas.length - 1) : Math.max(indexAtual - 1, 0);
          return { ...item, etapaProducao: etapas[novoIndex] };
        })
      }
    }));
  };

  const updateInventory = (itemId: string, quantity: number) => {
    setState(prev => ({
      ...prev,
      inventory: { ...prev.inventory, [itemId]: (prev.inventory[itemId] || 0) + quantity }
    }));
  };

  const adicionarCliente = (cliente: Cliente) => {
    setState(prev => ({
      ...prev,
      clientes: [...prev.clientes, cliente]
    }));
  };

  const adicionarProposta = (proposta: Proposta) => {
    setState(prev => ({
      ...prev,
      propostas: [proposta, ...(prev.propostas || [])]
    }));
  };

  const registrarTransacao = (transacao: TransacaoFinanceira) => {
    setState(prev => ({
      ...prev,
      transacoesFinanceiras: [...prev.transacoesFinanceiras, transacao]
    }));
  };

  const atualizarStatusTransacao = (id: string) => {
    setState(prev => ({
      ...prev,
      transacoesFinanceiras: prev.transacoesFinanceiras.map(t => 
        t.id === id ? { ...t, status: 'PAGO' } : t
      )
    }));
  };

  const darEntradaEstoque = (itemId: string, quantidade: number, novoCusto: number) => {
    setState(prev => {
      const novoEstoque = { ...prev.inventory };
      novoEstoque[itemId] = (novoEstoque[itemId] || 0) + quantidade;
      
      const item = prev.inventoryItems.find(i => i.id === itemId);
      
      const novosInventoryItems = prev.inventoryItems.map(i => 
        i.id === itemId ? { ...i, quantidadeEstoque: novoEstoque[itemId], custo: novoCusto } : i
      );
      
      return {
        ...prev,
        inventory: novoEstoque,
        inventoryItems: novosInventoryItems,
        transacoesFinanceiras: [...(prev.transacoesFinanceiras || []), {
          id: `DESP-${Date.now()}`,
          tipo: 'DESPESA',
          descricao: `Compra de ${item?.nome || 'Item'}`,
          valor: quantidade * novoCusto,
          dataVencimento: new Date().toISOString(),
          status: 'PENDENTE',
          origem: `COMPRA-${itemId}`
        }]
      };
    });
  };

  const enviarMensagemAoAgente = async (clienteId: string, message: string) => {
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      clientes: prev.clientes.map(c => 
        c.id === clienteId 
          ? { ...c, mensagens: [...(c.mensagens || []), userMsg] } 
          : c
      )
    }));

    try {
      const result = {
        response: "Olá! Recebi sua mensagem. Como posso ajudar com seu projeto de serralheria hoje?",
        updatedFunnelStage: 'Qualificação' as Cliente['funnelStage'],
        newPainsIdentified: []
      };
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: result.response,
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        clientes: prev.clientes.map(c => 
          c.id === clienteId 
            ? { 
                ...c, 
                mensagens: [...(c.mensagens || []), aiMsg],
                funnelStage: result.updatedFunnelStage,
                dores: Array.from(new Set([...(c.dores || []), ...result.newPainsIdentified]))
              } 
            : c
        )
      }));
    } catch (error) {
      console.error('Erro ao enviar mensagem ao agente:', error);
    }
  };

  return (
    <ERPContext.Provider value={{ state, adicionarAoCarrinho, removerDoCarrinho, fecharProposta, aprovarVenda, salvarRascunho, gerarOS, moverEtapaOS, updateInventory, calculateBOM, moverEtapaProjeto, totalCarrinho, validarConciliacao, limparCarrinho, adicionarCliente, adicionarProposta, darEntradaEstoque, registrarTransacao, atualizarStatusTransacao, enviarMensagemAoAgente }}>
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) throw new Error('useERP must be used within an ERPProvider');
  return context;
};
