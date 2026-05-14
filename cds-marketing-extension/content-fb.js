chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FILL_FORM') {
    const data = request.postData;
    let success = false;

    try {
      function findInputByLabelText(textSnippets) {
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
        
        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        for (const input of inputs) {
          const attrText = (input.getAttribute('aria-label') || input.getAttribute('placeholder') || '').toLowerCase();
          if (textSnippets.some(snippet => attrText.includes(snippet))) return input;
        }

        const divs = Array.from(document.querySelectorAll('div'));
        for(const div of divs) {
            const text = div.textContent.toLowerCase();
            if(textSnippets.some(snippet => text === snippet)) {
                const parent = div.parentElement;
                if(parent) {
                    const input = parent.querySelector('input, textarea');
                    if(input) return input;
                }
            }
        }
        return null;
      }

      // Nova abordagem: Simular clique e "colar" o texto (bypass infalível para React)
      async function simulateTyping(element, value) {
        if (!element || !value) return;
        
        // Simula o clique do usuário para "acordar" o componente
        element.focus();
        element.click();
        
        // Limpa o campo de forma nativa primeiro
        element.value = '';
        
        // Usa a API de Clipboard/ExecCommand para colar o texto como se fosse um humano
        document.execCommand('insertText', false, value);
        
        // Dispara os eventos de alteração de estado just in case
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Pequena pausa para o React processar
        await new Promise(r => setTimeout(r, 200));
      }

      async function runAutomation() {
        // 1. Título
        const titleInput = findInputByLabelText(['título', 'titulo', 'title']);
        await simulateTyping(titleInput, data.titulo || '');

        // 2. Preço
        const priceInput = findInputByLabelText(['preço', 'preco', 'price']);
        if (priceInput) {
          let numericPrice = data.preco ? String(data.preco).replace(/\D/g, '') : '';
          await simulateTyping(priceInput, numericPrice);
        }

        // 3. Descrição
        const descInput = findInputByLabelText(['descrição', 'descricao', 'description']);
        await simulateTyping(descInput, data.descricao || '');
        
        sendResponse({ success: true });
      }

      runAutomation();
      return true; // Mantém a porta de mensagem aberta para resposta assíncrona
    } catch (e) {
      console.error("Erro ao preencher Facebook:", e);
      sendResponse({ success: false, error: e.message });
    }
  }
});
