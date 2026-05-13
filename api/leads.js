// api/leads.js
// CRUD de leads para o funil CRM
import { selectAll, insert, update, remove } from './_lib/supabase.js';

const TABLE = 'leads';
const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'cds-leads-secret';

const NOMES_INVALIDOS = ['cds', 'cds industrial', 'cds ind', 'cdsind'];
function ehNomeInvalido(nome) {
  if (!nome) return true;
  const n = String(nome).trim().toLowerCase();
  return NOMES_INVALIDOS.includes(n);
}

function isLID(digits) {
  if (digits.length >= 15) return true;
  if (digits.length >= 14 && !digits.startsWith('55') && !digits.startsWith('1')) return true;
  if (digits.length >= 12 && !digits.startsWith('55') && !digits.startsWith('1')) return true;
  if (digits.startsWith('55') && digits.length > 13) return true;
  if (digits.startsWith('1') && digits.length > 11) return true;
  return false;
}

function formatarTelefoneWA(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.substring(2, 4);
    const num = d.substring(4);
    if (num.length === 9) {
      return `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    return `+55 ${ddd} ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  if (d.startsWith('1') && d.length === 11) {
    return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  }
  return `+${d}`;
}

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

const ROTULOS_MIDIA = {
  image: 'Foto',
  video: 'Video',
  audio: 'Audio',
  document: 'Documento',
  sticker: 'Figurinha',
};

function dadosPayload(msg) {
  const payload = msg?.payload_bruto || msg?.payload || {};
  const data = payload?.data || payload || {};
  const message = data?.message || payload?.message || {};
  return { payload, data, message };
}

function normalizarMediaType(valor) {
  const tipo = String(valor || '').toLowerCase().replace(/message$/, '');
  if (tipo === 'image' || tipo === 'imagem') return 'image';
  if (tipo === 'video') return 'video';
  if (tipo === 'audio') return 'audio';
  if (tipo === 'document' || tipo === 'documento') return 'document';
  if (tipo === 'sticker') return 'sticker';
  return '';
}

function textoMensagem(msg) {
  const { data, message } = dadosPayload(msg);
  const reaction = message?.reactionMessage || message?.reaction;
  const candidatos = [
    msg?.texto,
    msg?.conteudo,
    message?.conversation,
    message?.extendedTextMessage?.text,
    message?.imageMessage?.caption,
    message?.videoMessage?.caption,
    message?.documentMessage?.caption,
    data?.content,
    data?.text,
    reaction?.text ? `Voce reagiu com ${reaction.text}` : '',
  ];

  return String(candidatos.find(v => String(v || '').trim()) || '').trim().replace(/\s+/g, ' ');
}

function tipoMidiaMensagem(msg) {
  const { data, message } = dadosPayload(msg);
  const texto = String(msg?.texto || msg?.conteudo || '').toLowerCase();
  const mediaType = msg?.media_type || msg?.mediaType || data?.mediaType || data?.messageType;
  const tipoNormalizado = normalizarMediaType(mediaType);
  if (tipoNormalizado) return tipoNormalizado;
  if (message?.imageMessage || texto.includes('[image]')) return 'image';
  if (message?.videoMessage || texto.includes('[video]')) return 'video';
  if (message?.audioMessage || texto.includes('[audio]')) return 'audio';
  if (message?.documentMessage || texto.includes('[document]')) return 'document';
  if (message?.stickerMessage || texto.includes('[sticker]')) return 'sticker';
  if (msg?.media_url || data?.mediaUrl || data?.media) return 'image';
  return '';
}

function rotuloMidia(tipo) {
  const normalizado = String(tipo || '').toLowerCase().replace(/message$/, '');
  return ROTULOS_MIDIA[normalizado] || (normalizado ? 'Midia' : '');
}

function fotoMensagem(msg) {
  const { payload, data } = dadosPayload(msg);
  const candidatos = [
    msg?.foto_url,
    msg?.profile_pic_url,
    msg?.profilePicUrl,
    data?.profilePictureUrl,
    data?.profilePicUrl,
    data?.profile_picture_url,
    data?.senderProfilePicture,
    data?.senderPicture,
    data?.contact?.profilePictureUrl,
    payload?.profilePictureUrl,
  ];
  return String(candidatos.find(v => /^https?:\/\//i.test(String(v || '').trim())) || '').trim();
}

function previewMensagem(msg) {
  const texto = textoMensagem(msg);
  const mediaType = tipoMidiaMensagem(msg);
  if (/^\[(image|video|audio|document|sticker|media)\](?:\s+.*)?$/i.test(texto)) {
    return rotuloMidia(mediaType) || 'Midia';
  }
  if (texto && texto.toLowerCase() !== 'sem mensagens ainda') return texto;
  return rotuloMidia(mediaType);
}

function mensagemTemConteudo(msg) {
  return !!previewMensagem(msg);
}

function precisaPreviewAtualizado(valor) {
  const texto = String(valor || '').trim().toLowerCase();
  return !texto || texto === 'sem mensagens ainda';
}

function dataMensagem(msg) {
  const raw = msg?.timestamp_msg || msg?.criado_em || msg?.created_at || '';
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function dataMensagemIso(msg, fallback = '') {
  return msg?.timestamp_msg || msg?.criado_em || msg?.created_at || fallback;
}

function formatarLead(lead) {
  if (lead.etapa === 'lid_oculto') {
    return { ...lead, __ocultar: true };
  }
  let nome = lead.nome || '';
  const tel = lead.telefone || '';
  const pushName = lead.contato_nome || lead.push_name || lead.pushName || lead.nome_contato || '';
  const nomeDigits = nome.replace(/^\+/, '').replace(/\D/g, '');
  const telDigits = String(tel).replace(/\D/g, '');

  if (isLID(telDigits) && (!pushName || ehNomeInvalido(pushName)) && (!nome || ehNomeInvalido(nome) || /^[\d\s+()\-]+$/.test(nome))) {
    return { ...lead, nome: '', telefone: tel, __ocultar: true };
  }
  if (ehNomeInvalido(nome)) {
    if (pushName && pushName.trim() && !ehNomeInvalido(pushName)) nome = pushName.trim();
    else if (telDigits) {
      if (isLID(telDigits)) return { ...lead, nome: '', telefone: tel, __ocultar: true };
      nome = formatarTelefoneWA(telDigits);
    } else return { ...lead, nome: '', telefone: tel, __ocultar: true };
  } else if (nome && /^[\d\s+()\-]+$/.test(nome)) {
    if (isLID(nomeDigits)) {
      if (pushName && pushName.trim() && !ehNomeInvalido(pushName)) nome = pushName.trim();
      else return { ...lead, nome: '', telefone: tel, __ocultar: true };
    } else if (nomeDigits.length >= 10) nome = formatarTelefoneWA(nomeDigits);
  } else if (!nome || !nome.trim()) {
    if (pushName && pushName.trim() && !ehNomeInvalido(pushName)) nome = pushName.trim();
    else if (telDigits) {
      if (isLID(telDigits)) return { ...lead, nome: '', telefone: tel, __ocultar: true };
      nome = formatarTelefoneWA(telDigits);
    }
  }
  return { ...lead, nome, telefone: tel };
}

function normalizar(lead) {
  return {
    id: lead.id,
    nome: lead.nome || '',
    email: lead.email || '',
    telefone: lead.telefone || '',
    empresa: lead.empresa || '',
    mensagem: lead.mensagem || '',
    ultima_mensagem: lead.ultima_mensagem || lead.ultimaMensagem || '',
    foto_url: lead.foto_url || lead.fotoUrl || lead.profile_pic_url || '',
    origem: lead.origem || 'manual',
    etapa: lead.etapa || 'lead_novo',
    valor: Number(lead.valor) || 0,
    pedidoId: lead.pedidoId ?? lead.pedido_id ?? '',
    clienteId: lead.clienteId ?? lead.cliente_id ?? '',
    observacoes: lead.observacoes || '',
    contato_nome: lead.contato_nome || lead.push_name || lead.pushName || '',
    criadoEm: lead.criadoEm ?? lead.criado_em ?? lead.created_at ?? '',
    atualizadoEm: lead.atualizadoEm ?? lead.atualizado_em ?? lead.updated_at ?? '',
    ultima_hora: lead.ultima_hora ?? lead.ultimaHora ?? lead.atualizado_em ?? lead.atualizadoEm ?? lead.criado_em ?? '',
    ultima_tipo: lead.ultima_tipo || lead.ultimaTipo || '',
    total_mensagens: Number(lead.total_mensagens || lead.totalMensagens) || 0,
  };
}

async function listarLeads() {
  try {
    const [leads, mensagens] = await Promise.all([
      selectAll(TABLE, { orderBy: 'atualizado_em', limit: 300 }),
      selectAll('mensagens', { orderBy: 'criado_em', limit: 5000 }).catch(() => []),
    ]);

    const mensagensPorTelefone = new Map();
    for (const msg of mensagens || []) {
      if (!mensagemTemConteudo(msg)) continue;

      const tel = soDigitos(msg.telefone || msg.remote_jid);
      if (!tel) continue;

      const chaves = variantesTelefone(tel);
      const chaveExistente = chaves.find(chave => mensagensPorTelefone.has(chave));
      const chavePrincipal = chaveExistente || chaves[0] || tel;
      const atual = mensagensPorTelefone.get(chavePrincipal);
      if (!atual) {
        const info = { total: 1, ultima: msg, fotoUrl: fotoMensagem(msg) };
        chaves.forEach(chave => mensagensPorTelefone.set(chave, info));
        continue;
      }

      atual.total += 1;
      atual.fotoUrl ||= fotoMensagem(msg);
      if (dataMensagem(msg) >= dataMensagem(atual.ultima)) atual.ultima = msg;
    }

    return leads.map(lead => {
      const info = variantesTelefone(lead.telefone).map(tel => mensagensPorTelefone.get(tel)).find(Boolean);
      if (!info?.ultima) return lead;

      const ultimaTexto = previewMensagem(info.ultima);
      const ultimaHora = dataMensagemIso(info.ultima, lead.atualizado_em);
      return {
        ...lead,
        ultima_mensagem: ultimaTexto || (precisaPreviewAtualizado(lead.ultima_mensagem) ? '' : lead.ultima_mensagem),
        ultima_hora: ultimaHora || lead.ultima_hora,
        ultima_tipo: info.ultima.tipo || '',
        atualizado_em: ultimaHora || lead.atualizado_em,
        total_mensagens: info.total,
        foto_url: lead.foto_url || info.fotoUrl || lead.profile_pic_url,
      };
    }).sort((a, b) => {
      const dataA = new Date(a.ultima_hora || a.atualizado_em || a.criado_em || 0).getTime();
      const dataB = new Date(b.ultima_hora || b.atualizado_em || b.criado_em || 0).getTime();
      return (Number.isFinite(dataB) ? dataB : 0) - (Number.isFinite(dataA) ? dataA : 0);
    });
  } catch (err) {
    console.warn('[leads] select falhou:', err.message);
    return [];
  }
}

async function inserirLead(data) {
  const telefone = soDigitos(data.telefone || '');
  const payload = {
    nome: data.nome || '',
    email: data.email || '',
    telefone,
    mensagem: data.mensagem || '',
    empresa: data.empresa || '',
    origem: data.origem || 'site',
    etapa: data.etapa || 'lead_novo',
    valor: Number(data.valor) || 0,
    pedido_id: data.pedidoId || '',
    cliente_id: data.clienteId || '',
    observacoes: data.observacoes || '',
  };

  if (telefone) {
    const candidatos = variantesTelefone(telefone);
    for (const tel of candidatos) {
      const existentes = await selectAll(TABLE, { filters: { telefone: `eq.${tel}` }, limit: 1 });
      if (existentes[0]?.id) {
        await update(TABLE, 'id', existentes[0].id, {
          ...payload,
          telefone: existentes[0].telefone || telefone,
          atualizado_em: new Date().toISOString()
        });
        return existentes[0].id;
      }
    }
  }

  const inserted = await insert(TABLE, payload);
  return inserted?.id;
}

async function atualizarLead(id, body) {
  const updates = {};
  const allowed = ['nome', 'email', 'telefone', 'empresa', 'etapa', 'origem', 'observacoes', 'mensagem'];
  for (const f of allowed) if (body[f] !== undefined) updates[f] = String(body[f]);
  if (body.valor !== undefined) updates.valor = Number(body.valor) || 0;
  if (body.pedidoId !== undefined) updates.pedido_id = String(body.pedidoId);
  await update(TABLE, 'id', id, updates);
  return id;
}

async function deletarLead(id) {
  await remove(TABLE, 'id', id);
  return id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret, X-Erp-Create');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      const raw = await listarLeads();
      const incluirOcultos = req.query.incluirOcultos === '1';
      const leads = raw
        .map(normalizar)
        .map(formatarLead)
        .filter(l => incluirOcultos ? true : !l.__ocultar)
        .map(l => { delete l.__ocultar; return l; });
      return res.status(200).json(leads);
    }
    if (req.method === 'POST') {
      const erpCreate = req.body?.erpCreate === true || req.headers['x-erp-create'] === '1';
      if (!erpCreate) {
        const secret = req.headers['x-webhook-secret'] || req.query.secret;
        if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
      }
      const body = req.body || {};
      if (!body.nome && !body.telefone) return res.status(400).json({ error: 'Nome ou telefone obrigatorios' });
      const leadId = await inserirLead(body);
      return res.status(201).json({ success: true, leadId });
    }
    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await atualizarLead(id, req.body || {});
      return res.status(200).json({ ok: true, id });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      await deletarLead(id);
      return res.status(200).json({ ok: true, id });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[leads]', req.method, 'erro:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
