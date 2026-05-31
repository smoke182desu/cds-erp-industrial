// Servico de conversas (historico WhatsApp <-> ERP)
// Usa a API serverless /api/mensagem que acessa Supabase

export interface Mensagem {
  id: string;
  telefone: string;
  texto: string;
  tipo: 'entrada' | 'saida';
  origem: string;
  leadId: string;
  criadoEm: string;
  mediaUrl?: string;
  mediaType?: string; // 'image' | 'video' | 'document' | 'audio'
}

const API_BASE = '/api';

function tempoMensagem(mensagem: Mensagem): number {
  const time = new Date(mensagem.criadoEm || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

function ordenarMensagens(mensagens: Mensagem[]): Mensagem[] {
  return [...mensagens].sort((a, b) => tempoMensagem(a) - tempoMensagem(b));
}

function mediaTypeReal(valor?: string): boolean {
  const tipo = String(valor || '').toLowerCase().replace(/message$/, '');
  return ['image', 'imagem', 'video', 'audio', 'document', 'documento', 'sticker'].includes(tipo);
}

// ---------- buscar historico de um telefone ----------
export async function buscarMensagens(telefone: string): Promise<Mensagem[]> {
  const tel = telefone.replace(/\D/g, '');
  const res = await fetch(`${API_BASE}/mensagem?telefone=${tel}`);
  const data = await res.json();
  return ordenarMensagens(((Array.isArray(data) ? data : []) as Mensagem[])
    .filter(m => !!(m.texto?.trim() || m.mediaUrl || mediaTypeReal(m.mediaType))));
}

// ---------- enviar mensagem de texto via WhatsApp (Evolution multi-tenant) ----------
// Tenta primeiro o endpoint novo /api/whatsapp/send (Evolution API),
// caindo no /api/mensagem antigo se a Evolution nao encontrou instancia conectada.
export async function enviarMensagem(
  telefone: string,
  mensagem: string,
  leadId?: string,
  clienteAgenciaId?: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // 1) Tenta Evolution API multi-tenant
  if (clienteAgenciaId) {
    try {
      const r = await fetch(`${API_BASE}/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, mensagem, cliente_agencia_id: clienteAgenciaId }),
      });
      if (r.ok) {
        const d = await r.json();
        return { ok: true, id: d?.evolution?.key?.id };
      }
      // Se 404 (sem instancia conectada), cai pro legado
      if (r.status !== 404) {
        const err = await r.json().catch(() => ({}));
        return { ok: false, error: err?.error || `HTTP ${r.status}` };
      }
    } catch (e: any) {
      // segue pro legado
    }
  }

  // 2) Legado /api/mensagem
  const res = await fetch(`${API_BASE}/mensagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone, mensagem, leadId }),
  });
  return lerRespostaApi(res);
}

async function lerRespostaApi(res: Response): Promise<any> {
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) {
    return { ok: false, error: data.error || data.message || text || `HTTP ${res.status}` };
  }
  return data;
}

// ---------- converter File para base64 ----------
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- enviar midia (imagem/video/documento) via WhatsApp ----------
export async function enviarMidia(
  telefone: string,
  file: File,
  caption?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // Converte para base64 data URL e envia como JSON
  // Vercel tem limite de ~4.5MB no body
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: 'Arquivo muito grande. Maximo 4MB para envio pelo CRM.' };
  }

  const mediaBase64 = await fileToBase64(file);

  const res = await fetch(`${API_BASE}/mensagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telefone,
      media: mediaBase64,
      fileName: file.name,
      mimetype: file.type,
      caption: caption || '',
    }),
  });
  return lerRespostaApi(res);
}

// ---------- formatar conversa para copiar ----------
export function formatarConversaParaCopiar(
  mensagens: Mensagem[],
  nomeCliente: string
): string {
  const linhas = mensagens.map(m => {
    const hora = m.criadoEm
      ? new Date(m.criadoEm).toLocaleString('pt-BR')
      : '';
    const quem = m.tipo === 'saida' ? 'CDS Industrial' : nomeCliente || 'Cliente';
    const media = m.mediaUrl ? ` [${m.mediaType || 'midia'}]` : '';
    return `[${hora}] ${quem}: ${m.texto}${media}`;
  });
  return linhas.join('\n');
}
