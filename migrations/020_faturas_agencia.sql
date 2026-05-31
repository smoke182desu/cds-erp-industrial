-- 020: Faturas da agência — cobrança mensal do fee de cada empresa
BEGIN;

CREATE TABLE IF NOT EXISTS faturas_agencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,  -- mês de referência (sempre dia 1)
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  valor_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_extras NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviada','paga','vencida','cancelada')),
  forma_pagamento TEXT,
  data_pagamento DATE,
  link_pagamento TEXT,
  observacoes TEXT,
  numero_fatura TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faturas_cliente ON faturas_agencia(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_faturas_competencia ON faturas_agencia(competencia);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON faturas_agencia(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fatura_competencia ON faturas_agencia(cliente_agencia_id, competencia);

-- Função pra gerar faturas do mês corrente pra todas empresas ativas com fee > 0
CREATE OR REPLACE FUNCTION gerar_faturas_mes(p_mes DATE DEFAULT NULL) RETURNS TABLE(empresa TEXT, valor NUMERIC, status TEXT) AS $$
DECLARE
  v_mes DATE := COALESCE(p_mes, date_trunc('month', CURRENT_DATE)::DATE);
  v_emp RECORD;
  v_dia_venc DATE := (v_mes + INTERVAL '10 days')::DATE;
BEGIN
  FOR v_emp IN
    SELECT id, nome, fee_mensal
    FROM trafego_clientes
    WHERE status = 'ativo' AND fee_mensal > 0
  LOOP
    -- Verifica se já existe fatura desse mês
    IF NOT EXISTS (SELECT 1 FROM faturas_agencia WHERE cliente_agencia_id = v_emp.id AND competencia = v_mes) THEN
      INSERT INTO faturas_agencia (cliente_agencia_id, competencia, data_vencimento, valor_fee, valor_total, descricao, status)
      VALUES (v_emp.id, v_mes, v_dia_venc, v_emp.fee_mensal, v_emp.fee_mensal,
              'Serviços de gestão de marketing/agência ' || TO_CHAR(v_mes, 'MM/YYYY'),
              'pendente');
      empresa := v_emp.nome; valor := v_emp.fee_mensal; status := 'criada';
      RETURN NEXT;
    ELSE
      empresa := v_emp.nome; valor := v_emp.fee_mensal; status := 'já existe';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION faturas_agencia_touch() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fatag_touch ON faturas_agencia;
CREATE TRIGGER trg_fatag_touch BEFORE UPDATE ON faturas_agencia FOR EACH ROW EXECUTE FUNCTION faturas_agencia_touch();

GRANT ALL ON faturas_agencia TO service_role;
GRANT SELECT ON faturas_agencia TO anon;
GRANT EXECUTE ON FUNCTION gerar_faturas_mes(DATE) TO service_role, anon;

NOTIFY pgrst, 'reload schema';
COMMIT;
