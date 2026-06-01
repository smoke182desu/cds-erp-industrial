// api/comprovantes/upload.js — Upload real de arquivos (PDF/JPG/PNG/WEBP) pra comprovantes
// POST multipart/form-data: comprovante_id + file(s)
import { sb } from '../_lib/supabase.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function sbBody(p, o) {
  const r = await sb(p, o);
  if (!r.ok) { const e = new Error(`${r.status}`); e.status = r.status; throw e; }
  return r.body;
}

const UPLOAD_ROOT = process.env.UPLOAD_DIR || '/var/www/cds-erp/uploads/comprovantes';
const MAX_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || (15 * 1024 * 1024), 10);
const PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || 'https://erp.cdsind.com.br/uploads/comprovantes';

const MIME_PERMITIDOS = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

async function parseMultipart(req) {
  const ct = req.headers['content-type'] || '';
  const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!m) throw new Error('content-type sem boundary');
  const boundary = '--' + (m[1] || m[2]).trim();

  const chunks = [];
  await new Promise((resolve, reject) => {
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > MAX_BYTES) { req.destroy(); return reject(new Error(`arquivo > ${MAX_BYTES} bytes`)); }
      chunks.push(c);
    });
    req.on('end', resolve);
    req.on('error', reject);
  });
  const buf = Buffer.concat(chunks);
  const fields = {};
  const files = [];

  let pos = 0;
  const bBuf = Buffer.from(boundary);
  while (pos < buf.length) {
    const start = buf.indexOf(bBuf, pos);
    if (start < 0) break;
    const headerStart = start + bBuf.length;
    if (buf[headerStart] === 0x2d && buf[headerStart + 1] === 0x2d) break;
    const headerEnd = buf.indexOf('\r\n\r\n', headerStart);
    if (headerEnd < 0) break;
    const headersRaw = buf.slice(headerStart, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4;
    const bodyEnd = buf.indexOf(bBuf, bodyStart) - 2;
    if (bodyEnd < bodyStart) break;

    const dispMatch = headersRaw.match(/name="([^"]+)"(?:;\s*filename="([^"]+)")?/);
    const ctMatch = headersRaw.match(/Content-Type:\s*([^\r\n]+)/i);
    if (!dispMatch) { pos = bodyEnd + 2; continue; }
    const name = dispMatch[1];
    const filename = dispMatch[2];
    const body = buf.slice(bodyStart, bodyEnd);
    if (filename) {
      files.push({ field: name, filename, mime: (ctMatch?.[1] || 'application/octet-stream').trim(), buffer: body });
    } else {
      fields[name] = body.toString('utf8');
    }
    pos = bodyEnd + 2;
  }
  return { fields, files };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { fields, files } = await parseMultipart(req);
    const comprovanteId = fields.comprovante_id;
    if (!comprovanteId) return res.status(400).json({ error: 'comprovante_id obrigatório' });
    if (!files.length) return res.status(400).json({ error: 'nenhum arquivo enviado' });

    const cArr = await sbBody(`/comprovantes?id=eq.${comprovanteId}&select=id,cliente_agencia_id`);
    if (!cArr?.[0]) return res.status(404).json({ error: 'comprovante não encontrado' });
    const empresaId = cArr[0].cliente_agencia_id;

    const dir = path.join(UPLOAD_ROOT, empresaId);
    fs.mkdirSync(dir, { recursive: true });

    const salvos = [];
    for (const f of files) {
      if (!MIME_PERMITIDOS[f.mime]) { salvos.push({ filename: f.filename, erro: 'mime não permitido: ' + f.mime }); continue; }
      const ext = MIME_PERMITIDOS[f.mime];
      const hash = crypto.createHash('sha256').update(f.buffer).digest('hex');
      const dup = await sbBody(`/comprovantes_arquivos?comprovante_id=eq.${comprovanteId}&hash_sha256=eq.${hash}&select=id`);
      if (dup?.[0]) { salvos.push({ filename: f.filename, duplicado: dup[0].id }); continue; }
      const uuid = crypto.randomUUID();
      const fname = `${uuid}${ext}`;
      const fpath = path.join(dir, fname);
      fs.writeFileSync(fpath, f.buffer);
      const urlPub = `${PUBLIC_URL_BASE}/${empresaId}/${fname}`;
      const ins = await sb('/comprovantes_arquivos', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
          comprovante_id: comprovanteId,
          nome_original: f.filename,
          caminho_arquivo: fpath,
          url_publica: urlPub,
          mime_type: f.mime,
          tamanho_bytes: f.buffer.length,
          hash_sha256: hash,
          ocr_status: 'pendente',
        }
      });
      salvos.push({ filename: f.filename, id: ins.body?.[0]?.id, url: urlPub });
      await sb(`/comprovantes?id=eq.${comprovanteId}&arquivo_url=is.null`, { method: 'PATCH', body: { arquivo_url: urlPub, arquivo_tipo: f.mime, arquivo_tamanho: f.buffer.length }});
    }
    return res.status(200).json({ ok: true, salvos });
  } catch (err) {
    console.error('[comprovantes/upload]', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}

export const config = { api: { bodyParser: false } };
