// api/data.js — dispatcher unificado
import { sb, selectAll, insert, update, upsertByField } from './_lib/supabase.js';
import {
  postToFacebookPage,
  postToInstagram,
  postCarouselToInstagram,
  getInstagramAccountId,
  getPages,
  getLongLivedToken,
} from './_lib/facebook.js';
import { emitEvent } from './_lib/events.js';

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
  },
  {
    nome: 'Leone Abbacchio',
    email: 'abbacchio.marketing@cdsind.com.br',
    telefone: '',
    tipo: 'FUNC',
    documento: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: 'Brasilia',
    uf: 'DF',
    complemento: 'Gestor de Marketing e Trafego IA',
    orgao: 'Marketing e Publicidade',
    dores: ['Estrategia de trafego pago', 'Planejamento de campanhas', 'Analise de ROI e metricas']
  },
  {
    nome: 'Narancia Ghirga',
    email: 'narancia.conteudo@cdsind.com.br',
    telefone: '',
    tipo: 'FUNC',
    documento: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: 'Brasilia',
    uf: 'DF',
    complemento: 'Criador de Conteudo e Design IA',
    orgao: 'Marketing e Publicidade',
    dores: ['Criar copys de anuncios', 'Briefings de design', 'Posts para redes sociais']
  }
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function soDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function variantesTelefone(valor) {
  const d = soDigitos(valor);
  const variantes = new Set();
  if (!d) return [];
  variantes.add(d);

  if (d.startsWith('55')) {
    const ddi = d.slice(0, 2);
    const ddd = d.slice(2, 4);
    const local = d.slice(4);
    if (ddd.length === 2 && local.length === 9) {
      variantes.add(`${ddi}${ddd}${local.slice(1)}`);
      if (local[0] !== '9') variantes.add(`${ddi}${ddd}9${local.slice(1)}`);
    }
    if (ddd.length === 2 && local.length === 8) {
      variantes.add(`${ddi}${ddd}9${local}`);
    }
  }

  return [...variantes];
}

