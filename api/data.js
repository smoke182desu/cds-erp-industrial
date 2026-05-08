// api/data.js — dispatcher unificado para clientes/projects/calculadora via Supabase
import { sb, selectAll, insert, upsertByField } from './_lib/supabase.js';

// ——— clientes ———
async function handleClientes(req, res) {
  const TABLE = 'clientes';
  if (req.method === 'GET') {
    const data = await selectAll(TABLE, { orderBy: 'nome' });
    return res.status(200).json({ clientes: data });
  }
  if (req.method === 'POST') {
    // Upsert por telefone ou email para evitar duplicatas
    let conflictField = 'id';
    if (req.body?.telefone) conflictField = 'telefone';
    else if (req.body?.email) conflictField = 'email';
    
    const saved = await upsertByField(TABLE, req.body || {}, conflictField);
    return res.status(200).json(saved);
  }
  return res.status(405).json({ error: 'Metodo nao permitido' });
}

// ——— projects ———
async function handleProjects(req, res) {
  const TABLE = 'projects';
  const { id } = req.query;
  if (req.method === 'GET') {
    if (id) {
      const data = await selectAll(TABLE, { filters: { id: `eq.${id}` } });
      return res.status(200).json(data[0] || { error: 'Not found' });
    }
    const data = await selectAll(TABLE, { orderBy: 'created_at' });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const saved = await insert(TABLE, req.body || {});
    return res.status(200).json(saved);
  }
  return res.status(405).json({ error: 'Metodo nao permitido' });
}

// ——— calculadora (webhook escadas) ———
function parsearPayloadCalc(body, query) {
  const d = { ...query, ...body };
  const nome     = d.nome     || d.name     || d.cliente  || '';
  const email    = d.email    || d.mail     || '';
  const telefone = d.telefone || d.phone    || d.celular  || d.whatsapp || '';
  const empresa  = d.empresa  || d.company  || '';
  const tipo     = d.tipo_escada || d.tipo  || '';
  const largura  = d.largura  || d.width    || '';
  const altura   = d.altura   || d.height   || '';
  const degraus  = d.degraus  || d.steps    || '';
  const material = d.material || '';
  const valor    = parseFloat(d.valor_total || d.total || d.preco || '0');
  const partes = [];
  if (tipo)     partes.push(`Tipo: ${tipo}`);
  if (material) partes.push(`Material: ${material}`);
  if (largura)  partes.push(`Largura: ${largura}m`);
  if (altura)   partes.push(`Altura: ${altura}m`);
  if (degraus)  partes.push(`Degraus: ${degraus}`);
  if (valor)    partes.push(`Estimativa: R$ ${valor.toFixed(2)}`);
  const observacoes = `Orcamento calculadora de escadas\n${partes.join(' | ')}`;
  return { nome, email, telefone: String(telefone).replace(/\D/g,''), empresa, observacoes, valor };
}

async function handleCalculadora(req, res) {
  if (req.method === 'GET' && !req.query.nome && !req.query.email && !req.query.telefone) {
    return res.status(200).json({ ok: true, service: 'calculadora-webhook' });
  }
  const data = parsearPayloadCalc(req.body || {}, req.query || {});
  if (!data.nome && !data.email && !data.telefone) {
    return res.status(400).json({ error: 'Dados insuficientes (nome, email ou telefone obrigatorio)' });
  }
  
  // 1. Upsert cliente no Supabase
  const cliente = await upsertByField('clientes', { 
    nome: data.nome || 'Lead Calculadora', 
    email: data.email, 
    telefone: data.telefone, 
    empresa: data.empresa, 
    origem: 'calculadora', 
    tipo: 'pre_cadastro' 
  }, 'telefone');

  // 2. Inserir lead no Supabase (tabela leads)
  const lead = await insert('leads', { 
    nome: data.nome || 'Lead Calculadora', 
    email: data.email, 
    telefone: data.telefone, 
    origem: 'calculadora', 
    etapa: 'lead_novo', 
    observacoes: data.observacoes, 
    cliente_id: cliente.id, 
    valor: data.valor 
  });

  return res.status(200).json({ ok: true, leadId: lead.id, clienteId: cliente.id });
}

