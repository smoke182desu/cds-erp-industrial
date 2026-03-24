// ============================================================
// NFeService.ts - Comunicação Direta com SEFAZ (NF-e 4.0)
// CDS Industrial ERP - Protocolo NF-e padrão ABNT/ENCAT
// ============================================================

// ──────────────────────────────────────────────────────────────
//  TIPOS
// ──────────────────────────────────────────────────────────────

export interface CertificadoDigital {
  pfxBase64: string;   // Certificado A1 em base64 (.pfx)
  senha: string;       // Senha do certificado
}

export interface ItemNFe {
  ordem: number;
  codigo: string;
  descricao: string;
  ncm: string;           // NCM com 8 dígitos, ex: "73089010"
  cfop: string;          // CFOP, ex: "5101"
  unidade: string;       // UN, KG, M2, etc.
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  cst?: string;          // CST ICMS (Regime Normal)
  csosn?: string;        // CSOSN (Simples Nacional) - ex: "400"
  aliqIcms?: number;
  baseIcms?: number;
  valorIcms?: number;
  aliqPis?: number;
  valorPis?: number;
  aliqCofins?: number;
  valorCofins?: number;
}

export interface EmissorNFe {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  ie: string;           // Inscrição Estadual
  crt: '1' | '2' | '3'; // 1=Simples, 2=Simples Excesso, 3=Regime Normal
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  codigoMunicipio: string; // IBGE 7 dígitos
  uf: string;
  cep: string;
  telefone?: string;
}

export interface DestinatarioNFe {
  nome: string;
  cnpj?: string;
  cpf?: string;
  ie?: string;
  indIEDest: '1' | '2' | '9'; // 1=Contribuinte IE, 2=Isento, 9=Não contribuinte
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  codigoMunicipio: string;
  uf: string;
  cep: string;
  email?: string;
}

export interface DadosNFe {
  // Cabeçalho
  ambiente: 1 | 2;    // 1=Produção, 2=Homologação
  naturezaOperacao: string; // ex: "VENDA DE MERCADORIA"
  formaPagamento: '0' | '1' | '2' | '3' | '4' | '5' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '90' | '99';
  // 0=À Vista, 1=A Prazo, 15=Boleto, 17=PIX, 99=Sem Pagamento

  // Série e número (controlado pelo sistema)
  serie?: string;     // ex: "001"
  numero?: number;    // Número da NF

  // Partes
  emissor: EmissorNFe;
  destinatario: DestinatarioNFe;
  itens: ItemNFe[];

  // Totais (calculados automaticamente)
  infoAdicionais?: string;

  // Certificado digital
  certificado?: CertificadoDigital;
}

export interface NFeResponse {
  status: 'autorizado' | 'rejeitado' | 'erro' | 'processando';
  chaveAcesso?: string;
  nProtocolo?: string;
  recibo?: string;
  xmlAssinado?: string;
  xmlRetorno?: string;
  danfeUrl?: string;
  mensagem?: string;
  cStat?: string;    // Código de status SEFAZ
  xMotivo?: string;  // Descrição do status SEFAZ
}

// ──────────────────────────────────────────────────────────────
//  URLs dos WebServices SEFAZ por UF (NF-e 4.0)
// ──────────────────────────────────────────────────────────────

const SEFAZ_URLS: Record<string, { producao: string; homologacao: string }> = {
  DF: {
    producao: 'https://nfe.fazenda.df.gov.br/ws/NfeAutorizacao4.asmx',
    homologacao: 'https://nfe-homologacao.fazenda.df.gov.br/ws/NfeAutorizacao4.asmx',
  },
  SP: {
    producao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    homologacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
  },
  MG: {
    producao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
    homologacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
  },
  // SVRS (usada por vários estados: GO, MT, MS, etc.)
  SVRS: {
    producao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    homologacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  },
};

function getSefazUrl(uf: string, ambiente: 1 | 2): string {
  const key = SEFAZ_URLS[uf] ? uf : 'SVRS';
  return ambiente === 1 ? SEFAZ_URLS[key].producao : SEFAZ_URLS[key].homologacao;
}

// ──────────────────────────────────────────────────────────────
//  CONTROLE DE NUMERAÇÃO (localStorage)
// ──────────────────────────────────────────────────────────────

function proximoNumeroNFe(): number {
  const atual = parseInt(localStorage.getItem('@cds-nfe-numero') || '0', 10);
  const proximo = atual + 1;
  localStorage.setItem('@cds-nfe-numero', String(proximo));
  return proximo;
}

// ──────────────────────────────────────────────────────────────
//  FUNÇÕES AUXILIARES
// ──────────────────────────────────────────────────────────────

