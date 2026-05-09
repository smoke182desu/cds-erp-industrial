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

// ---------- buscar historico de um telefone ----------
export async function buscarMensagens(telefone: string): Promise<Mensagem[]> {
  const tel = telefone.replace(/\D/g, '');
  const res = await fetch(`${API_BASE}/mensagem?telefone=${tel}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []) as Mensagem[];
}

// ---------- enviar mensagem de texto via WhatsApp ----------
export async function enviarMensagem(
  telefone: string,
  mensagem: string,
  leadId?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/mensagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone, mensagem, leadId }),
  });
  return res.json();
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
  return res.json();
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
