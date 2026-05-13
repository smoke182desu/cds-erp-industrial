// content-scripts/olx.js — Automacao de postagem na OLX
// Preenche o formulario de anuncio automaticamente

(async function olxAutoPost() {
  // Busca o conteudo pendente do storage
  const data = await chrome.storage.local.get('pendingPost');
  const pending = data.pendingPost;
  if (!pending || pending.platform !== 'olx') return;

  const content = pending.content;
  if (!content || !content.titulo) return;

  // Limpa o pending para nao repetir
  await chrome.storage.local.remove('pendingPost');

  // Aguarda a pagina carregar completamente
  await waitFor(3000);

  console.log('[CDS Auto Poster] Iniciando preenchimento OLX...');

  // A OLX usa React, entao precisamos simular eventos nativos
  function setNativeValue(element, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    
    if (element.tagName === 'TEXTAREA') {
      nativeTextAreaValueSetter.call(element, value);
    } else {
      nativeInputValueSetter.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForSelector(selector, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el) return el;
      await waitFor(300);
    }
    return null;
  }

  // --- PASSO 1: Titulo ---
  const tituloInput = await waitForSelector('input[name="subject"], input[placeholder*="tulo"], input[data-testid="subject-input"]');
  if (tituloInput) {
    setNativeValue(tituloInput, content.titulo);
    console.log('[CDS] Titulo preenchido:', content.titulo);
    await waitFor(500);
  }

  // --- PASSO 2: Descricao ---
  const descInput = await waitForSelector('textarea[name="body"], textarea[placeholder*="Descri"], textarea[data-testid="body-input"]');
  if (descInput) {
    // Monta descricao completa com info da empresa
    const descCompleta = `${content.descricao}\n\n---\nCDS Industrial - Fabrica Metalica em Brasilia/DF\nWhatsApp: (61) 99308-1396\nSite: cdsind.com.br\nPIX: 7% de desconto | Entrega para todo Brasil`;
    setNativeValue(descInput, descCompleta);
    console.log('[CDS] Descricao preenchida');
    await waitFor(500);
  }

  // --- PASSO 3: Preco ---
  if (content.preco) {
    const precoInput = await waitForSelector('input[name="price"], input[placeholder*="pre"], input[data-testid="price-input"]');
    if (precoInput) {
      const precoLimpo = content.preco.replace(/[^\d]/g, '');
      setNativeValue(precoInput, precoLimpo);
      console.log('[CDS] Preco preenchido:', precoLimpo);
      await waitFor(500);
    }
  }

  // --- PASSO 4: CEP (Brasilia) ---
  const cepInput = await waitForSelector('input[name="zipcode"], input[placeholder*="CEP"], input[data-testid="zipcode-input"]');
  if (cepInput) {
    setNativeValue(cepInput, '71215000'); // CEP da CDS em Brasilia
    console.log('[CDS] CEP preenchido');
    await waitFor(500);
  }

  // Notifica o usuario
  showNotification('Formulario preenchido! Confira os dados e clique em Publicar.');

  // Reporta sucesso
  chrome.runtime.sendMessage({ action: 'postFilled', platform: 'olx', status: 'filled' });

  function showNotification(msg) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;background:#065f46;color:#6ee7b7;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:slideIn 0.3s ease;font-family:system-ui;';
    div.textContent = '⚡ CDS Auto Poster: ' + msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 8000);
  }
})();
