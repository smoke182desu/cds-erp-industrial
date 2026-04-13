import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID = 'gen-lang-client-0908948294';
const DATABASE_ID = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-webhook-secret'] || req.query.secret;
  if (secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { nome, email, telefone, mensagem, origem = 'site', empresa } = req.body;
  if (!nome && !telefone) {
    return res.status(400).json({ error: 'Nome ou telefone sao obrigatorios' });
  }

  const lead = {
    fields: {
      nome:     { stringValue: nome || '' },
      email:    { stringValue: email || '' },
      telefone: { stringValue: telefone || '' },
      mensagem: { stringValue: mensagem || '' },
      empresa:  { stringValue: empresa || '' },
      origem:   { stringValue: origem },
      status:   { stringValue: 'novo' },
      criadoEm: { timestampValue: new Date().toISOString() },
    }
  };

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/leads?key=${FIREBASE_API_KEY}`;

  try {
    const response = await axios.post(url, lead);
    const id = response.data.name.split('/').pop();
    return res.status(201).json({ success: true, id });
  } catch (error) {
    console.error('Firestore error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao salvar lead' });
  }
}
