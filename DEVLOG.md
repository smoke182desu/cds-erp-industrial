# DEVLOG - CDS ERP Industrial

> Arquivo compartilhado de desenvolvimento. Cada desenvolvedor anota seu progresso aqui.
> Marque com ✅ quando concluído, ⬜ quando pendente, 🔄 quando em progresso.

---

## 📋 Checklist de Tarefas Pendentes

### 🔴 Prioridade Alta

- ⬜ **Configurar webhook Evolution API para mensagens de saída**
  - O webhook atual só captura mensagens recebidas (entrada)
  - Precisa acessar o Evolution Manager com a API Key Global (está nas env vars do Vercel)
  - Habilitar evento MESSAGES_UPSERT para capturar mensagens enviadas pelo celular
  - O código backend (api/whatsapp.js) já está preparado para processar mensagens de saída (fromMe)
  - URL do webhook: https://erp.cdsind.com.br/api/whatsapp
  - Evolution API: https://evolution-api-production-903e.up.railway.app
  - Instância: cdsind

- ✅ **Resolver quota do Firestore (free tier)**
  - Migração realizada para Supabase.

### 🟡 Prioridade Média

- ⬜ **Formulário de cadastro de produtos (Produtos.tsx)**
  - Criar formulário completo com abas: Dados Gerais, Especificações, Fotos, Preços
  - Integrar com Supabase table produtos
  - Campos: nome, código, categoria, peso, dimensões, material, acabamento, preço

- ⬜ **Sincronização bidirecional ERP ↔ WooCommerce**
  - Sincronizar produtos do ERP com a loja WooCommerce (cdsind.com.br)
  - Atualizar estoque, preços e status em ambas direções
  - Usar WooCommerce REST API

- ⬜ **Mensagens WhatsApp enviadas pelo celular**
  - Testar se mensagens enviadas diretamente pelo WhatsApp no celular são capturadas
  - Depende da configuração do webhook Evolution API (tarefa acima)

### 🟢 Prioridade Baixa

- ⬜ **Melhorar tratamento de erros no frontend**
  - Adicionar feedback visual quando Supabase está indisponível
  - Toast notifications para erros de API

- ⬜ **Dashboard de métricas de vendas**
  - Gráficos de conversão de leads
  - Relatórios de mensagens por período

---

## ✅ Tarefas Concluídas

### 2026-05-07

- ✅ **Migração Completa para Supabase (Postgres)** — *Antigravity*
  - Todos os endpoints migrados de Firestore/PHP para Supabase REST API
  - Implementado helper `api/_lib/supabase.js` com `fetch` nativo (sem dependências)
  - Removido `firebase-admin` e `phpFetch` do projeto
  - Endpoints migrados: `leads`, `mensagem`, `produtos`, `produto`, `config`, `data`, `proposta-ia`, `assistente-vendas`, `conversa-inteligencia`, `whatsapp`
  - Webhook de WhatsApp (`api/whatsapp.js`) agora salva direto no Postgres

### 2025-04-17

- ✅ **Melhorias no sidebar ConversaInteligente** — *Claude*
  - Nome da empresa aparece primeiro, fallback para leadNome
  - Especificações de produtos incluídas na análise IA
  - Deploy realizado no Vercel (commit d1dbf2b)

- ✅ **Fix AssistenteVendas** — *Claude*
  - Corrigido erro de renderização do componente
  - Commit 8b3e605

- ✅ **Deploy manual no Vercel** — *Claude*
  - Projeto ea6j usa Deploy Hooks, não auto-deploy do git push
  - Deploy triggado manualmente via UI do Vercel
  - Produção atualizada em erp.cdsind.com.br

- ✅ **Diagnóstico: mensagens WhatsApp de saída** — *Claude*
  - Causa raiz identificada: webhook da Evolution API não está configurado para enviar eventos de mensagens de saída
  - Zero mensagens do tipo saida existem no Firestore
  - Código backend está correto e preparado para receber

---

## 📝 Log de Desenvolvimento

### 2026-05-07 — Antigravity (IA)
- Realizada migração total do backend para Supabase
- Eliminada dependência do HostGator (PHP/MySQL) e Firestore
- Consolidado helper de banco de dados em `api/_lib/supabase.js`
- Limpeza de arquivos legados: `php-api.js`, `firestore.js`, `cache.js` removidos
- Webhook de WhatsApp configurado para salvar em `mensagens` e upsertar `leads` no Supabase

### 2025-04-17 — Claude (IA)
- Investigado problema de mensagens WhatsApp de saída não aparecendo no ERP
- Diagnosticado: Evolution API webhook precisa ser configurado para evento MESSAGES_UPSERT
- Verificado que api/whatsapp.js já trata fromMe=true corretamente
- Verificado que api/mensagem.js busca ambos tipos (entrada/saida) do Firestore
- Deploy manual realizado no Vercel para commits 8b3e605 e d1dbf2b
- Melhorias no ConversaInteligente confirmadas em produção

---

## 🔧 Informações do Ambiente

| Item | Valor |
|------|-------|
| Frontend | React + Vite + TypeScript |
| Backend | Vercel Serverless Functions |
| Database | Supabase (Postgres) |
| IA | Groq API (llama-3.1-8b-instant) |
| WhatsApp | Evolution API v2.3.7 + Z-API |
| Hosting | Vercel (Hobby plan) |
| Domínio | erp.cdsind.com.br |
| Repo | github.com/smoke182desu/cds-erp-industrial |
| Branch | main |
| Deploy | Manual via Deploy Hooks (não auto-deploy) |

---

## 👥 Desenvolvedores

| Nome | Papel | Contato |
|------|-------|---------|
| Jean (Clark) | Owner / Dev | clarkjean@hotmail.com |
| Antigravity | IA Assistant (Supabase Migration) | — |
| Elton | Dev | — |
| Claude | IA Assistant | — |

---

> **Como usar este arquivo:**
> 1. Antes de começar a trabalhar, leia o checklist acima
> 2. Se pegar uma tarefa, mude de ⬜ para 🔄 e anote seu nome
> 3. Quando concluir, mude para ✅ e adicione uma entrada no Log
> 4. Sempre faça commit deste arquivo junto com suas alterações
