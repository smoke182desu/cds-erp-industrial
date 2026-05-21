import { useEffect, useState, useCallback } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DiagResponse {
  ok: boolean;
  instance?: string;
  current_webhook?: string | null;
  matches_expected?: boolean;
  webhook_raw?: any;
  connection_state?: {
    instance?: { state?: string };
    code?: number;
    message?: string;
  };
  error?: string;
}

interface QrResponse {
  ok: boolean;
  qrcode?: { base64?: string; code?: string; count?: number };
  pairingCode?: string | null;
  error?: string;
}

const DIAG_URL = '/api/data?resource=evolution-diag';

export default function WhatsAppConfigModal({ open, onClose }: Props) {
  const [diag, setDiag] = useState<DiagResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const refreshDiag = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(DIAG_URL);
      const data: DiagResponse = await r.json();
      setDiag(data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao consultar diagnóstico');
    } finally {
      setLoading(false);
    }
  }, []);

  // Estado da conexão derivado
  const state = diag?.connection_state?.instance?.state || null;
  const connState =
    diag?.connection_state?.code === 404
      ? 'application_not_found'
      : state || 'unknown';

  // Polling enquanto modal aberto + connecting/closed (pra ver QR atualizar / conexão estabelecer)
  useEffect(() => {
    if (!open) return;
    refreshDiag();
    const tick = setInterval(refreshDiag, 5000);
    return () => clearInterval(tick);
  }, [open, refreshDiag]);

  // Auto reset ao fechar
  useEffect(() => {
    if (!open) {
      setQrBase64(null);
      setPairingCode(null);
      setActionMsg(null);
    }
  }, [open]);

  const fetchQr = async () => {
    setQrLoading(true);
    setActionMsg(null);
    try {
      const r = await fetch(`${DIAG_URL}&action=qrcode`);
      const data: QrResponse = await r.json();
      if (data?.qrcode?.base64) {
        const b64 = data.qrcode.base64.startsWith('data:')
          ? data.qrcode.base64
          : `data:image/png;base64,${data.qrcode.base64}`;
        setQrBase64(b64);
        setPairingCode(data.pairingCode || null);
      } else if (data?.pairingCode) {
        setPairingCode(data.pairingCode);
      } else {
        setActionMsg('QR Code ainda não disponível. Aguarde alguns segundos e tente de novo.');
      }
    } catch (e: any) {
      setActionMsg(`Erro ao buscar QR: ${e?.message || e}`);
    } finally {
      setQrLoading(false);
    }
  };

  const restart = async () => {
    setActionMsg('Reiniciando conexão…');
    try {
      const r = await fetch(`${DIAG_URL}&action=restart`, { method: 'POST' });
      const data = await r.json();
      setActionMsg(data?.ok ? 'Restart enviado com sucesso.' : `Restart falhou: ${data?.error || 'erro desconhecido'}`);
      setQrBase64(null);
      refreshDiag();
    } catch (e: any) {
      setActionMsg(`Erro: ${e?.message || e}`);
    }
  };

  const fixWebhook = async () => {
    setActionMsg('Configurando webhook…');
    try {
      const r = await fetch(`${DIAG_URL}&action=set`, { method: 'POST' });
      const data = await r.json();
      setActionMsg(data?.ok ? 'Webhook configurado.' : `Falhou: ${JSON.stringify(data?.response || data)}`);
      refreshDiag();
    } catch (e: any) {
      setActionMsg(`Erro: ${e?.message || e}`);
    }
  };

  if (!open) return null;

  // UI helpers
  const statusBadge = () => {
    const map: Record<string, { color: string; label: string }> = {
      open: { color: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'Conectado' },
      connecting: { color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Conectando' },
      close: { color: 'bg-rose-100 text-rose-700 border-rose-300', label: 'Desconectado' },
      application_not_found: { color: 'bg-rose-100 text-rose-700 border-rose-300', label: 'Instância não existe' },
      unknown: { color: 'bg-gray-100 text-gray-600 border-gray-300', label: 'Desconhecido' },
    };
    const cfg = map[connState] || map.unknown;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${connState === 'open' ? 'bg-emerald-500' : connState === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
        {cfg.label}
      </span>
    );
  };

  const showQrSection = connState !== 'open';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Configurar WhatsApp</h2>
            <p className="text-emerald-100 text-xs">Status e reconexão da Evolution API</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status row */}
          <div className="border rounded-xl p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Status da conexão</span>
              {loading ? <span className="text-xs text-gray-400">atualizando…</span> : statusBadge()}
            </div>
            <div className="text-xs text-gray-600 grid grid-cols-1 gap-1">
              <div><span className="font-semibold">Instância:</span> {diag?.instance || '—'}</div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Webhook:</span>
                <span className="truncate max-w-[260px]">{diag?.current_webhook || '— não configurado —'}</span>
                {diag && (diag.matches_expected ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <button onClick={fixWebhook} className="text-xs text-indigo-600 hover:underline">corrigir</button>
                ))}
              </div>
            </div>
            {error && <div className="text-rose-600 text-xs mt-2">{error}</div>}
          </div>

          {/* QR / reconnect */}
          {showQrSection && (
            <div className="border rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">Reconectar WhatsApp</div>
              {qrBase64 ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={qrBase64} alt="QR Code WhatsApp" className="w-64 h-64 border rounded-lg" />
                  <p className="text-xs text-gray-600 text-center max-w-sm">
                    Abra o WhatsApp no celular → <strong>Configurações</strong> → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> e escaneie o código acima.
                  </p>
                  <button onClick={fetchQr} disabled={qrLoading} className="text-xs text-indigo-600 hover:underline">
                    {qrLoading ? 'gerando…' : 'gerar novo QR'}
                  </button>
                </div>
              ) : pairingCode ? (
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Código de pareamento:</div>
                  <div className="font-mono text-2xl tracking-widest text-emerald-700">{pairingCode}</div>
                </div>
              ) : (
                <button
                  onClick={fetchQr}
                  disabled={qrLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl text-sm"
                >
                  {qrLoading ? 'Gerando QR Code…' : 'Gerar QR Code'}
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="border rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Ações avançadas</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={refreshDiag} className="text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg">
                Atualizar status
              </button>
              <button onClick={restart} className="text-sm bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg">
                Reiniciar conexão
              </button>
              <button onClick={fixWebhook} className="text-sm bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg">
                Reconfigurar webhook
              </button>
            </div>
            {actionMsg && <div className="text-xs text-gray-600 mt-3 whitespace-pre-wrap">{actionMsg}</div>}
          </div>

          <div className="text-[10px] text-gray-400 text-center">
            Quando o status virar <strong>Conectado</strong>, novas mensagens recebidas pelo WhatsApp criam leads automaticamente.
          </div>
        </div>
      </div>
    </div>
  );
}
