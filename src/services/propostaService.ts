export interface ItemProposta {
  nome: string;
  descricao?: string;
  qtd: number;
  valorUnitario: number;
}

export interface PropostaDados {
  numero?: number;
  data?: string;        // DD/MM/YYYY - preenchido automaticamente se vazio
  empresa?: string;     // pode vir vazio — sai em branco mas a proposta sai
  ac?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  cep?: string;
  local?: string;
  vendedor?: string;
  contato?: string;
  validade?: string;
  frete?: string;
  intro?: string;
  itens?: ItemProposta[]; // pode vir vazio — tabela sai s/ linhas
  pagamento?: string;
  prazoEntrega?: string;
}

// ---------- Contador sequencial via REST ----------
export async function proximoNumeroProposta(): Promise<number> {
  try {
    const r = await fetch('/api/config?col=config&doc=proposta_counter');
    const d = await r.json();
    const atual = d.data?.numero ?? 42;
    const proximo = Number(atual) + 1;
    await fetch('/api/config?col=config&doc=proposta_counter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: proximo }),
    });
    return proximo;
  } catch {
    return Date.now() % 10000; // fallback: número baseado em timestamp
  }
}

// ---------- Helpers ----------
function fmtBR(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function pad2(n: number): string { return String(n).padStart(2, '0'); }
function hojeStr(): string {
  const d = new Date();
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}
function refNum(num: number, dataStr?: string): string {
  let mes = new Date().getMonth() + 1;
  let ano = new Date().getFullYear();
  if (dataStr) {
    const parts = dataStr.split('/');
    if (parts.length === 3) { mes = parseInt(parts[1]); ano = parseInt(parts[2]); }
  }
  return pad2(num) + '/' + pad2(mes) + '/' + ano;
}
function sub(itens: ItemProposta[]): number {
  if (!itens || itens.length === 0) return 0;
  return itens.reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valorUnitario) || 0), 0);
}
function il(label: string, value?: string): string {
  return '<div class="info-line"><span class="label">' + label + '</span>' +
    '<span class="value' + (value ? '' : ' auto-dash') + '">' + (value || '') + '</span></div>';
}
function rows(itens: ItemProposta[]): string {
  if (!itens || itens.length === 0) {
    // Sem itens: emite uma linha em branco pra a estrutura nao quebrar
    return '<tr><td><span class="item-name">—</span>' +
      '<span class="item-desc">A definir</span></td>' +
      '<td class="col-qty">—</td>' +
      '<td class="col-valor">—</td>' +
      '<td class="col-valor">—</td></tr>';
  }
  return itens.map(it => {
    const qtd = Number(it.qtd) || 0;
    const vu  = Number(it.valorUnitario) || 0;
    const t   = qtd * vu;
    return '<tr><td><span class="item-name">' + (it.nome || '—') + '</span>' +
      (it.descricao ? '<span class="item-desc">' + it.descricao + '</span>' : '') +
      '</td><td class="col-qty">' + (qtd || '—') +
      '</td><td class="col-valor">' + fmtBR(vu) +
      '</td><td class="col-valor">' + fmtBR(t) + '</td></tr>';
  }).join('');
}