function padNum(n: number, size: number): string {
  return String(n).padStart(size, '0');
}

function soDigitos(s: string): string {
  return s.replace(/\D/g, '');
}

function formatarMoeda(valor: number): string {
  return valor.toFixed(2);
}

// Dígito verificador da chave NF-e (módulo 11)
function calcularDV(chave43: string): number {
  const pesos = chave43.split('').reverse().map(Number);
  let soma = 0;
  let peso = 2;
  for (const d of pesos) {
    soma += d * peso;
    peso = peso >= 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function gerarCodigoNFe(): string {
  return Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
}

function montarChaveAcesso(dados: DadosNFe, numero: number, serie: string, cNF: string): string {
  const agora = new Date();
  const cUF = dados.emissor.codigoMunicipio.slice(0, 2); // 2 primeiros dígitos do cód município = cUF
  const aamm = `${agora.getFullYear()}${padNum(agora.getMonth() + 1, 2)}`;
  const cnpj = soDigitos(dados.emissor.cnpj);
  const mod = '55'; // NF-e
  const nNF = padNum(numero, 9);
  const serie3 = padNum(parseInt(serie || '1'), 3);
  const tpEmis = '1'; // 1=Normal

  const chave43 = `${cUF}${aamm}${cnpj}${mod}${serie3}${nNF}${tpEmis}${cNF}`;
  const dv = calcularDV(chave43);
  return chave43 + dv;
}

// ──────────────────────────────────────────────────────────────
//  GERAÇÃO DO XML NF-e 4.0
// ──────────────────────────────────────────────────────────────

function gerarXmlNFe(dados: DadosNFe, numero: number, serie: string, chaveAcesso: string, cNF: string): string {
  const agora = new Date();
  const dhEmi = agora.toISOString().slice(0, 19) + '-03:00';
  const cUF = dados.emissor.codigoMunicipio.slice(0, 2);

  // Totais
  const totalProdutos = dados.itens.reduce((s, i) => s + i.valorTotal, 0);
  const totalIcms = dados.itens.reduce((s, i) => s + (i.valorIcms || 0), 0);
  const totalPis = dados.itens.reduce((s, i) => s + (i.valorPis || 0), 0);
  const totalCofins = dados.itens.reduce((s, i) => s + (i.valorCofins || 0), 0);
  const totalNF = totalProdutos;

  // Monta XML dos itens
  const itensXml = dados.itens.map((item) => {
    const isSimples = dados.emissor.crt === '1' || dados.emissor.crt === '2';
    
    const icmsXml = isSimples ? `
          <ICMSSN>
            <ICMSSN${item.csosn || '400'}>
              <orig>0</orig>
              <CSOSN>${item.csosn || '400'}</CSOSN>
            </ICMSSN${item.csosn || '400'}>
          </ICMSSN>` : `
          <ICMS>
            <ICMS${item.cst || '00'}>
              <orig>0</orig>
              <CST>${item.cst || '00'}</CST>
              <modBC>3</modBC>
              <vBC>${formatarMoeda(item.baseIcms || item.valorTotal)}</vBC>
              <pICMS>${formatarMoeda(item.aliqIcms || 0)}</pICMS>
              <vICMS>${formatarMoeda(item.valorIcms || 0)}</vICMS>
            </ICMS${item.cst || '00'}>
          </ICMS>`;

    return `
      <det nItem="${item.ordem}">
        <prod>
          <cProd>${item.codigo}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${item.descricao}</xProd>
          <NCM>${soDigitos(item.ncm)}</NCM>
          <CFOP>${item.cfop}</CFOP>
          <uCom>${item.unidade}</uCom>
          <qCom>${item.quantidade.toFixed(4)}</qCom>
          <vUnCom>${item.valorUnitario.toFixed(10)}</vUnCom>
          <vProd>${formatarMoeda(item.valorTotal)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>${item.unidade}</uTrib>
          <qTrib>${item.quantidade.toFixed(4)}</qTrib>
          <vUnTrib>${item.valorUnitario.toFixed(10)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          ${icmsXml}
          <PIS>
            <PISAliq>
              <CST>07</CST>
              <vBC>${formatarMoeda(item.valorTotal)}</vBC>
              <pPIS>${formatarMoeda(item.aliqPis || 0)}</pPIS>
              <vPIS>${formatarMoeda(item.valorPis || 0)}</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>07</CST>
              <vBC>${formatarMoeda(item.valorTotal)}</vBC>
              <pCOFINS>${formatarMoeda(item.aliqCofins || 0)}</pCOFINS>
              <vCOFINS>${formatarMoeda(item.valorCofins || 0)}</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>`;
  }).join('');

  // Destinatário (CPF ou CNPJ)
  const docDest = dados.destinatario.cnpj
    ? `<CNPJ>${soDigitos(dados.destinatario.cnpj)}</CNPJ>`
    : `<CPF>${soDigitos(dados.destinatario.cpf || '')}</CPF>`;

  const ieDestXml = dados.destinatario.ie
    ? `<IE>${dados.destinatario.ie}</IE>`
    : '';

  const emailDestXml = dados.destinatario.email
    ? `<email>${dados.destinatario.email}</email>`
    : '';

  const infAdicXml = dados.infoAdicionais
    ? `<infAdic><infCpl>${dados.infoAdicionais}</infCpl></infAdic>`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe versao="4.00" Id="NFe${chaveAcesso}">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${cNF}</cNF>
        <natOp>${dados.naturezaOperacao}</natOp>
        <mod>55</mod>
        <serie>${padNum(parseInt(serie || '1'), 3)}</serie>
        <nNF>${padNum(numero, 9)}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${dados.emissor.codigoMunicipio}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${chaveAcesso.slice(-1)}</cDV>
        <tpAmb>${dados.ambiente}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>CDS-ERP-1.0</verProc>
      </ide>
      <emit>
        <CNPJ>${soDigitos(dados.emissor.cnpj)}</CNPJ>
        <xNome>${dados.emissor.razaoSocial}</xNome>
        ${dados.emissor.nomeFantasia ? `<xFant>${dados.emissor.nomeFantasia}</xFant>` : ''}
        <enderEmit>
          <xLgr>${dados.emissor.logradouro}</xLgr>
          <nro>${dados.emissor.numero}</nro>
          <xBairro>${dados.emissor.bairro}</xBairro>
          <cMun>${dados.emissor.codigoMunicipio}</cMun>
          <xMun>${dados.emissor.municipio}</xMun>
          <UF>${dados.emissor.uf}</UF>
          <CEP>${soDigitos(dados.emissor.cep)}</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
          ${dados.emissor.telefone ? `<fone>${soDigitos(dados.emissor.telefone)}</fone>` : ''}
        </enderEmit>
        <IE>${dados.emissor.ie}</IE>
        <CRT>${dados.emissor.crt}</CRT>
      </emit>
      <dest>
        ${docDest}
        <xNome>${dados.destinatario.nome}</xNome>
        <enderDest>
          <xLgr>${dados.destinatario.logradouro}</xLgr>
          <nro>${dados.destinatario.numero}</nro>
          <xBairro>${dados.destinatario.bairro}</xBairro>
          <cMun>${dados.destinatario.codigoMunicipio}</cMun>
          <xMun>${dados.destinatario.municipio}</xMun>
          <UF>${dados.destinatario.uf}</UF>
          <CEP>${soDigitos(dados.destinatario.cep)}</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderDest>
        <indIEDest>${dados.destinatario.indIEDest}</indIEDest>
        ${ieDestXml}
        ${emailDestXml}
      </dest>
      ${itensXml}
      <total>
        <ICMSTot>
          <vBC>${formatarMoeda(0)}</vBC>
          <vICMS>${formatarMoeda(totalIcms)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${formatarMoeda(totalProdutos)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${formatarMoeda(totalPis)}</vPIS>
          <vCOFINS>${formatarMoeda(totalCofins)}</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${formatarMoeda(totalNF)}</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <pag>
        <detPag>
          <tPag>${dados.formaPagamento}</tPag>
          <vPag>${formatarMoeda(totalNF)}</vPag>
        </detPag>
      </pag>
      ${infAdicXml}
    </infNFe>
  </NFe>
</nfeProc>`;

  return xml;
}

// ──────────────────────────────────────────────────────────────
//  ASSINATURA DIGITAL (Web Crypto API)
// ──────────────────────────────────────────────────────────────

async function carregarCertificado(pfxBase64: string, senha: string): Promise<{ privateKey: CryptoKey; certificate: string }> {
  // Importa a lib forge para processar o .pfx (será carregada dinamicamente)
  // A biblioteca node-forge é usada para extrair chave privada e certificado do .pfx
  const forgeScript = 'https://cdn.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js';
  
  if (!(window as any).forge) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = forgeScript;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const forge = (window as any).forge;
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, senha);

  // Extrai chave privada e certificado
  const bags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = bags[forge.pki.oids.certBag]?.[0];
  const certPem = forge.pki.certificateToPem(certBag?.cert);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  const keyPem = forge.pki.privateKeyToPem(keyBag?.key);

  // Importa a chave privada via Web Crypto API
  const keyDer = forge.util.binary.raw.decode(
    forge.pki.pemToDer(keyPem).bytes()
  );
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    false,
    ['sign']
  );

  return { privateKey, certificate: certPem };
}

async function assinarXmlNFe(xml: string, privateKey: CryptoKey, certPem: string): Promise<string> {
  // Extrai apenas o conteúdo de infNFe para assinar
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'text/xml');
  const infNFe = xmlDoc.querySelector('infNFe');
  if (!infNFe) throw new Error('Elemento infNFe não encontrado no XML');

  const infNFeId = infNFe.getAttribute('Id') || '';
  const serializer = new XMLSerializer();
  const infNFeStr = serializer.serializeToString(infNFe);

  // Digest SHA-1 do elemento
  const encoder = new TextEncoder();
  const data = encoder.encode(infNFeStr);
  const digestBuffer = await crypto.subtle.digest('SHA-1', data);
  const digestBase64 = btoa(String.fromCharCode(...new Uint8Array(digestBuffer)));

  // Monta SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
    <Reference URI="#${infNFeId}">
      <Transforms>
        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      </Transforms>
      <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
      <DigestValue>${digestBase64}</DigestValue>
    </Reference>
  </SignedInfo>`;

  // Assina o SignedInfo
  const signedInfoData = encoder.encode(signedInfo);
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    signedInfoData
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  // Extrai conteúdo do certificado (entre os headers PEM)
  const certContent = certPem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\n/g, '');

  // Monta bloco de assinatura XML
  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    ${signedInfo}
    <SignatureValue>${signatureBase64}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certContent}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`;

  // Insere a assinatura dentro de NFe, após infNFe
  return xml.replace('</NFe>', `  ${signature}\n  </NFe>`);
}

// ──────────────────────────────────────────────────────────────
//  ENVIO AO WEBSERVICE SEFAZ (SOAP)
// ──────────────────────────────────────────────────────────────

function montarSOAPNFeAutorizacao(xmlNFe: string, ambiente: 1 | 2, uf: string): string {
  // Remove cabeçalho XML do envelope interno
  const xmlBody = xmlNFe.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>${Date.now()}</idLote>
        <indSinc>1</indSinc>
        ${xmlBody}
      </enviNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function parsearRetornoSEFAZ(xmlRetorno: string): { cStat: string; xMotivo: string; chaveAcesso?: string; nProt?: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlRetorno, 'text/xml');
  
  const cStat = doc.querySelector('cStat')?.textContent || '';
  const xMotivo = doc.querySelector('xMotivo')?.textContent || '';
  const chNFe = doc.querySelector('chNFe')?.textContent || '';
  const nProt = doc.querySelector('nProt')?.textContent || '';

  return { cStat, xMotivo, chaveAcesso: chNFe, nProt };
}

// ──────────────────────────────────────────────────────────────
//  FUNÇÃO PRINCIPAL: TRANSMITIR NF-E
// ──────────────────────────────────────────────────────────────

export async function transmitirNFe(dadosNFe: DadosNFe): Promise<NFeResponse> {
  try {
    // 1. Numerar a NF-e
    const numero = dadosNFe.numero || proximoNumeroNFe();
    const serie = dadosNFe.serie || '001';
    const cNF = gerarCodigoNFe();

    // 2. Montar chave de acesso
    const chaveAcesso = montarChaveAcesso(dadosNFe, numero, serie, cNF);

    // 3. Gerar XML NF-e 4.0
    let xmlNFe = gerarXmlNFe(dadosNFe, numero, serie, chaveAcesso, cNF);

    // 4. Assinar digitalmente (se certificado fornecido)
    if (dadosNFe.certificado) {
      try {
        const { privateKey, certificate } = await carregarCertificado(
          dadosNFe.certificado.pfxBase64,
          dadosNFe.certificado.senha
        );
        xmlNFe = await assinarXmlNFe(xmlNFe, privateKey, certificate);
      } catch (certError) {
        console.error('Erro ao assinar com certificado:', certError);
        // Em homologação pode continuar sem assinatura para testes
        if (dadosNFe.ambiente === 1) {
          return {
            status: 'erro',
            mensagem: `Erro ao processar certificado digital: ${certError instanceof Error ? certError.message : 'Erro desconhecido'}. Verifique se o arquivo .pfx e a senha estão corretos.`
          };
        }
      }
    }

    // 5. Em HOMOLOGAÇÃO sem certificado → retorna XML gerado para visualização
    if (dadosNFe.ambiente === 2 && !dadosNFe.certificado) {
      return {
        status: 'processando',
        chaveAcesso,
        xmlAssinado: xmlNFe,
        mensagem: 'XML NF-e gerado com sucesso. Para transmitir à SEFAZ, configure o Certificado Digital A1 nas Configurações.',
      };
    }

    // 6. Montar envelope SOAP e enviar ao WebService SEFAZ
    const soapEnvelope = montarSOAPNFeAutorizacao(xmlNFe, dadosNFe.ambiente, dadosNFe.emissor.uf);
    const urlSefaz = getSefazUrl(dadosNFe.emissor.uf, dadosNFe.ambiente);

    const response = await fetch(urlSefaz, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      throw new Error(`WebService SEFAZ retornou HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlRetorno = await response.text();
    const retorno = parsearRetornoSEFAZ(xmlRetorno);

    // 7. cStat 100 = Autorizado; 150 = Autorizado fora de prazo
    if (retorno.cStat === '100' || retorno.cStat === '150') {
      return {
        status: 'autorizado',
        chaveAcesso: retorno.chaveAcesso || chaveAcesso,
        nProtocolo: retorno.nProt,
        xmlAssinado: xmlNFe,
        xmlRetorno,
        cStat: retorno.cStat,
        xMotivo: retorno.xMotivo,
        mensagem: `NF-e Autorizada! Protocolo: ${retorno.nProt}`,
      };
    } else {
      return {
        status: 'rejeitado',
        chaveAcesso,
        xmlAssinado: xmlNFe,
        xmlRetorno,
        cStat: retorno.cStat,
        xMotivo: retorno.xMotivo,
        mensagem: `Rejeição SEFAZ ${retorno.cStat}: ${retorno.xMotivo}`,
      };
    }
  } catch (error) {
    console.error('[NFeService] Erro ao transmitir NF-e:', error);
    return {
      status: 'erro',
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido ao transmitir NF-e.',
    };
  }
}
// ──────────────────────────────────────────────────────────────────────────────
//  GERAÇÃO DE DANFE A4 — PADRÃO SEFAZ NF-e MODELO 55
// ──────────────────────────────────────────────────────────────────────────────

export function gerarDanfeHTML(dados: DadosNFe, resultado: NFeResponse): string {
  const totalNF     = dados.itens.reduce((s, i) => s + i.valorTotal, 0);
  const totalIcms   = dados.itens.reduce((s, i) => s + ((i as any).valorIcms   || 0), 0);
  const totalPis    = dados.itens.reduce((s, i) => s + ((i as any).valorPis    || 0), 0);
  const totalCofins = dados.itens.reduce((s, i) => s + ((i as any).valorCofins || 0), 0);
  const agora     = new Date();
  const dhEmissao = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const chaveGrupos = (resultado.chaveAcesso || '').match(/.{1,4}/g)?.join(' ') || '—';
  const isHomologacao = dados.ambiente === 2;
  const numSerie = String((dados as any).numero || 1).padStart(9, '0');
  const serie    = ((dados as any).serie || '001').padStart(3, '0');
  const pgto = (dados as any).formaPagamento || '';
  const pgtoLabel = pgto === '17' ? 'PIX' : pgto === '1' ? 'Dinheiro' : pgto === '3' ? 'Cartão de Crédito' :
                    pgto === '4' ? 'Cartão de Débito' : pgto === '15' ? 'Boleto' : pgto === '2' ? 'Cheque' : 'Outro';

  const wm = isHomologacao
    ? `.danfe::before{content:"SEM VALOR FISCAL";position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:60pt;color:rgba(255,180,0,.10);font-weight:bold;white-space:nowrap;pointer-events:none;z-index:0}`
    : '';
  const ambBg  = isHomologacao ? '#FFF3CD' : '#D4EDDA';
  const ambFg  = isHomologacao ? '#856404' : '#155724';
  const ambMsg = isHomologacao
    ? '⚠ EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL ⚠'
    : '✔ NOTA FISCAL ELETRÔNICA — AMBIENTE DE PRODUÇÃO';

  const itensRows = dados.itens.map((item, idx) => `
    <tr>
      <td style="text-align:center">${String(idx + 1).padStart(3, '0')}</td>
      <td>${item.codigo}</td>
      <td>${item.descricao}</td>
      <td style="text-align:center">${item.ncm}</td>
      <td style="text-align:center">${(item as any).csosn || (item as any).cst || ''}</td>
      <td style="text-align:center">${item.cfop}</td>
      <td style="text-align:center">${item.unidade}</td>
      <td style="text-align:right">${item.quantidade.toFixed(4)}</td>
      <td style="text-align:right">${item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
      <td style="text-align:right">0,00</td>
      <td style="text-align:right">0,00</td>
      <td style="text-align:right;font-weight:bold">${item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right">${((item as any).aliqIcms  || 0).toFixed(2)}</td>
      <td style="text-align:right">${((item as any).valorIcms || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE - NF-e ${resultado.chaveAcesso || ''}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#000;background:#fff}
    .danfe{width:210mm;min-height:297mm;margin:0 auto;padding:5mm;background:#fff}
    ${wm}
    .lbl{font-size:5.5pt;color:#444;text-transform:uppercase;font-weight:bold;padding:1mm 1.5mm 0;display:block;letter-spacing:.02em}
    .val{font-size:7.5pt;padding:.5mm 1.5mm 1mm;display:block}
    .val-b{font-size:8pt;font-weight:bold;padding:.5mm 1.5mm 1mm;display:block}
    .hdr{display:flex;border:.5pt solid #000}
    .hdr-emit{flex:0 0 65mm;padding:2mm;border-right:.5pt solid #000}
    .hdr-emit .rzs{font-size:9pt;font-weight:bold;line-height:1.3}
    .hdr-emit .inf{font-size:6.5pt;margin-top:1mm;line-height:1.5}
    .hdr-d{flex:0 0 44mm;text-align:center;border-right:.5pt solid #000;padding:1.5mm;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .hdr-d .tit{font-size:12pt;font-weight:bold;letter-spacing:2px}
    .hdr-d .sub{font-size:6pt;line-height:1.4;margin:.7mm 0}
    .hdr-d .nnum{font-size:8pt;font-weight:bold;margin-top:.7mm}
    .hdr-k{flex:1;padding:1.5mm}
    .chave{font-size:6.5pt;font-family:'Courier New',monospace;font-weight:bold;word-break:break-all;margin:.8mm 0;letter-spacing:.4px}
    .cons{font-size:5pt;color:#555;margin-top:.5mm}
    .amb{border:.5pt solid #000;border-top:none;text-align:center;padding:1mm;font-size:6.5pt;font-weight:bold;letter-spacing:.7px;background:${ambBg};color:${ambFg}}
    .row{display:flex;border:.5pt solid #000;border-top:none}
    .cel{border-right:.5pt solid #000}
    .cel:last-child{border-right:none}
    .sec{border:.5pt solid #000;border-top:none}
    .sec-h{background:#F0F0F0;border-bottom:.5pt solid #000;padding:.8mm 1.5mm;font-size:6pt;font-weight:bold;text-transform:uppercase;text-align:center;letter-spacing:.4px}
    .sec-b{display:flex;flex-wrap:wrap}
    .sec-b .f{border-right:.5pt solid #000;border-bottom:.5pt solid #000}
    .sec-b .f:last-child{border-right:none}
    .ptbl{width:100%;border-collapse:collapse;font-size:6.5pt}
    .ptbl th{background:#EBEBEB;border:.3pt solid #666;padding:.8mm .6mm;text-align:center;font-size:5.5pt;font-weight:bold;text-transform:uppercase;line-height:1.1}
    .ptbl td{border:.3pt solid #bbb;padding:.6mm .6mm;vertical-align:top}
    .tot-r{display:flex;border:.5pt solid #000;border-top:none}
    .tot-l{flex:1;border-right:.5pt solid #000}
    .tot-v{width:55mm;background:#000;padding:2.5mm 3mm;display:flex;flex-direction:column;justify-content:center}
    @media print{html,body{margin:0;padding:0;background:#fff}.danfe{width:100%;padding:5mm;min-height:auto}.prt{display:none!important}@page{size:A4 portrait;margin:5mm}}
    @media screen{body{background:#9ca3af}.danfe{box-shadow:0 4px 24px rgba(0,0,0,.3);margin:8mm auto}}
  </style>
</head>
<body>
<div class="danfe">
<div class="hdr">
  <div class="hdr-emit">
    <div class="rzs">${dados.emissor.razaoSocial}</div>
    <div class="inf">
      ${dados.emissor.logradouro}, ${dados.emissor.numero}${dados.emissor.bairro ? ' — ' + dados.emissor.bairro : ''}<br>
      ${dados.emissor.municipio} / ${dados.emissor.uf} — CEP: ${dados.emissor.cep}<br>
      CNPJ: <strong>${dados.emissor.cnpj}</strong> &nbsp; IE: ${dados.emissor.ie}
      ${dados.emissor.telefone ? '<br>Fone: ' + dados.emissor.telefone : ''}
    </div>
  </div>
  <div class="hdr-d">
    <div class="tit">DANFE</div>
    <div class="sub">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
    <div style="font-size:5.5pt;margin:.5mm 0">
      <span style="background:#eee;padding:1px 4px;border:.3pt solid #999">Entrada <b>0</b></span>
      &nbsp;
      <span style="background:#000;color:#fff;padding:1px 4px">Saída <b>1</b></span>
    </div>
    <div class="nnum">Nº ${numSerie}</div>
    <div style="font-size:6pt">Série: ${serie} &nbsp; Folha: 1/1</div>
  </div>
  <div class="hdr-k">
    <span class="lbl">Chave de Acesso</span>
    <div class="chave">${chaveGrupos}</div>
    <div class="cons">Consulte em: www.nfe.fazenda.gov.br ou no site da SEFAZ autorizadora</div>
    <div style="margin-top:2mm">
      <span class="lbl">Protocolo de Autorização</span>
      <div class="val">${resultado.nProtocolo || '—'} ${resultado.nProtocolo ? '· ' + dhEmissao : ''}</div>
    </div>
  </div>
</div>
<div class="amb">${ambMsg}</div>
<div class="row">
  <div class="cel" style="flex:2"><span class="lbl">Natureza da Operação</span><span class="val-b">${dados.naturezaOperacao}</span></div>
  <div class="cel" style="flex:1"><span class="lbl">Forma de Pagamento</span><span class="val">${pgtoLabel}</span></div>
  <div class="cel" style="flex:1;border-right:none"><span class="lbl">Data de Emissão</span><span class="val">${dhEmissao}</span></div>
</div>
<div class="sec">
  <div class="sec-h">Emitente</div>
  <div class="sec-b">
    <div class="f" style="flex:3"><span class="lbl">Nome / Razão Social</span><span class="val-b">${dados.emissor.razaoSocial}</span></div>
    <div class="f" style="flex:1"><span class="lbl">CNPJ</span><span class="val">${dados.emissor.cnpj}</span></div>
    <div class="f" style="flex:1;border-right:none"><span class="lbl">Insc. Estadual</span><span class="val">${dados.emissor.ie}</span></div>
    <div class="f" style="flex:2"><span class="lbl">Endereço</span><span class="val">${dados.emissor.logradouro}, ${dados.emissor.numero}</span></div>
    <div class="f" style="flex:1"><span class="lbl">Bairro</span><span class="val">${dados.emissor.bairro}</span></div>
    <div class="f" style="flex:1"><span class="lbl">CEP</span><span class="val">${dados.emissor.cep}</span></div>
    <div class="f" style="flex:1"><span class="lbl">Município</span><span class="val">${dados.emissor.municipio}</span></div>
    <div class="f" style="flex:0 0 10mm"><span class="lbl">UF</span><span class="val">${dados.emissor.uf}</span></div>
    <div class="f" style="flex:1"><span class="lbl">Fone</span><span class="val">${dados.emissor.telefone || '—'}</span></div>
    <div class="f" style="flex:1;border-right:none"><span class="lbl">CRT</span><span class="val">${dados.emissor.crt === '1' ? '1 – Simples Nacional' : dados.emissor.crt === '2' ? '2 – Simples Excesso' : '3 – Regime Normal'}</span></div>
  </div>
</div>
<div class="sec">
  <div class="sec-h">Destinatário / Remetente</div>
  <div class="sec-b">
    <div class="f" style="flex:3"><span class="lbl">Nome / Razão Social</span><span class="val-b">${dados.destinatario.nome}</span></div>
    <div class="f" style="flex:1"><span class="lbl">${dados.destinatario.cnpj ? 'CNPJ' : 'CPF'}</span><span class="val">${dados.destinatario.cnpj || dados.destinatario.cpf || '—'}</span></div>
    <div class="f" style="flex:1;border-right:none"><span class="lbl">Insc. Estadual</span><span class="val">${dados.destinatario.ie || 'ISENTO'}</span></div>
    <div class="f" style="flex:2"><span class="lbl">Endereço</span><span class="val">${dados.destinatario.logradouro}, ${dados.destinatario.numero}</span></div>
    <div class="f" style="flex:1"><span class="lbl">Bairro</span><span class="val">${dados.destinatario.bairro}</span></div>
    <div class="f" style="flex:1"><span class="lbl">CEP</span><span class="val">${dados.destinatario.cep}</span></div>
    <div class="f" style="flex:1"><span class="lbl">Município</span><span class="val">${dados.destinatario.municipio}</span></div>
    <div class="f" style="flex:0 0 10mm"><span class="lbl">UF</span><span class="val">${dados.destinatario.uf}</span></div>
    <div class="f" style="flex:1;border-right:none"><span class="lbl">E-mail</span><span class="val">${dados.destinatario.email || '—'}</span></div>
  </div>
</div>
<div class="sec">
  <div class="sec-h">Dados dos Produtos / Serviços</div>
  <table class="ptbl">
    <thead><tr>
      <th style="width:8mm">Nº</th><th style="width:13mm">Código</th>
      <th>Descrição do Produto / Serviço</th>
      <th style="width:13mm">NCM/SH</th><th style="width:9mm">CST/<br>CSOSN</th>
      <th style="width:9mm">CFOP</th><th style="width:8mm">Un.</th>
      <th style="width:16mm">Qtd.</th><th style="width:18mm">Vl. Unit.</th>
      <th style="width:13mm">Vl. Desc.</th><th style="width:13mm">Vl. Frete</th>
      <th style="width:18mm">Vl. Total</th><th style="width:11mm">% ICMS</th>
      <th style="width:14mm">Vl. ICMS</th>
    </tr></thead>
    <tbody>${itensRows}</tbody>
  </table>
</div>
<div class="tot-r">
  <div class="tot-l">
    <div style="display:flex;border-bottom:.3pt solid #bbb">
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">BC ICMS</span><span class="val" style="text-align:right">R$ 0,00</span></div>
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">Valor ICMS</span><span class="val" style="text-align:right">R$ ${totalIcms.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">BC ICMS ST</span><span class="val" style="text-align:right">R$ 0,00</span></div>
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">Valor ICMS ST</span><span class="val" style="text-align:right">R$ 0,00</span></div>
      <div style="flex:1;padding:.5mm 1.2mm"><span class="lbl">Trib. Aprox.</span><span class="val" style="text-align:right">R$ ${(totalPis+totalCofins+totalIcms).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
    </div>
    <div style="display:flex">
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">Valor Frete</span><span class="val" style="text-align:right">R$ 0,00</span></div>
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">Valor Seguro</span><span class="val" style="text-align:right">R$ 0,00</span></div>
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">Desconto</span><span class="val" style="text-align:right">R$ 0,00</span></div>
      <div style="flex:1;border-right:.3pt solid #bbb;padding:.5mm 1.2mm"><span class="lbl">Outras Despesas</span><span class="val" style="text-align:right">R$ 0,00</span></div>
      <div style="flex:1;padding:.5mm 1.2mm"><span class="lbl">Valor IPI</span><span class="val" style="text-align:right">R$ 0,00</span></div>
    </div>
  </div>
  <div class="tot-v">
    <div style="color:#aaa;font-size:5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.5px">Valor Total da NF-e</div>
    <div style="color:#fff;font-size:13pt;font-weight:bold;text-align:right;margin-top:1mm">R$ ${totalNF.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
  </div>
</div>
<div class="sec">
  <div class="sec-h">Transportador / Volumes Transportados</div>
  <div class="sec-b">
    <div class="f" style="flex:2"><span class="lbl">Razão Social</span><span class="val">—</span></div>
    <div class="f" style="flex:1"><span class="lbl">CNPJ / CPF</span><span class="val">—</span></div>
    <div class="f" style="flex:1"><span class="lbl">Modalidade do Frete</span><span class="val">9 – Sem Frete</span></div>
    <div class="f" style="flex:1;border-right:none"><span class="lbl">Placa do Veículo</span><span class="val">—</span></div>
  </div>
</div>
<div class="sec">
  <div class="sec-h">Dados Adicionais</div>
  <div style="display:flex;min-height:18mm">
    <div style="flex:2;border-right:.3pt solid #bbb;padding:1.5mm">
      <span class="lbl">Informações Complementares</span>
      <div style="font-size:7pt;margin-top:1mm;line-height:1.4">
        ${dados.infoAdicionais || '—'}
        ${isHomologacao ? '<br><strong>NOTA DE HOMOLOGAÇÃO — NÃO POSSUI VALOR FISCAL</strong>' : ''}
      </div>
    </div>
    <div style="flex:1;padding:1.5mm"><span class="lbl">Reservado ao Fisco</span></div>
  </div>
</div>
<div style="border:.5pt solid #000;border-top:none;padding:1.2mm;font-size:5.5pt;color:#555;text-align:center">
  Consulte a autenticidade em: <strong>www.nfe.fazenda.gov.br</strong> &nbsp;|&nbsp; CDS Industrial ERP &nbsp;|&nbsp; ${dhEmissao}
</div>
</div>
<div class="prt" style="margin:5mm auto;display:flex;justify-content:center;gap:8px">
  <button onclick="window.print()" style="padding:8px 28px;font-size:12px;font-weight:bold;cursor:pointer;border:none;border-radius:6px;background:#1a56db;color:#fff">Imprimir / Salvar PDF (A4)</button>
  <button onclick="window.close()" style="padding:8px 20px;font-size:12px;cursor:pointer;border:none;border-radius:6px;background:#e5e7eb;color:#111">Fechar</button>
</div>
</body>
</html>`;
}

export function downloadXml(xmlContent: string, chaveAcesso: string): void {
  const blob = new Blob([xmlContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NFe_${chaveAcesso}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

export function abrirDanfe(dados: DadosNFe, resultado: NFeResponse): void {
  const html = gerarDanfeHTML(dados, resultado);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
