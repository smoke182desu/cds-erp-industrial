-- 015: Campanhas + criativos + audiências (Tráfego Pago multi-canal)

BEGIN;

CREATE TABLE IF NOT EXISTS audiencias_trafego (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  spec JSONB DEFAULT '{}'::jsonb,
  reach_estimado INT,
  publica BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audiencias_cliente ON audiencias_trafego(cliente_agencia_id);

CREATE TABLE IF NOT EXISTS campanhas_trafego (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  objetivo TEXT NOT NULL CHECK (objetivo IN ('vendas','leads','alcance','trafego','engajamento','consideracao','conversao','app_installs','video_views','messages')),
  plataformas TEXT[] DEFAULT ARRAY[]::TEXT[],
  orcamento_diario NUMERIC(12,2),
  orcamento_total NUMERIC(12,2),
  data_inicio DATE,
  data_fim DATE,
  audiencia_id UUID REFERENCES audiencias_trafego(id) ON DELETE SET NULL,
  audiencia_spec JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','revisao','aprovada','publicada','pausada','encerrada')),
  briefing_md TEXT,
  publicado_em TIMESTAMPTZ,
  external_ids JSONB DEFAULT '{}'::jsonb,
  metricas_cache JSONB DEFAULT '{}'::jsonb,
  ultimo_sync_em TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campanhas_cliente ON campanhas_trafego(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON campanhas_trafego(status);

CREATE TABLE IF NOT EXISTS criativos_trafego (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas_trafego(id) ON DELETE CASCADE,
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('imagem','video','carrossel','story','reels','colecao','texto')),
  headline TEXT,
  texto_principal TEXT,
  descricao TEXT,
  cta TEXT,
  link_destino TEXT,
  assets JSONB DEFAULT '[]'::jsonb,
  variacao TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado','em_uso','pausado','arquivado')),
  fonte TEXT DEFAULT 'manual' CHECK (fonte IN ('manual','ia','importado','clonado')),
  metricas JSONB DEFAULT '{}'::jsonb,
  external_ids JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_criativos_campanha ON criativos_trafego(campanha_id);
CREATE INDEX IF NOT EXISTS idx_criativos_cliente ON criativos_trafego(cliente_agencia_id);

CREATE OR REPLACE FUNCTION campanhas_touch() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campanhas_touch ON campanhas_trafego;
CREATE TRIGGER trg_campanhas_touch BEFORE UPDATE ON campanhas_trafego
  FOR EACH ROW EXECUTE FUNCTION campanhas_touch();

DROP TRIGGER IF EXISTS trg_criativos_touch ON criativos_trafego;
CREATE TRIGGER trg_criativos_touch BEFORE UPDATE ON criativos_trafego
  FOR EACH ROW EXECUTE FUNCTION campanhas_touch();

DROP TRIGGER IF EXISTS trg_audiencias_touch ON audiencias_trafego;
CREATE TRIGGER trg_audiencias_touch BEFORE UPDATE ON audiencias_trafego
  FOR EACH ROW EXECUTE FUNCTION campanhas_touch();

GRANT ALL ON campanhas_trafego, criativos_trafego, audiencias_trafego TO service_role;
GRANT SELECT ON campanhas_trafego, criativos_trafego, audiencias_trafego TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
