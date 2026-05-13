-- MIGRATION 006: Suporte a imagens na fila de publicacao
-- Adiciona coluna JSONB para armazenar array de imagens por post
-- Cada imagem: { tipo, url, descricao, formato, ordem, promptIA, produtoRef }

ALTER TABLE public.extension_posts
  ADD COLUMN IF NOT EXISTS imagens JSONB DEFAULT '[]'::jsonb;

-- Adiciona foto_url na tabela de produtos (para proxy de imagens)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS fotos TEXT[] DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.extension_posts.imagens IS 'Array de objetos: [{tipo, url, descricao, formato, ordem, promptIA, produtoRef}]';
COMMENT ON COLUMN public.produtos.foto_url IS 'URL da foto principal do produto (WooCommerce)';
COMMENT ON COLUMN public.produtos.fotos IS 'Array de URLs de fotos adicionais';

NOTIFY pgrst, 'reload schema';
