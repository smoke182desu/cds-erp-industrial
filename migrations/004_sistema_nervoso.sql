-- ============================================================
-- MIGRATION 004: Sistema Nervoso Empresarial — Fundacao
-- Cria as tabelas de eventos, campanhas, tarefas e metas
-- que transformam o ERP de registro para inteligencia.
-- ============================================================

-- 1. EVENT BUS — Toda acao vira evento imutavel e rastreavel
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,            -- 'whatsapp', 'user', 'agent', 'cron', 'woocommerce'
  type TEXT NOT NULL,              -- 'lead.created', 'lead.stage_changed', 'message.received', etc
  entity_type TEXT,                -- 'lead', 'produto', 'campanha', 'proposta', 'tarefa'
  entity_id TEXT,                  -- UUID da entidade afetada
  actor TEXT,                      -- 'jean', 'sistema', 'cliente:<id>', 'agente:bruno'
  payload JSONB DEFAULT '{}',     -- Dados especificos do evento
  session_id TEXT,                 -- Agrupa eventos relacionados
  parent_event_id UUID,            -- Causalidade: qual evento gerou este
  confidence SMALLINT,             -- Se gerado por IA: 0-100
  CONSTRAINT fk_parent_event FOREIGN KEY (parent_event_id) REFERENCES public.events(id)
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON public.events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON public.events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON public.events(source);
CREATE INDEX IF NOT EXISTS idx_events_session ON public.events(session_id) WHERE session_id IS NOT NULL;

-- 2. CAMPANHAS — Campanhas de marketing com budget, periodo, canal
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL,            -- 'google_ads', 'meta_ads', 'instagram_organic', 'tiktok', 'linkedin'
  objective TEXT,                   -- 'leads', 'awareness', 'traffic', 'remarketing', 'launch'
  status TEXT DEFAULT 'draft',     -- 'draft', 'active', 'paused', 'completed', 'cancelled'
  budget_monthly NUMERIC,
  budget_daily NUMERIC,
  target_audience TEXT,
  product_focus TEXT,               -- Produto/familia foco da campanha
  strategy JSONB DEFAULT '{}',    -- Estrategia completa gerada pelo Abbacchio
  start_date DATE,
  end_date DATE,
  created_by TEXT DEFAULT 'user',  -- 'user', 'agente:abbacchio'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_channel ON public.campaigns(channel);

-- 3. CAMPAIGN CONTENTS — Copies/criativos vinculados a campanhas
CREATE TABLE IF NOT EXISTS public.campaign_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL,               -- 'anuncio', 'post', 'stories', 'carrossel', 'reels_script'
  platform TEXT,                    -- 'instagram', 'facebook', 'google', 'linkedin', 'tiktok'
  headline TEXT,
  body TEXT,
  cta TEXT,
  hashtags TEXT[],
  design_brief JSONB,              -- Briefing de design gerado pelo Narancia
  ab_variant TEXT DEFAULT 'A',     -- 'A', 'B', 'C' para testes
  performance JSONB DEFAULT '{}', -- clicks, impressions, ctr, conversions (atualizado)
  status TEXT DEFAULT 'draft',     -- 'draft', 'active', 'paused', 'winner', 'loser'
  created_by TEXT DEFAULT 'agente:narancia',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_campaign ON public.campaign_contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cc_status ON public.campaign_contents(status);

-- 4. ATRIBUICAO LEAD-CAMPANHA — qual campanha trouxe qual lead
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id),
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS lead_score SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS predicted_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_probability SMALLINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_campaign ON public.leads(campaign_id) WHERE campaign_id IS NOT NULL;

-- 5. TASKS — Tarefas geradas pelos agentes com prioridade e rastreamento
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_by TEXT NOT NULL,       -- 'agente:bruno', 'agente:abbacchio', 'sistema', 'user'
  assigned_to TEXT DEFAULT 'jean', -- 'jean', 'sistema', 'agente:narancia'
  type TEXT NOT NULL,               -- 'respond_lead', 'create_proposal', 'adjust_budget', 'create_content', 'follow_up'
  priority TEXT DEFAULT 'medium',  -- 'critical', 'high', 'medium', 'low'
  title TEXT NOT NULL,
  context TEXT,                     -- Contexto para executar a tarefa
  entity_type TEXT,                 -- 'lead', 'campanha', 'proposta'
  entity_id TEXT,                   -- ID da entidade relacionada
  deadline TIMESTAMPTZ,
  estimated_impact TEXT,            -- "Potencial R$ 15k se fechar"
  status TEXT DEFAULT 'pending',   -- 'pending', 'in_progress', 'done', 'dismissed', 'expired'
  outcome TEXT,                     -- O que aconteceu depois
  completed_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON public.tasks(entity_type, entity_id);

-- 6. GOALS — Metas configuraveis com tracking automatico
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,               -- 'Vendas do mes', 'Leads por semana', 'Tempo de resposta'
  metric TEXT NOT NULL,             -- 'revenue', 'leads_count', 'response_time_avg', 'conversion_rate'
  direction TEXT DEFAULT 'up',     -- 'up' (mais = melhor) ou 'down' (menos = melhor)
  target_value NUMERIC NOT NULL,
  unit TEXT,                        -- 'R$', 'leads', 'minutos', '%'
  period TEXT DEFAULT 'monthly',   -- 'daily', 'weekly', 'monthly', 'quarterly'
  active BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 7. GOAL PROGRESS — Progresso diario contra cada meta
CREATE TABLE IF NOT EXISTS public.goal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_value NUMERIC NOT NULL DEFAULT 0,
  delta NUMERIC DEFAULT 0,          -- Variacao vs dia anterior
  percentage SMALLINT DEFAULT 0,    -- % atingido da meta
  status TEXT DEFAULT 'tracking',  -- 'tracking', 'achieved', 'missed', 'at_risk'
  notes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (goal_id, date)
);

CREATE INDEX IF NOT EXISTS idx_gp_goal_date ON public.goal_progress(goal_id, date DESC);

-- 8. AGENT SESSIONS — Registro de trabalho dos agentes
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,              -- 'bruno', 'giorno', 'abbacchio', 'narancia'
  trigger_type TEXT,                -- 'user_request', 'cron', 'event_triggered'
  trigger_event_id UUID,            -- Evento que disparou a sessao
  input_summary TEXT,               -- Resumo do input
  output_summary TEXT,              -- Resumo do output
  tokens_used INTEGER DEFAULT 0,
  provider TEXT,                    -- 'gemini', 'groq', 'openai'
  model TEXT,                       -- modelo especifico usado
  duration_ms INTEGER DEFAULT 0,
  events_generated INTEGER DEFAULT 0,
  tasks_generated INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_as_agent ON public.agent_sessions(agent);
CREATE INDEX IF NOT EXISTS idx_as_created ON public.agent_sessions(criado_em DESC);

-- ============================================================
-- RLS: service_role tem acesso total a todas as novas tabelas
-- ============================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.campaign_contents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.goals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.goal_progress
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.agent_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Recarregar o cache do schema do PostgREST
NOTIFY pgrst, 'reload schema';
