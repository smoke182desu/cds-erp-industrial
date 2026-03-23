import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PerfilData } from '../data/perfisDB';
import { UsuarioConfig } from '../services/usuarioService';

interface DadosProjeto {
  largura: number;
  altura: number;
  profundidade?: number;
  inclinacaoPercentual?: number;
  materialCobertura?: 'vidro' | 'policarbonato' | 'telha' | 'vazio';
  areaCobertura?: number;
  perfilSelecionado: PerfilData;
  quantidadeGrades: number;
  tipoMontagem: 'reto' | 'meia-esquadria';
  tipoProduto: string;
  pesoTotal: number;
  custoTotal: number;
  temGuardaCorpo: boolean;
  ladosGuardaCorpo: 'esquerdo' | 'direito' | 'ambos';
  acabamentoMetal: { nome: string };
  materialDegrau: { nome: string };
  listaCorte: { item: string; quantidade: number; medida: string }[];
}

export const gerarPropostaPDF = (
  dadosProjeto: DadosProjeto, 
  imagem3D: string, 
  config: UsuarioConfig, 
  canvasWidth: number, 
  canvasHeight: number,
  prints?: string[]
) => {
  const doc = new jsPDF();
  const { 
    largura, 
    altura, 
    profundidade,
    inclinacaoPercentual,
    materialCobertura,
    areaCobertura,
    perfilSelecionado, 
    quantidadeGrades, 
    tipoMontagem, 
    tipoProduto,
    pesoTotal, 
    custoTotal,
    temGuardaCorpo,
    ladosGuardaCorpo,
    acabamentoMetal,
    materialDegrau,
    listaCorte
  } = dadosProjeto;

  // Cabeçalho
  if (config.logoBase64) {
    // Adiciona a logo no canto superior esquerdo
    try {
      doc.addImage(config.logoBase64, 'PNG', 15, 10, 30, 30, undefined, 'FAST');
    } catch (e) {
      console.warn("Erro ao adicionar logo ao PDF", e);
    }
  }

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  
  // Título com o nome da empresa ou genérico
  const titulo = config.nomeEmpresa ? config.nomeEmpresa.toUpperCase() : 'PROPOSTA COMERCIAL';
  doc.text(titulo, 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  doc.text(`Data: ${dataAtual}`, 105, 28, { align: 'center' });
  
  if (config.telefone) {
    doc.text(`Tel/WhatsApp: ${config.telefone}`, 105, 34, { align: 'center' });
  }

  // Imagem do Projeto
  const imageStartY = config.telefone ? 45 : 40;
  if (imagem3D && canvasWidth > 0 && canvasHeight > 0) {
    const maxWidth = 180;
    const maxHeight = 100;
    const aspectRatio = canvasWidth / canvasHeight;
    let imgWidth = maxWidth;
    let imgHeight = maxWidth / aspectRatio;
    
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = maxHeight * aspectRatio;
    }
    
    // Centralizar a imagem
    const x = 15 + (maxWidth - imgWidth) / 2;
    doc.addImage(imagem3D, 'PNG', x, imageStartY, imgWidth, imgHeight);
  } else if (imagem3D) {
    doc.addImage(imagem3D, 'PNG', 15, imageStartY, 180, 100);
  }

  // Especificações Técnicas
  const specsStartY = imageStartY + 110;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Especificações Técnicas', 15, specsStartY);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  let currentY = specsStartY + 8;
  const lineSpacing = 6;

  if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') {
    doc.text(`Largura da Escada: ${largura} mm`, 15, currentY); currentY += lineSpacing;
    doc.text(`Altura do Pé Direito: ${altura} mm`, 15, currentY); currentY += lineSpacing;
  } else if (tipoProduto === 'cobertura_pergolado' || tipoProduto === 'galpao') {
    doc.text(`Largura: ${largura} mm`, 15, currentY); currentY += lineSpacing;
    doc.text(`Profundidade: ${profundidade} mm`, 15, currentY); currentY += lineSpacing;
    doc.text(`Inclinação: ${inclinacaoPercentual}%`, 15, currentY); currentY += lineSpacing;
    
    let coberturaNome = 'Sem Cobertura';
    if (materialCobertura === 'vidro') coberturaNome = 'Vidro Temperado';
    else if (materialCobertura === 'policarbonato') coberturaNome = 'Policarbonato';
    else if (materialCobertura === 'telha') {
      coberturaNome = 'Telha Metálica';
    }
    
    doc.text(`Material da Cobertura: ${coberturaNome}`, 15, currentY); currentY += lineSpacing;
    doc.text(`Área da Cobertura: ${areaCobertura?.toFixed(2)} m²`, 15, currentY); currentY += lineSpacing;
  } else {
    doc.text(`Largura Externa: ${largura} mm`, 15, currentY); currentY += lineSpacing;
    doc.text(`Altura Externa: ${altura} mm`, 15, currentY); currentY += lineSpacing;
  }
  
  doc.text(`Perfil Escolhido: ${perfilSelecionado.nome}`, 15, currentY); currentY += lineSpacing;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(`Uso: ${perfilSelecionado.uso}`, 15, currentY); currentY += lineSpacing;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  if (tipoProduto !== 'escada_reta' && tipoProduto !== 'escada_l' && tipoProduto !== 'galpao') {
    doc.text(`Tipo de Montagem: ${tipoMontagem === 'reto' ? 'Topo a Topo (Reto)' : 'Quadro (45º)'}`, 15, currentY); currentY += lineSpacing;
    doc.text(`Quantidade de Grades Internas: ${quantidadeGrades}`, 15, currentY); currentY += lineSpacing;
  }

  doc.text(`Acabamento da Estrutura: ${acabamentoMetal.nome}`, 15, currentY); currentY += lineSpacing;
  
  if (tipoProduto === 'escada_reta' || tipoProduto === 'escada_l') {
    doc.text(`Material (Degraus/Preenchimento): ${materialDegrau.nome}`, 15, currentY); currentY += lineSpacing;
    if (tipoProduto === 'escada_reta') {
      doc.text(`Guarda-Corpo: ${temGuardaCorpo ? 'Incluso (' + ladosGuardaCorpo + ')' : 'Não Incluso'}`, 15, currentY); currentY += lineSpacing;
    }
  }

  // Relatório de Produção / Lista de Corte
  autoTable(doc, {
    startY: currentY + 5,
    head: [['Item', 'Quantidade', 'Medida / Especificação']],
    body: listaCorte.map(c => [c.item, c.quantidade.toString(), c.medida]),
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10 },
    margin: { top: 10 }
  });

  // Tabela Financeira
  const finalY = (doc as any).lastAutoTable.finalY || currentY + 30;

  const maoDeObra = custoTotal * config.multiplicadorLucro;
  const valorTotalSugerido = custoTotal + maoDeObra;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  autoTable(doc, {
    startY: finalY + 10,
    head: [['Descrição', 'Valor']],
    body: [
      ['Peso Total Estimado (Kg)', `${pesoTotal.toFixed(2)} Kg`],
      ['Custo Base do Material (R$)', formatCurrency(custoTotal)],
      ['Mão de Obra Sugerida (R$)', formatCurrency(maoDeObra)],
      ['VALOR TOTAL SUGERIDO', formatCurrency(valorTotalSugerido)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: 50 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' }
    }
  });

  const finalTableY = (doc as any).lastAutoTable.finalY || finalY + 50;
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text("Valores estimados baseados no peso teórico do aço e acabamentos selecionados. Sujeito a variações de mercado.", 15, finalTableY + 10);

  // Prints
  console.log("PDF Generator: prints received", prints);
  if (prints && prints.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Prints do Projeto', 15, 20);
    
    let y = 30;
    prints.forEach((print, index) => {
      doc.addImage(print, 'PNG', 15, y, 180, 100);
      y += 110;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    });
  }

  // Salvar o PDF
  doc.save('Proposta_AcoFacil.pdf');
};

