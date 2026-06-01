-- 025: WC → Propostas + clientes/produtos/cupons sync + comprovantes com arquivos reais + webhook bancário
-- Multi-tenant via cliente_agencia_id em todas as tabelas
BEGIN;

-- 1) Extensão wc_lojas: flags de automação + secrets
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS auto_criar_proposta BOOLEAN DEFAULT TRUE;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS auto_criar_lead BOOLEAN DEFAULT TRUE;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS auto_criar_comprovante BOOLEAN DEFAULT TRUE;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS sync_clientes_wp BOOLEAN DEFAULT TRUE;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS sync_produtos_estoque BOOLEAN DEFAULT TRUE;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS sync_cupons BOOLEAN DEFAULT TRUE;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS ultima_sync_clientes TIMESTAMPTZ;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS ultima_sync_produtos TIMESTAMPTZ;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS ultima_sync_cupons TIMESTAMPTZ;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS estoque_minimo_alerta INT DEFAULT 5;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS wp_user TEXT;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS wp_app_password TEXT;

-- 2) Extensão wc_pedidos: link propostas_geradas e comprovante auto
ALTER TABLE wc_pedidos ADD COLUMN IF NOT EXISTS proposta_gerada_id UUID REFERENCES propostas_geradas(id) ON DELETE SET NULL;
ALTER TABLE wc_pedidos ADD COLUMN IF NOT EXISTS comprovante_auto_id UUID;
ALTER TABLE wc_pedidos ADD COLUMN IF NOT EXISTS wc_customer_id INT;
CREATE INDEX IF NOT EXISTS idx_wc_ped_propger ON wc_pedidos(proposta_gerada_id);
CREATE INDEX IF NOT EXISTS idx_wc_ped_wccust ON wc_pedidos(wc_customer_id);

-- 3) wc_clientes
CREATE TABLE IF NOT EXISTS wc_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES wc_lojas(id) ON DELETE CASCADE,
  wc_customer_id INT,
  wp_user_id INT,
  email TEXT,
  username TEXT,
  nome TEXT,
  primeiro_nome TEXT,
  sobrenome TEXT,
  telefone TEXT,
  documento TEXT,
  data_cadastro TIMESTAMPTZ,
  total_pedidos INT DEFAULT 0,
  total_gasto NUMERIC(12,2) DEFAULT 0,
  endereco_cobranca JSONB DEFAULT '{}'::jsonb,
  endereco_entrega JSONB DEFAULT '{}'::jsonb,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  cliente_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  sincronizado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wccli_wc ON wc_clientes(loja_id, wc_customer_id) WHERE wc_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wccli_wp ON wc_clientes(loja_id, wp_user_id) WHERE wp_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wccli_cliente ON wc_clientes(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_wccli_email ON wc_clientes(email);
CREATE INDEX IF NOT EXISTS idx_wccli_lead ON wc_clientes(lead_id);

-- 4) wc_produtos
CREATE TABLE IF NOT EXISTS wc_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES wc_lojas(id) ON DELETE CASCADE,
  wc_product_id INT NOT NULL,
  nome TEXT NOT NULL,
  sku TEXT,
  status TEXT,
  tipo TEXT,
  preco NUMERIC(12,2),
  preco_promo NUMERIC(12,2),
  estoque INT,
  gerencia_estoque BOOLEAN DEFAULT FALSE,
  status_estoque TEXT,
  categorias JSONB DEFAULT '[]'::jsonb,
  imagem_url TEXT,
  permalink TEXT,
  total_vendas INT DEFAULT 0,
  data_criacao TIMESTAMPTZ,
  data_modificacao TIMESTAMPTZ,
  payload_bruto JSONB DEFAULT '{}'::jsonb,
  sincronizado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wcprod ON wc_produtos(loja_id, wc_product_id);
CREATE INDEX IF NOT EXISTS idx_wcprod_cliente ON wc_produtos(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_wcprod_estoque_baixo ON wc_produtos(cliente_agencia_id, estoque) WHERE gerencia_estoque = TRUE;
CREATE INDEX IF NOT EXISTS idx_wcprod_sku ON wc_produtos(sku);

-- 5) wc_cupons
CREATE TABLE IF NOT EXISTS wc_cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES wc_lojas(id) ON DELETE CASCADE,
  wc_coupon_id INT NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT,
  tipo_desconto TEXT,
  valor NUMERIC(12,2),
  data_validade DATE,
  total_usos INT DEFAULT 0,
  limite_usos INT,
  ativo BOOLEAN DEFAULT TRUE,
  payload_bruto JSONB DEFAULT '{}'::jsonb,
  sincronizado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wccupom ON wc_cupons(loja_id, wc_coupon_id);
