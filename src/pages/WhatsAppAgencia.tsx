// src/pages/WhatsAppAgencia.tsx
// Gestao de instancias WhatsApp por empresa da agencia.
// 1 numero por empresa. QR code para conectar/reconectar.

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageCircle, Plus, Trash2, Phone, Wifi, WifiOff, Loader2, RefreshCw,
  CheckCircle2, AlertCircle, QrCode, X, Smartphone, Clock,
} from 'lucide-react';
import { useTrafego } from '../contexts/TrafegoContext';
import { AgenciaContextoBanner } from '../components/AgenciaContextoBanner';

interface Instancia {
  id: string;
  cliente_agencia_id: string;
  evolution_instance_name: string;
  telefone?: string | null;
  status: 'aguardando_qr' | 'conectando' | 'conectado' | 'desconectado' | 'erro';
  qr_code_base64?: string | null;
  qr_code_expires_at?: string | null;
  ultimo_conectado_em?: string | null;
  ultimo_desconectado_em?: string | null;
  criado_em?: string;
}

const STATUS_LABEL: Record<Instancia['status'], { label: string; color: string; icon: any }> = {
  aguardando_qr: { label: 'Aguardando QR',  color: 'bg-amber-100 text-amber-700',     icon: QrCode },
  conectando:    { label: 'Conectando...',  color: 'bg-blue-100 text-blue-700',       icon: Loader2 },
  conectado:     { label: 'Conectado',      color: 'bg-emerald-100 text-emerald-700', icon: Wifi },
  desconectado:  { label: 'Desconectado',   color: 'bg-slate-200 text-slate-600',     icon: WifiOff },
  erro:          { label: 'Erro',           color: 'bg-red-100 text-red-700',         icon: AlertCircle },
};

