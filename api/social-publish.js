// api/social-publish.js
// Endpoint unificado para publicar em redes sociais
// Suporta: Instagram, Facebook Page
// Usa: Graph API via _lib/facebook.js

import {
  postToFacebookPage,
  postToInstagram,
  postCarouselToInstagram,
  getInstagramAccountId,
  getPages,
  getLongLivedToken,
} from './_lib/facebook.js';
import { emitEvent } from './_lib/events.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
  const PAGE_ID = process.env.FB_PAGE_ID;
  const APP_ID = process.env.FB_APP_ID || '1528432055514554';
  const APP_SECRET = process.env.FB_APP_SECRET;

  try {
    // GET: status de conexao e info das contas
    if (req.method === 'GET') {
      const action = req.query?.action;

      // Listar pages disponiveis (para setup inicial)
      if (action === 'pages' && req.query?.token) {
        const pages = await getPages(req.query.token);
        return res.status(200).json({ pages });
      }

      // Verificar se Instagram esta vinculado
      if (action === 'ig-check' && PAGE_ID && PAGE_ACCESS_TOKEN) {
        const igId = await getInstagramAccountId(PAGE_ID, PAGE_ACCESS_TOKEN);
        return res.status(200).json({
          connected: !!igId,
          instagramId: igId,
          pageId: PAGE_ID,
        });
      }

      // Trocar token curto por longo
      if (action === 'exchange-token' && req.query?.token && APP_SECRET) {
        const longToken = await getLongLivedToken(req.query.token, APP_ID, APP_SECRET);
        return res.status(200).json({ token: longToken, expiresIn: '60 days' });
      }

      // Status geral
      return res.status(200).json({
        configured: !!(PAGE_ACCESS_TOKEN && PAGE_ID),
        appId: APP_ID,
        hasSecret: !!APP_SECRET,
        hasToken: !!PAGE_ACCESS_TOKEN,
        hasPageId: !!PAGE_ID,
      });
    }

    // POST: publicar em rede social
    if (req.method === 'POST') {
      if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
        return res.status(400).json({
          error: 'Facebook nao configurado. Adicione FB_PAGE_ACCESS_TOKEN e FB_PAGE_ID no Vercel.',
        });
      }

      const { platform, message, caption, imageUrl, imageUrls } = req.body || {};

      const results = [];

      // Publicar no Facebook
      if (platform === 'facebook' || platform === 'all') {
        try {
          const fbResult = await postToFacebookPage(PAGE_ID, PAGE_ACCESS_TOKEN, {
            message: message || caption,
            imageUrl,
          });
          results.push(fbResult);

          emitEvent({
            type: 'social.published',
            source: 'api',
            entity_type: 'post',
            entity_id: fbResult.postId,
            actor: 'sistema',
            payload: { platform: 'facebook', postId: fbResult.postId },
          });
        } catch (err) {
          results.push({ platform: 'facebook', error: err.message });
        }
      }

      // Publicar no Instagram
      if (platform === 'instagram' || platform === 'all') {
        try {
          const igId = await getInstagramAccountId(PAGE_ID, PAGE_ACCESS_TOKEN);
          if (!igId) throw new Error('Instagram Business nao vinculado a esta Page');

          let igResult;
          if (imageUrls?.length > 1) {
            igResult = await postCarouselToInstagram(igId, PAGE_ACCESS_TOKEN, {
              caption: caption || message,
              imageUrls,
            });
          } else {
            const singleUrl = imageUrl || imageUrls?.[0];
            if (!singleUrl) throw new Error('Instagram requer pelo menos 1 imagem');
            igResult = await postToInstagram(igId, PAGE_ACCESS_TOKEN, {
              caption: caption || message,
              imageUrl: singleUrl,
            });
          }
          results.push(igResult);

          emitEvent({
            type: 'social.published',
            source: 'api',
            entity_type: 'post',
            entity_id: igResult.postId,
            actor: 'sistema',
            payload: { platform: 'instagram', postId: igResult.postId },
          });
        } catch (err) {
          results.push({ platform: 'instagram', error: err.message });
        }
      }

      return res.status(200).json({ ok: true, results });
    }

    return res.status(405).json({ error: 'Metodo nao permitido' });
  } catch (err) {
    console.error('[social-publish] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
