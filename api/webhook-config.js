// api/webhook-config.js
// Endpoint para consultar e configurar o webhook da Evolution API
// GET: mostra config atual do webhook
// POST: configura webhook para capturar mensagens de saida (MESSAGES_UPSERT)
// DELETE: remove webhook
//
// IMPORTANTE: Este endpoint usa as env vars do Vercel (EVOLUTION_API_KEY, etc)
// Protegido por query param ?secret=<EVOLUTION_API_KEY> para evitar acesso nao autorizado

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
  const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
  const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';
  const WEBHOOK_URL = 'https://erp.cdsind.com.br/api/whatsapp';

  if (!EVOLUTION_API_KEY) {
    return res.status(500).json({ error: 'EVOLUTION_API_KEY nao configurada nas env vars' });
  }

  // Protecao simples: exige secret na query string
  const { secret } = req.query;
  if (secret !== EVOLUTION_API_KEY) {
    return res.status(401).json({ error: 'Acesso nao autorizado. Use ?secret=SUA_API_KEY' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY
  };

  try {
    // GET - Consultar webhook atual
    if (req.method === 'GET') {
      const response = await fetch(
        `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
        { headers }
      );
      const data = await response.json();
      return res.status(200).json({
        status: 'ok',
        instance: INSTANCE_NAME,
        evolutionUrl: EVOLUTION_API_URL,
        webhookConfig: data
      });
    }

    // POST - Configurar webhook para mensagens de saida
    if (req.method === 'POST') {
      const webhookPayload = {
        url: WEBHOOK_URL,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
          'CONNECTION_UPDATE'
        ]
      };

      const response = await fetch(
        `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(webhookPayload)
        }
      );
      const data = await response.json();

      return res.status(200).json({
        status: 'ok',
        message: 'Webhook configurado com sucesso',
        instance: INSTANCE_NAME,
        webhookUrl: WEBHOOK_URL,
        events: webhookPayload.events,
        response: data
      });
    }

    // DELETE - Remover webhook
    if (req.method === 'DELETE') {
      const response = await fetch(
        `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: '', events: [] })
        }
      );
      const data = await response.json();
      return res.status(200).json({
        status: 'ok',
        message: 'Webhook removido',
        response: data
      });
    }

    return res.status(405).json({ error: 'Metodo nao permitido' });

  } catch (error) {
    console.error('Erro webhook-config:', error);
    return res.status(500).json({
      error: 'Erro ao comunicar com Evolution API',
      details: error.message
    });
  }
}
