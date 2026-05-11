-- Tabela de experimentos A/B: rastreia cada sugestao exibida, uso e resultado
CREATE TABLE IF NOT EXISTS ia_experimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  telefone TEXT,
  variant_id TEXT NOT NULL,         -- 'A' (padrao) ou 'B' (exploratorio)
  label_sugestao TEXT,              -- ex: 'saudacao', 'urgencia', 'tecnica'
  mensagem_sugestao TEXT,
  etapa_no_momento TEXT,
  tecnica_usada TEXT,
  usada BOOLEAN DEFAULT FALSE,
  resultado TEXT,                   -- 'etapa_avancou', 'resposta_recebida', 'sem_resultado'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de insights globais: padroes aprendidos pelo Bruno, compartilhados com Giorno
CREATE TABLE IF NOT EXISTS ia_insights_globais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,               -- 'tecnica_efetiva', 'abordagem_falhou', 'padrao_cliente'
  contexto TEXT,                    -- ex: 'etapa:qualificado', 'label:urgencia'
  insight TEXT NOT NULL,
  confianca INTEGER DEFAULT 50,     -- 0-100, sobe com confirmacoes
  usos INTEGER DEFAULT 0,
  sucessos INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: servico tem acesso total
ALTER TABLE ia_experimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_insights_globais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON ia_experimentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON ia_insights_globais
  FOR ALL TO service_role USING (true) WITH CHECK (true);
