// api/extension-posts.js
// Endpoint para a Chrome Extension buscar posts pendentes e reportar status.
// O Marketing.tsx envia conteudo aqui, a extensao consome.

import { selectAll, insert, update } from './_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET /api/extension-posts — buscar posts pendentes para a extensao
    if (req.method === 'GET') {
      const posts = await selectAll('extension_posts', {
        filters: { status: 'eq.pending' },
        orderBy: 'criado_em',
        limit: 10,
      });
      return res.status(200).json({ posts });
    }

    // POST /api/extension-posts — criar post pendente (chamado pelo Marketing.tsx)
    // ou atualizar status (chamado pela extensao)
    if (req.method === 'POST') {
      const body = req.body || {};

      // Extensao reportando status
      if (body.action === 'update-status') {
        const { postId, platform, status } = body;
        if (postId) {
          await update('extension_posts', 'id', postId, {
            status,
            atualizado_em: new Date().toISOString(),
          });
        }
        return res.status(200).json({ ok: true });
      }

      // Marketing criando post pendente
      const { titulo, descricao, preco, categoria, plataformas, copyOriginal } = body;
      if (!titulo) return res.status(400).json({ error: 'Titulo obrigatorio' });

      const post = await insert('extension_posts', {
        titulo,
        descricao: descricao || '',
        preco: preco || '',
        categoria: categoria || 'Servicos',
        plataformas: plataformas || ['olx', 'marketplace'],
        copy_original: copyOriginal || null,
        status: 'pending',
      });

      return res.status(200).json({ ok: true, post });
    }

    return res.status(405).json({ error: 'Metodo nao permitido' });
  } catch (err) {
    console.error('[extension-posts] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
