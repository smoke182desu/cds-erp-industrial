// api/_lib/facebook.js
// Wrapper para Facebook Graph API — publica no Instagram e Facebook Pages
// Requer: FB_APP_ID, FB_APP_SECRET, FB_PAGE_ACCESS_TOKEN no env

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * Publica uma foto com legenda na Facebook Page
 */
export async function postToFacebookPage(pageId, accessToken, { message, imageUrl }) {
  const endpoint = imageUrl
    ? `${GRAPH_API}/${pageId}/photos`
    : `${GRAPH_API}/${pageId}/feed`;

  const body = imageUrl
    ? { url: imageUrl, message, access_token: accessToken }
    : { message, access_token: accessToken };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) throw new Error(`FB Page: ${data.error.message}`);
  return { postId: data.id || data.post_id, platform: 'facebook' };
}

/**
 * Publica no Instagram via Graph API (Container → Publish)
 * Requer Instagram Business Account vinculado a uma Facebook Page
 */
export async function postToInstagram(igUserId, accessToken, { caption, imageUrl }) {
  if (!imageUrl) throw new Error('Instagram requer uma imagem (imageUrl)');

  // Passo 1: Criar container de midia
  const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(`IG Container: ${containerData.error.message}`);

  const containerId = containerData.id;

  // Passo 2: Aguardar processamento (Instagram precisa de tempo)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Passo 3: Publicar o container
  const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`IG Publish: ${publishData.error.message}`);

  return { postId: publishData.id, platform: 'instagram' };
}

/**
 * Publica carrossel no Instagram (multiplas imagens)
 */
export async function postCarouselToInstagram(igUserId, accessToken, { caption, imageUrls }) {
  if (!imageUrls?.length) throw new Error('Carrossel requer pelo menos 2 imagens');

  // Criar containers individuais para cada imagem
  const childContainers = [];
  for (const url of imageUrls) {
    const res = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`IG Carousel Item: ${data.error.message}`);
    childContainers.push(data.id);
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Criar container do carrossel
  const carouselRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      caption,
      children: childContainers,
      access_token: accessToken,
    }),
  });

  const carouselData = await carouselRes.json();
  if (carouselData.error) throw new Error(`IG Carousel: ${carouselData.error.message}`);

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Publicar
  const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: carouselData.id,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`IG Carousel Publish: ${publishData.error.message}`);

  return { postId: publishData.id, platform: 'instagram', type: 'carousel' };
}

/**
 * Descobre o Instagram Business Account ID vinculado a uma Page
 */
export async function getInstagramAccountId(pageId, accessToken) {
  const res = await fetch(
    `${GRAPH_API}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`IG Account: ${data.error.message}`);
  return data.instagram_business_account?.id || null;
}

/**
 * Lista todas as Pages do usuario com tokens
 */
export async function getPages(userAccessToken) {
  const res = await fetch(
    `${GRAPH_API}/me/accounts?access_token=${userAccessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`Pages: ${data.error.message}`);
  return data.data || [];
}

/**
 * Troca token de curta duracao por longa duracao (~60 dias)
 */
export async function getLongLivedToken(shortToken, appId, appSecret) {
  const res = await fetch(
    `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`Token Exchange: ${data.error.message}`);
  return data.access_token;
}
