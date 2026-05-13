const MATERIAIS = {
  aco_carbono: { label: 'Aco carbono', precoKg: 70, densidadeKgMm3: 7.85e-6 },
  inox: { label: 'Inox', precoKg: 150, densidadeKgMm3: 7.9e-6 },
  aluminio: { label: 'Aluminio', precoKg: 120, densidadeKgMm3: 2.7e-6 },
  galvanizado: { label: 'Aco galvanizado', precoKg: 100, densidadeKgMm3: 7.85e-6 },
};

function normalizarTexto(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function numero(valor) {
  return Number(String(valor || '').replace(',', '.')) || 0;
}

function arredondar(valor, casas = 2) {
  const fator = 10 ** casas;
  return Math.round((Number(valor) || 0) * fator) / fator;
}

function detectarMaterial(texto) {
  const t = normalizarTexto(texto);
  if (/\binox\b|304|430/.test(t)) return 'inox';
  if (/\baluminio\b|\balumin\b/.test(t)) return 'aluminio';
  if (/\bgalvanizad/.test(t)) return 'galvanizado';
  return 'aco_carbono';
}

function detectarEspessuraMm(texto) {
  const t = normalizarTexto(texto);
  const chapa14 = /\bchapa\s*(?:#\s*)?14\b|\bch\s*14\b/.test(t);
  if (chapa14) return { valor: 2, assumida: false, origem: 'chapa 14' };

  const padroes = [
    /(?:espessura|parede|chapa|e=)\s*(\d+(?:[,.]\d+)?)\s*mm\b/i,
    /\b(\d+(?:[,.]\d+)?)\s*mm\s*(?:de\s*)?(?:espessura|parede|chapa)\b/i,
  ];
  for (const re of padroes) {
    const m = String(texto || '').match(re);
    if (m) {
      const valor = numero(m[1]);
      if (valor > 0 && valor <= 6.35) return { valor, assumida: false, origem: `${valor}mm` };
    }
  }

  return { valor: 2, assumida: true, origem: 'chapa 14 / 2mm assumida' };
}

function escalaMedidaParaMm(valores, unidade, bruto) {
  const unit = normalizarTexto(unidade);
  if (unit === 'mm' || unit.startsWith('milimetro')) return 1;
  if (unit === 'cm' || unit.startsWith('centimetro')) return 10;
  if (unit.startsWith('m')) return 1000;

  const max = Math.max(...valores);
  const temDecimal = /[,.]/.test(String(bruto || ''));
  if (temDecimal && max <= 10) return 1000; // 1,20x0,60 normalmente e metro
  if (max <= 300) return 10; // 75x64 normalmente e centimetro
  return 1;
}

function extrairDimensoes(texto) {
  const out = [];
  const re = /(\d+(?:[,.]\d+)?)\s*[xX×]\s*(\d+(?:[,.]\d+)?)(?:\s*[xX×]\s*(\d+(?:[,.]\d+)?))?\s*(mm|cm|m|metros?|centimetros?|milimetros?)?/gi;
  let m;
  while ((m = re.exec(String(texto || ''))) !== null) {
    const valores = [m[1], m[2], m[3]].filter(Boolean).map(numero).filter(v => v > 0);
    if (valores.length < 2) continue;
    const escala = escalaMedidaParaMm(valores, m[4] || '', m[0]);
    out.push({
      original: m[0],
      valoresMm: valores.map(v => v * escala),
    });
  }
  return out;
}

function extrairQuantidade(produto, texto) {
  const direta = Number(produto?.quantidade || produto?.qtd || produto?.quantidadeSolicitada || 0);
  if (direta > 0) return direta;
  const m = String(texto || '').match(/\b(\d{1,3})\s*(?:un|unid|unidade|unidades|pecas|pe[cç]as|pes|p[eé]s)\b/i);
  return m ? Math.max(1, Number(m[1]) || 1) : 1;
}

function calcularChapa({ dimensoes, espessuraMm, material }) {
  if (!dimensoes?.valoresMm?.length || dimensoes.valoresMm.length < 2) return null;
  const [a, b, c] = dimensoes.valoresMm;
  const t = normalizarTexto(dimensoes.original);
  let areaMm2 = a * b;
  let metodo = 'chapa plana';

  if (c && /\b(container|caixa|carrinho|bandeja|vaso|cachepot)\b/.test(t)) {
    areaMm2 = (a * b) + (2 * a * c) + (2 * b * c);
    metodo = 'chapa dobrada/caixa aberta';
  }

  const pesoKg = areaMm2 * espessuraMm * material.densidadeKgMm3;
  return { pesoKg, metodo, dimensoes: dimensoes.original };
}

function calcularPerfil(texto, espessuraPadrao, material) {
  const perfil = String(texto || '').match(/\b(?:metalon|tubo|perfil)\s*(\d+(?:[,.]\d+)?)\s*[xX×]\s*(\d+(?:[,.]\d+)?)(?:\s*[xX×]\s*(\d+(?:[,.]\d+)?))?/i);
  if (!perfil) return null;
  const a = numero(perfil[1]);
  const b = numero(perfil[2]);
  const parede = numero(perfil[3]) || espessuraPadrao || 1.5;
  const comprimento = String(texto || '').match(/\b(\d+(?:[,.]\d+)?)\s*(m|metro|metros)\b/i);
  if (!a || !b || !comprimento) return null;
  const compMm = numero(comprimento[1]) * 1000;
  const internoA = Math.max(0, a - (2 * parede));
  const internoB = Math.max(0, b - (2 * parede));
  const areaSecaoMm2 = (a * b) - (internoA * internoB);
  const pesoKg = areaSecaoMm2 * compMm * material.densidadeKgMm3;
  return {
    pesoKg,
    metodo: `perfil/tubo ${a}x${b}x${parede}mm`,
    dimensoes: `${perfil[0]} com ${comprimento[0]}`,
  };
}

export function estimarPrecoSobMedida(produto = {}, conversaTexto = '') {
  const texto = [
    conversaTexto,
    produto.nome,
    produto.descricao,
    produto.observacoes,
  ].filter(Boolean).join(' ');

  const materialKey = detectarMaterial(texto);
  const material = MATERIAIS[materialKey] || MATERIAIS.aco_carbono;
  const espessura = detectarEspessuraMm(texto);
  const perfil = calcularPerfil(texto, espessura.valor, material);
  const dimensoes = extrairDimensoes(texto);
  const chapa = perfil || calcularChapa({ dimensoes: dimensoes[0], espessuraMm: espessura.valor, material });
  if (!chapa?.pesoKg) return null;

  const quantidade = extrairQuantidade(produto, texto);
  const pesoKg = arredondar(chapa.pesoKg, 3);
  const precoUnitario = arredondar(pesoKg * material.precoKg, 2);

  return {
    fonte: 'simulacao_peso',
    material: materialKey,
    materialLabel: material.label,
    precoKg: material.precoKg,
    densidadeKgMm3: material.densidadeKgMm3,
    espessuraMm: espessura.valor,
    espessuraAssumida: espessura.assumida,
    pesoKg,
    quantidade,
    precoUnitario,
    precoTotal: arredondar(precoUnitario * quantidade, 2),
    metodo: chapa.metodo,
    dimensoesBase: chapa.dimensoes,
    observacoes: [
      `Base ${material.label}: R$ ${material.precoKg}/kg`,
      espessura.assumida ? 'Espessura assumida como chapa 14 / 2mm' : `Espessura usada: ${espessura.origem}`,
      'Estimativa por peso para sob medida; revisar medidas, perdas, ferragens, solda e pintura antes de fechar.',
    ],
  };
}

export function aplicarPrecoSobMedida(item, conversaTexto = '', campoPreco = 'precoUnitario') {
  if (!item || item.produtoPadrao || item.skuCatalogo) return item;
  const simulacao = estimarPrecoSobMedida(item, conversaTexto);
  if (!simulacao) return item;

  item.sobMedida = true;
  item.produtoPadrao = false;
  item.simulacaoPreco = simulacao;
  item[campoPreco] = simulacao.precoUnitario;
  const detalhe = `Preco estimado por peso: ${simulacao.pesoKg} kg x R$ ${simulacao.precoKg}/kg (${simulacao.materialLabel}).`;
  item.descricao = item.descricao
    ? `${item.descricao} ${detalhe}`
    : detalhe;
  return item;
}
