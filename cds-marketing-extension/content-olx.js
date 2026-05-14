chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FILL_FORM') {
    const data = request.postData;
    let success = false;

    try {
      // 1. Preencher Título
      // OLX geralmente usa input com id/name "subject"
      const titleInput = document.querySelector('input[name="subject"], input[id="subject"], input[placeholder*="título" i]');
      if (titleInput) {
        titleInput.value = data.titulo || '';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 2. Preencher Descrição
      // OLX usa textarea id/name "body"
      const descInput = document.querySelector('textarea[name="body"], textarea[id="body"], textarea[placeholder*="descrição" i]');
      if (descInput) {
        descInput.value = data.descricao || '';
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
        descInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 3. Preencher Preço
      // OLX usa input id/name "price"
      const priceInput = document.querySelector('input[name="price"], input[id="price"], input[placeholder*="preço" i], input[placeholder*="R$" i]');
      if (priceInput) {
        let numericPrice = data.preco ? String(data.preco).replace(/\D/g, '') : '';
        priceInput.value = numericPrice;
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      success = true;
    } catch (e) {
      console.error("Erro ao preencher OLX:", e);
    }

    sendResponse({ success });
  }
  return true;
});
