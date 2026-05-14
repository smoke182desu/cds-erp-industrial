chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FILL_FORM') {
    const data = request.postData;
    let success = false;

    try {
      // O Facebook Marketplace usa classes obfuscadas, então a melhor aposta
      // é buscar por aria-labels ou placeholders.

      // 1. Título
      const titleInputs = Array.from(document.querySelectorAll('input, textarea'))
        .filter(el => {
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const place = (el.getAttribute('placeholder') || '').toLowerCase();
          return aria.includes('título') || place.includes('título');
        });
      
      if (titleInputs.length > 0) {
        const titleInput = titleInputs[0];
        titleInput.focus();
        // Em React, as vezes é preciso usar um setter nativo para que o onchange dispare
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(titleInput, data.titulo || '');
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 2. Preço
      const priceInputs = Array.from(document.querySelectorAll('input'))
        .filter(el => {
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const place = (el.getAttribute('placeholder') || '').toLowerCase();
          return aria.includes('preço') || place.includes('preço');
        });
        
      if (priceInputs.length > 0) {
        const priceInput = priceInputs[0];
        let numericPrice = data.preco ? String(data.preco).replace(/\D/g, '') : '';
        priceInput.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(priceInput, numericPrice);
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 3. Descrição
      const descInputs = Array.from(document.querySelectorAll('textarea'))
        .filter(el => {
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const place = (el.getAttribute('placeholder') || '').toLowerCase();
          return aria.includes('descrição') || place.includes('descrição');
        });
        
      if (descInputs.length > 0) {
        const descInput = descInputs[0];
        descInput.focus();
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeTextAreaValueSetter.call(descInput, data.descricao || '');
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      success = true;
    } catch (e) {
      console.error("Erro ao preencher Facebook:", e);
    }

    sendResponse({ success });
  }
  return true;
});
