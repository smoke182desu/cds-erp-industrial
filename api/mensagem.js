// api/mensagem.js
// CRUD de mensagens + envio via Evolution API
// MIGRADO para Firebase Admin SDK para evitar quota 50k/dia da REST API publica

import axios from 'axios';
import { firestoreAdd, firestoreQueryMulti } from './lib/firestore.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';

// ---------- buscar mensagens por telefone (Admin SDK) ----------
async function buscarMensagens(telefone) {
  const mensagens = await firestoreQueryMulti(
    'mensagens',
    [{ field: 'telefone', op: '==', value: telefone }],
    'criadoEm',
    'asc',
    200
  );

  return mensagens.map(m => ({
    id: m.id,
    telefone: m.telefone || '',
    texto: m.texto || m.mensagem || '',
    tipo: m.tipo || 'entrada',
    criadoEm: m.criadoEm?.toDate?.() ? m.criadoEm.toDate().toISOString() : (m.criadoEm || ''),
    leadId: m.leadId || '',
    origem: m.origem || 'whatsapp',
  }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - buscar mensagens por telefone
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

  // POST - enviar mensagem via Evolution API + salvar no Firestore
  if (req.method === 'POST') {
    const { telefone, mensagem, texto: textoBody, leadId } = req.body || {};
    const textoEnviar = textoBody || mensagem;

    if (!telefone || !textoEnviar) {
      return res.status(400).json({ error: 'telefone e mensagem obrigatorios' });
    }

    const numero = String(telefone).replace(/\D/g, '');

    try {
      // Envia via Evolution API
      const evoRes = await axios.post(
        `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
        { number: numero, text: textoEnviar },
        { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
      );

      // Salva no Firestore via Admin SDK
      const id = await firestoreAdd('mensagens', {
        telefone: telefone,
        texto: textoEnviar,
        leadId: leadId || '',
        tipo: 'saida',
        origem: 'whatsapp',
        criadoEm: new Date(),
        messageId: evoRes.data?.key?.id || '',
      });

      return res.status(200).json({ success: true, id, messageId: evoRes.data?.key?.id });
    } catch (err) {
      console.error('Erro POST mensagem:', err.response?.data || err.message);
      return res.status(500).json({ error: err.message, details: err.response?.data });
    }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
