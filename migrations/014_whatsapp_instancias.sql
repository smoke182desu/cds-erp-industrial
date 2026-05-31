-- 014_whatsapp_instancias.sql
-- Tabela que mapeia cada empresa da agencia (trafego_clientes) pra uma instancia do Evolution API
-- Permite multi-tenant: 1 numero WhatsApp por empresa

BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_instancias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_agencia_id UUID NOT NULL REFERENCES trafego_clientes(id) ON DELETE CASCADE,
  -- Nome da instancia no Evolution API (slug, ex: 'cds-industrial')
  evolution_instance_name TEXT NOT NULL UNIQUE,
  -- Telefone conectado (preenchido apos QR scan)
  telefone TEXT,
  -- Status: aguardando_qr | conectando | conectado | desconectado | erro
  status TEXT NOT NULL DEFAULT 'aguardando_qr' CHECK (status IN ('aguardando_qr','conectando','conectado','desconectado','erro')),
  -- QR code base64 atual (curto-vivido, atualizado via webhook QRCODE_UPDATED)
  qr_code_base64 TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  -- Timestamps de eventos importantes
  ultimo_conectado_em TIMESTAMPTZ,
  ultimo_desconectado_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  -- Metadata extra do Evolution (profileName, pictureUrl, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Webhook config: pode customizar URL por instancia (default: global)
  webhook_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inst_cliente ON whatsapp_instancias(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inst_status ON whatsapp_instancias(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_inst_cliente_unica ON whatsapp_instancias(cliente_agencia_id) WHERE status != 'desconectado';

-- 1 instancia ativa por empresa, mas pode ter historico de desconectadas

CREATE OR REPLACE FUNCTION whatsapp_instancias_touch() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_instancias_touch ON whatsapp_instancias;
CREATE TRIGGER trg_whatsapp_instancias_touch
  BEFORE UPDATE ON whatsapp_instancias
  FOR EACH ROW EXECUTE FUNCTION whatsapp_instancias_touch();

-- Permissoes pro PostgREST
GRANT ALL ON whatsapp_instancias TO service_role;
GRANT SELECT ON whatsapp_instancias TO anon;

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
