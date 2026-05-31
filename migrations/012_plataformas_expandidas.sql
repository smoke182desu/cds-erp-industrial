-- Migration 012: ampliar plataformas suportadas em trafego_contas
-- Adiciona: google_merchant, google_search_console, google_analytics,
-- youtube, twitter_x (futuro)
-- Mantém compat com plataformas já existentes.

ALTER TABLE public.trafego_contas
    DROP CONSTRAINT IF EXISTS trafego_contas_plataforma_valida;

ALTER TABLE public.trafego_contas
    ADD CONSTRAINT trafego_contas_plataforma_valida CHECK (plataforma IN (
        -- Anúncios pagos
        'meta_ads',           -- Facebook + Instagram Ads
        'google_ads',
        'tiktok_ads',
        'linkedin_ads',
        'pinterest_ads',
        'snapchat_ads',
        'youtube_ads',
        'twitter_ads',
        -- Analytics e SEO
        'google_analytics',   -- GA4
        'google_search_console',
        'google_tag_manager',
        -- E-commerce
        'google_merchant',    -- Google Merchant Center / Shopping
        'facebook_catalog',   -- Catalog Manager Meta
        -- Orgânico / Páginas sociais (Sprint 4)
        'facebook_page',      -- pra postar e ler insights da Page
        'instagram_business',
        'linkedin_company_page',
        'tiktok_creator',
        'youtube_channel',
        'twitter_x_account',
        'pinterest_business'
    ));

COMMENT ON CONSTRAINT trafego_contas_plataforma_valida ON public.trafego_contas
    IS 'Lista exaustiva de plataformas conectáveis. Atualizar conforme novas integrações.';

NOTIFY pgrst, 'reload schema';
