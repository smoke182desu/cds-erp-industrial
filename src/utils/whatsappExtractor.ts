/**
 * whatsappExtractor.ts
 *
 * Motor de extração inteligente de dados de conversas do WhatsApp.
 * Estratégia de ZERO custo: regex + APIs gratuitas (BrasilAPI, ViaCEP).
 * IA (Gemini) só é chamada se necessário para campos ainda faltando.
 */

export interface ExtractedClientData {
  nome?: string;
  email?: string;
  telefone?: string;
  tipo?: 'PF' | 'PJ' | 'GOV';
  documento?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  endereco?: string;
  razaoSocial?: string;
  orgao?: string;
  confianca: Record<string, 'alto' | 'medio' | 'baixo'>;
}

export interface ExtractedProposalData {
  tipoProduto?: string;
  dimensoes?: { largura?: number; altura?: number; comprimento?: number; area?: number };
  quantidade?: number;
  descricao?: string;
  orcamentoEstimado?: string;
  prazoMencionado?: string;
}

export interface ExtractionResult {
  cliente: ExtractedClientData;
  proposta: ExtractedProposalData;
  camposFaltando: string[];
  resumoConversa: string;
}

function limparNumero(str: string): string {
  return str.replace(/\D/g, '');
}

function validarCPF(cpf: string): boolean {
  const c = limparNumero(cpf);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

function validarCNPJ(cnpj: string): boolean {
  const c = limparNumero(cnpj);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calcDigit = (str: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + parseInt(str[i]) * w, 0);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcDigit(c, w1) % 11;
  const d2 = calcDigit(c, w2) % 11;
  return parseInt(c[12]) === (d1 < 2 ? 0 : 11 - d1) &&
         parseInt(c[13]) === (d2 < 2 ? 0 : 11 - d2);
}

export function extrairTelefone(texto: string): string | undefined {
  const padroes = [
    /(?:whatsapp|tel|fone|celular|contato)[:\s]*(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})/gi,
    /(\+55\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})/g,
    /(\(?\d{2}\)?\s*9\d{4}[-\s]?\d{4})/g,
    /(\(?\d{2}\)?\s*\d{4}[-\s]?\d{4})/g,
  ];
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) return limparNumero(m[0]);
  }
  return undefined;
}

export function extrairEmail(texto: string): string | undefined {
  const m = texto.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m?.[0];
}

export function extrairDocumento(texto: string): { documento: string; tipo: 'PF' | 'PJ' } | undefined {
  const cnpjMatch = texto.match(/\d{2}[.\-]?\d{3}[.\-]?\d{3}[\/\-]?\d{4}[-]?\d{2}/g);
  if (cnpjMatch) {
    for (const c of cnpjMatch) {
      if (validarCNPJ(c)) return { documento: limparNumero(c), tipo: 'PJ' };
    }
  }
  const cpfMatch = texto.match(/\d{3}[.\-]?\d{3}[.\-]?\d{3}[-]?\d{2}/g);
  if (cpfMatch) {
    for (const c of cpfMatch) {
      if (validarCPF(c)) return { documento: limparNumero(c), tipo: 'PF' };
    }
  }
  return undefined;
}

export function extrairCEP(texto: string): string | undefined {
  const m = texto.match(/\d{5}[-]?\d{3}/);
  return m ? limparNumero(m[0]) : undefined;
}

