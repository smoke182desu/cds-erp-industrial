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
                        const texto = f.texto?.stringValue || f.mensagem?.stringValue || '';
                        const criadoEm = f.criadoEm?.timestampValue || f.timestamp?.timestampValue || f.timestamp?.stringValue || '';
                        return {
                                                  id: r.document.name.split('/').pop(),
                                                  telefone: f.telefone?.stringValue || '',
                                                  texto,
                                                  tipo: f.tipo?.stringValue || 'entrada',
                                                  criadoEm,
                                                  leadId: f.leadId?.stringValue || '',
                                                  origem: f.origem?.stringValue || 'whatsapp',
                        };
        })
        .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
}

export default async function handler(req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.status(200).end();

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

  if (req.method === 'POST') {
            const { telefone, mensagem, texto: textoBody, leadId } = req.body || {};
            const textoEnviar = textoBody || mensagem;
            if (!telefone || !textoEnviar) return res.status(400).json({ error: 'telefone e mensagem obrigatorios' });

        const numero = String(telefone).replace(/\D/g, '');

        try {
                        const evoRes = await axios.post(
                                              `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
                          { number: numero, text: textoEnviar },
                          { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
                                            );

              const id = await firestoreAdd('mensagens', {
                                    telefone: str(telefone),
                                    texto:    str(textoEnviar),
                                    leadId:   str(leadId || ''),
                                    tipo:     str('saida'),
                                    origem:   str('whatsapp'),
                                    criadoEm: ts(),
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
