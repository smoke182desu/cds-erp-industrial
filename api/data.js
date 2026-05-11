// api/data.js — dispatcher unificado
import { sb, selectAll, insert, update, upsertByField } from './_lib/supabase.js';

const FUNCIONARIOS_IA = [
  {
    nome: 'Giorno Giovanna',
    email: 'giorno.vendas@cdsind.com.br',
    telefone: '',
    tipo: 'FUNC',
    documento: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: 'Brasilia',
    uf: 'DF',
    complemento: 'Operador de Vendas IA',
    orgao: 'Atendimento Comercial',
    dores: ['Responder clientes', 'Qualificar produtos', 'Conduzir orcamentos']
  },
  {
    nome: 'Bruno Bucciarati',
    email: 'bruno.gerente@cdsind.com.br',
    telefone: '',
    tipo: 'FUNC',
    documento: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: 'Brasilia',
    uf: 'DF',
    complemento: 'Gerente de Vendas IA',
    orgao: 'Gestao Comercial',
    dores: ['Gerenciar atendimentos', 'Identificar novos produtos', 'Orientar o dono']
  }
];

function sanitizeClientePayload(data = {}) {
  const payload = {
    nome: data.nome || '',
    email: data.email || '',
    telefone: data.telefone || '',
    tipo: data.tipo || 'PJ',
    documento: data.documento || data.cnpj || data.cnpj_cpf || '',
    cnpj: data.cnpj || '',
    cep: data.cep || '',
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    bairro: data.bairro || '',
    cidade: data.cidade || '',
    uf: data.uf || '',
    complemento: data.complemento || '',
    orgao: data.orgao || '',
    razao_social: data.razao_social || data.razaoSocial || '',
    nome_fantasia: data.nome_fantasia || data.nomeFantasia || '',
    inscricao_estadual: data.inscricao_estadual || data.inscricaoEstadual || '',
    funnel_stage: data.funnel_stage || data.funnelStage || null,
    dores: Array.isArray(data.dores) ? data.dores : []
  };

  if (data.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(data.id))) {
    payload.id = data.id;
  }
  return payload;
}

async function salvarClientePersistente(data = {}) {
  const payload = sanitizeClientePayload(data);
  if (payload.id) {
    const { id, ...semId } = payload;
    return await update('clientes', 'id', id, semId);
  }
  if (payload.telefone) return await upsertByField('clientes', payload, 'telefone');
  if (payload.email) {
    const existente = await selectAll('clientes', { filters: { email: `eq.${payload.email}` }, limit: 1 });
    if (existente[0]?.id) return await update('clientes', 'id', existente[0].id, payload);
  }
  return await insert('clientes', payload);
}

async function garantirFuncionariosIA() {
  for (const funcionario of FUNCIONARIOS_IA) {
    await salvarClientePersistente(funcionario);
  }
}

async function handleClientes(req, res) {
  const TABLE = 'clientes';
  if (req.method === 'GET') {
    await garantirFuncionariosIA();
    const data = await selectAll(TABLE, { orderBy: 'nome' });
    return res.status(200).json({ clientes: data });
  }
  if (req.method === 'POST') {
    const saved = await salvarClientePersistente(req.body || {});
    return res.status(200).json(saved);
  }
  return res.status(405).json({ error: 'Metodo nao permitido' });
}

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

function parsearPayloadCalc(body, query) {
  const d = { ...query, ...body };
  return {
    nome: d.nome || d.name || d.cliente || '',
    email: d.email || d.mail || '',
    telefone: String(d.telefone || d.phone || d.celular || d.whatsapp || '').replace(/\D/g,''),
    empresa: d.empresa || d.company || '',
    observacoes: `Orcamento calculadora`,
    valor: parseFloat(d.valor_total || d.total || d.preco || '0')
  };
}

async function handleCalculadora(req, res) {
  if (req.method === 'GET' && !req.query.nome && !req.query.email && !req.query.telefone) {
    return res.status(200).json({ ok: true, service: 'calculadora-webhook' });
  }
  const data = parsearPayloadCalc(req.body || {}, req.query || {});
  if (!data.nome && !data.email && !data.telefone) {
    return res.status(400).json({ error: 'Dados insuficientes' });
  }
  const cliente = await upsertByField('clientes', { nome: data.nome || 'Lead Calculadora', email: data.email, telefone: data.telefone, empresa: data.empresa, origem: 'calculadora', tipo: 'pre_cadastro' }, 'telefone');
  const lead = await insert('leads', { nome: data.nome || 'Lead Calculadora', email: data.email, telefone: data.telefone, origem: 'calculadora', etapa: 'lead_novo', observacoes: data.observacoes, cliente_id: cliente.id, valor: data.valor });
  return res.status(200).json({ ok: true, leadId: lead.id, clienteId: cliente.id });
}