async function upsertLeadPorTelefone(payload) {
  for (const tel of variantesTelefone(payload.telefone)) {
    const existentes = await selectAll('leads', { filters: { telefone: `eq.${tel}` }, limit: 1 });
    if (existentes[0]?.id) {
      return await update('leads', 'id', existentes[0].id, {
        ...payload,
        telefone: existentes[0].telefone || payload.telefone
      });
    }
  }
  return await upsertByField('leads', payload, 'telefone');
}

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

  if (data.id && UUID_RE.test(String(data.id))) {
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

  function extrairFotoPerfil(data) {
    const candidatos = [
      data?.profilePictureUrl,
      data?.profile_picture_url,
      data?.profilePicUrl,
      data?.picture,
      data?.url,
      data?.data?.profilePictureUrl,
      data?.data?.profile_picture_url,
      data?.data?.profilePicUrl,
      data?.data?.picture,
      data?.data?.url,
    ];
    return String(candidatos.find(v => /^https?:\/\//i.test(String(v || '').trim())) || '').trim();
  }
  
  async function fetchPic(telefone) {
    const number = String(telefone).replace(/\D/g, '');
    if (!number) return null;
    try {
      for (const payload of [{ number }, { number: `${number}@s.whatsapp.net` }]) {
        const r = await fetch(`${EVO_URL}/chat/fetchProfilePictureUrl/${EVO_INSTANCE}`, {
          method: 'POST', headers, body: JSON.stringify(payload)
        });
        if (!r.ok) continue;
        const data = await r.json();
        const foto = extrairFotoPerfil(data);
        if (foto) return foto;
      }
      return null;
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
            await upsertLeadPorTelefone({ telefone: numero, nome: pushNameValido, etapa: 'lead_novo', ultima_mensagem: lastMsg.texto || '', criado_em: lastMsg.criado_em, atualizado_em: lastMsg.criado_em });
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

async function handleInventory(req, res) {
  if (req.method === 'GET') {
    const rows = await selectAll('inventory_items', { orderBy: 'nome', limit: 1000 });
    return res.status(200).json(rows.map(item => ({
      id: item.id,
      codigo: item.codigo || '',
      nome: item.nome || '',
      categoria: item.categoria || '',
      unidade: item.unidade || '',
      custo: Number(item.custo) || 0,
      precoVenda: Number(item.preco_venda) || 0,
      quantidadeEstoque: Number(item.quantidade_estoque) || 0,
      estoqueMinimo: Number(item.estoque_minimo) || 0
    })));
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = req.body || {};
    const payload = {
      codigo: body.codigo || '',
      nome: body.nome || '',
      categoria: body.categoria || '',
      unidade: body.unidade || '',
      custo: Number(body.custo) || 0,
      preco_venda: Number(body.precoVenda ?? body.preco_venda) || 0,
      quantidade_estoque: Number(body.quantidadeEstoque ?? body.quantidade_estoque) || 0,
      estoque_minimo: Number(body.estoqueMinimo ?? body.estoque_minimo) || 0
    };
    const saved = payload.codigo
      ? await upsertByField('inventory_items', payload, 'codigo')
      : await insert('inventory_items', payload);
    return res.status(200).json(saved);
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

async function handleTransacoes(req, res) {
  if (req.method === 'GET') {
    const rows = await selectAll('transacoes_financeiras', { orderBy: 'criado_em', limit: 1000 });
    return res.status(200).json(rows.map(t => ({
      id: t.id,
      tipo: t.tipo,
      descricao: t.descricao || '',
      valor: Number(t.valor) || 0,
      dataVencimento: t.data_vencimento || '',
      status: t.status || 'PENDENTE',
      origem: t.origem || ''
    })));
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = req.body || {};
    const payload = {
      tipo: body.tipo,
      descricao: body.descricao || '',
      valor: Number(body.valor) || 0,
      data_vencimento: body.dataVencimento || body.data_vencimento || null,
      data_pagamento: body.dataPagamento || body.data_pagamento || null,
      status: body.status || 'PENDENTE',
      origem: body.origem || ''
    };
    const saved = body.id && UUID_RE.test(String(body.id))
      ? await update('transacoes_financeiras', 'id', body.id, payload)
      : await insert('transacoes_financeiras', payload);
    return res.status(200).json(saved);
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

async function handleImageProxy(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { produtoId, nome, q } = req.query;

  function formatarProdutoImagem(produto) {
    const imagens = [];
    if (produto.foto_url) {
      imagens.push({ tipo: 'foto_produto', url: produto.foto_url, descricao: `Foto principal: ${produto.nome}`, ordem: 1 });
    }
    if (Array.isArray(produto.fotos)) {
      produto.fotos.forEach((url, i) => {
        imagens.push({ tipo: 'foto_produto', url, descricao: `Foto ${i + 2}: ${produto.nome}`, ordem: i + 2 });
      });
    }
    return { id: produto.id, nome: produto.nome, imagens, totalFotos: imagens.length };
  }

  if (produtoId) {
    const data = await selectAll('produtos', { filters: { id: `eq.${produtoId}` }, limit: 1 });
    if (!data?.[0]) return res.status(404).json({ error: 'Produto nao encontrado' });
    const formatado = formatarProdutoImagem(data[0]);
    if (formatado.imagens.length > 0) res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(formatado);
  }

  if (nome) {
    const data = await selectAll('produtos', { orderBy: 'nome', limit: 100 });
    const filtered = (data || []).filter(p => (p.nome || '').toLowerCase().includes(nome.toLowerCase()));
    return res.status(200).json({ produtos: filtered.slice(0, 5).map(formatarProdutoImagem) });
  }

  if (q) {
    const data = await selectAll('produtos', { orderBy: 'nome', limit: 200 });
    const ql = q.toLowerCase();
    const filtered = (data || []).filter(p =>
      (p.nome || '').toLowerCase().includes(ql) ||
      (p.categoria || '').toLowerCase().includes(ql) ||
      (p.sku || '').toLowerCase().includes(ql)
    );
    return res.status(200).json({ produtos: filtered.slice(0, 10).map(formatarProdutoImagem) });
  }

  const data = await selectAll('produtos', { orderBy: 'nome', limit: 200 });
  const comFoto = (data || []).filter(p => p.foto_url);
  return res.status(200).json({ produtos: comFoto.slice(0, 50).map(formatarProdutoImagem) });
}

async function handleExtensionPosts(req, res) {
  if (req.method === 'GET') {
    const posts = await selectAll('extension_posts', {
      filters: { status: 'eq.pending' },
      orderBy: 'criado_em',
      limit: 10,
    });
    return res.status(200).json({ posts });
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    if (body.action === 'update-status') {
      const { postId, platform, status } = body;
      if (postId) {
        await update('extension_posts', 'id', postId, {
          status,
          atualizado_em: new Date().toISOString(),
        });
      }
      return res.status(200).json({ ok: true });
    }

    const { titulo, descricao, preco, categoria, plataformas, copyOriginal, imagens } = body;
    if (!titulo) return res.status(400).json({ error: 'Titulo obrigatorio' });

    const post = await insert('extension_posts', {
      titulo,
      descricao: descricao || '',
      preco: preco || '',
      categoria: categoria || 'Servicos',
      plataformas: plataformas || ['olx', 'marketplace'],
      copy_original: copyOriginal || null,
      imagens: Array.isArray(imagens) ? imagens : [],
      status: 'pending',
    });

    return res.status(200).json({ ok: true, post });
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

async function handleSocialPublish(req, res) {
  const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
  const PAGE_ID = process.env.FB_PAGE_ID;
  const APP_ID = process.env.FB_APP_ID || '1528432055514554';
  const APP_SECRET = process.env.FB_APP_SECRET;

  if (req.method === 'GET') {
    const action = req.query?.action;

    if (action === 'pages' && req.query?.token) {
      const pages = await getPages(req.query.token);
      return res.status(200).json({ pages });
    }

    if (action === 'ig-check' && PAGE_ID && PAGE_ACCESS_TOKEN) {
      const igId = await getInstagramAccountId(PAGE_ID, PAGE_ACCESS_TOKEN);
      return res.status(200).json({
        connected: !!igId,
        instagramId: igId,
        pageId: PAGE_ID,
      });
    }

    if (action === 'exchange-token' && req.query?.token && APP_SECRET) {
      const longToken = await getLongLivedToken(req.query.token, APP_ID, APP_SECRET);
      return res.status(200).json({ token: longToken, expiresIn: '60 days' });
    }

    return res.status(200).json({
      configured: !!(PAGE_ACCESS_TOKEN && PAGE_ID),
      appId: APP_ID,
      hasSecret: !!APP_SECRET,
      hasToken: !!PAGE_ACCESS_TOKEN,
      hasPageId: !!PAGE_ID,
    });
  }

  if (req.method === 'POST') {
    if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
      return res.status(400).json({
        error: 'Facebook nao configurado. Adicione FB_PAGE_ACCESS_TOKEN e FB_PAGE_ID no Vercel.',
      });
    }

    const { platform, message, caption, imageUrl, imageUrls, extensionPostId } = req.body || {};
    const results = [];

    async function logPublish({ plataforma, ok, postId, url, erro }) {
      try {
        await insert('social_publish_log', {
          extension_post_id: extensionPostId || null,
          plataforma,
          status: ok ? 'published' : 'error',
          platform_post_id: postId || null,
          platform_url: url || null,
          erro: erro || null,
        });
      } catch (e) {
        console.warn('[social-publish] falha ao gravar log:', e.message);
      }
    }

    const fbUrl = (postId) => postId ? `https://www.facebook.com/${postId}` : null;
    const igUrl = (postId) => postId ? `https://www.instagram.com/p/${postId}` : null;

    if (platform === 'facebook' || platform === 'all') {
      try {
        const fbResult = await postToFacebookPage(PAGE_ID, PAGE_ACCESS_TOKEN, {
          message: message || caption,
          imageUrl,
        });
        const url = fbUrl(fbResult.postId);
        results.push({ ...fbResult, url });
        await logPublish({ plataforma: 'facebook', ok: true, postId: fbResult.postId, url });
        emitEvent({
          type: 'social.published',
          source: 'api',
          entity_type: 'post',
          entity_id: fbResult.postId,
          actor: 'sistema',
          payload: { platform: 'facebook', postId: fbResult.postId },
        });
      } catch (err) {
        results.push({ platform: 'facebook', error: err.message });
        await logPublish({ plataforma: 'facebook', ok: false, erro: err.message });
      }
    }

    if (platform === 'instagram' || platform === 'all') {
      try {
        const igId = await getInstagramAccountId(PAGE_ID, PAGE_ACCESS_TOKEN);
        if (!igId) throw new Error('Instagram Business nao vinculado a esta Page');

        let igResult;
        if (imageUrls?.length > 1) {
          igResult = await postCarouselToInstagram(igId, PAGE_ACCESS_TOKEN, {
            caption: caption || message,
            imageUrls,
          });
        } else {
          const singleUrl = imageUrl || imageUrls?.[0];
          if (!singleUrl) throw new Error('Instagram requer pelo menos 1 imagem');
          igResult = await postToInstagram(igId, PAGE_ACCESS_TOKEN, {
            caption: caption || message,
            imageUrl: singleUrl,
          });
        }

        const url = igUrl(igResult.postId);
        results.push({ ...igResult, url });
        await logPublish({ plataforma: 'instagram', ok: true, postId: igResult.postId, url });
        emitEvent({
          type: 'social.published',
          source: 'api',
          entity_type: 'post',
          entity_id: igResult.postId,
          actor: 'sistema',
          payload: { platform: 'instagram', postId: igResult.postId },
        });
      } catch (err) {
        results.push({ platform: 'instagram', error: err.message });
        await logPublish({ plataforma: 'instagram', ok: false, erro: err.message });
      }
    }

    return res.status(200).json({ ok: true, results });
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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
    if (resource === 'inventory') return await handleInventory(req, res);
    if (resource === 'transacoes') return await handleTransacoes(req, res);
    if (resource === 'image-proxy') return await handleImageProxy(req, res);
    if (resource === 'extension-posts') return await handleExtensionPosts(req, res);
    if (resource === 'social-publish') return await handleSocialPublish(req, res);
    return res.status(400).json({ error: 'resource invalido' });
  } catch (err) {
    console.error(`[data] erro (${resource}):`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
