import { phpFetch } from './_lib/php-api.js';

function formatarLead(lead) {
    let nome = lead.nome || '';
    const tel = lead.telefone || '';
    // Remove "+" inicial para teste numerico, garante sem duplicar prefixo
    const nomeDigits = nome.replace(/^\+/, '');
    if (/^\d{10,}$/.test(nomeDigits)) {
          if (nomeDigits.startsWith('55') && nomeDigits.length >= 12 && nomeDigits.length <= 13) {
                  const ddd = nomeDigits.substring(2, 4);
                  const num = nomeDigits.substring(4);
                  nome = '(' + ddd + ') ' + num.substring(0, num.length - 4) + '-' + num.substring(num.length - 4);
          } else {
                  // Internacional: garante prefixo "+" sem duplicar
                  nome = '+' + nomeDigits;
          }
    }
    return { ...lead, nome, telefone: tel };
}

                    export default async function handler(req, res) {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                        if (req.method === 'OPTIONS') return res.status(200).end();
                        try {
                              if (req.method === 'GET') {
                                      const r = await phpFetch('leads');
                                      const data = await r.json();
                                      const leads = Array.isArray(data) ? data : (data.leads || []);
                                      return res.status(200).json(leads.map(formatarLead));
                              }
                              if (req.method === 'POST') {
                                      const r = await phpFetch('leads', { method: 'POST', body: req.body });
                                      return res.status(201).json(await r.json());
                              }
                              if (req.method === 'PUT') {
                                      const id = req.query.id;
                                      if (!id) return res.status(400).json({ error: 'id required' });
                                      const r = await phpFetch('leads', { method: 'PUT', params: { id }, body: req.body });
                                      return res.status(200).json(await r.json());
                              }
                              if (req.method === 'DELETE') {
                                      const id = req.query.id;
                                      if (!id) return res.status(400).json({ error: 'id required' });
                                      const r = await phpFetch('leads', { method: 'DELETE', params: { id } });
                                      return res.status(200).json(await r.json());
                                        }
                              return res.status(405).json({ error: 'Method not allowed' });
                        } catch (err) {
                              return res.status(500).json({ error: err.message || 'Internal error' });
                        }
                    }