// ---------- Gerar HTML completo ----------
// SEMPRE devolve HTML, mesmo se vier sem empresa, sem itens, sem nada.
// Campos vazios viram "—" no template.
export function gerarPropostaHTML(d: PropostaDados): string {
  d = d || ({} as PropostaDados);
  const dataStr   = d.data || hojeStr();
  const numStr    = d.numero ? refNum(d.numero, d.data) : '—';
  const freteStr  = d.frete || 'À combinar';
  const itensSeguros: ItemProposta[] = Array.isArray(d.itens) ? d.itens : [];
  const subtotal  = sub(itensSeguros);
  const empresaStr = (d.empresa || '').trim();

  const hdr = '<header class="header"><div class="logo-box">' +
    '<img src="https://cdsind.com.br/wp-content/uploads/2025/11/cropped-20251105_1919_Logotipo-Azul-Minimalista_remix_01k9b1kffgfqwacrv1sthe5q9f.png?x54102" alt="CDS Industrial">' +
    '</div><div class="company-info"><strong>CDS INDUSTRIAL</strong><br>' +
    'CNPJ: 31.834.899/0001-71<br>SHIN, Trecho 3-A, Lote 18, Lago Norte<br>' +
    'Brasília - DF, CEP 71538-505<br>(61) 99308-1396 • vendas01@cdsind.com.br</div></header>';

  const topBar = '<div class="top-bar"><div><h1 class="main-title">Proposta Comercial</h1>' +
    '<div class="ref-number">Ref: ' + numStr + '</div></div>' +
    '<div class="status-badge">Data: ' + dataStr + '</div></div>';

  const ft = (p: number) => '<footer class="footer"><div class="footer-inner">' +
    '<div class="footer-left"></div>' +
    '<div class="footer-center">CDS Industrial - Soluções em Aço e Engenharia • www.cdsind.com.br • Brasília/DF</div>' +
    '<div class="footer-right">Página ' + p + '/2</div></div></footer>';

  const introDefault = 'Prezado(a),<br><br>Em atendimento ao contato realizado, apresentamos nossa proposta comercial' +
    (empresaStr ? ' para <strong>' + empresaStr + '</strong>' : '') +
    ', conforme especificação abaixo.';

  const page1 = '<section class="page">' + hdr + '<div class="content">' + topBar +
    '<div class="client-grid"><div><div class="box-title">Destinatário (Cliente)</div>' +
    il('Empresa:', empresaStr) + il('A/C:', d.ac) + il('CNPJ/CPF:', d.cnpj) +
    il('Email:', d.email) + il('Telefone:', d.telefone) +
    il('Endereço:', d.endereco) + il('Cidade/UF:', d.cidade) + il('CEP:', d.cep) +
    '</div><div><div class="box-title">Detalhes do Projeto</div>' +
    il('Local:', d.local || empresaStr) + il('Vendedor:', d.vendedor || 'Jean') +
    il('Validade:', d.validade || '7 dias corridos') + il('Frete:', freteStr) +
    il('Contato:', d.contato || d.telefone) + '</div></div>' +
    '<div class="intro">' + (d.intro || introDefault) + '</div>' +
    '<table><thead><tr><th>Item / Descrição</th><th class="col-qty">Qtd.</th>' +
    '<th class="col-valor">Unitário</th><th class="col-valor">Total</th></tr></thead>' +
    '<tbody>' + rows(itensSeguros) + '</tbody></table>' +
    '<div class="totals-area"><div class="totals-box">' +
    '<div class="t-row"><span>Subtotal:</span><span>' + fmtBR(subtotal) + '</span></div>' +
    '<div class="t-row"><span>Frete:</span><span>' + freteStr + '</span></div>' +
    '<div class="t-row final"><span>TOTAL:</span><span>' + fmtBR(subtotal) + '</span></div>' +
    '</div></div></div>' + ft(1) + '</section>';

  const page2 = '<section class="page">' + hdr + '<div class="content">' + topBar +
    '<div class="info-cols"><div><div class="box-title">Condições Comerciais</div><ul class="cond-list">' +
    '<li><strong>Pagamento:</strong> ' + (d.pagamento || 'A definir em comum acordo.') + '</li>' +
    '<li><strong>Prazo de Entrega:</strong> ' + (d.prazoEntrega || 'A confirmar após aceite formal.') + '</li>' +
    '<li><strong>Frete:</strong> ' + freteStr + ' (conforme endereço e condições de descarga).</li>' +
    '<li><strong>Garantia:</strong> 90 dias contra defeitos de fabricação.</li>' +
    '<li><strong>Impostos:</strong> contemplados na Nota Fiscal emitida.</li>' +
    '</ul></div><div><div class="box-title">Dados para Pagamento</div>' +
    '<div class="bank-box"><div class="bank-title">Asaas I.P S.A</div><div class="bank-info">' +
    'Banco: <strong>461 - Asaas I.P S.A</strong><br>Agência: <strong>0001</strong><br>' +
    'Conta: <strong>4691287-9</strong><br>Tipo: <strong>Conta de Pagamento</strong><br><br>' +
    'Nome: <strong>Clark Jean Martins Genu</strong><br>CPF/CNPJ: <strong>31.834.899/0001-71</strong><br><br>' +
    'PIX (CNPJ): <strong>31.834.899/0001-71</strong><br>PIX (E-mail): <strong>vendas01@cdsind.com.br</strong>' +
    '</div></div></div></div>' +
    '<div class="signature-area">' +
    '<div class="sign-line"><strong>CDS INDUSTRIAL</strong><br>Departamento Comercial</div>' +
    '<div class="sign-line"><strong>DE ACORDO (CLIENTE)</strong><br>Data: ____/____/________</div>' +
    '</div></div>' + ft(2) + '</section>';

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<title>Proposta - ' + (empresaStr || 'Cliente') + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<style>' + CSS_PROPOSTA + '</style></head><body>' +
    page1 + page2 + '</body></html>';
}