export const gerarPropostaLicitacaoPDF = (
  licitacao: any,
  items: any[],
  bdi: number,
  config: any
) => {
  const doc = new jsPDF();
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Cabeçalho
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA COMERCIAL - LICITAÇÃO', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 105, 28, { align: 'center' });

  // Dados da Licitação
  doc.setFillColor(240, 240, 240);
  doc.rect(15, 35, 180, 40, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA LICITAÇÃO', 20, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`Órgão: ${licitacao.orgao}`, 20, 50);
  doc.text(`UASG: ${licitacao.uasg}`, 20, 58);
  doc.text(`Objeto: ${licitacao.objeto}`, 20, 66);
  if (licitacao.pregao) doc.text(`Pregão: ${licitacao.pregao}`, 20, 74);

  // Tabela de Itens
  autoTable(doc, {
    startY: 85,
    head: [['Item', 'Descrição', 'Qtd', 'Custo Unit.', 'BDI (%)', 'Preço Unit.', 'Total']],
    body: items.map((item, index) => {
      const precoUnit = item.custo * (1 + bdi / 100);
      const total = precoUnit * item.qtd;
      return [
        (index + 1).toString(),
        item.nome,
        item.qtd.toString(),
        formatCurrency(item.custo),
        `${bdi}%`,
        formatCurrency(precoUnit),
        formatCurrency(total)
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 120;
  const totalGeral = items.reduce((acc, item) => acc + (item.custo * (1 + bdi / 100) * item.qtd), 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`VALOR TOTAL DA PROPOSTA: ${formatCurrency(totalGeral)}`, 195, finalY + 15, { align: 'right' });

  // Rodapé com dados da empresa
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${config.razaoSocial} - CNPJ: ${config.cnpj}`, 105, 280, { align: 'center' });
  doc.text(`${config.logradouro}, ${config.numero} - ${config.cidade}/${config.uf}`, 105, 285, { align: 'center' });

  doc.save(`Proposta_Licitacao_${licitacao.uasg}.pdf`);
};
