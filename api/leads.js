import { phpFetch } from './_lib/php-api.js';


// Detecta se string eh um LID do WhatsApp (ID anonimo da Meta introduzido em 2024-2025).
// LIDs chegam via Evolution API em 'remoteJid' quando a Meta anonimiza o contato.
// Nao sao telefones validos e nao devem ser formatados como tal.
function isLID(digits) {
  // E.164 maximo oficial = 15 digitos. LIDs do WhatsApp tem 15+ digitos puros.
  if (digits.length >= 15) return true;
  // 14 digitos sem DDI conhecido (55=BR, 1=US, 44=UK, etc) tambem suspeito
  if (digits.length >= 14 && !digits.startsWith('55') && !digits.startsWith('1')) return true;
  return false;
}

function formatarLead(lead) {
  let nome = lead.nome || '';
  const tel = lead.telefone || '';
  // Fallback: se o registro tiver pushName do WhatsApp, usa como nome prioritario
  const pushName = lead.push_name || lead.pushName || lead.nome_contato || '';

  // Remove "+" inicial para teste numerico
  const nomeDigits = nome.replace(/^\+/, '');

  if (/^\d{10,}$/.test(nomeDigits)) {
    // Telefone brasileiro: DDI 55 + DDD + numero (12-13 digitos)
    if (nomeDigits.startsWith('55') && nomeDigits.length >= 12 && nomeDigits.length <= 13) {
      const ddd = nomeDigits.substring(2, 4);
      const num = nomeDigits.substring(4);
      nome = '(' + ddd + ') ' + num.substring(0, num.length - 4) + '-' + num.substring(num.length - 4);
    } else if (isLID(nomeDigits)) {
      // LID do WhatsApp: prioriza pushName; senao mostra "Aguardando identificacao"
      nome = pushName && pushName.trim() ? pushName.trim() : 'Aguardando identificacao';
    } else {
      // Internacional valido: prefixa "+" sem duplicar
      nome = '+' + nomeDigits;
    }
  } else if ((!nome || !nome.trim()) && pushName) {
    // Nome vazio mas temos pushName: usa ele
    nome = pushName.trim();
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
