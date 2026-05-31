-- Migration 013: ordens_servico aceitando pedidos externos (WooCommerce)
-- Adiciona campos pra rastrear origem externa + idempotência

ALTER TABLE public.ordens_servico
    ADD COLUMN IF NOT EXISTS origem TEXT,
    ADD COLUMN IF NOT EXISTS pedido_externo_id TEXT,
    ADD COLUMN IF NOT EXISTS cliente_email TEXT,
    ADD COLUMN IF NOT EXISTS endereco_entrega JSONB,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Idempotência: não cria duas OS pra mesmo pedido externo
CREATE UNIQUE INDEX IF NOT EXISTS uq_ordens_origem_pedido_externo
    ON public.ordens_servico(origem, pedido_externo_id)
    WHERE pedido_externo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordens_origem ON public.ordens_servico(origem);

COMMENT ON COLUMN public.ordens_servico.origem IS 'Sistema externo: woocommerce, shopify, mercadolivre, etc.';
COMMENT ON COLUMN public.ordens_servico.pedido_externo_id IS 'ID do pedido no sistema externo. Único por (origem, pedido_externo_id).';

NOTIFY pgrst, 'reload schema';
