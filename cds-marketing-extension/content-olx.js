chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FILL_FORM') {
    const data = request.postData;
    let success = false;

    try {
      // Nova abordagem: Simular clique e "colar" o texto (bypass infalível para React/Vue)
      async function simulateTyping(element, value) {
        if (!element || !value) return;
        
        // Simula o clique do usuário para "acordar" o componente
        element.focus();
        element.click();
        
        // Limpa o campo de forma nativa primeiro
        element.value = '';
        
        // Usa a API de Clipboard/ExecCommand para colar o texto
        document.execCommand('insertText', false, value);
        
        // Dispara os eventos de alteração de estado
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Pequena pausa para o framework processar
        await new Promise(r => setTimeout(r, 200));
      }

      async function runAutomation() {
        // 1. Preencher Título
        const titleInput = document.querySelector('input[name="subject"], input[id="subject"], input[placeholder*="título" i]');
        await simulateTyping(titleInput, data.titulo || '');

        // 2. Preencher Descrição
        const descInput = document.querySelector('textarea[name="body"], textarea[id="body"], textarea[placeholder*="descrição" i]');
        await simulateTyping(descInput, data.descricao || '');

        // 3. Preencher Preço
        const priceInput = document.querySelector('input[name="price"], input[id="price"], input[placeholder*="preço" i], input[placeholder*="R$" i]');
        if (priceInput) {
          let numericPrice = data.preco ? String(data.preco).replace(/\D/g, '') : '';
          await simulateTyping(priceInput, numericPrice);
        }

        sendResponse({ success: true });
      }

      runAutomation();
      return true; // async response
    } catch (e) {
      console.error("Erro ao preencher OLX:", e);
      sendResponse({ success: false, error: e.message });
    }
  }
});