CREATE INDEX IF NOT EXISTS idx_wccupom_cliente ON wc_cupons(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_wccupom_codigo ON wc_cupons(codigo);

-- 6) comprovantes_arquivos (storage real)
CREATE TABLE IF NOT EXISTS comprovantes_arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprovante_id UUID NOT NULL REFERENCES comprovantes(id) ON DELETE CASCADE,
  nome_original TEXT NOT NULL,
  caminho_arquivo TEXT NOT NULL,
  url_publica TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  hash_sha256 TEXT,
  ocr_status TEXT DEFAULT 'pendente' CHECK (ocr_status IN ('pendente','processando','concluido','falhou','sem_chave_ia')),
  ocr_resultado JSONB,
  ocr_executado_em TIMESTAMPTZ,
  ocr_provider TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compr_arq_compr ON comprovantes_arquivos(comprovante_id);
CREATE INDEX IF NOT EXISTS idx_compr_arq_hash ON comprovantes_arquivos(hash_sha256);

-- 6b) campos auxiliares em comprovantes
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'manual' CHECK (fonte IN ('manual','woocommerce','banco','email','whatsapp'));
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS beneficiario TEXT;
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS pagador TEXT;
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS txid TEXT;
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS end_to_end_id TEXT;

-- 7) wc_webhook_eventos (audit + retries)
CREATE TABLE IF NOT EXISTS wc_webhook_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID REFERENCES wc_lojas(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  resource TEXT,
  event TEXT,
  wc_resource_id INT,
  payload JSONB NOT NULL,
  signature TEXT,
  signature_valid BOOLEAN,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  erro TEXT,
  ip_origem TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wcwh_loja ON wc_webhook_eventos(loja_id);
CREATE INDEX IF NOT EXISTS idx_wcwh_topic ON wc_webhook_eventos(topic);
CREATE INDEX IF NOT EXISTS idx_wcwh_processed ON wc_webhook_eventos(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_wcwh_criado ON wc_webhook_eventos(criado_em DESC);

-- 8) bank_webhooks_recebidos
CREATE TABLE IF NOT EXISTS bank_webhooks_recebidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL,
  banco TEXT NOT NULL,
  tipo_evento TEXT,
  txid TEXT,
  end_to_end_id TEXT,
  valor NUMERIC(12,2),
  data_pagamento TIMESTAMPTZ,
  pagador_nome TEXT,
  pagador_documento TEXT,
  pagador_banco TEXT,
  payload_bruto JSONB NOT NULL,
  signature TEXT,
  signature_valid BOOLEAN,
  comprovante_id UUID REFERENCES comprovantes(id) ON DELETE SET NULL,
  wc_pedido_id UUID REFERENCES wc_pedidos(id) ON DELETE SET NULL,
  fatura_id UUID REFERENCES faturas_agencia(id) ON DELETE SET NULL,
  matched_at TIMESTAMPTZ,
  match_score NUMERIC(4,2),
  match_reason TEXT,
  processado BOOLEAN DEFAULT FALSE,
  ip_origem TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bwr_banco ON bank_webhooks_recebidos(banco);
CREATE INDEX IF NOT EXISTS idx_bwr_txid ON bank_webhooks_recebidos(txid);
CREATE INDEX IF NOT EXISTS idx_bwr_e2e ON bank_webhooks_recebidos(end_to_end_id);
CREATE INDEX IF NOT EXISTS idx_bwr_valor ON bank_webhooks_recebidos(valor, data_pagamento);
CREATE INDEX IF NOT EXISTS idx_bwr_processado ON bank_webhooks_recebidos(processado) WHERE processado = FALSE;

-- 9) Touch triggers
DROP TRIGGER IF EXISTS trg_wccli_touch ON wc_clientes;
CREATE TRIGGER trg_wccli_touch BEFORE UPDATE ON wc_clientes FOR EACH ROW EXECUTE FUNCTION wc_touch();
DROP TRIGGER IF EXISTS trg_wcprod_touch ON wc_produtos;
CREATE TRIGGER trg_wcprod_touch BEFORE UPDATE ON wc_produtos FOR EACH ROW EXECUTE FUNCTION wc_touch();
DROP TRIGGER IF EXISTS trg_wccupom_touch ON wc_cupons;
CREATE TRIGGER trg_wccupom_touch BEFORE UPDATE ON wc_cupons FOR EACH ROW EXECUTE FUNCTION wc_touch();
DROP TRIGGER IF EXISTS trg_comparq_touch ON comprovantes_arquivos;
CREATE TRIGGER trg_comparq_touch BEFORE UPDATE ON comprovantes_arquivos FOR EACH ROW EXECUTE FUNCTION wc_touch();

-- 10) Função: WC pedido → proposta_gerada (idempotente)
CREATE OR REPLACE FUNCTION wc_pedido_para_proposta(p_pedido_id UUID) RETURNS UUID AS $$
DECLARE
  v_ped wc_pedidos%ROWTYPE;
  v_numero TEXT;
  v_prop_id UUID;
  v_loja_nome TEXT;
