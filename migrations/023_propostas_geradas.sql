-- 023: Histórico de propostas geradas — toda proposta criada via template fica salva
BEGIN;

CREATE TABLE IF NOT EXISTS propostas_geradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates_proposta(id) ON DELETE SET NULL,
  numero_documento TEXT,
  -- Dados do destinatário (cliente final)
  cliente_nome TEXT,
  cliente_contato TEXT,
  cliente_telefone TEXT,
  cliente_email TEXT,
  cliente_cnpj TEXT,
  -- Conteúdo
  titulo TEXT NOT NULL,
  introducao_md TEXT,
  conteudo_md TEXT,
  itens JSONB DEFAULT '[]'::jsonb,
  condicoes_md TEXT,
  observacoes TEXT,
  -- Valores
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) DEFAULT 0,
  valor_final NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Visual
  cor_destaque TEXT,
  -- Status / workflow
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','visualizada','aprovada','rejeitada','expirada','cancelada')),
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_validade DATE,
  data_enviada TIMESTAMPTZ,
  data_visualizada TIMESTAMPTZ,
  data_resposta TIMESTAMPTZ,
  comentarios_cliente TEXT,
  -- Token público pra aprovação web
  token_publico TEXT UNIQUE,
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prop_ger_cliente ON propostas_geradas(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_prop_ger_status ON propostas_geradas(status);
CREATE INDEX IF NOT EXISTS idx_prop_ger_token ON propostas_geradas(token_publico);
CREATE INDEX IF NOT EXISTS idx_prop_ger_criado ON propostas_geradas(criado_em DESC);

CREATE OR REPLACE FUNCTION propostas_geradas_touch() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prop_ger_touch ON propostas_geradas;
CREATE TRIGGER trg_prop_ger_touch BEFORE UPDATE ON propostas_geradas FOR EACH ROW EXECUTE FUNCTION propostas_geradas_touch();

GRANT ALL ON propostas_geradas TO service_role;
GRANT SELECT, UPDATE ON propostas_geradas TO anon;  -- anon pra aprovação via token

NOTIFY pgrst, 'reload schema';
COMMIT;