async function handleRelinkLeads(req, res) {
  try {
    const todosLeads = await selectAll('leads', { orderBy: 'criado_em' });
    const result = { totalLeads: todosLeads.length, atualizados: 0, jaCorretos: 0, semNome: 0, errors: [] };
    for (const lead of todosLeads) {
      try {
        if (!lead.telefone) { result.semNome++; continue; }
        const msgs = await selectAll('mensagens', { filters: { telefone: `eq.${lead.telefone}`, tipo: 'eq.entrada' } });
        const msgComNome = (msgs || []).find(m => m.remetente && String(m.remetente).trim().length > 0 && m.remetente !== 'CDS');
        const novoNome = msgComNome ? String(msgComNome.remetente).trim() : null;
        if (!novoNome) { result.semNome++; continue; }
        if (lead.nome === novoNome) { result.jaCorretos++; continue; }
        await sb(`/leads?id=eq.${lead.id}`, { method: 'PATCH', body: { nome: novoNome, atualizado_em: new Date().toISOString() } });
        result.atualizados++;
      } catch (e) {
        result.errors.push({ leadId: lead.id, err: e.message });
      }
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ——— FOTOS — busca fotos de perfil via Evolution API ———
async function handleFotos(req, res) {
  const EVO_URL = String(process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app').trim().replace(/\s+$/,'').replace(/\/$/,'');
  const EVO_KEY = String(process.env.EVOLUTION_API_KEY || '').trim();
  const EVO_INSTANCE = String(process.env.EVOLUTION_INSTANCE_NAME || 'cdsind').trim();
  if (!EVO_KEY) return res.status(500).json({ error: 'EVOLUTION_API_KEY nao configurada' });
  
  const headers = { apikey: EVO_KEY, 'Content-Type': 'application/json' };
  
  async function fetchPic(telefone) {
    const number = String(telefone).replace(/\D/g, '');
    if (!number) return null;
    try {
      const r = await fetch(`${EVO_URL}/chat/fetchProfilePictureUrl/${EVO_INSTANCE}`, {
        method: 'POST', headers, body: JSON.stringify({ number })
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data?.profilePictureUrl || data?.profile_picture_url || null;
    } catch (e) { return null; }
  }

  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const refazer = req.query.refazer === '1';
    const todos = await selectAll('leads', { orderBy: 'atualizado_em', limit: 300 });
    const target = refazer ? todos : todos.filter(l => !l.foto_url && l.etapa !== 'lid_oculto');
    const lista = target.slice(0, limit);
    const result = { totalCandidatos: target.length, processados: 0, atualizados: 0, semFoto: 0, errors: [] };
    for (const lead of lista) {
      if (!lead.telefone) continue;
      result.processados++;
      try {
        const fotoUrl = await fetchPic(lead.telefone);
        if (fotoUrl) {
          await sb(`/leads?id=eq.${lead.id}`, { method: 'PATCH', body: { foto_url: fotoUrl } });
          result.atualizados++;
        } else {
          result.semFoto++;
        }
      } catch (e) {
        result.errors.push({ id: lead.id, err: e.message });
      }
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleEvolutionDiag(req, res) {
  const EVO_URL = String(process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app').trim().replace(/\s+$/,'').replace(/\/$/,'');
  const EVO_KEY = String(process.env.EVOLUTION_API_KEY || '').trim();
  const EVO_INSTANCE = String(process.env.EVOLUTION_INSTANCE_NAME || 'cdsind').trim();
  const EXPECTED_WEBHOOK = 'https://erp.cdsind.com.br/api/whatsapp';
  if (!EVO_KEY) return res.status(500).json({ error: 'EVOLUTION_API_KEY nao configurada' });
  const headers = { apikey: EVO_KEY, 'Content-Type': 'application/json' };

  if (String(req.query.action||'').toLowerCase() === 'backfill') {
    const maxChats = parseInt(req.query.maxChats||'500', 10);
    const maxMsgs = parseInt(req.query.maxMsgs||'100', 10);
    const offset = parseInt(req.query.offset||'0', 10);
    try {
      const chatsRes = await fetch(`${EVO_URL}/chat/findChats/${EVO_INSTANCE}`, { method: 'POST', headers, body: JSON.stringify({}) });
      const chats = await chatsRes.json();
      if (!Array.isArray(chats)) return res.status(500).json({ error: 'chats not array', got: chats });
      const results = { totalChats: chats.length, offset, processedChats: 0, totalMessages: 0, importedMessages: 0, leadsCreated: 0, errors: [] };
      const limited = chats.slice(offset, offset + maxChats);
      for (const chat of limited) {
        const remoteJid = chat.remoteJid || chat.id;
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast') || remoteJid.includes('@lid') || remoteJid.startsWith('0@')) continue;
        results.processedChats++;
        const numero = remoteJid.split('@')[0];
        if (!/^\d{10,15}$/.test(numero)) continue;
        const pushName = chat.pushName || chat.name || '';
        try {
          const mRes = await fetch(`${EVO_URL}/chat/findMessages/${EVO_INSTANCE}`, { method: 'POST', headers, body: JSON.stringify({ where: { key: { remoteJid } }, limit: maxMsgs }) });
          const mData = await mRes.json();
          let msgs = mData.messages?.records || mData.records || (Array.isArray(mData)?mData:[]);
          const dias = parseInt(req.query.dias || '30', 10);
          const cutoff = Date.now() - (dias * 24 * 60 * 60 * 1000);
          msgs = msgs.filter(m => { const ts = m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now(); return ts >= cutoff; });
          if (!msgs.length) continue;
          results.totalMessages += msgs.length;
          const rows = msgs.map(m => {
            const key = m.key || {};
            const message = m.message || {};
            const texto = message.conversation || message.extendedTextMessage?.text || m.content || m.text || '';
            const ts = m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
            return { telefone: numero, texto, tipo: key.fromMe ? 'saida' : 'entrada', remetente: key.fromMe ? 'CDS' : (m.pushName || pushName || numero), criado_em: ts };
          }).filter(r => r.texto.trim());
          if (rows.length) {
            const batchRes = await sb(`/mensagens`, { method: 'POST', body: rows });
            if (batchRes.ok) results.importedMessages += rows.length;
            else results.errors.push({ numero, status: batchRes.status });
            const lastMsg = rows[rows.length - 1];
            const pushNameValido = pushName && pushName !== 'CDS' ? pushName : (rows.find(r => r.tipo === 'entrada' && r.remetente !== 'CDS')?.remetente || numero);
            await upsertByField('leads', { telefone: numero, nome: pushNameValido, etapa: 'lead_novo', ultima_mensagem: lastMsg.texto || '', criado_em: lastMsg.criado_em, atualizado_em: lastMsg.criado_em }, 'telefone');
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

  if (req.method === 'POST' && String(req.query.action||'').toLowerCase() === 'set') {
    const webhookUrl = (req.body && req.body.url) || EXPECTED_WEBHOOK;
    const events = (req.body && req.body.events) || ['MESSAGES_UPSERT'];
    const r = await fetch(`${EVO_URL}/webhook/set/${EVO_INSTANCE}`, { method: 'POST', headers, body: JSON.stringify({ url: webhookUrl, enabled: true, webhook_by_events: false, events }) });
    const data = await r.json();
    return res.status(r.status).json({ ok: r.ok, action: 'set', sent: { url: webhookUrl, events }, response: data });
  }

  try {
    const [wRes, sRes] = await Promise.all([
      fetch(`${EVO_URL}/webhook/find/${EVO_INSTANCE}`, { headers }),
      fetch(`${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`, { headers }),
    ]);
    const wData = await wRes.json();
    const sData = await sRes.json();
    const currentUrl = wData && (wData.url || wData.webhook?.url || wData.Webhook?.url);
    return res.status(200).json({ ok: true, instance: EVO_INSTANCE, current_webhook: currentUrl || null, matches_expected: currentUrl === EXPECTED_WEBHOOK, webhook_raw: wData, connection_state: sData });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleConfig(req, res) {
  const col = req.query.col || req.query.collection || 'config';
  const doc = req.query.doc;
  if (!doc) return res.status(400).json({ error: 'doc obrigatorio' });

  try {
    if (req.method === 'GET') {
      const data = await selectAll('configs', { 
        filters: { 
          collection: `eq.${col}`,
          key: `eq.${doc}`
        }
      });
      const result = data[0]?.data || data[0]?.value || {};
      return res.status(200).json({ ok: true, data: result });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const payload = {
        collection: col,
        key: doc,
        data: req.body || {}
      };
      const result = await upsertByField('configs', payload, 'key');
      return res.status(200).json({ ok: true, data: result });
    }

    return res.status(405).json({ error: 'metodo nao permitido' });
  } catch (err) {
    console.error('[config] erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const resource = String(req.query.resource || '').toLowerCase();
  try {
    if (resource === 'clientes') return await handleClientes(req, res);
    if (resource === 'projects') return await handleProjects(req, res);
    if (resource === 'calculadora') return await handleCalculadora(req, res);
    if (resource === 'evolution-diag') return await handleEvolutionDiag(req, res);
    if (resource === 'relink-leads') return await handleRelinkLeads(req, res);
    if (resource === 'fotos') return await handleFotos(req, res);
    if (resource === 'config') return await handleConfig(req, res);
    return res.status(400).json({ error: 'resource invalido (use clientes|projects|calculadora|evolution-diag|relink-leads|fotos|config)' });
  } catch (err) {
    console.error(`[data] erro (${resource}):`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
