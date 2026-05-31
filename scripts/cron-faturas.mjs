#!/usr/bin/env node
// scripts/cron-faturas.mjs
// Roda diariamente. Para cada fatura pendente cuja empresa tem WhatsApp conectado,
// envia a cobrança via Evolution API e marca status=enviada.
// Uso: node scripts/cron-faturas.mjs [--dry-run]

import 'dotenv/config';
import fs from 'fs';

const DRY = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:3001';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_PATH_PREFIX = process.env.SUPABASE_PATH_PREFIX !== undefined ? process.env.SUPABASE_PATH_PREFIX : '';
const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://127.0.0.1:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

function fmt(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}
function fmtData(s) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}
function fmtMes(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

async function sb(path, opts = {}) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}${SUPABASE_PATH_PREFIX}${path}`;
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function evolutionSend(instanceName, numero, mensagem) {
  const r = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: numero, text: mensagem }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${await r.text()}`);
  return r.json();
}

function normalizarTelefone(tel) {
  const t = String(tel || '').replace(/\D/g, '');
  if (!t) return '';
  return t.startsWith('55') ? t : '55' + t;
}

function montarMensagem(fatura, empresa) {
  const valor = fmt(Number(fatura.valor_total));
  const vencimento = fmtData(fatura.data_vencimento);
  const mes = fmtMes(fatura.competencia);
  const pix = empresa.banco_pix ? `\n\n💸 *PIX:* \`${empresa.banco_pix}\`` : '';
  const responsavel = empresa.responsavel ? `Olá ${empresa.responsavel}!` : 'Olá!';
  return [
    responsavel,
    '',
    `Segue a *fatura mensal* dos serviços de marketing referente a *${mes}*:`,
    '',
    `📄 ${fatura.descricao || 'Serviços de marketing'}`,
    `💰 *Valor:* ${valor}`,
    `📅 *Vencimento:* ${vencimento}`,
    pix,
    '',
    'Qualquer dúvida, estou à disposição! 🙏',
  ].filter(Boolean).join('\n');
}

async function main() {
  console.log(`[cron-faturas] iniciando ${DRY ? '(DRY-RUN)' : ''} @ ${new Date().toISOString()}`);
  if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY ausente'); process.exit(1); }
  if (!EVOLUTION_API_KEY) { console.error('EVOLUTION_API_KEY ausente'); process.exit(1); }

  // Faturas pendentes (não enviadas)
  const faturas = await sb(`/faturas_agencia?status=eq.pendente&select=*,trafego_clientes(id,nome,responsavel,telefone_contato,banco_pix)`);
  console.log(`[cron-faturas] ${faturas.length} faturas pendentes`);

  // Instâncias WhatsApp conectadas
  const instancias = await sb(`/whatsapp_instancias?status=eq.conectado&select=cliente_agencia_id,evolution_instance_name`);
  const wppPorEmpresa = new Map();
  for (const i of instancias) wppPorEmpresa.set(i.cliente_agencia_id, i.evolution_instance_name);
  console.log(`[cron-faturas] ${instancias.length} empresas com WhatsApp conectado`);

  let enviadas = 0, ignoradas = 0, erros = 0;
  for (const f of faturas) {
    const empresa = f.trafego_clientes;
    const tel = empresa?.telefone_contato;
    const instancia = wppPorEmpresa.get(f.cliente_agencia_id);

    if (!tel) { console.log(`  ⏭ ${empresa.nome} — sem telefone_contato`); ignoradas++; continue; }
    if (!instancia) { console.log(`  ⏭ ${empresa.nome} — sem WhatsApp conectado`); ignoradas++; continue; }

    const numero = normalizarTelefone(tel);
    const mensagem = montarMensagem(f, empresa);

    if (DRY) {
      console.log(`  📨 [DRY] ${empresa.nome} (${numero}): "${mensagem.slice(0,60)}..."`);
      enviadas++;
      continue;
    }

    try {
      const resp = await evolutionSend(instancia, numero, mensagem);
      await sb(`/faturas_agencia?id=eq.${f.id}`, {
        method: 'PATCH',
        body: {
          status: 'enviada',
          metadata: { ...(f.metadata || {}), envio_automatico_em: new Date().toISOString(), evolution_msg_id: resp?.key?.id },
        },
      });
      console.log(`  ✅ ${empresa.nome} — enviado pra ${numero}`);
      enviadas++;
      await new Promise(r => setTimeout(r, 2000));  // throttle pra não disparar muito rápido
    } catch (e) {
      console.error(`  ❌ ${empresa.nome}:`, e.message);
      erros++;
    }
  }

  // Marca faturas vencidas (data_vencimento < hoje e status != paga/cancelada)
  if (!DRY) {
    const r = await sb(`/faturas_agencia?status=in.(pendente,enviada)&data_vencimento=lt.${new Date().toISOString().slice(0,10)}&select=id`);
    if (r.length > 0) {
      const ids = r.map(x => x.id);
      for (const id of ids) {
        await sb(`/faturas_agencia?id=eq.${id}`, { method: 'PATCH', body: { status: 'vencida' } });
      }
      console.log(`[cron-faturas] ${ids.length} faturas marcadas como vencidas`);
    }
  }

  const resumo = { enviadas, ignoradas, erros, total: faturas.length, ts: new Date().toISOString() };
  console.log(`[cron-faturas] DONE`, resumo);
  try { fs.appendFileSync('/var/log/cron-faturas.log', JSON.stringify(resumo) + '\n'); } catch {}
}

main().catch(e => { console.error('[cron-faturas] FATAL:', e); process.exit(1); });
