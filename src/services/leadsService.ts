import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export type LeadStatus = 'novo' | 'em_triagem' | 'qualificado' | 'descartado';
export type LeadOrigem = 'site' | 'whatsapp' | 'manual';

export interface Lead {
  id?: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  mensagem?: string;
  origem: LeadOrigem;
  status: LeadStatus;
  criadoEm: string;
  atualizadoEm?: string;
  observacoes?: string;
}

export const buscarLeads = async (): Promise<Lead[]> => {
  try {
    const q = query(collection(db, 'leads'), orderBy('criadoEm', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Lead));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'leads');
    return [];
  }
};

export const adicionarLead = async (lead: Omit<Lead, 'id' | 'criadoEm'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'leads'), {
      ...lead,
      status: 'novo' as LeadStatus,
      criadoEm: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'leads');
    return '';
  }
};

export const atualizarLead = async (
  id: string,
  dados: Partial<Pick<Lead, 'status' | 'observacoes'>>
): Promise<void> => {
  try {
    const docRef = doc(db, 'leads', id);
    await updateDoc(docRef, {
      ...dados,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `leads/${id}`);
  }
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo:        'Novo',
  em_triagem:  'Em Triagem',
  qualificado: 'Qualificado',
  descartado:  'Descartado',
};

export const ORIGEM_LABELS: Record<LeadOrigem, string> = {
  site:      'Site',
  whatsapp:  'WhatsApp',
  manual:    'Manual',
};