export function extrairNome(texto: string): string | undefined {
  const padroes = [
    /(?:meu nome é|me chamo|sou [ao]|aqui é|fala[ndo]? com)\s+([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+(?:\s+[A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+)+)/i,
    /(?:empresa|firma|razão social)[:\s]+([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][A-Za-záéíóúàâêîôûãõç\s]+?)(?:\n|,|\.)/i,
    /Olá[,!]?\s+(?:sou|aqui é)\s+([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+(?:\s+[A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+)*)/i,
    /^([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+(?:\s+[A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][a-záéíóúàâêîôûãõç]+)+)[:,\n]/m,
  ];
  for (const p of padroes) {
    const m = texto.match(p);
    if (m?.[1] && m[1].length > 3) return m[1].trim();
  }
  return undefined;
}

export function extrairEmpresa(texto: string): string | undefined {
  const padroes = [
    /(?:empresa|firma|razão social|companhia)[:\s]+([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][A-Za-záéíóúàâêîôûãõç\s&.]+?)(?:\n|,|\.| {2})/i,
    /da\s+([A-ZÁÉÍÓÚÀÂÊÎÔÛÃÕÇ][A-Za-záéíóúàâêîôûãõç\s&.]+(?:Ltda|S\.A\.|ME|EPP|EIRELI))/i,
  ];
  for (const p of padroes) {
    const m = texto.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export function extrairDadosProposta(texto: string): ExtractedProposalData {
  const resultado: ExtractedProposalData = {};
  const palavrasProduto: Record<string, string> = {
    'galpão|galpao': 'Galpão Industrial',
    'cobertura|telhado': 'Cobertura Metálica',
    'portão|portao': 'Portão',
    'grade|gradil': 'Grade/Gradil',
    'escada': 'Escada Metálica',
    'mezanino': 'Mezanino',
    'estrutura metálica|estrutura metalica': 'Estrutura Metálica',
    'cerca|fechamento': 'Cerca/Fechamento',
    'guarda-corpo|guarda corpo': 'Guarda-corpo',
    'toldo|marquise': 'Toldo/Marquise',
    'plataforma': 'Plataforma',
    'corrimão|corrimao': 'Corrimão',
  };
  const textoLower = texto.toLowerCase();
  for (const [padrao, tipo] of Object.entries(palavrasProduto)) {
    if (new RegExp(padrao, 'i').test(textoLower)) { resultado.tipoProduto = tipo; break; }
  }
  const dimMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(?:m(?:etros?)?)?/);
  if (dimMatch) {
    resultado.dimensoes = {
      largura: parseFloat(dimMatch[1].replace(',', '.')),
      comprimento: parseFloat(dimMatch[2].replace(',', '.')),
    };
  }
  const areaMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
  if (areaMatch) {
    if (!resultado.dimensoes) resultado.dimensoes = {};
    resultado.dimensoes.area = parseFloat(areaMatch[1].replace(',', '.'));
  }
  const altMatch = texto.match(/(?:altura|p[eé] direito)[:\s]+(\d+(?:[.,]\d+)?)\s*m/i);
  if (altMatch) {
    if (!resultado.dimensoes) resultado.dimensoes = {};
    resultado.dimensoes.altura = parseFloat(altMatch[1].replace(',', '.'));
  }
  const qtdMatch = texto.match(/(\d+)\s+(?:unidade|pe[çc]a|galpão|portão|escada|grade)/i);
  if (qtdMatch) resultado.quantidade = parseInt(qtdMatch[1]);
  const orcMatch = texto.match(/R\$\s*(\d+(?:[.,]\d+)*(?:\s*(?:mil|k|m))?)/i);
  if (orcMatch) resultado.orcamentoEstimado = orcMatch[0];
  const prazoMatch = texto.match(/(?:prazo|entrega|precis[ao])\s+(?:em\s+)?(\d+\s+(?:dias?|semanas?|meses?)|urgente|imediato|para\s+\w+)/i);
  if (prazoMatch) resultado.prazoMencionado = prazoMatch[1];
  const linhas = texto.split('\n').filter(l => l.trim().length > 20);
  resultado.descricao = linhas.slice(0, 3).join(' ').substring(0, 300);
  return resultado;
}

export async function enriquecerComCNPJ(cnpj: string): Promise<Partial<ExtractedClientData>> {
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!response.ok) return {};
    const data = await response.json();
    return {
      nome: data.nome_fantasia || data.razao_social,
      razaoSocial: data.razao_social,
      telefone: data.ddd_telefone_1 ? limparNumero(data.ddd_telefone_1) : undefined,
      email: data.email?.toLowerCase(),
      logradouro: data.logradouro,
      numero: data.numero,
      bairro: data.bairro,
      cidade: data.municipio,
      uf: data.uf,
      cep: data.cep ? limparNumero(data.cep) : undefined,
      tipo: 'PJ',
    };
  } catch { return {}; }
}

export async function enriquecerComCEP(cep: string): Promise<Partial<ExtractedClientData>> {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) return {};
    const data = await response.json();
    if (data.erro) return {};
    return { logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf };
  } catch { return {}; }
}

export async function extrairDadosWhatsApp(conversa: string): Promise<ExtractionResult> {
  const cliente: ExtractedClientData = { confianca: {} };
  const proposta = extrairDadosProposta(conversa);
  const tel = extrairTelefone(conversa);
  if (tel) { cliente.telefone = tel; cliente.confianca.telefone = 'alto'; }
  const email = extrairEmail(conversa);
  if (email) { cliente.email = email; cliente.confianca.email = 'alto'; }
  const doc = extrairDocumento(conversa);
  if (doc) {
    cliente.documento = doc.documento;
    cliente.tipo = doc.tipo;
    cliente.confianca.documento = 'alto';
    if (doc.tipo === 'PJ') {
      const dadosCNPJ = await enriquecerComCNPJ(doc.documento);
      Object.assign(cliente, dadosCNPJ);
      if (dadosCNPJ.nome) cliente.confianca.nome = 'alto';
      if (dadosCNPJ.logradouro) cliente.confianca.endereco = 'alto';
    }
  }
  if (!cliente.logradouro) {
    const cep = extrairCEP(conversa);
    if (cep) {
      cliente.cep = cep;
      const dadosCEP = await enriquecerComCEP(cep);
      Object.assign(cliente, dadosCEP);
      if (dadosCEP.logradouro) cliente.confianca.endereco = 'medio';
    }
  }
  if (!cliente.nome) {
    const nome = extrairNome(conversa);
    if (nome) { cliente.nome = nome; cliente.confianca.nome = 'medio'; }
  }
  if (!cliente.razaoSocial && cliente.tipo !== 'PF') {
    const empresa = extrairEmpresa(conversa);
    if (empresa) { cliente.razaoSocial = empresa; cliente.confianca.razaoSocial = 'medio'; }
  }
  if (!cliente.tipo) cliente.tipo = 'PF';
  const camposObrigatorios = ['nome', 'telefone', 'email', 'documento', 'logradouro'];
  const camposFaltando = camposObrigatorios.filter(c => !cliente[c as keyof ExtractedClientData]);
  const linhas = conversa.split('\n').filter(l => l.trim().length > 10);
  const resumoConversa = linhas.slice(0, 5).join(' ').substring(0, 400);
  return { cliente, proposta, camposFaltando, resumoConversa };
}
