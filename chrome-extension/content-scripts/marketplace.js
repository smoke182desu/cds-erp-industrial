// content-scripts/marketplace.js — Automacao de postagem no Facebook Marketplace
// Preenche o formulario de listing automaticamente

(async function marketplaceAutoPost() {
  const data = await chrome.storage.local.get('pendingPost');
  const pending = data.pendingPost;
  if (!pending || pending.platform !== 'marketplace') return;

  const content = pending.content;
  if (!content || !content.titulo) return;

  await chrome.storage.local.remove('pendingPost');

  await waitFor(4000); // Marketplace demora mais para carregar

  console.log('[CDS Auto Poster] Iniciando preenchimento Marketplace...');

  function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function setNativeValue(element, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    
    if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Facebook Marketplace usa contenteditable divs e inputs especiais
  // Precisamos lidar com ambos os casos

  async function findAndFill(selectors, value, label) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        if (el.getAttribute('contenteditable') === 'true') {
          el.focus();
          el.textContent = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          setNativeValue(el, value);
        }
        console.log(`[CDS] ${label} preenchido`);
        await waitFor(500);
        return true;
      }
    }
    console.warn(`[CDS] ${label} nao encontrado`);
    return false;
  }

  // Facebook Marketplace form fields - tentamos varios seletores
  // O Marketplace muda o DOM frequentemente, entao usamos multiplos seletores

  // Titulo
  await findAndFill([
    'input[aria-label*="tulo"]',
    'input[aria-label*="Title"]',
    'input[placeholder*="tulo"]',
    'label[aria-label*="tulo"] input',
    'span[data-text="true"]',
  ], content.titulo, 'Titulo');

  await waitFor(800);

  // Preco
  if (content.preco) {
    const precoLimpo = content.preco.replace(/[^\d]/g, '');
    await findAndFill([
      'input[aria-label*="Pre"]',
      'input[aria-label*="Price"]',
      'input[placeholder*="Pre"]',
    ], precoLimpo, 'Preco');
  }

  await waitFor(800);

  // Descricao
  const descCompleta = `${content.descricao}\n\nCDS Industrial - Fabrica Metalica Brasilia/DF\nWhatsApp: (61) 99308-1396\ncdsind.com.br | PIX 7% OFF`;
  await findAndFill([
    'textarea[aria-label*="Descri"]',
    'textarea[aria-label*="Description"]',
    'textarea[placeholder*="Descri"]',
    'div[aria-label*="Descri"][contenteditable="true"]',
  ], descCompleta, 'Descricao');

  await waitFor(800);

  // Localizacao (Brasilia)
  await findAndFill([
    'input[aria-label*="Locali"]',
    'input[aria-label*="Location"]',
    'input[placeholder*="Locali"]',
  ], 'Brasilia, DF', 'Localizacao');

  showNotification('Formulario preenchido! Adicione as fotos e clique em Publicar.');

  chrome.runtime.sendMessage({ action: 'postFilled', platform: 'marketplace', status: 'filled' });

  function showNotification(msg) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;background:#1e3a5f;color:#93c5fd;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:system-ui;';
    div.textContent = '⚡ CDS Auto Poster: ' + msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 8000);
  }
})();
