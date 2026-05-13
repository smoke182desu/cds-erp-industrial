// background.js — Service Worker da extensao CDS Auto Poster
// Coordena comunicacao entre popup e content scripts

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'openAndPost') {
    handleOpenAndPost(msg).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }
  if (msg.action === 'getStoredContent') {
    chrome.storage.local.get('pendingPost', (data) => sendResponse(data.pendingPost || null));
    return true;
  }
});

async function handleOpenAndPost(msg) {
  const { platform, content } = msg;

  // Salva o conteudo no storage para o content script pegar
  await chrome.storage.local.set({ pendingPost: { platform, content, timestamp: Date.now() } });

  const urls = {
    olx: 'https://www.olx.com.br/desapega',
    marketplace: 'https://www.facebook.com/marketplace/create/item/',
  };

  const url = urls[platform];
  if (!url) return { error: 'Plataforma nao suportada' };

  // Abre a aba e injeta o content script
  const tab = await chrome.tabs.create({ url, active: true });

  return { ok: true, tabId: tab.id, platform };
}
