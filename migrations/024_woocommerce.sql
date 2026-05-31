-- 024: Integração WooCommerce + comprovantes
BEGIN;

-- Loja WC por empresa
CREATE TABLE IF NOT EXISTS wc_lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  consumer_key TEXT,
  consumer_secret TEXT,
  webhook_secret TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  ultimo_sync TIMESTAMPTZ,
  ultimo_pedido_id INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wc_lojas_cliente ON wc_lojas(cliente_agencia_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wc_loja_url ON wc_lojas(cliente_agencia_id, url);

-- Pedidos sincronizados do WC
CREATE TABLE IF NOT EXISTS wc_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES wc_lojas(id) ON DELETE SET NULL,
  wc_order_id INT NOT NULL,
  numero_wc TEXT,
  status TEXT,
  total NUMERIC(12,2),
  subtotal NUMERIC(12,2),
  shipping_total NUMERIC(12,2),
  payment_method TEXT,
  payment_method_title TEXT,
  cliente_nome TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  cliente_documento TEXT,
  endereco_entrega JSONB DEFAULT '{}'::jsonb,
  endereco_cobranca JSONB DEFAULT '{}'::jsonb,
  itens JSONB DEFAULT '[]'::jsonb,
  notas_cliente TEXT,
  link_pagamento TEXT,
  data_pedido TIMESTAMPTZ,
  data_pago TIMESTAMPTZ,
  data_completo TIMESTAMPTZ,
  payload_bruto JSONB DEFAULT '{}'::jsonb,
  sincronizado_em TIMESTAMPTZ DEFAULT NOW(),
  -- Vinculação com ERP
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  proposta_id UUID REFERENCES propostas(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wc_pedido ON wc_pedidos(loja_id, wc_order_id);
CREATE INDEX IF NOT EXISTS idx_wc_ped_cliente ON wc_pedidos(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_wc_ped_status ON wc_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_wc_ped_data ON wc_pedidos(data_pedido DESC);

-- Comprovantes (PIX prints, boletos, NFe, recibos)
CREATE TABLE IF NOT EXISTS comprovantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('pix','boleto','transferencia','dinheiro','cartao','nfe','recibo','outro')),
  titulo TEXT,
  descricao TEXT,
  valor NUMERIC(12,2),
  data_pagamento DATE,
  arquivo_url TEXT,
  arquivo_tipo TEXT,
  arquivo_tamanho INT,
  -- Vinculação
  pedido_wc_id UUID REFERENCES wc_pedidos(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  proposta_gerada_id UUID REFERENCES propostas_geradas(id) ON DELETE SET NULL,
  fatura_agencia_id UUID REFERENCES faturas_agencia(id) ON DELETE SET NULL,
  -- Status
  status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido','conferido','aprovado','rejeitado','divergente')),
  observacoes TEXT,
  conciliado_em TIMESTAMPTZ,
  conciliado_por TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compr_cliente ON comprovantes(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_compr_status ON comprovantes(status);
CREATE INDEX IF NOT EXISTS idx_compr_pedido ON comprovantes(pedido_wc_id);

-- Touch triggers
CREATE OR REPLACE FUNCTION wc_touch() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wcl_touch ON wc_lojas;
CREATE TRIGGER trg_wcl_touch BEFORE UPDATE ON wc_lojas FOR EACH ROW EXECUTE FUNCTION wc_touch();
DROP TRIGGER IF EXISTS trg_wcp_touch ON wc_pedidos;
CREATE TRIGGER trg_wcp_touch BEFORE UPDATE ON wc_pedidos FOR EACH ROW EXECUTE FUNCTION wc_touch();
DROP TRIGGER IF EXISTS trg_compr_touch ON comprovantes;
CREATE TRIGGER trg_compr_touch BEFORE UPDATE ON comprovantes FOR EACH ROW EXECUTE FUNCTION wc_touch();

GRANT ALL ON wc_lojas, wc_pedidos, comprovantes TO service_role;
GRANT SELECT ON wc_lojas, wc_pedidos, comprovantes TO anon;

-- Bootstrap: loja CDS (cdsind.com.br) pra empresa CDS
INSERT INTO wc_lojas (cliente_agencia_id, nome, url, ativo)
VALUES ('a5a4466d-fd22-4eb0-98af-ad342d34bb73', 'Loja CDS Industrial', 'https://cdsind.com.br', TRUE)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
