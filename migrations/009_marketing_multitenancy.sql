-- Migration 009: Marketing multi-tenant
-- Adiciona cliente_id (referencia trafego_clientes) em todas tabelas de Marketing
-- Permite que a Tuany atenda múltiplos clientes via mesma plataforma.

ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.campaign_contents
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.extension_posts
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.ia_experimentos
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.social_publish_log
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

-- Backfill: tudo que já existia pertence ao CDS Industrial (primeiro cliente cadastrado)
UPDATE public.campaigns SET cliente_id = (SELECT id FROM public.trafego_clientes WHERE slug = 'cds-industrial' LIMIT 1)
WHERE cliente_id IS NULL;

UPDATE public.campaign_contents SET cliente_id = (SELECT id FROM public.trafego_clientes WHERE slug = 'cds-industrial' LIMIT 1)
WHERE cliente_id IS NULL;

UPDATE public.extension_posts SET cliente_id = (SELECT id FROM public.trafego_clientes WHERE slug = 'cds-industrial' LIMIT 1)
WHERE cliente_id IS NULL;

UPDATE public.ia_experimentos SET cliente_id = (SELECT id FROM public.trafego_clientes WHERE slug = 'cds-industrial' LIMIT 1)
WHERE cliente_id IS NULL;

UPDATE public.social_publish_log SET cliente_id = (SELECT id FROM public.trafego_clientes WHERE slug = 'cds-industrial' LIMIT 1)
WHERE cliente_id IS NULL;

-- Indexes pra filtrar por cliente rápido
CREATE INDEX IF NOT EXISTS idx_campaigns_cliente_id ON public.campaigns(cliente_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contents_cliente_id ON public.campaign_contents(cliente_id);
CREATE INDEX IF NOT EXISTS idx_extension_posts_cliente_id ON public.extension_posts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ia_experimentos_cliente_id ON public.ia_experimentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_social_publish_log_cliente_id ON public.social_publish_log(cliente_id);

-- Recarrega schema cache do PostgREST pra expor a nova coluna na API REST
NOTIFY pgrst, 'reload schema';

-- Comentários documentais
COMMENT ON COLUMN public.campaigns.cliente_id IS 'Cliente da agência (trafego_clientes) ao qual esta campanha pertence';
COMMENT ON COLUMN public.extension_posts.cliente_id IS 'Cliente da agência (trafego_clientes) ao qual este post pertence';
COMMENT ON COLUMN public.ia_experimentos.cliente_id IS 'Cliente da agência (trafego_clientes) ao qual este experimento de IA pertence';
