-- 019: Adiciona cliente_agencia_id em todas tabelas operacionais que faltavam
BEGIN;

ALTER TABLE produtos                 ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE pedidos_compra           ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE transacoes_financeiras   ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE inventory_items          ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE tasks                    ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE events                   ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE goals                    ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE goal_progress            ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE configuracoes            ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE agent_sessions           ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE ia_experimentos          ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE ia_insights_globais      ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE campaigns                ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE campaign_contents        ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE extension_posts          ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE social_publish_log       ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE feedbacks                ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;
ALTER TABLE leads_leitura            ADD COLUMN IF NOT EXISTS cliente_agencia_id UUID REFERENCES trafego_clientes(id) ON DELETE SET NULL;

-- Adicionar campo numero_documento padronizado em propostas, ordens, pedidos
ALTER TABLE propostas       ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE ordens_servico  ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE pedidos_compra  ADD COLUMN IF NOT EXISTS numero_documento TEXT;

-- Índices por cliente_agencia_id (queries vão filtrar muito por isso)
CREATE INDEX IF NOT EXISTS idx_produtos_cliente_agencia       ON produtos(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_cliente_agencia ON pedidos_compra(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_trans_fin_cliente_agencia      ON transacoes_financeiras(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_inv_cliente_agencia            ON inventory_items(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_tasks_cliente_agencia          ON tasks(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_events_cliente_agencia         ON events(cliente_agencia_id);
CREATE INDEX IF NOT EXISTS idx_goals_cliente_agencia          ON goals(cliente_agencia_id);

-- Defaults: backfill SE houver dados (todas estão vazias, então no-op, mas seguro)
UPDATE produtos SET cliente_agencia_id = 'a5a4466d-fd22-4eb0-98af-ad342d34bb73' WHERE cliente_agencia_id IS NULL;
UPDATE pedidos_compra SET cliente_agencia_id = 'a5a4466d-fd22-4eb0-98af-ad342d34bb73' WHERE cliente_agencia_id IS NULL;
UPDATE transacoes_financeiras SET cliente_agencia_id = 'a5a4466d-fd22-4eb0-98af-ad342d34bb73' WHERE cliente_agencia_id IS NULL;
UPDATE inventory_items SET cliente_agencia_id = 'a5a4466d-fd22-4eb0-98af-ad342d34bb73' WHERE cliente_agencia_id IS NULL;
UPDATE tasks SET cliente_agencia_id = 'a5a4466d-fd22-4eb0-98af-ad342d34bb73' WHERE cliente_agencia_id IS NULL;
UPDATE events SET cliente_agencia_id = 'a5a4466d-fd22-4eb0-98af-ad342d34bb73' WHERE cliente_agencia_id IS NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;
