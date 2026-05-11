-- ===================================================================
-- Migration 003: ERP Core Tables (Clientes ALTER, OS, Estoque, Financeiro)
-- Substitui o localStorage do ERPContext por dados persistentes
-- ===================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------
-- 1. CLIENTES — ALTER da tabela existente (WooCommerce sync)
-- Adiciona colunas ERP/CRM sem quebrar o que ja tem.
-- Existente: id, wc_customer_id, nome, razao_social, cnpj_cpf, email,
--   whatsapp, endereco (jsonb), segmento, last_proposal_at,
--   perfil_resumido, score_lead, tags, lifetime_value, origem,
--   criado_em, atualizado_em, categoria
-- -------------------------------------------------------------------
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'PJ',
    ADD COLUMN IF NOT EXISTS documento TEXT,
    ADD COLUMN IF NOT EXISTS cnpj TEXT,
    ADD COLUMN IF NOT EXISTS uasg TEXT,
    ADD COLUMN IF NOT EXISTS cep TEXT,
    ADD COLUMN IF NOT EXISTS logradouro TEXT,
    ADD COLUMN IF NOT EXISTS numero TEXT,
    ADD COLUMN IF NOT EXISTS bairro TEXT,
    ADD COLUMN IF NOT EXISTS cidade TEXT,
    ADD COLUMN IF NOT EXISTS uf TEXT,
    ADD COLUMN IF NOT EXISTS complemento TEXT,
    ADD COLUMN IF NOT EXISTS orgao TEXT,
    ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
    ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
    ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
    ADD COLUMN IF NOT EXISTS indicador_ie TEXT,
    ADD COLUMN IF NOT EXISTS cnae TEXT,
    ADD COLUMN IF NOT EXISTS regime_tributario TEXT,
    ADD COLUMN IF NOT EXISTS funnel_stage TEXT DEFAULT 'Prospeccao',
    ADD COLUMN IF NOT EXISTS dores JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- Sincroniza documento com cnpj_cpf existente (mantem compatibilidade)
UPDATE public.clientes
SET documento = cnpj_cpf
WHERE documento IS NULL AND cnpj_cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON public.clientes(whatsapp);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON public.clientes(documento);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON public.clientes(tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_lead_id ON public.clientes(lead_id);
CREATE INDEX IF NOT EXISTS idx_clientes_funnel_stage ON public.clientes(funnel_stage);

-- -------------------------------------------------------------------
-- 2. ORDENS DE SERVICO (com etapa Kanban de 10 estagios)
-- Estagios em ordem:
--   fila, corte, dobra, solda_montagem, pintura, embalagem,
--   transporte, entregue, pos_venda, concluido
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ordens_servico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero SERIAL,
    proposta_id UUID,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    cliente_nome TEXT,
    itens JSONB DEFAULT '[]',
    valor_total NUMERIC DEFAULT 0,
    etapa TEXT DEFAULT 'fila',
    data_entrega DATE,
    observacoes TEXT,
    etapa_atualizada_em TIMESTAMPTZ DEFAULT NOW(),
    historico_etapas JSONB DEFAULT '[]',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ordens_servico_etapa_valida CHECK (
        etapa IN ('fila', 'corte', 'dobra', 'solda_montagem', 'pintura', 'embalagem', 'transporte', 'entregue', 'pos_venda', 'concluido')
    )
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'ordens_servico_numero_seq') THEN
        PERFORM setval('ordens_servico_numero_seq', GREATEST(1000, (SELECT COALESCE(MAX(numero), 999) + 1 FROM public.ordens_servico)), false);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ordens_etapa ON public.ordens_servico(etapa);
CREATE INDEX IF NOT EXISTS idx_ordens_cliente_id ON public.ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_proposta_id ON public.ordens_servico(proposta_id);
CREATE INDEX IF NOT EXISTS idx_ordens_criado_em ON public.ordens_servico(criado_em DESC);

-- -------------------------------------------------------------------
-- 3. INVENTORY ITEMS
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE,
    nome TEXT NOT NULL,
    categoria TEXT,
    unidade TEXT,
    custo NUMERIC DEFAULT 0,
    preco_venda NUMERIC DEFAULT 0,
    quantidade_estoque NUMERIC DEFAULT 0,
    estoque_minimo NUMERIC DEFAULT 0,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_codigo ON public.inventory_items(codigo);
CREATE INDEX IF NOT EXISTS idx_inventory_categoria ON public.inventory_items(categoria);

-- -------------------------------------------------------------------
-- 4. TRANSACOES FINANCEIRAS
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo TEXT NOT NULL,
    descricao TEXT,
    valor NUMERIC DEFAULT 0,
    data_vencimento DATE,
    data_pagamento DATE,
    status TEXT DEFAULT 'PENDENTE',
    origem TEXT,
    proposta_id UUID,
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT transacoes_tipo_valido CHECK (tipo IN ('RECEITA', 'DESPESA')),
    CONSTRAINT transacoes_status_valido CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO'))
);

CREATE INDEX IF NOT EXISTS idx_transacoes_status ON public.transacoes_financeiras(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON public.transacoes_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_data_vencimento ON public.transacoes_financeiras(data_vencimento);

-- -------------------------------------------------------------------
-- 5. PEDIDOS DE COMPRA
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedidos_compra (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor TEXT,
    itens JSONB DEFAULT '[]',
    valor_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'aguardando_entrega',
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    entregue_em TIMESTAMPTZ,
    CONSTRAINT pedidos_compra_status_valido CHECK (status IN ('aguardando_entrega', 'entregue', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_status ON public.pedidos_compra(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_os_id ON public.pedidos_compra(os_id);

-- -------------------------------------------------------------------
-- 6. FEEDBACKS (pos-venda)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    nota INTEGER,
    comentario TEXT,
    pontos_positivos JSONB DEFAULT '[]',
    pontos_negativos JSONB DEFAULT '[]',
    proxima_compra_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT feedbacks_nota_valida CHECK (nota IS NULL OR (nota >= 0 AND nota <= 10))
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_cliente_id ON public.feedbacks(cliente_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_os_id ON public.feedbacks(os_id);

-- -------------------------------------------------------------------
-- 7. Trigger: atualizado_em automatico
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_atualizado_em_ordens ON public.ordens_servico;
CREATE TRIGGER set_atualizado_em_ordens
    BEFORE UPDATE ON public.ordens_servico
    FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

DROP TRIGGER IF EXISTS set_atualizado_em_inventory ON public.inventory_items;
CREATE TRIGGER set_atualizado_em_inventory
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

DROP TRIGGER IF EXISTS set_atualizado_em_transacoes ON public.transacoes_financeiras;
CREATE TRIGGER set_atualizado_em_transacoes
    BEFORE UPDATE ON public.transacoes_financeiras
    FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

-- -------------------------------------------------------------------
-- 8. Trigger: ao mudar etapa da OS, anota historico
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_log_etapa_os()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
        NEW.etapa_atualizada_em = NOW();
        NEW.historico_etapas = COALESCE(OLD.historico_etapas, '[]'::jsonb) || jsonb_build_object(
            'de', OLD.etapa,
            'para', NEW.etapa,
            'em', NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_etapa_os ON public.ordens_servico;
CREATE TRIGGER log_etapa_os
    BEFORE UPDATE ON public.ordens_servico
    FOR EACH ROW EXECUTE FUNCTION trigger_log_etapa_os();

NOTIFY pgrst, 'reload schema';
