document.addEventListener('DOMContentLoaded', () => {
  const envSelect = document.getElementById('env-select');
  const loader = document.getElementById('loader');
  const errorMessage = document.getElementById('error-message');
  const emptyState = document.getElementById('empty-state');
  const postsList = document.getElementById('posts-list');
  const postTemplate = document.getElementById('post-template');

  let currentPosts = [];

  // Carregar ambiente salvo
  chrome.storage.local.get(['cdsEnv'], (result) => {
    if (result.cdsEnv) {
      envSelect.value = result.cdsEnv;
    }
    fetchPosts();
  });

  envSelect.addEventListener('change', (e) => {
    chrome.storage.local.set({ cdsEnv: e.target.value });
    fetchPosts();
  });

  async function fetchPosts() {
    showLoader(true);
    hideError();
    emptyState.classList.add('hidden');
    postsList.innerHTML = '';

    const baseUrl = envSelect.value;
    try {
      const res = await fetch(`${baseUrl}/api/data?resource=extension-posts`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
      
      const data = await res.json();
      currentPosts = data.posts || [];
      
      renderPosts();
    } catch (err) {
      showError(err.message);
    } finally {
      showLoader(false);
    }
  }

  function renderPosts() {
    if (currentPosts.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    currentPosts.forEach(post => {
      const clone = postTemplate.content.cloneNode(true);
      const card = clone.querySelector('.post-card');
      
      clone.querySelector('.post-title').textContent = post.titulo;
      clone.querySelector('.post-price').textContent = post.preco || '';
      clone.querySelector('.post-desc').textContent = post.descricao || '';
      
      const imgContainer = clone.querySelector('.post-images');
      if (post.imagens && post.imagens.length > 0) {
        post.imagens.forEach(item => {
          const imgUrl = typeof item === 'string' ? item : (item.url || '');
          if (!imgUrl || !/^https?:\/\//.test(imgUrl)) return;
          const img = document.createElement('img');
          img.src = imgUrl;
          img.alt = item.descricao || 'Foto do produto';
          img.style.objectFit = 'cover';
          imgContainer.appendChild(img);
        });
        if (!imgContainer.children.length) imgContainer.style.display = 'none';
      } else {
        imgContainer.style.display = 'none';
      }

      // Configurar botões
      const btnOlx = clone.querySelector('.btn-olx');
      const btnFb = clone.querySelector('.btn-fb');
      const btnDone = clone.querySelector('.btn-done');

      if (!post.plataformas?.includes('olx')) btnOlx.style.display = 'none';
      if (!post.plataformas?.includes('marketplace')) btnFb.style.display = 'none';

      btnOlx.addEventListener('click', () => injectData(post, 'olx'));
      btnFb.addEventListener('click', () => injectData(post, 'fb'));
      btnDone.addEventListener('click', () => markAsDone(post.id, card));

      postsList.appendChild(clone);
    });
  }

  async function injectData(post, platform) {
    // Pegar aba ativa
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showError("Nenhuma aba ativa encontrada.");
      return;
    }

    // Validar se estamos na URL certa dependendo da plataforma (opcional, mas recomendado)
    const url = tab.url || '';
    if (platform === 'olx' && !url.includes('olx.com.br')) {
      alert("Abra a página de inserir anúncio da OLX primeiro!");
      return;
    }
    if (platform === 'fb' && !url.includes('facebook.com')) {
      alert("Abra a página do Facebook Marketplace primeiro!");
      return;
    }

    // Injetar o script de conteúdo correspondente e enviar a mensagem
    const file = platform === 'olx' ? 'content-olx.js' : 'content-fb.js';
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [file]
    }, () => {
      if (chrome.runtime.lastError) {
        showError("Erro ao injetar script: " + chrome.runtime.lastError.message);
        return;
      }
      
      // Enviar os dados do post para o content script preencher
      chrome.tabs.sendMessage(tab.id, {
        action: 'FILL_FORM',
        postData: post
      }, (response) => {
        if (!response || !response.success) {
          console.warn("Falha no preenchimento ou script não respondeu", response);
        } else {
          // Opcional: mostrar sucesso
        }
      });
    });
  }

  async function markAsDone(postId, cardElement) {
    const baseUrl = envSelect.value;
    const btn = cardElement.querySelector('.btn-done');
    const originalText = btn.textContent;
    btn.textContent = 'Aguarde...';
    btn.disabled = true;

    try {
      const res = await fetch(`${baseUrl}/api/data?resource=extension-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-status',
          postId: postId,
          status: 'published'
        })
      });
      
      if (!res.ok) throw new Error("Erro ao atualizar status");
      
      cardElement.style.opacity = '0.5';
      setTimeout(() => {
        cardElement.remove();
        currentPosts = currentPosts.filter(p => p.id !== postId);
        if (currentPosts.length === 0) emptyState.classList.remove('hidden');
      }, 300);

    } catch (err) {
      alert("Erro ao marcar como concluído: " + err.message);
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  function showLoader(show) {
    loader.classList.toggle('hidden', !show);
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }
});
