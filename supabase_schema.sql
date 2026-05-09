-- Schema Supabase para CDS ERP Industrial

-- Habilitar a extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Leads
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT,
    email TEXT,
    telefone TEXT UNIQUE,
    empresa TEXT,
    mensagem TEXT,
    origem TEXT DEFAULT 'site',
    etapa TEXT DEFAULT 'lead_novo',
    valor NUMERIC DEFAULT 0,
    pedido_id TEXT,
    cliente_id TEXT,
    observacoes TEXT,
    contato_nome TEXT,
    ultima_mensagem TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefone TEXT NOT NULL,
    texto TEXT,
    tipo TEXT, -- 'entrada' ou 'saida'
    remetente TEXT,
    instancia TEXT,
    payload_bruto JSONB,
    media_url TEXT, -- URL da midia (imagem, video, documento)
    media_type TEXT, -- 'image', 'video', 'document', 'audio'
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    sku TEXT,
    categoria TEXT,
    preco NUMERIC,
    preco_regular NUMERIC,
    descricao TEXT,
    especificacoes JSONB,
    woocommerce_id TEXT UNIQUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Configurações
CREATE TABLE IF NOT EXISTS public.configuracoes (
    key TEXT PRIMARY KEY,
    value JSONB,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cria índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON public.leads(telefone);
CREATE INDEX IF NOT EXISTS idx_mensagens_telefone ON public.mensagens(telefone);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado_em ON public.mensagens(criado_em);
CREATE INDEX IF NOT EXISTS idx_produtos_woocommerce_id ON public.produtos(woocommerce_id);

-- Recarregar o cache do schema do PostgREST
NOTIFY pgrst, 'reload schema';
