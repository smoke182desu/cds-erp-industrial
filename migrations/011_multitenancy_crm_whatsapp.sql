-- Migration 011: multi-tenancy em CRM + WhatsApp
-- ============================================================
-- Adiciona cliente_agencia_id em tabelas que hoje sao do CDS apenas
-- pra permitir que a agencia atenda multiplos clientes com CRMs
-- isolados. Diferente de cliente_id existente (que aponta pra
-- public.clientes — clientes finais do CDS).

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.propostas
    ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.mensagens
    ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

ALTER TABLE public.ordens_servico
    ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES public.trafego_clientes(id) ON DELETE SET NULL;

-- Backfill: tudo que existia eh do CDS Industrial
UPDATE public.leads
    SET cliente_agencia_id = (SELECT id FROM public.trafego_clientes WHERE slug='cds-industrial' LIMIT 1)
    WHERE cliente_agencia_id IS NULL;

UPDATE public.propostas
    SET cliente_agencia_id = (SELECT id FROM public.trafego_clientes WHERE slug='cds-industrial' LIMIT 1)
    WHERE cliente_agencia_id IS NULL;

UPDATE public.mensagens
    SET cliente_agencia_id = (SELECT id FROM public.trafego_clientes WHERE slug='cds-industrial' LIMIT 1)
    WHERE cliente_agencia_id IS NULL;

UPDATE public.clientes
    SET cliente_agencia_id = (SELECT id FROM public.trafego_clientes WHERE slug='cds-industrial' LIMIT 1)
    WHERE cliente_agencia_id IS NULL;

UPDATE public.ordens_servico
    SET cliente_agencia_id = (SELECT id FROM public.trafego_clientes WHERE slug='cds-industrial' LIMIT 1)
    WHERE cliente_agencia_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_cliente_agencia ON public.leads(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente_agencia ON public.propostas(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente_agencia ON public.mensagens(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cliente_agencia ON public.clientes(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_agencia ON public.ordens_servico(cliente_agencia_id);

COMMENT ON COLUMN public.leads.cliente_agencia_id IS 'Cliente da agencia (trafego_clientes). Permite agencia atender varios clientes com CRMs isolados.';
COMMENT ON COLUMN public.propostas.cliente_agencia_id IS 'Cliente da agencia (trafego_clientes)';
COMMENT ON COLUMN public.mensagens.cliente_agencia_id IS 'Cliente da agencia (trafego_clientes). Permite WhatsApp multi-tenant.';
COMMENT ON COLUMN public.clientes.cliente_agencia_id IS 'Cliente da agencia (trafego_clientes) dono deste cliente final';
COMMENT ON COLUMN public.ordens_servico.cliente_agencia_id IS 'Cliente da agencia (trafego_clientes)';

NOTIFY pgrst, 'reload schema';
