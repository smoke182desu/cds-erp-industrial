-- 008_trafego_clientes.sql
-- Modulo Trafego Pago - Sprint 1
-- Cria a tabela de clientes (tenants) gerenciados pela area de trafego.
-- Demais tabelas (contas_ads, campanhas, metricas_diarias, leads_atribuicao, relatorios)
-- serao adicionadas nas Sprints 2 e 3.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.trafego_clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE,                       -- usado em URLs/relatorios. Ex: 'cds-industrial'
    logo_url TEXT,
    cor_destaque TEXT DEFAULT '#6366f1',    -- hex usado no dashboard pra identificar o cliente
    status TEXT DEFAULT 'ativo',            -- 'ativo' | 'pausado' | 'arquivado'
    fee_mensal NUMERIC DEFAULT 0,           -- fee de gestao cobrado por mes
    responsavel TEXT,                       -- quem da equipe e o gestor de trafego do cliente
    email_contato TEXT,
    telefone_contato TEXT,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trafego_clientes_status ON public.trafego_clientes(status);
CREATE INDEX IF NOT EXISTS idx_trafego_clientes_slug ON public.trafego_clientes(slug);

-- Trigger para atualizar atualizado_em em UPDATE
CREATE OR REPLACE FUNCTION public.trafego_clientes_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trafego_clientes_updated_at ON public.trafego_clientes;
CREATE TRIGGER trafego_clientes_updated_at
    BEFORE UPDATE ON public.trafego_clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.trafego_clientes_set_updated_at();

-- Seed do primeiro cliente: a propria CDS Industrial
INSERT INTO public.trafego_clientes (nome, slug, cor_destaque, status, responsavel)
VALUES ('CDS Industrial', 'cds-industrial', '#dc2626', 'ativo', 'Jean')
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
