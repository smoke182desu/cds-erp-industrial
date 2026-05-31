-- 021: Posts agendados + workflow de aprovação cliente
BEGIN;

-- Reutiliza criativos_trafego como base mas cria nova tabela pra posts orgânicos+aprovação
CREATE TABLE IF NOT EXISTS posts_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  campanha_id UUID REFERENCES campanhas_trafego(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  texto TEXT,
  plataformas TEXT[],
  tipo TEXT DEFAULT 'imagem',
  assets JSONB DEFAULT '[]'::jsonb,
  agendado_para TIMESTAMPTZ,
  publicado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','revisao','aprovado_cliente','rejeitado_cliente','publicado','cancelado')),
  -- Workflow
  token_aprovacao TEXT UNIQUE,
  link_aprovacao_aberto_em TIMESTAMPTZ,
  aprovado_em TIMESTAMPTZ,
  aprovado_por TEXT,
  comentarios_cliente TEXT,
  -- Metadata
  external_ids JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_cal_cliente ON posts_calendario(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_posts_cal_agendado ON posts_calendario(agendado_para);
CREATE INDEX IF NOT EXISTS idx_posts_cal_status ON posts_calendario(status);
CREATE INDEX IF NOT EXISTS idx_posts_cal_token ON posts_calendario(token_aprovacao);

CREATE OR REPLACE FUNCTION posts_cal_touch() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_posts_cal_touch ON posts_calendario;
CREATE TRIGGER trg_posts_cal_touch BEFORE UPDATE ON posts_calendario FOR EACH ROW EXECUTE FUNCTION posts_cal_touch();

GRANT ALL ON posts_calendario TO service_role;
GRANT SELECT, UPDATE ON posts_calendario TO anon;  -- anon pode marcar aprovado via token

NOTIFY pgrst, 'reload schema';
COMMIT;
