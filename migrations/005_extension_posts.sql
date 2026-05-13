-- MIGRATION 005: Tabela de posts para Chrome Extension
-- Fila de publicacao: Marketing envia, Extension consome

CREATE TABLE IF NOT EXISTS public.extension_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  preco TEXT DEFAULT '',
  categoria TEXT DEFAULT 'Servicos',
  plataformas TEXT[] DEFAULT ARRAY['olx', 'marketplace'],
  copy_original JSONB,
  status TEXT DEFAULT 'pending',   -- 'pending', 'posting', 'posted', 'failed'
  posted_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ep_status ON public.extension_posts(status);

ALTER TABLE public.extension_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.extension_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
