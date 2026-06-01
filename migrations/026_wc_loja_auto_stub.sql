-- 026: Auto-cria wc_loja stub quando insere nova empresa-cliente + prep multi-user
BEGIN;

-- Multi-user prep: user_id opcional (sem FK ainda, decidir tabela users depois)
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS owner_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_wc_loja_owner ON wc_lojas(owner_user_id);

-- Coluna status_conexao pra mostrar progresso na UI sem precisar olhar credenciais
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS status_conexao TEXT DEFAULT 'nao_configurada'
  CHECK (status_conexao IN ('nao_configurada','aguardando_credenciais','testada_ok','testada_falha','sincronizando','ativa','erro'));
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS ultimo_teste_em TIMESTAMPTZ;
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS ultimo_teste_erro TEXT;
-- Token assinado pro webhook URL — gera 1x na criação, fica imutável
ALTER TABLE wc_lojas ADD COLUMN IF NOT EXISTS webhook_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex');

-- Função que cria 1 stub vazia
CREATE OR REPLACE FUNCTION criar_wc_loja_stub() RETURNS trigger AS $$
BEGIN
  -- Só cria se ainda não existe nenhuma loja pra essa empresa
  IF NOT EXISTS (SELECT 1 FROM wc_lojas WHERE cliente_agencia_id = NEW.id) THEN
    INSERT INTO wc_lojas (
      cliente_agencia_id, nome, url, ativo, status_conexao,
      auto_criar_proposta, auto_criar_lead, auto_criar_comprovante,
      sync_clientes_wp, sync_produtos_estoque, sync_cupons
    ) VALUES (
      NEW.id,
      'Loja ' || NEW.nome,
      '',
      FALSE,
      'nao_configurada',
      TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_criar_wc_loja_stub ON trafego_clientes;
CREATE TRIGGER trg_criar_wc_loja_stub
  AFTER INSERT ON trafego_clientes
  FOR EACH ROW
  EXECUTE FUNCTION criar_wc_loja_stub();

-- Bootstrap: criar stubs pras empresas existentes que ainda não têm loja
INSERT INTO wc_lojas (cliente_agencia_id, nome, url, ativo, status_conexao,
                     auto_criar_proposta, auto_criar_lead, auto_criar_comprovante,
                     sync_clientes_wp, sync_produtos_estoque, sync_cupons)
SELECT tc.id, 'Loja ' || tc.nome, '', FALSE, 'nao_configurada',
       TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
FROM trafego_clientes tc
WHERE tc.ativo = TRUE
  AND NOT EXISTS (SELECT 1 FROM wc_lojas WHERE cliente_agencia_id = tc.id);

-- Atualizar lojas já existentes com webhook_token se ainda não tem
UPDATE wc_lojas SET webhook_token = encode(gen_random_bytes(16), 'hex')
WHERE webhook_token IS NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;
