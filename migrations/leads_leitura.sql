-- Tabela para rastrear qual lead foi lido por último e quando
-- Permite persistência do estado "lido/não lido" entre dispositivos e sessões
CREATE TABLE IF NOT EXISTS leads_leitura (
  lead_id TEXT PRIMARY KEY,
  ultima_leitura_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: acesso liberado para service_role (usado pelo backend)
ALTER TABLE leads_leitura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON leads_leitura
  FOR ALL TO service_role USING (true) WITH CHECK (true);