export function WhatsAppAgencia() {
  const { clientes, clienteAtivo } = useTrafego();
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [qrModal, setQrModal] = useState<Instancia | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const url = clienteAtivo
        ? `/api/whatsapp/instancias?cliente_id=${clienteAtivo.id}`
        : '/api/whatsapp/instancias';
      const res = await fetch(url);
      if (!res.ok) throw new Error('falhou ao carregar');
      const data = await res.json();
      setInstancias(Array.isArray(data) ? data : []);
      setErro('');
    } catch (e: any) {
      setErro(e?.message || 'erro');
    } finally {
      setLoading(false);
    }
  }, [clienteAtivo]);

  useEffect(() => { carregar(); }, [carregar]);
  // Polling a cada 4s pra ver mudanca de status quando QR é scaneado
  useEffect(() => {
    const id = setInterval(carregar, 4000);
    return () => clearInterval(id);
  }, [carregar]);

  async function criarInstancia() {
    if (!clienteAtivo) { setErro('Selecione uma empresa primeiro'); return; }
    setCriando(true); setErro('');
    try {
      const res = await fetch('/api/whatsapp/instancias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_agencia_id: clienteAtivo.id }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'falhou ao criar');
      }
      const inst = await res.json();
      await carregar();
      setQrModal(inst);
    } catch (e: any) {
      setErro(e?.message || 'erro');
    } finally {
      setCriando(false);
    }
  }

  async function removerInstancia(id: string) {
    if (!confirm('Desconectar e remover essa instancia? O numero podera ser reconectado depois.')) return;
    try {
      const res = await fetch(`/api/whatsapp/instancias?id=${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('falhou');
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'erro ao remover');
    }
  }

  function clienteDe(id: string) {
    return clientes.find(c => c.id === id);
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">WhatsApp da Agência</h1>
            <p className="text-sm text-slate-500">
              {instancias.length} {instancias.length === 1 ? 'número conectado' : 'números conectados'} · Evolution API
            </p>
          </div>
          <button
            onClick={criarInstancia}
            disabled={!clienteAtivo || criando}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
          >
            {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Conectar número
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <AgenciaContextoBanner contexto="WhatsApp" />

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {erro}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Carregando...
          </div>
        ) : instancias.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-700 mb-1">
              {clienteAtivo ? `Nenhum WhatsApp conectado para ${clienteAtivo.nome}` : 'Nenhuma empresa selecionada'}
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              {clienteAtivo ? 'Conecte um número para começar a receber e enviar mensagens.' : 'Selecione uma empresa no banner acima.'}
            </p>
            {clienteAtivo && (
              <button onClick={criarInstancia} disabled={criando} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {criando ? 'Criando...' : '+ Conectar primeiro número'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {instancias.map(inst => {
              const cliente = clienteDe(inst.cliente_agencia_id);
              const StatusIcon = STATUS_LABEL[inst.status]?.icon || Wifi;
              return (
                <div key={inst.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: cliente?.cor_destaque || '#10b981' }}
                      >
                        {cliente?.nome?.split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-900 truncate">{cliente?.nome || 'Empresa removida'}</h3>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_LABEL[inst.status]?.color}`}>
                            <StatusIcon className={`w-3 h-3 ${inst.status === 'conectando' ? 'animate-spin' : ''}`} />
                            {STATUS_LABEL[inst.status]?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {inst.telefone ? (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +{inst.telefone}</span>
                          ) : (
                            <span className="text-slate-400">Sem número (escaneie QR)</span>
                          )}
                          {inst.ultimo_conectado_em && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Conectou {new Date(inst.ultimo_conectado_em).toLocaleString('pt-BR')}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{inst.evolution_instance_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(inst.status === 'aguardando_qr' || inst.status === 'conectando' || inst.status === 'desconectado') && (
                        <button
                          onClick={() => setQrModal(inst)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg"
                        >
                          <QrCode className="w-3.5 h-3.5" /> Ver QR
                        </button>
                      )}
                      <button
                        onClick={() => removerInstancia(inst.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ajuda */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Como conectar
          </h4>
          <ol className="space-y-1 text-blue-800 list-decimal list-inside text-xs">
            <li>Selecione a empresa no banner acima</li>
            <li>Clique em <strong>+ Conectar número</strong> — vai abrir um QR code</li>
            <li>No celular: WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho</li>
            <li>Aponte a câmera pro QR. Em segundos, status muda para <em>Conectado</em></li>
            <li>Mensagens recebidas começam a aparecer no <strong>WhatsApp CRM</strong> e podem ser respondidas por lá</li>
          </ol>
        </div>
      </div>

      {qrModal && <QRModal instancia={qrModal} onClose={() => setQrModal(null)} />}
    </div>
  );
}

function QRModal({ instancia, onClose }: { instancia: Instancia; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(instancia.qr_code_base64 || null);
  const [status, setStatus] = useState(instancia.status);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/whatsapp/qr?id=${instancia.id}`);
      if (r.ok) {
        const d = await r.json();
        if (d.qr_code_base64) setQr(d.qr_code_base64);
        if (d.status) setStatus(d.status);
        if (d.status === 'conectado') {
          // Fechou! Quando conectar, dá tempo de mostrar e fecha
          setTimeout(onClose, 1500);
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [instancia.id, onClose]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Conectar WhatsApp</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{instancia.evolution_instance_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {status === 'conectado' ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-lg text-slate-800">Conectado!</h4>
              <p className="text-sm text-slate-500">Esse número está pronto pra usar.</p>
            </div>
          ) : qr ? (
            <>
              <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-center">
                <img
                  src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">No celular:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Abra WhatsApp</li>
                  <li>Vá em <strong>Configurações → Aparelhos conectados</strong></li>
                  <li>Toque em <strong>Conectar um aparelho</strong></li>
                  <li>Escaneie o QR acima</li>
                </ol>
              </div>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg"
              >
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Atualizar QR
              </button>
            </>
          ) : (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Gerando QR code...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WhatsAppAgencia;
