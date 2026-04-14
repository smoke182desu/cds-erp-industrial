import axios from 'axios';

const FIREBASE_API_KEY = 'AIzaSyCr_o3dEiSExaafhkP57SpTf1wTLQSIiMs';
const PROJECT_ID      = 'gen-lang-client-0908948294';
const DATABASE_ID     = 'ai-studio-eb49ab80-1528-409e-b7d5-b3e84e7a358d';
const BASE_URL        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const EVOLUTION_API_URL    = process.env.EVOLUTION_API_URL    || 'https://evolution-api-production-903e.up.railway.app';
const EVOLUTION_API_KEY    = process.env.EVOLUTION_API_KEY    || '';
const EVOLUTION_INSTANCE   = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';

function str(v) { return { stringValue: String(v || '') }; }
function ts()   { return { timestampValue: new Date().toISOString() }; }

async function firestoreAdd(collection, fields) {
    const res = await axios.post(`${BASE_URL}/${collection}?key=${FIREBASE_API_KEY}`, { fields });
    return res.data.name.split('/').pop();
}

async function buscarMensagens(telefone) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const body = {
          structuredQuery: {
                  from: [{ collectionId: 'mensagens' }],
                  where: { fieldFilter: { field: { fieldPath: 'telefone' }, op: 'EQUAL', value: { stringValue: telefone } } },
                  limit: 200,
          },
    };
    const res = await axios.post(url, body);
    return (res.data || [])
      .filter(r => r.document)
      .map(r => {
              const f = r.document.fields || {};
              return {
                        id: r.document.name.split('/').pop(),
                        telefone: f.telefone?.stringValue || '',
                        mensagem: f.mensagem?.stringValue || '',
                        tipo: f.tipo?.stringValue || 'entrada',
                        timestamp: f.timestamp?.stringValue || f.timestamp?.timestampValue || '',
                        nome: f.nome?.stringValue || '',
              };
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - buscar historico de mensagens
  if (req.method === 'GET') {
        const { telefone } = req.query;
        if (!telefone) return res.status(400).json({ error: 'telefone obrigatorio' });
        try {
                const mensagens = await buscarMensagens(telefone);
                return res.status(200).json(mensagens);
        } catch (err) {
                console.error('Erro GET mensagens:', err.message);
                return res.status(500).json({ error: err.message });
        }
  }

  // POST - enviar mensagem via Evolution API
  if (req.method === 'POST') {
        const { telefone, mensagem, nome } = req.body || {};
        if (!telefone || !mensagem) return res.status(400).json({ error: 'telefone e mensagem obrigatorios' });

      const numero = String(telefone).replace(/\D/g, '');

      try {
              // Enviar via Evolution API
          const evoRes = await axios.post(
                    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
            { number: numero, text: mensagem },
            { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
                  );

          // Salvar no Firestore como mensagem de saida
          const id = await firestoreAdd('mensagens', {
                    telefone: str(telefone),
                    mensagem: str(mensagem),
                    nome: str(nome || ''),
                    tipo: str('saida'),
                    timestamp: ts(),
                    messageId: str(evoRes.data?.key?.id || ''),
          });

          return res.status(200).json({ success: true, id, messageId: evoRes.data?.key?.id });
      } catch (err) {
              console.error('Erro POST mensagem:', err.response?.data || err.message);
              return res.status(500).json({ error: err.message, details: err.response?.data });
      }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
