-- Migration: Criar tabela propostas
-- Rode no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero SERIAL,
    lead_id UUID,
    telefone TEXT,
    nome_cliente TEXT,
    empresa TEXT,
    itens JSONB DEFAULT '[]',
    valor_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'rascunho',
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_propostas_telefone ON public.propostas(telefone);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON public.propostas(status);
CREATE INDEX IF NOT EXISTS idx_propostas_criado_em ON public.propostas(criado_em DESC);

NOTIFY pgrst, 'reload schema';
