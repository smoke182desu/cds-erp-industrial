import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  onSnapshot,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ---------- Tipos do funil CRM ----------
export type EtapaFunil =
  | 'lead_novo'
  | 'contato_feito'
  | 'qualificado'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado_ganho'
  | 'fechado_perdido';

export type LeadOrigem = 'site' | 'whatsapp' | 'woocommerce' | 'calculadora' | 'manual';

export const ETAPAS_FUNIL: { id: EtapaFunil; label: string; cor: string; descricao: string }[] = [
  { id: 'lead_novo',        label: 'Novo Lead',         cor: '#6366f1', descricao: 'Lead recém captado' },
  { id: 'contato_feito',    label: 'Contato Feito',     cor: '#0ea5e9', descricao: 'Primeiro contato realizado' },
  { id: 'qualificado',      label: 'Qualificado',       cor: '#f59e0b', descricao: 'Lead validado e com potencial' },
  { id: 'proposta_enviada', label: 'Proposta Enviada',  cor: '#8b5cf6', descricao: 'Proposta comercial enviada' },
  { id: 'negociacao',       label: 'Em Negociação',     cor: '#ec4899', descricao: 'Negociação em andamento' },
  { id: 'fechado_ganho',    label: 'Fechado ✓',         cor: '#10b981', descricao: 'Venda concluída com sucesso' },
  { id: 'fechado_perdido',  label: 'Perdido ✗',         cor: '#ef4444', descricao: 'Oportunidade perdida' },
];

export const ORIGEM_LABELS: Record<LeadOrigem, string> = {
  site:        '🌐 Site',
  whatsapp:    '💬 WhatsApp',
  woocommerce: '🛒 WooCommerce',
  calculadora: '📐 Calculadora',
  manual:      '✏️ Manual',
};

export interface Lead {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  mensagem?: string;
  origem: LeadOrigem;
  etapa: EtapaFunil;
  valor?: number;
  pedidoId?: string;
  clienteId?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm?: string;
}

// ---------- buscar todos os leads (tempo real) ----------
export function subscribeLeads(callback: (leads: Lead[]) => void) {
  const q = query(collection(db, 'leads'), orderBy('criadoEm', 'desc'));
  return onSnapshot(q, (snap) => {
    const leads: Lead[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Lead, 'id'>),
    }));
    callback(leads);
  });
}

// ---------- buscar leads (uma vez) ----------
export async function buscarLeads(): Promise<Lead[]> {
  const q = query(collection(db, 'leads'), orderBy('criadoEm', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, 'id'>) }));
}

// ---------- buscar leads por etapa ----------
export async function buscarLeadsPorEtapa(etapa: EtapaFunil): Promise<Lead[]> {
  const q = query(collection(db, 'leads'), where('etapa', '==', etapa), orderBy('criadoEm', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, 'id'>) }));
}

// ---------- próximo código de cliente (sequencial) ----------
async function proximoCodigoCliente(): Promise<number> {
  const ref = doc(db, 'config', 'cliente_counter');
  const snap = await getDoc(ref);
  const atual = snap.exists() ? (snap.data().numero as number) : 0;
  const proximo = atual + 1;
  await setDoc(ref, { numero: proximo });
  return proximo;
}

// ---------- criar ou retornar cliente ----------
export async function salvarCliente(lead: Partial<Lead>): Promise<string> {
  if (!lead.telefone) return '';
  // Evita duplicatas por telefone
  const q = query(collection(db, 'clientes'), where('telefone', '==', lead.telefone));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const existente = snap.docs[0];
    await updateDoc(existente.ref, {
      nome: lead.nome || existente.data().nome || '',
      empresa: lead.empresa || existente.data().empresa || '',
      email: lead.email || existente.data().email || '',
      atualizadoEm: new Date().toISOString(),
    });
    return existente.id;
  }
  // Novo cliente com número sequencial
  const codigo = await proximoCodigoCliente();
  const codigoFormatado = `CLI-${String(codigo).padStart(4, '0')}`;
  const ref = await addDoc(collection(db, 'clientes'), {
    codigo,
    codigoFormatado,
    nome:      lead.nome      || '',
    email:     lead.email     || '',
    telefone:  lead.telefone,
    empresa:   lead.empresa   || '',
    tipo:      'pre_cadastro',
    origem:    lead.origem    || 'manual',
    criadoEm:  new Date().toISOString(),
  });
  return ref.id;
}

// ---------- adicionar lead (e salvar cliente automaticamente) ----------
export async function adicionarLead(data: Omit<Lead, 'id' | 'criadoEm'>): Promise<string> {
  // Salva/atualiza cliente automaticamente
  const clienteId = await salvarCliente(data);
  const ref = await addDoc(collection(db, 'leads'), {
    ...data,
    clienteId,
    etapa: data.etapa || 'lead_novo',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });
  return ref.id;
}

// ---------- atualizar lead ----------
export async function atualizarLead(id: string, data: Partial<Omit<Lead, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'leads', id), {
    ...data,
    atualizadoEm: new Date().toISOString(),
  });
}

// ---------- mover etapa ----------
export async function moverEtapa(id: string, etapa: EtapaFunil): Promise<void> {
  await updateDoc(doc(db, 'leads', id), {
    etapa,
    atualizadoEm: new Date().toISOString(),
  });
}

// ---------- buscar clientes (pre-cadastro) ----------
export async function buscarClientes() {
  const snap = await getDocs(collection(db, 'clientes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