// ---------- Abrir proposta em nova aba ----------
export function abrirProposta(dados: PropostaDados): void {
  const html = gerarPropostaHTML(dados);
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ---------- CSS da proposta (extraído do template original) ----------
const CSS_PROPOSTA = ':root{--primary-color:#003B73;--accent-color:#FFC400;--text-dark:#111827;--text-gray:#4B5563;' +
  '--bg-page:#F3F4F6;--page-w:210mm;--page-h:297mm;--footer-h:16mm;--content-pad:14mm;}' +
  '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
  'body{margin:0;padding:24px 16px;background:var(--bg-page);font-family:Inter,sans-serif;' +
  'color:var(--text-dark);line-height:1.5;}' +
  '.page{width:var(--page-w);height:var(--page-h);margin:0 auto 18px;background:#fff;position:relative;' +
  'box-shadow:0 10px 30px rgba(0,0,0,.08);overflow:hidden;break-after:page;page-break-after:always;}' +
  '.page:last-child{break-after:auto;page-break-after:auto;}' +
  '.header{background:var(--primary-color);color:#fff;padding:12mm var(--content-pad);' +
  'display:flex;justify-content:space-between;position:relative;}' +
  '.header::after{content:"";position:absolute;bottom:0;left:0;width:100%;height:4px;background:var(--accent-color);}' +
  '.logo-box{background:#fff;padding:8px 12px;border-radius:4px;display:inline-block;align-self:flex-start;}' +
  '.logo-box img{height:45px;display:block;}' +
  '.company-info{text-align:right;font-size:11px;opacity:.95;line-height:1.4;}' +
  '.company-info strong{font-size:13px;color:#fff;}' +
  '.content{padding:var(--content-pad);padding-bottom:calc(var(--footer-h) + var(--content-pad));}' +
  '.top-bar{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10mm;' +
  'border-bottom:1px solid #E5E7EB;padding-bottom:5mm;}' +
  '.main-title{font-size:26px;color:var(--primary-color);font-weight:700;margin:0;text-transform:uppercase;}' +
  '.ref-number{font-size:14px;color:var(--text-gray);font-weight:500;}' +
  '.status-badge{background:#EFF6FF;color:var(--primary-color);padding:5px 10px;border-radius:4px;' +
  'font-size:12px;font-weight:600;border:1px solid #DBEAFE;}' +
  '.client-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:8mm;}' +
  '.box-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;' +
  'margin-bottom:10px;border-bottom:1px solid #E5E7EB;padding-bottom:4px;}' +
  '.info-line{display:flex;margin-bottom:6px;font-size:13px;gap:10px;}' +
  '.label{width:110px;color:var(--text-gray);font-weight:500;flex-shrink:0;}' +
  '.value{font-weight:600;color:var(--text-dark);min-height:18px;}' +
  '.value.auto-dash:empty::before{content:"—";color:#9CA3AF;font-weight:700;}' +
  '.intro{margin-bottom:8mm;font-size:13px;color:var(--text-gray);text-align:justify;}' +
  'table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8mm;}' +
  'th{text-align:left;padding:10px;background:#F9FAFB;color:var(--text-gray);' +
  'text-transform:uppercase;font-size:11px;font-weight:600;border-bottom:2px solid #E5E7EB;}' +
  'td{padding:12px 10px;border-bottom:1px solid #E5E7EB;vertical-align:top;}' +
  '.col-valor{text-align:right;white-space:nowrap;width:15%;}' +
  '.col-qty{text-align:center;width:8%;}' +
  '.item-name{font-weight:700;color:var(--primary-color);display:block;font-size:13px;margin-bottom:4px;}' +
  '.item-desc{display:block;color:var(--text-gray);line-height:1.4;}' +
  '.totals-area{display:flex;justify-content:flex-end;margin-bottom:2mm;}' +
  '.totals-box{width:300px;}' +
  '.t-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-gray);}' +
  '.t-row.final{border-top:2px solid var(--primary-color);margin-top:8px;padding-top:12px;' +
  'font-size:18px;color:var(--primary-color);font-weight:700;}' +
  '.info-cols{display:grid;grid-template-columns:1.2fr 0.8fr;gap:30px;margin-bottom:10mm;}' +
  '.cond-list{list-style:none;padding:0;margin:0;font-size:12px;color:var(--text-gray);}' +
  '.cond-list li{margin-bottom:6px;padding-left:12px;position:relative;}' +
  '.cond-list li::before{content:"•";color:var(--accent-color);position:absolute;left:0;font-weight:700;}' +
  '.bank-box{background:#F8FAFC;padding:15px;border-radius:6px;border:1px solid #E2E8F0;}' +
  '.bank-title{font-size:12px;font-weight:700;color:var(--primary-color);margin-bottom:8px;text-transform:uppercase;}' +
  '.bank-info{font-size:12px;color:var(--text-dark);line-height:1.6;}' +
  '.signature-area{margin-top:8mm;border-top:1px dashed #CBD5E1;padding-top:7mm;' +
  'display:flex;justify-content:space-between;align-items:flex-end;gap:18px;}' +
  '.sign-line{width:45%;border-top:1px solid #000;padding-top:8px;text-align:center;font-size:11px;color:#000;}' +
  '.footer{position:absolute;left:0;bottom:0;width:100%;height:var(--footer-h);background:#F1F5F9;' +
  'border-top:1px solid #E2E8F0;display:flex;align-items:center;justify-content:center;padding:0 var(--content-pad);}' +
  '.footer-inner{width:100%;display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center;' +
  'gap:8px;font-size:10px;color:#64748B;}' +
  '.footer-left{text-align:left;}.footer-center{text-align:center;}' +
  '.footer-right{text-align:right;font-weight:600;color:#475569;}' +
  '@page{size:A4;margin:0;}' +
  '@media print{body{padding:0;background:#fff;}.page{margin:0;box-shadow:none;}}';
