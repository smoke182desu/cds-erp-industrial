BEGIN;

CREATE TABLE IF NOT EXISTS templates_proposta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL,
  global BOOLEAN DEFAULT FALSE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'agencia' CHECK (categoria IN ('agencia','industrial','servico','produto','assinatura','outro')),
  descricao TEXT,
  introducao_md TEXT,
  conteudo_md TEXT,
  itens_padrao JSONB DEFAULT '[]'::jsonb,
  condicoes_md TEXT,
  cor_destaque TEXT,
  duracao_validade_dias INT DEFAULT 30,
  ativo BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tpl_cliente ON templates_proposta(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_tpl_global ON templates_proposta(global) WHERE global = TRUE;

CREATE OR REPLACE FUNCTION templates_proposta_touch() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_tpl_touch ON templates_proposta;
CREATE TRIGGER trg_tpl_touch BEFORE UPDATE ON templates_proposta FOR EACH ROW EXECUTE FUNCTION templates_proposta_touch();

GRANT ALL ON templates_proposta TO service_role;
GRANT SELECT ON templates_proposta TO anon;

NOTIFY pgrst, 'reload schema';
COMMIT;
