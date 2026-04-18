// api/data.js — dispatcher unificado para clientes/projects/calculadora via PHP/MySQL
import { phpFetch } from './_lib/php-api.js';

// ——— clientes ———
async function handleClientes(req, res) {
  if (req.method === 'GET') {
    const r = await phpFetch('clientes');
    const data = await r.json();
    return res.status(r.status).json({ clientes: data });
  }
  if (req.method === 'POST') {
    const r = await phpFetch('clientes', { method: 'POST', body: req.body || {} });
    const data = await r.json();
    return res.status(r.status).json(data);
  }
  return res.status(405).json({ error: 'Metodo nao permitido' });
}

// ——— projects ———
async function handleProjects(req, res) {
  const { id } = req.query;
  if (req.method === 'GET' && id) {
    const r = await phpFetch('projects', { params: { id } });
    const data = await r.json();
    return res.status(r.status).json(data);
  }
  if (req.method === 'POST') {
    const r = await phpFetch('projects', { method: 'POST', body: req.body || {} });
    const data = await r.json();
    return res.status(r.status).json(data);
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
  // Upsert cliente
  const cRes = await phpFetch('clientes', {
    method: 'POST',
    body: { nome: data.nome||'Lead Calculadora', email: data.email, telefone: data.telefone, empresa: data.empresa, origem: 'calculadora', tipo: 'pre_cadastro' },
  });
  const cJson = await cRes.json();
  const clienteId = cJson.id || cJson.clienteId;

  // Upsert lead
  const lRes = await phpFetch('leads', {
    method: 'POST',
    body: { nome: data.nome||'Lead Calculadora', email: data.email, telefone: data.telefone, origem: 'calculadora', etapa: 'lead_novo', observacoes: data.observacoes, clienteId, valor: data.valor, erpCreate: true },
  });
  const lJson = await lRes.json();
  return res.status(200).json({ ok: true, leadId: lJson.leadId || lJson.id, clienteId });
}

// ——— evolution-diag (checar/ajustar webhook do Evolution API) ———
async function handleEvolutionDiag(req, res) {
  const EVO_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-903e.up.railway.app';
  const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
  const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'cdsind';
  const EXPECTED_WEBHOOK = 'https://erp.cdsind.com.br/api/whatsapp';

  if (!EVO_KEY) {
    return res.status(500).json({ error: 'EVOLUTION_API_KEY nao configurada no Vercel' });
  }

  const headers = { apikey: EVO_KEY, 'Content-Type': 'application/json' };

  // POST com action=set ajusta a URL do webhook (precisa confirmacao explicita do usuario)
  if (req.method === 'POST' && String(req.query.action||'').toLowerCase() === 'set') {
    const webhookUrl = (req.body && req.body.url) || EXPECTED_WEBHOOK;
    const events = (req.body && req.body.events) || ['MESSAGES_UPSERT'];
    const r = await fetch(`${EVO_URL}/webhook/set/${EVO_INSTANCE}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: webhookUrl, enabled: true, webhook_by_events: false, events }),
    });
    const txt = await r.text();
    let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
    return res.status(r.status).json({ ok: r.ok, action: 'set', sent: { url: webhookUrl, events }, response: data });
  }

  // GET (default) — lê webhook atual + estado da instancia
  try {
    const [wRes, sRes] = await Promise.all([
      fetch(`${EVO_URL}/webhook/find/${EVO_INSTANCE}`, { headers }),
      fetch(`${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`, { headers }),
    ]);
    const wTxt = await wRes.text();
    const sTxt = await sRes.text();
    let wData; try { wData = JSON.parse(wTxt); } catch { wData = { raw: wTxt }; }
    let sData; try { sData = JSON.parse(sTxt); } catch { sData = { raw: sTxt }; }
    const currentUrl = wData && (wData.url || wData.webhook?.url || wData.Webhook?.url);
    return res.status(200).json({
      ok: true,
      instance: EVO_INSTANCE,
      evolution_url: EVO_URL,
      expected_webhook: EXPECTED_WEBHOOK,
      current_webhook: currentUrl || null,
      matches_expected: currentUrl === EXPECTED_WEBHOOK,
      webhook_raw: wData,
      webhook_status: wRes.status,
      connection_state: sData,
      connection_status: sRes.status,
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