BEGIN
  SELECT * INTO v_ped FROM wc_pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido nao encontrado'; END IF;
  IF v_ped.proposta_gerada_id IS NOT NULL THEN RETURN v_ped.proposta_gerada_id; END IF;
  v_numero := gerar_proximo_numero(v_ped.cliente_agencia_id, 'proposta');
  SELECT nome INTO v_loja_nome FROM wc_lojas WHERE id = v_ped.loja_id;
  INSERT INTO propostas_geradas (
    cliente_agencia_id, numero_documento,
    cliente_nome, cliente_email, cliente_telefone, cliente_cnpj,
    titulo, conteudo_md, itens, valor_total, valor_final,
    status, data_emissao, metadata
  ) VALUES (
    v_ped.cliente_agencia_id, v_numero,
    v_ped.cliente_nome, v_ped.cliente_email, v_ped.cliente_telefone, v_ped.cliente_documento,
    'Pedido WooCommerce #' || COALESCE(v_ped.numero_wc, v_ped.wc_order_id::text),
    'Pedido recebido em ' || COALESCE(v_loja_nome, 'loja online') || ' — origem WooCommerce. Pagamento via ' || COALESCE(v_ped.payment_method_title, v_ped.payment_method, 'método não informado') || '.',
    v_ped.itens, COALESCE(v_ped.total, 0), COALESCE(v_ped.total, 0),
    CASE WHEN v_ped.data_pago IS NOT NULL OR v_ped.status IN ('processing','completed') THEN 'aprovada' ELSE 'enviada' END,
    COALESCE(v_ped.data_pedido::date, CURRENT_DATE),
    jsonb_build_object('origem','woocommerce','wc_order_id',v_ped.wc_order_id,'loja_id',v_ped.loja_id,'pagamento',v_ped.payment_method_title)
  ) RETURNING id INTO v_prop_id;
  UPDATE wc_pedidos SET proposta_gerada_id = v_prop_id WHERE id = p_pedido_id;
  RETURN v_prop_id;
END;
$$ LANGUAGE plpgsql;

-- 11) Função: WC pedido pago → comprovante auto (idempotente)
CREATE OR REPLACE FUNCTION wc_pedido_para_comprovante(p_pedido_id UUID) RETURNS UUID AS $$
DECLARE
  v_ped wc_pedidos%ROWTYPE;
  v_compr_id UUID;
  v_loja wc_lojas%ROWTYPE;
  v_tipo TEXT;
BEGIN
  SELECT * INTO v_ped FROM wc_pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido nao encontrado'; END IF;
  IF v_ped.comprovante_auto_id IS NOT NULL THEN RETURN v_ped.comprovante_auto_id; END IF;
  IF v_ped.data_pago IS NULL AND v_ped.status NOT IN ('processing','completed') THEN RETURN NULL; END IF;
  SELECT * INTO v_loja FROM wc_lojas WHERE id = v_ped.loja_id;
  v_tipo := CASE
    WHEN v_ped.payment_method ILIKE '%pix%' THEN 'pix'
    WHEN v_ped.payment_method ILIKE '%boleto%' THEN 'boleto'
    WHEN v_ped.payment_method ILIKE '%card%' OR v_ped.payment_method ILIKE '%stripe%' OR v_ped.payment_method ILIKE '%mercadopago%' THEN 'cartao'
    WHEN v_ped.payment_method ILIKE '%bank%' OR v_ped.payment_method ILIKE '%transfer%' THEN 'transferencia'
    ELSE 'outro'
  END;
  INSERT INTO comprovantes (
    cliente_agencia_id, tipo, titulo, descricao, valor, data_pagamento,
    pedido_wc_id, proposta_gerada_id,
    status, fonte, banco, pagador, metadata
  ) VALUES (
    v_ped.cliente_agencia_id, v_tipo,
    'Pedido #' || COALESCE(v_ped.numero_wc, v_ped.wc_order_id::text) || ' — ' || COALESCE(v_loja.nome,'loja'),
    'Pagamento automático via ' || COALESCE(v_ped.payment_method_title, v_ped.payment_method, 'WooCommerce'),
    v_ped.total, COALESCE(v_ped.data_pago::date, v_ped.data_pedido::date, CURRENT_DATE),
    v_ped.id, v_ped.proposta_gerada_id,
    'conferido', 'woocommerce', v_ped.payment_method_title, v_ped.cliente_nome,
    jsonb_build_object('origem','woocommerce','wc_order_id',v_ped.wc_order_id)
  ) RETURNING id INTO v_compr_id;
  UPDATE wc_pedidos SET comprovante_auto_id = v_compr_id WHERE id = p_pedido_id;
  RETURN v_compr_id;
END;
$$ LANGUAGE plpgsql;

-- 12) Grants
GRANT ALL ON wc_clientes, wc_produtos, wc_cupons, comprovantes_arquivos,
             wc_webhook_eventos, bank_webhooks_recebidos TO service_role;
GRANT SELECT ON wc_clientes, wc_produtos, wc_cupons, comprovantes_arquivos TO anon;
GRANT EXECUTE ON FUNCTION wc_pedido_para_proposta(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION wc_pedido_para_comprovante(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
