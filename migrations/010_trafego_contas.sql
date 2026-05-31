-- ============================================================
-- Migration 010: tabela trafego_contas (conexoes com plataformas)
-- ============================================================
-- Armazena conexao de cada cliente da agencia com plataformas
-- de ads (Meta, Google Ads, TikTok, etc.). Tokens guardados
-- criptografados (pgcrypto) ou em texto plano por enquanto
-- (pre-OAuth).

CREATE TABLE IF NOT EXISTS public.trafego_contas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES public.trafego_clientes(id) ON DELETE CASCADE,
    plataforma TEXT NOT NULL,  -- 'meta_ads', 'google_ads', 'tiktok_ads', 'linkedin_ads', 'pinterest_ads'
    account_id TEXT NOT NULL,  -- ID da conta na plataforma (ex: act_123456789 da Meta)
    account_name TEXT,
    access_token TEXT,         -- TODO: encrypt at rest com pgcrypto
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    scopes TEXT[],
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'ativo',  -- 'ativo', 'expirado', 'desconectado', 'erro'
    erro_ultimo TEXT,
    sync_ultimo_em TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',  -- pixel_id, business_id, manager_account, etc.
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT trafego_contas_status_valido CHECK (status IN ('ativo', 'expirado', 'desconectado', 'erro')),
    CONSTRAINT trafego_contas_plataforma_valida CHECK (plataforma IN ('meta_ads','google_ads','tiktok_ads','linkedin_ads','pinterest_ads','snapchat_ads'))
);

CREATE INDEX IF NOT EXISTS idx_trafego_contas_cliente_id ON public.trafego_contas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_trafego_contas_plataforma ON public.trafego_contas(plataforma);
CREATE INDEX IF NOT EXISTS idx_trafego_contas_status ON public.trafego_contas(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trafego_contas_unica ON public.trafego_contas(cliente_id, plataforma, account_id);

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION trafego_contas_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trafego_contas_updated_at ON public.trafego_contas;
CREATE TRIGGER trafego_contas_updated_at BEFORE UPDATE ON public.trafego_contas
    FOR EACH ROW EXECUTE FUNCTION trafego_contas_set_updated_at();

GRANT ALL ON public.trafego_contas TO service_role;
COMMENT ON TABLE public.trafego_contas IS 'Contas conectadas (Meta/Google/TikTok) de cada cliente da agencia';

-- ============================================================