// ——— evolution-diag (checar/ajustar webhook do Evolution API) ———
async function handleEvolutionDiag(req, res) {
  const EVO_URL = String(process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app').trim().replace(/\s+$/,'').replace(/\/$/,'');
  const EVO_KEY = String(process.env.EVOLUTION_API_KEY || '').trim();
  const EVO_INSTANCE = String(process.env.EVOLUTION_INSTANCE_NAME || 'cdsind').trim();
  const EXPECTED_WEBHOOK = 'https://erp.cdsind.com.br/api/whatsapp';
  
  // Aponta para o proprio Vercel agora que o PHP morreu
  const LOCAL_WEBHOOK = 'https://erp.cdsind.com.br/api/whatsapp';
  const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || '';

  if (!EVO_KEY) {
    return res.status(500).json({ error: 'EVOLUTION_API_KEY nao configurada no Vercel' });
  }

  const headers = { apikey: EVO_KEY, 'Content-Type': 'application/json' };

  // POST com action=chats_debug
  if (String(req.query.action||'').toLowerCase() === 'chats_debug') {
    try {
      const chatsRes = await fetch(`${EVO_URL}/chat/findChats/${EVO_INSTANCE}`, {
        method: 'POST', headers, body: JSON.stringify({})
      });
      const chats = await chatsRes.json();
      return res.status(200).json({ ok: true, chats: chats.slice(0, 100) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST com action=backfill puxa todas as conversas abertas e importa pro Supabase
  if (String(req.query.action||'').toLowerCase() === 'backfill') {
    const maxChats = parseInt(req.query.maxChats||'500', 10);
    const maxMsgs = parseInt(req.query.maxMsgs||'100', 10);
    const offset = parseInt(req.query.offset||'0', 10);
    try {
      const chatsRes = await fetch(`${EVO_URL}/chat/findChats/${EVO_INSTANCE}`, {
        method: 'POST', headers, body: JSON.stringify({})
      });
      const chats = await chatsRes.json();
      if (!Array.isArray(chats)) return res.status(500).json({ error: 'chats not array', got: chats });

      const results = { totalChats: chats.length, offset, processedChats: 0, totalMessages: 0, importedMessages: 0, leadsCreated: 0, errors: [] };
      const limited = chats.slice(offset, offset + maxChats);

      for (const chat of limited) {
        const remoteJid = chat.remoteJid || chat.id;
        // Ignorar grupos, broadcast e mensagens do sistema (0@). LIDs (usuarios de comunidades/business) sao mantidos.
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast') || remoteJid.startsWith('0@')) continue; 
        results.processedChats++;
        const numero = remoteJid.split('@')[0];
        const pushName = chat.pushName || chat.name || '';
        
        try {
          const mRes = await fetch(`${EVO_URL}/chat/findMessages/${EVO_INSTANCE}`, {
            method: 'POST', headers,
            body: JSON.stringify({ where: { key: { remoteJid } }, limit: maxMsgs })
          });
          const mData = await mRes.json();
          let msgs = mData.messages?.records || mData.records || (Array.isArray(mData)?mData:[]);
          
          // Filtrar mensagens muito antigas (padrão: 30 dias)
          const diasLimite = parseInt(req.query.dias || '30', 10);
          const cutoff = Date.now() - (diasLimite * 24 * 60 * 60 * 1000);
          msgs = msgs.filter(m => {
            const ts = m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now();
            return ts >= cutoff;
          });

          if (!msgs.length) continue;
          results.totalMessages += msgs.length;
          
          // Batch insert direto no Supabase
          const rows = msgs.map(m => {
            const key = m.key || {};
            const message = m.message || {};
            const texto = message.conversation 
              || message.extendedTextMessage?.text 
              || m.content || m.text || '';
            const ts = m.messageTimestamp 
              ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
              : new Date().toISOString();
            return {
              telefone: numero,
              texto: texto,
              tipo: key.fromMe ? 'saida' : 'entrada',
              remetente: key.fromMe ? 'CDS' : (m.pushName || pushName || numero),
              criado_em: ts
            };
          }).filter(r => r.texto.trim());

          if (rows.length) {
            const batchRes = await sb(`/mensagens`, { method: 'POST', body: rows });
            if (batchRes.ok) {
              results.importedMessages += rows.length;
            } else {
              results.errors.push({ numero, status: batchRes.status, body: JSON.stringify(batchRes.body).slice(0,200) });
            }
          }

          // Upsert lead
          if (rows.length) {
            const lastMsg = rows[rows.length - 1];
            await upsertByField('leads', {
              telefone: numero,
              nome: pushName || numero,
              etapa: 'lead_novo',
              ultima_mensagem: lastMsg.texto || '',
              criado_em: lastMsg.criado_em,
              atualizado_em: lastMsg.criado_em
            }, 'telefone');
            results.leadsCreated++;
          }
        } catch (e) {
          results.errors.push({ numero, err: e.message });
        }
      }
      return res.status(200).json({ ok: true, action: 'backfill', ...results });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST com action=set ajusta a URL do webhook
  if (req.method === 'POST' && String(req.query.action||'').toLowerCase() === 'set') {
    const webhookUrl = (req.body && req.body.url) || EXPECTED_WEBHOOK;
    const events = (req.body && req.body.events) || ['MESSAGES_UPSERT'];
    const r = await fetch(`${EVO_URL}/webhook/set/${EVO_INSTANCE}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: webhookUrl, enabled: true, webhook_by_events: false, events }),
    });
    const data = await r.json();
    return res.status(r.status).json({ ok: r.ok, action: 'set', sent: { url: webhookUrl, events }, response: data });
  }

  // GET (default) — lê webhook atual + estado da instancia
  try {
    const [wRes, sRes] = await Promise.all([
      fetch(`${EVO_URL}/webhook/find/${EVO_INSTANCE}`, { headers }),
      fetch(`${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`, { headers }),
    ]);
    const wData = await wRes.json();
    const sData = await sRes.json();
    const currentUrl = wData && (wData.url || wData.webhook?.url || wData.Webhook?.url);
    return res.status(200).json({
      ok: true,
      instance: EVO_INSTANCE,
      current_webhook: currentUrl || null,
      matches_expected: currentUrl === EXPECTED_WEBHOOK,
      webhook_raw: wData,
      connection_state: sData,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ——— dispatcher ———
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const resource = String(req.query.resource || '').toLowerCase();
  try {
    if (resource === 'clientes')       return await handleClientes(req, res);
    if (resource === 'projects')       return await handleProjects(req, res);
    if (resource === 'calculadora')    return await handleCalculadora(req, res);
    if (resource === 'evolution-diag') return await handleEvolutionDiag(req, res);
    return res.status(400).json({ error: 'resource invalido (use clientes|projects|calculadora|evolution-diag)' });
  } catch (err) {
    console.error(`[data] erro (${resource}):`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
