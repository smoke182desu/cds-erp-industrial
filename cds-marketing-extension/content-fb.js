chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FILL_FORM') {
    const data = request.postData;
    let success = false;

    try {
      function findInputByLabelText(textSnippets) {
        // Busca em todos os labels
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          const text = (label.textContent || label.getAttribute('aria-label') || '').toLowerCase();
          if (textSnippets.some(snippet => text.includes(snippet))) {
            const input = label.querySelector('input, textarea');
            if (input) return input;
            const inputId = label.getAttribute('for');
            if (inputId) {
               const el = document.getElementById(inputId);
               if (el) return el;
            }
          }
        }
        
        // Fallback: buscar inputs diretamente pelos placeholders ou aria-labels
        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        for (const input of inputs) {
          const attrText = (input.getAttribute('aria-label') || input.getAttribute('placeholder') || '').toLowerCase();
          if (textSnippets.some(snippet => attrText.includes(snippet))) return input;
        }

        // Fallback agressivo: procurar divs que contém o texto e pegar o input mais próximo dentro
        const divs = Array.from(document.querySelectorAll('div'));
        for(const div of divs) {
            const text = div.textContent.toLowerCase();
            if(textSnippets.some(snippet => text === snippet)) {
                // Sobe um nível e procura input
                const parent = div.parentElement;
                if(parent) {
                    const input = parent.querySelector('input, textarea');
                    if(input) return input;
                }
            }
        }
        return null;
      }

      function setNativeValue(element, value) {
        if (!element) return;
        element.focus();
        const prototype = Object.getPrototypeOf(element);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(element, value);
        } else {
          element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 1. Título
      const titleInput = findInputByLabelText(['título', 'titulo', 'title']);
      if (titleInput) setNativeValue(titleInput, data.titulo || '');

      // 2. Preço
      const priceInput = findInputByLabelText(['preço', 'preco', 'price']);
      if (priceInput) {
        let numericPrice = data.preco ? String(data.preco).replace(/\D/g, '') : '';
        setNativeValue(priceInput, numericPrice);
      }

      // 3. Descrição
      const descInput = findInputByLabelText(['descrição', 'descricao', 'description']);
      if (descInput) setNativeValue(descInput, data.descricao || '');

      success = true;
    } catch (e) {
      console.error("Erro ao preencher Facebook:", e);
    }

    sendResponse({ success });
  }
  return true;
});
