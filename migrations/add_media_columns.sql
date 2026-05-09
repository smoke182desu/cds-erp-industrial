-- Migration: Adiciona colunas de midia na tabela mensagens
-- Rode este SQL no Supabase SQL Editor

ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Recarregar o cache do schema do PostgREST
NOTIFY pgrst, 'reload schema';
