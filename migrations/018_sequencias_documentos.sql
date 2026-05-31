-- 018: Numeração por empresa
BEGIN;

CREATE TABLE IF NOT EXISTS sequencias_documentos (
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('proposta','pedido','os','nfe','nfse','fatura','contrato','recibo','pedido_compra','rma')),
  prefixo TEXT,
  proximo_numero INT NOT NULL DEFAULT 1,
  formato TEXT NOT NULL DEFAULT '{prefixo}-{numero:04d}',
  resetar_anualmente BOOLEAN DEFAULT FALSE,
  ano_atual INT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cliente_agencia_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_seq_cliente ON sequencias_documentos(cliente_agencia_id);

-- Função atômica: pega + incrementa em uma transação
CREATE OR REPLACE FUNCTION gerar_proximo_numero(
  p_cliente_agencia UUID,
  p_tipo TEXT
) RETURNS TEXT AS $$
DECLARE
  v_seq sequencias_documentos%ROWTYPE;
  v_numero INT;
  v_resultado TEXT;
  v_ano INT := EXTRACT(YEAR FROM NOW())::INT;
BEGIN
  -- Lock + select
  SELECT * INTO v_seq
  FROM sequencias_documentos
  WHERE cliente_agencia_id = p_cliente_agencia AND tipo = p_tipo
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Cria sequência padrão se não existe
    INSERT INTO sequencias_documentos (cliente_agencia_id, tipo, prefixo, proximo_numero, formato, ano_atual)
    VALUES (p_cliente_agencia, p_tipo, UPPER(LEFT(p_tipo, 3)), 2, '{prefixo}-{numero:04d}', v_ano)
    RETURNING * INTO v_seq;
    v_numero := 1;
  ELSE
    -- Se reseta anualmente e mudou o ano, zera
    IF v_seq.resetar_anualmente AND v_seq.ano_atual != v_ano THEN
      v_numero := 1;
      UPDATE sequencias_documentos
        SET proximo_numero = 2, ano_atual = v_ano, atualizado_em = NOW()
        WHERE cliente_agencia_id = p_cliente_agencia AND tipo = p_tipo;
    ELSE
      v_numero := v_seq.proximo_numero;
      UPDATE sequencias_documentos
        SET proximo_numero = proximo_numero + 1, atualizado_em = NOW()
        WHERE cliente_agencia_id = p_cliente_agencia AND tipo = p_tipo;
    END IF;
  END IF;

  -- Renderiza formato: substitui {prefixo} e {numero:0Nd}
  v_resultado := REPLACE(v_seq.formato, '{prefixo}', COALESCE(v_seq.prefixo, ''));
  v_resultado := REGEXP_REPLACE(v_resultado, '\{numero:0(\d+)d\}',
    LPAD(v_numero::TEXT, GREATEST(LENGTH(v_numero::TEXT), 4), '0'), 'g');
  v_resultado := REPLACE(v_resultado, '{numero}', v_numero::TEXT);
  v_resultado := REPLACE(v_resultado, '{ano}', v_ano::TEXT);

  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- Bootstrap pra CDS Industrial
INSERT INTO sequencias_documentos (cliente_agencia_id, tipo, prefixo, proximo_numero, formato)
VALUES
  ('a5a4466d-fd22-4eb0-98af-ad342d34bb73', 'proposta', 'CDS', 1, '{prefixo}-{numero:04d}'),
  ('a5a4466d-fd22-4eb0-98af-ad342d34bb73', 'pedido',   'CDS', 1, '{prefixo}-PED-{numero:04d}'),
  ('a5a4466d-fd22-4eb0-98af-ad342d34bb73', 'os',       'CDS', 1, '{prefixo}-OS-{numero:04d}'),
  ('a5a4466d-fd22-4eb0-98af-ad342d34bb73', 'nfe',      'CDS', 1, '{numero:06d}'),
  ('a5a4466d-fd22-4eb0-98af-ad342d34bb73', 'pedido_compra', 'CDS', 1, '{prefixo}-PC-{numero:04d}')
ON CONFLICT DO NOTHING;

GRANT ALL ON sequencias_documentos TO service_role;
GRANT SELECT ON sequencias_documentos TO anon;
GRANT EXECUTE ON FUNCTION gerar_proximo_numero(UUID, TEXT) TO service_role, anon;

NOTIFY pgrst, 'reload schema';
COMMIT;
