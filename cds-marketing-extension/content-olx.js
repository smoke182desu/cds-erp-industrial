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

      // Função auxiliar para encontrar e clicar em botões por texto
      async function clickByText(selector, textSnippets, timeout = 8000) {
        return new Promise(resolve => {
          const startTime = Date.now();
          const interval = setInterval(() => {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const el of elements) {
              const text = (el.textContent || el.value || '').toLowerCase().trim();
              if (textSnippets.some(snippet => text === snippet || text.includes(snippet))) {
                clearInterval(interval);
                el.click();
                resolve(true);
                return;
              }
            }
            if (Date.now() - startTime > timeout) {
              clearInterval(interval);
              resolve(false);
            }
          }, 500);
        });
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

        // 4. Injetar Imagens
        if (data.imagens && data.imagens.length > 0) {
          try {
            const fileInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"]');
            if (fileInput) {
              const dataTransfer = new DataTransfer();
              
              for (let i = 0; i < data.imagens.length; i++) {
                const imgUrl = typeof data.imagens[i] === 'string' ? data.imagens[i] : data.imagens[i].url;
                if (!imgUrl) continue;
                
                // Fetch direct from URL
                const res = await fetch(imgUrl);
                const blob = await res.blob();
                
                let ext = 'jpg';
                if (blob.type === 'image/png') ext = 'png';
                if (blob.type === 'image/webp') ext = 'webp';
                if (blob.type === 'image/jpeg') ext = 'jpg';
                
                const file = new File([blob], `foto_${i + 1}.${ext}`, { type: blob.type });
                dataTransfer.items.add(file);
              }
              
              if (dataTransfer.files.length > 0) {
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                // As vezes as plataformas escutam input tambem
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          } catch (imgError) {
            console.error("Erro ao injetar imagens na OLX:", imgError);
          }
        }

        // 5. Clicar em Enviar/Avançar
        console.log("Avançando formulário...");
        await clickByText('button', ['enviar anúncio', 'enviar anuncio', 'avançar', 'continuar']);
        
        // 6. Aguardar e selecionar plano "Gratuito"
        console.log("Buscando plano gratuito...");
        await clickByText('button, div[role="button"], label', ['grátis', 'gratis', 'gratuito', 'anúncio grátis', 'padrão', 'padrao']);
        
        // 7. Clicar em Publicar (confirmar)
        console.log("Confirmando publicação...");
        await clickByText('button', ['publicar', 'confirmar', 'ir para meus anúncios', 'concluir']);

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
