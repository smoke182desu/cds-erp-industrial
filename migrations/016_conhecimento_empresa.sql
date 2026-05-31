-- 016: Módulo de Conhecimento da Empresa (RAG/contexto para IA)

BEGIN;

-- Tabela principal 1:1 com cliente_agencia (trafego_clientes)
CREATE TABLE IF NOT EXISTS conhecimento_empresa (
  cliente_agencia_id UUID PRIMARY KEY REFERENCES trafego_clientes(id) ON DELETE CASCADE,

  -- Identidade da marca
  missao TEXT,
  visao TEXT,
  valores TEXT[],
  tom_voz TEXT,
  personalidade_marca TEXT,
  proposta_valor TEXT,
  slogan TEXT,
  historia TEXT,

  -- Mercado
  segmento TEXT,
  industria TEXT,
  ticket_medio NUMERIC(12,2),
  sazonalidade JSONB DEFAULT '{}'::jsonb,
  geografia JSONB DEFAULT '{}'::jsonb,

  -- Ideal Customer Profile
  icp_perfil TEXT,
  icp_dor TEXT,
  icp_objetivo TEXT,
  icp_objecoes TEXT[],
  icp_jornada TEXT,

  -- Posicionamento
  diferenciais TEXT[],
  beneficios_principais TEXT[],
  garantias TEXT[],
  prova_social TEXT,

  -- Branding visual
  paleta_cores TEXT[],
  fonte_marca TEXT,
  logo_url TEXT,
  guidelines_url TEXT,

  -- Estratégia
  objetivos_negocio TEXT,
  metas_marketing TEXT,
  palavras_chave TEXT[],
  hashtags_marca TEXT[],
  evitar_palavras TEXT[],

  -- Histórico/aprendizado
  historico_aprendido TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conhecimento_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'documento' CHECK (tipo IN ('briefing','contrato','brand_guidelines','manual','deck','planilha','faq','fluxo_atendimento','case','outro','documento')),
  conteudo_md TEXT,
  arquivo_url TEXT,
  arquivo_tipo TEXT,
  tags TEXT[],
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_cliente ON conhecimento_documentos(cliente_agencia_id);

CREATE TABLE IF NOT EXISTS conhecimento_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  preco_de NUMERIC(12,2),
  preco_por NUMERIC(12,2),
  publico_alvo TEXT,
  beneficios TEXT[],
  diferenciais TEXT[],
  imagens JSONB DEFAULT '[]'::jsonb,
  link_produto TEXT,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_cliente ON conhecimento_produtos(cliente_agencia_id);

CREATE TABLE IF NOT EXISTS conhecimento_concorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT,
  posicionamento TEXT,
  pontos_fortes TEXT[],
  pontos_fracos TEXT[],
  diferencas_voce TEXT,
  notas TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conc_cliente ON conhecimento_concorrentes(cliente_agencia_id);

-- Triggers de touch
CREATE OR REPLACE FUNCTION conhecimento_touch() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ce_touch ON conhecimento_empresa;
CREATE TRIGGER trg_ce_touch BEFORE UPDATE ON conhecimento_empresa FOR EACH ROW EXECUTE FUNCTION conhecimento_touch();
DROP TRIGGER IF EXISTS trg_cd_touch ON conhecimento_documentos;
CREATE TRIGGER trg_cd_touch BEFORE UPDATE ON conhecimento_documentos FOR EACH ROW EXECUTE FUNCTION conhecimento_touch();
DROP TRIGGER IF EXISTS trg_cp_touch ON conhecimento_produtos;
CREATE TRIGGER trg_cp_touch BEFORE UPDATE ON conhecimento_produtos FOR EACH ROW EXECUTE FUNCTION conhecimento_touch();
DROP TRIGGER IF EXISTS trg_cc_touch ON conhecimento_concorrentes;
CREATE TRIGGER trg_cc_touch BEFORE UPDATE ON conhecimento_concorrentes FOR EACH ROW EXECUTE FUNCTION conhecimento_touch();

GRANT ALL ON conhecimento_empresa, conhecimento_documentos, conhecimento_produtos, conhecimento_concorrentes TO service_role;
GRANT SELECT ON conhecimento_empresa, conhecimento_documentos, conhecimento_produtos, conhecimento_concorrentes TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
