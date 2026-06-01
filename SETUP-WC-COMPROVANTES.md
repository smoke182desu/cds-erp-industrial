# Setup: Integração WooCommerce + Propostas + Comprovantes

Sprint I+J+K+L — entregue em uma rodada. Documenta o que voce precisa configurar no VPS e em cada loja WC pra ativar.

## 1) Aplicar migration 025 no Postgres do VPS

```bash
ssh root@2.25.153.162
cd /var/www/cds-erp
sudo -u postgres psql -d cdserp -f migrations/025_wc_propostas_comprovantes_extended.sql
```

Cria: `wc_clientes`, `wc_produtos`, `wc_cupons`, `comprovantes_arquivos`, `wc_webhook_eventos`, `bank_webhooks_recebidos`. Estende `wc_lojas`, `wc_pedidos`, `comprovantes`. Cria 2 funções: `wc_pedido_para_proposta()` e `wc_pedido_para_comprovante()`.

## 2) Criar pasta de uploads e configurar Nginx

```bash
mkdir -p /var/www/cds-erp/uploads/comprovantes
chown -R www-data:www-data /var/www/cds-erp/uploads
chmod 750 /var/www/cds-erp/uploads
```

No `/etc/nginx/sites-available/erp.cdsind.com.br` adicionar dentro do server block:

```nginx
# Servir uploads de comprovantes (privado — só logado)
location /uploads/comprovantes/ {
    alias /var/www/cds-erp/uploads/comprovantes/;
    # auth_request /api/_auth/check;   # quando tiver auth backend
    expires 1d;
    add_header X-Content-Type-Options nosniff;
    add_header Content-Security-Policy "default-src 'none'";
}

# Aumentar body size pra upload de PDF
client_max_body_size 20M;
```

Recarregar:
```bash
nginx -t && systemctl reload nginx
```

## 3) Variáveis de ambiente

Adicionar em `/var/www/cds-erp/.env`:

```ini
# Uploads
UPLOAD_DIR=/var/www/cds-erp/uploads/comprovantes
UPLOAD_MAX_BYTES=15728640
PUBLIC_URL_BASE=https://erp.cdsind.com.br/uploads/comprovantes

# OCR (pelo menos uma):
# Groq grátis em https://console.groq.com/keys
GROQ_API_KEY=gsk_...
# OU Anthropic Claude (paid)
ANTHROPIC_API_KEY=sk-ant-...
# OU OpenAI (paid)
OPENAI_API_KEY=sk-...

# Webhooks bancários (opcional, por banco):
SICOOB_WEBHOOK_SECRET=...
ITAU_WEBHOOK_SECRET=...
BRADESCO_WEBHOOK_SECRET=...
BB_WEBHOOK_SECRET=...
BANK_WEBHOOK_SECRET=...
```

Restart depois:
```bash
pm2 restart cds-erp --update-env
```

## 4) Configurar webhook do WooCommerce em cada loja

No WP-Admin de cada loja → WooCommerce → Configurações → Avançado → Webhooks → Adicionar webhook:

| Campo | Valor |
|-------|-------|
| Nome | CDS ERP — Pedidos |
| Status | Ativo |
| Tópico | Order created (criar mais um pra "Order updated") |
| URL de entrega | `https://erp.cdsind.com.br/api/wc-webhook?loja_id=UUID_DA_LOJA` |
| Chave secreta | gera aleatória 32+ chars |
| Versão da API | WP REST API v3 |

A `UUID_DA_LOJA` está em wc_lojas.id no banco — pega pela UI Tráfego/WooCommerce ou:

```bash
sudo -u postgres psql -d cdserp -c "SELECT id, nome, url FROM wc_lojas;"
```

A mesma chave secreta vai em wc_lojas.webhook_secret pra validar:

```sql
UPDATE wc_lojas SET webhook_secret = 'A_MESMA_CHAVE' WHERE id = 'UUID_DA_LOJA';
```

Repete pra os tópicos:
- Order created
- Order updated  
- Customer created
- Product updated
- Coupon created

## 5) (Opcional) WordPress Application Password pra sync de usuários

Pra puxar usuários WP que ainda não são clientes WC:

WP-Admin → Usuários → Seu perfil → role até "Application Passwords" → digita nome (ex: "ERP CDS") → Add New Application Password → copia o token gerado (formato: `xxxx xxxx xxxx xxxx xxxx xxxx`).

No ERP, edita a wc_loja:
```sql
UPDATE wc_lojas SET wp_user = 'admin', wp_app_password = 'xxxx xxxx xxxx xxxx xxxx xxxx' WHERE id = 'UUID';
```

Sincronizar:
```bash
curl -X POST https://erp.cdsind.com.br/api/wc-sync -H 'Content-Type: application/json' -d '{"loja_id":"UUID","entity":"wp_users"}'
```

## 6) Testar end-to-end

```bash
# Sincronizar pedidos (puxa últimos 90d e auto-cria propostas+comprovantes pros pagos)
curl -X POST https://erp.cdsind.com.br/api/wc-sync \
  -H 'Content-Type: application/json' \
  -d '{"loja_id":"UUID","entity":"tudo"}'

# Upload de comprovante (após criar comprovante manual)
curl -X POST https://erp.cdsind.com.br/api/comprovantes/upload \
  -F "comprovante_id=UUID_COMPROVANTE" \
  -F "file=@/tmp/comprovante.pdf"

# OCR
curl -X POST https://erp.cdsind.com.br/api/comprovantes/ocr \
  -H 'Content-Type: application/json' \
  -d '{"comprovante_id":"UUID_COMPROVANTE"}'

# Bank webhook (simulação)
curl -X POST 'https://erp.cdsind.com.br/api/bank-webhook?banco=generic&cliente_id=UUID_EMPRESA' \
  -H 'Content-Type: application/json' \
  -d '{"txid":"abc123","valor":150,"horario":"2026-06-01T10:00:00Z","pagador":{"nome":"Joao","cpf":"12345"}}'
```

## 7) Como funciona o fluxo Multi-tenant

Toda tabela tem `cliente_agencia_id`. Quando o webhook do WC chega:

1. Recebe na URL `?loja_id=UUID` → resolve a loja
2. Pega `loja.cliente_agencia_id` → essa é a empresa-cliente da agência
3. Cria/atualiza wc_pedidos com esse cliente_agencia_id
4. Se `loja.auto_criar_proposta=true` E pedido pago → chama `wc_pedido_para_proposta()` → cria em propostas_geradas com numero único POR EMPRESA (CDS-0001, PAD-0001, etc.)
5. Mesma coisa pra comprovante via `wc_pedido_para_comprovante()`

Isso significa: cada uma das 10+ empresas tem seu próprio fluxo isolado.

## 8) Aperto da segurança (recomendado)

- Renomear `webhook_secret` periodicamente em ambos lados (WC e DB)
- Configurar Cloudflare Rate Limiting em `/api/wc-webhook` e `/api/bank-webhook`
- Backup automático do `/var/www/cds-erp/uploads/` (script de backup já existe pra Postgres — adicionar este dir)

