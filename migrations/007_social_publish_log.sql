-- MIGRATION 007: Log de publicacoes nas redes sociais
-- Rastreia cada publicacao individual por plataforma

CREATE TABLE IF NOT EXISTS public.social_publish_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_post_id UUID REFERENCES extension_posts(id),
  plataforma TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  platform_post_id TEXT,
  platform_url TEXT,
  erro TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_publish_log_post ON social_publish_log(extension_post_id);
CREATE INDEX IF NOT EXISTS idx_social_publish_log_status ON social_publish_log(status);

COMMENT ON TABLE public.social_publish_log IS 'Log de publicacoes via Graph API (Facebook/Instagram)';
COMMENT ON COLUMN public.social_publish_log.plataforma IS 'facebook, instagram, ou outra plataforma';
COMMENT ON COLUMN public.social_publish_log.platform_post_id IS 'ID retornado pela API da plataforma';
COMMENT ON COLUMN public.social_publish_log.platform_url IS 'URL do post publicado na plataforma';

NOTIFY pgrst, 'reload schema';
