// Serviço de conversas (histórico WhatsApp ↔ ERP)
// Usa a API serverless /api/mensagem que acessa Firestore

export interface Mensagem {
  id: string;
  telefone: string;
  texto: string;
  tipo: 'entrada' | 'saida';
  origem: string;
  leadId: string;
  criadoEm: string;
}

const API_BASE = '/api';

// ---------- buscar histórico de um telefone ----------
export async function buscarMensagens(telefone: string): Promise<Mensagem[]> {
  const tel = telefone.replace(/\D/g, '');
  const res = await fetch(`${API_BASE}/mensagem?telefone=${tel}`);
  const data = await res.json();
  return (data.mensagens || []) as Mensagem[];
}

// ---------- enviar mensagem via WhatsApp ----------
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
    return `[${hora}] ${quem}: ${m.texto}`;
  });
  return linhas.join('\n');
}
