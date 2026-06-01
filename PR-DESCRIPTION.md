## Sprint I+J+K+L — Integração WooCommerce completa + Comprovantes inteligentes

### Resumo executivo
Toda a stack de e-commerce do ERP agora suporta:
- Pedidos WC → Propostas automáticas no ERP (com numeração própria por empresa)
- WC paid → Comprovante automático (idempotente)
- Sync de clientes WC → Leads no CRM (com deduplicação)
- Sync de produtos com estoque + cupons
- Sync de usuários do WordPress (via Application Password)
- Upload real de arquivos pra comprovantes (PDF/JPG/PNG/WEBP/HEIC)
- **OCR com IA** que extrai valor/data/banco/pagador do print do PIX
- Webhook bancário genérico (Sicoob/Itaú/BB/Bradesco) com matching automático

Tudo **multi-tenant** via `cliente_agencia_id`. Funciona pras 10+ empresas-cliente da agência sem refatoração adicional.

### Mudanças
**Migration 025 — `025_wc_propostas_comprovantes_extended.sql`** (283 linhas)
- Estende `wc_lojas` com flags de automação: `auto_criar_proposta`, `auto_criar_lead`, `auto_criar_comprovante`, `sync_clientes_wp`, `sync_produtos_estoque`, `sync_cupons`
- Estende `wc_pedidos` com `proposta_gerada_id`, `comprovante_auto_id`, `wc_customer_id`
- Estende `comprovantes` com `fonte`, `banco`, `beneficiario`, `pagador`, `txid`, `end_to_end_id`
- Novas tabelas: `wc_clientes`, `wc_produtos`, `wc_cupons`, `comprovantes_arquivos`, `wc_webhook_eventos`, `bank_webhooks_recebidos`
- 2 funções SQL idempotentes: `wc_pedido_para_proposta(uuid)` e `wc_pedido_para_comprovante(uuid)`
- Grants pra service_role e anon; reload de schema PostgREST

**Endpoints novos**
- `api/wc-webhook.js` (240 LOC): receptor real-time com HMAC validation. Dispatch por resource: order/customer/product/coupon. Loga todos eventos em wc_webhook_eventos pra audit.
- `api/comprovantes/upload.js` (129 LOC): multipart parser inline (sem dependências externas), suporta múltiplos arquivos, hash SHA-256 pra dedup, configurável via `UPLOAD_DIR`/`PUBLIC_URL_BASE`.
- `api/comprovantes/ocr.js` (184 LOC): tenta Anthropic Claude vision → Groq llama vision → OpenAI gpt-4o-mini. Retorna JSON estruturado. Atualiza comprovante com campos extraídos.
- `api/bank-webhook.js` (183 LOC): receptor genérico com normalizer pra payloads BACEN PIX, boleto, etc. Matching automático por txid/end_to_end_id/valor+data. Auto-cria comprovante quando não acha match.

**Endpoint estendido**
- `api/wc-sync.js` (354 LOC, era 95): novo param `entity` aceita `pedidos|clientes|produtos|cupons|wp_users|tudo`. Pra cada pedido pago, chama as funções SQL pra criar proposta+comprovante. Auto-vincula leads quando sincroniza clientes.

**Frontend**
- `src/components/ComprovanteArquivos.tsx` (195 LOC): dropzone com drag-and-drop, lista de arquivos com badges de status OCR, botão "IA" por arquivo, visualização de campos extraídos (valor/data/banco/pagador/txid/confiança).
- `src/pages/WooCommerce.tsx`: integra `ComprovanteArquivos` dentro do `ModalComprovante` quando o comprovante já existe.

**Documentação**
- `SETUP-WC-COMPROVANTES.md` (164 LOC): setup do Nginx (location /uploads), env vars, configuração de webhook em cada loja WC, geração de Application Password no WP, testes curl, explicação do fluxo multi-tenant.

### Passos pós-merge (no VPS)

1. Aplicar migration 025:
   ```bash
   ssh root@2.25.153.162
   cd /var/www/cds-erp && git pull
   sudo -u postgres psql -d cdserp -f migrations/025_wc_propostas_comprovantes_extended.sql
   ```

2. Criar pasta de uploads + Nginx config (ver `SETUP-WC-COMPROVANTES.md` seção 2).

3. Adicionar no `/var/www/cds-erp/.env`:
   ```
   UPLOAD_DIR=/var/www/cds-erp/uploads/comprovantes
   PUBLIC_URL_BASE=https://erp.cdsind.com.br/uploads/comprovantes
   GROQ_API_KEY=...   # grátis em console.groq.com — destrava OCR
   ```

4. `pm2 restart cds-erp --update-env`

5. (Opcional) Configurar webhooks WC em cada loja: `https://erp.cdsind.com.br/api/wc-webhook?loja_id=UUID`

### Testes que rodei localmente
- `tsc --noEmit`: novos arquivos sem erros (erros pré-existentes em DashboardLayout não relacionados a este PR)
- `vite build`: passou em 19.68s (3.94 MB JS, +1.5kB do novo componente)

### Compatibilidade
- 100% retro-compatível. `wc-sync` sem `entity` continua tratando como `pedidos`. Comprovantes antigos com `arquivo_url` externo continuam funcionando.
- Funções SQL são idempotentes — chamar 2x não duplica.
- Webhook é tolerante a falhas — payload mal-formado vira evento com `erro` mas não derruba o endpoint.
