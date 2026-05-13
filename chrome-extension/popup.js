// popup.js — Interface da extensao CDS Auto Poster
// Conecta ao ERP para buscar conteudo e dispara postagens

document.addEventListener('DOMContentLoaded', () => {
  const erpUrlInput = document.getElementById('erpUrl');
  const titleInput = document.getElementById('postTitle');
  const bodyInput = document.getElementById('postBody');
  const priceInput = document.getElementById('postPrice');
  const categoryInput = document.getElementById('postCategory');
  const loadBtn = document.getElementById('loadFromErp');
  const postOlxBtn = document.getElementById('postOlx');
  const postMarketplaceBtn = document.getElementById('postMarketplace');
  const postAllBtn = document.getElementById('postAll');

  // Carregar URL salva
  chrome.storage.local.get(['erpUrl', 'lastContent'], (data) => {
    if (data.erpUrl) erpUrlInput.value = data.erpUrl;
    if (data.lastContent) fillContent(data.lastContent);
  });

  // Salvar URL ao digitar
  erpUrlInput.addEventListener('change', () => {
    chrome.storage.local.set({ erpUrl: erpUrlInput.value.trim() });
  });

  function fillContent(content) {
    titleInput.value = content.titulo || content.headline || '';
    bodyInput.value = content.descricao || content.corpo || content.body || '';
    priceInput.value = content.preco || content.price || '';
    categoryInput.value = content.categoria || content.category || 'Servicos';
    chrome.storage.local.set({ lastContent: content });
  }

  function getContent() {
    return {
      titulo: titleInput.value,
      descricao: bodyInput.value,
      preco: priceInput.value,
      categoria: categoryInput.value,
    };
  }

  function showStatus(msg, type) {
    const area = document.getElementById('statusArea');
    const el = document.getElementById('statusMsg');
    area.style.display = 'block';
    el.className = 'status-msg status-' + type;
    el.innerHTML = (type === 'info' ? '<span class="spinner"></span>' : '') + msg;
  }

  // Carregar do ERP
  loadBtn.addEventListener('click', async () => {
    const url = erpUrlInput.value.trim();
    if (!url) return showStatus('Configure a URL do ERP primeiro', 'error');

    showStatus('Buscando conteudo do ERP...', 'info');
    try {
      const res = await fetch(`${url}/api/extension-posts`, { method: 'GET' });
      const data = await res.json();
      if (data.posts && data.posts.length > 0) {
        const post = data.posts[0];
        fillContent(post);
        showStatus(`Carregado: "${post.titulo || post.headline}"`, 'success');
      } else {
        showStatus('Nenhum post pendente no ERP. Gere conteudo no Marketing primeiro.', 'error');
      }
    } catch (err) {
      showStatus('Erro ao conectar ao ERP: ' + err.message, 'error');
    }
  });

  // Postar na OLX
  postOlxBtn.addEventListener('click', () => postTo('olx'));
  postMarketplaceBtn.addEventListener('click', () => postTo('marketplace'));
  postAllBtn.addEventListener('click', async () => {
    await postTo('olx');
    setTimeout(() => postTo('marketplace'), 2000);
  });

  async function postTo(platform) {
    const content = getContent();
    if (!content.titulo) return showStatus('Preencha o titulo do anuncio', 'error');

    showStatus(`Abrindo ${platform}...`, 'info');
    chrome.runtime.sendMessage(
      { action: 'openAndPost', platform, content },
      (response) => {
        if (response?.ok) {
          showStatus(`${platform} aberto! Preenchendo formulario...`, 'success');
          // Reportar ao ERP que o post foi iniciado
          reportToErp(platform, content, 'started');
        } else {
          showStatus(`Erro: ${response?.error || 'desconhecido'}`, 'error');
        }
      }
    );
  }

  async function reportToErp(platform, content, status) {
    const url = erpUrlInput.value.trim();
    if (!url) return;
    try {
      await fetch(`${url}/api/extension-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-status', platform, titulo: content.titulo, status, timestamp: new Date().toISOString() }),
      });
    } catch {}
  }
});
