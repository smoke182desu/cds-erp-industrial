-- 017: Dados fiscais por empresa (CNPJ, IE, regime tributário, endereço fiscal, certificado A1 NFe)
BEGIN;

ALTER TABLE trafego_clientes
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT DEFAULT 'PJ' CHECK (tipo_pessoa IN ('PF','PJ','MEI')),
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS regime_tributario TEXT CHECK (regime_tributario IN ('simples','lucro_presumido','lucro_real','mei') OR regime_tributario IS NULL),
  ADD COLUMN IF NOT EXISTS cnae_principal TEXT,

  ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
  ADD COLUMN IF NOT EXISTS endereco_uf TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep TEXT,

  -- NFe config
  ADD COLUMN IF NOT EXISTS emite_nfe BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ambiente_nfe TEXT DEFAULT 'homologacao' CHECK (ambiente_nfe IN ('homologacao','producao')),
  ADD COLUMN IF NOT EXISTS certificado_a1_path TEXT,
  ADD COLUMN IF NOT EXISTS certificado_a1_senha_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS certificado_a1_validade DATE,
  ADD COLUMN IF NOT EXISTS proxima_serie_nfe INT DEFAULT 1,

  -- Bancário (pra emissão de boletos)
  ADD COLUMN IF NOT EXISTS banco_nome TEXT,
  ADD COLUMN IF NOT EXISTS banco_agencia TEXT,
  ADD COLUMN IF NOT EXISTS banco_conta TEXT,
  ADD COLUMN IF NOT EXISTS banco_pix TEXT,

  ADD COLUMN IF NOT EXISTS fiscal_metadata JSONB DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
COMMIT;
