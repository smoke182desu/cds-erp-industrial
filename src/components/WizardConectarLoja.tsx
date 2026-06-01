// Wizard de 4 passos pra conectar uma loja WooCommerce a uma empresa-cliente
import { useState, useEffect } from 'react';
import {
  ShoppingBag, CheckCircle2, AlertCircle, Loader2, Copy, ExternalLink,
  ArrowRight, ArrowLeft, X, Globe, Key, Webhook, Zap, Eye, EyeOff
} from 'lucide-react';

type Passo = 1 | 2 | 3 | 4;

interface TestResult {
  ok: boolean;
  produtos_disponiveis?: number;
  pedidos_total?: number;
  loja?: { nome_loja?: string; versao_wc?: string; moeda?: string };
  erro?: string;
  dica?: string;
}

interface Loja {
  id: string;
  cliente_agencia_id: string;
  nome: string;
  url?: string;
  consumer_key?: string;
  consumer_secret?: string;
  webhook_token?: string;
  status_conexao?: string;
}

export function WizardConectarLoja({
  loja,
  empresaNome,
  onClose,
  onSucesso
}: {
  loja: Loja;
  empresaNome: string;
  onClose: () => void;
  onSucesso?: (loja: Loja) => void;
}) {
  const [passo, setPasso] = useState<Passo>(1);
  const [nome, setNome] = useState(loja.nome || `Loja ${empresaNome}`);
  const [url, setUrl] = useState(loja.url || '');
  const [consumerKey, setConsumerKey] = useState(loja.consumer_key || '');
  const [consumerSecret, setConsumerSecret] = useState(loja.consumer_secret || '');
  const [mostrarSecret, setMostrarSecret] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncResultado, setSyncResultado] = useState<any>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://erp.cdsind.com.br';
  const webhookUrl = `${ORIGIN}/api/wc-webhook?loja_id=${loja.id}`;
  const webhookSecret = loja.webhook_token || '';

  function copiar(texto: string, label: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(label);
    setTimeout(() => setCopiado(null), 1500);
  }

  async function salvarPasso1() {
    await fetch(`/api/wc-lojas?id=${loja.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, url: url.replace(/\/$/, '') })
    });
    setPasso(2);
  }

  async function testarConexao() {
    if (!url || !consumerKey || !consumerSecret) return;
    setTestando(true); setTestResult(null);
    try {
      const r = await fetch('/api/wc-lojas-conexao/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, consumer_key: consumerKey, consumer_secret: consumerSecret,
          loja_id: loja.id, salvar: true
        })
      });
      const data: TestResult = await r.json();
      setTestResult(data);
      if (data.ok) {
        // Marca loja ativa após teste OK
        await fetch(`/api/wc-lojas?id=${loja.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo: true })
        });
      }
    } catch (e: any) {
      setTestResult({ ok: false, erro: e?.message || 'erro' });
    } finally {
      setTestando(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      const r = await fetch('/api/wc-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loja_id: loja.id, entity: 'pedidos' })
      });
      const data = await r.json();
      setSyncResultado(data.resultado?.[0] || data);
    } catch (e: any) {
      setSyncResultado({ erro: e?.message });
    } finally {
      setSincronizando(false);
    }
  }

  function podeAvancar(p: Passo) {
    if (p === 1) return !!nome.trim() && !!url.trim();
    if (p === 2) return testResult?.ok === true;
    if (p === 3) return true;
    return false;
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Conectar Loja WooCommerce</h3>
              <p className="text-xs text-slate-500">Empresa: <span className="font-semibold">{empresaNome}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 flex items-center gap-1 bg-slate-50 border-b border-slate-200 text-xs font-semibold">
          {[1,2,3,4].map(n => (
            <div key={n} className="flex items-center gap-1 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                passo === n ? 'bg-violet-600 text-white' :
                passo > n ? 'bg-emerald-500 text-white' :
                'bg-slate-200 text-slate-500'
              }`}>
                {passo > n ? <CheckCircle2 className="w-3 h-3" /> : n}
              </div>
              <span className={`hidden md:inline ${passo === n ? 'text-violet-700' : passo > n ? 'text-emerald-700' : 'text-slate-500'}`}>
                {n === 1 ? 'Identidade' : n === 2 ? 'Credenciais' : n === 3 ? 'Webhook' : 'Pronto'}
              </span>
              {n < 4 && <div className={`h-px flex-1 ${passo > n ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 min-h-[300px]">
          {passo === 1 && (
            <>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                <Globe className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <strong>Passo 1 — identificação da loja</strong>
                  <p className="text-xs mt-0.5">Nome interno e URL da loja WooCommerce desta empresa. A URL precisa ser pública e ter WooCommerce ativo.</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Nome interno da loja</label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1"
                  placeholder="Loja da Padaria do João"
                />
                <p className="text-[10px] text-slate-400 mt-1">Aparece só pra você — o cliente não vê.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">URL da loja</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono"
                  placeholder="https://lojadocliente.com.br"
                />
                <p className="text-[10px] text-slate-400 mt-1">URL completa incluindo https://. Sem barra no final.</p>
              </div>
            </>
          )}

          {passo === 2 && (
            <>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                <Key className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <strong>Passo 2 — gerar credenciais no WooCommerce</strong>
                  <p className="text-xs mt-0.5">Você precisa de Consumer Key e Consumer Secret pro ERP conseguir falar com a loja.</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-2">
                <strong className="text-slate-800 text-sm">📋 Como gerar:</strong>
                <ol className="space-y-1 list-decimal list-inside ml-1">
                  <li>Abrir o WP-Admin da loja → <strong>WooCommerce</strong> → <strong>Configurações</strong></li>
                  <li>Aba <strong>Avançado</strong> → <strong>REST API</strong> → <strong>Adicionar chave</strong></li>
                  <li>Descrição: <code className="bg-white px-1 rounded">CDS ERP</code></li>
                  <li>Usuário: o admin da loja</li>
                  <li>Permissões: <strong>Ler/Escrever</strong></li>
                  <li>Clicar em <strong>Gerar chave da API</strong></li>
                  <li>Copiar <strong>Consumer key</strong> (começa com <code>ck_</code>) e <strong>Consumer secret</strong> (começa com <code>cs_</code>)</li>
                </ol>
                <p className="text-[10px] text-slate-500 mt-2">⚠️ O secret só aparece UMA vez. Anote logo!</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Consumer Key</label>
                <input
                  value={consumerKey}
                  onChange={e => setConsumerKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono"
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Consumer Secret</label>
                <div className="relative">
                  <input
                    type={mostrarSecret ? 'text' : 'password'}
                    value={consumerSecret}
                    onChange={e => setConsumerSecret(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mt-1 font-mono pr-9"
                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSecret(!mostrarSecret)}
                    className="absolute right-2 top-3 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {mostrarSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={testarConexao}
                disabled={testando || !consumerKey || !consumerSecret}
                className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Testar conexão
              </button>

              {testResult && (
                <div className={`p-3 rounded-lg border ${testResult.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} text-sm`}>
                  {testResult.ok ? (
                    <>
                      <div className="flex items-center gap-2 font-semibold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4" /> Conexão OK!
                      </div>
                      <div className="text-xs text-emerald-700 mt-1 space-y-0.5">
                        {testResult.loja?.nome_loja && <div>Loja: <strong>{testResult.loja.nome_loja}</strong></div>}
                        {testResult.loja?.versao_wc && <div>WooCommerce: v{testResult.loja.versao_wc}</div>}
                        <div>{testResult.produtos_disponiveis} produtos · {testResult.pedidos_total ?? '?'} pedidos</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 font-semibold text-red-800">
                        <AlertCircle className="w-4 h-4" /> Conexão falhou
                      </div>
                      <div className="text-xs text-red-700 mt-1 break-all">{testResult.erro}</div>
                      {testResult.dica && <div className="text-[11px] text-red-600 mt-1 italic">💡 {testResult.dica}</div>}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {passo === 3 && (
            <>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                <Webhook className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <strong>Passo 3 — webhook em tempo real (opcional, mas recomendado)</strong>
                  <p className="text-xs mt-0.5">Sem webhook a gente sincroniza a cada hora. Com webhook, pedidos novos aparecem instantaneamente.</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-3">
                <div>
                  <strong className="text-slate-800 text-sm">📋 Configurar webhook:</strong>
                  <ol className="space-y-1 list-decimal list-inside ml-1 mt-1 text-slate-700">
                    <li>WP-Admin → WooCommerce → Configurações → Avançado → <strong>Webhooks</strong></li>
                    <li><strong>Adicionar webhook</strong></li>
                    <li>Nome: <code className="bg-white px-1 rounded">CDS ERP - Pedidos</code></li>
                    <li>Status: <strong>Ativo</strong></li>
                    <li>Tópico: <strong>Order created</strong></li>
                    <li>URL de entrega: usar a URL abaixo ⬇️</li>
                    <li>Chave secreta: usar o secret abaixo ⬇️</li>
                    <li>Versão API: <strong>WP REST API Integration v3</strong></li>
                    <li>Salvar — depois repetir pra Order updated, Customer created, Product updated</li>
                  </ol>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">URL de entrega</label>
                  <div className="flex items-center gap-1 mt-1">
                    <input readOnly value={webhookUrl} className="flex-1 px-2 py-1.5 bg-white border border-slate-300 rounded font-mono text-[11px]" />
                    <button
                      onClick={() => copiar(webhookUrl, 'url')}
                      className="px-2 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> {copiado === 'url' ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chave secreta</label>
                  <div className="flex items-center gap-1 mt-1">
                    <input readOnly value={webhookSecret} className="flex-1 px-2 py-1.5 bg-white border border-slate-300 rounded font-mono text-[11px]" />
                    <button
                      onClick={() => copiar(webhookSecret, 'secret')}
                      className="px-2 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> {copiado === 'secret' ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-500">
                Você pode pular esse passo e configurar depois — o ERP ainda vai sincronizar a cada hora automaticamente.
              </p>
            </>
          )}

          {passo === 4 && (
            <>
              <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg text-sm text-emerald-900">
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <strong>Passo 4 — sincronizar pela primeira vez</strong>
                  <p className="text-xs mt-0.5">Vou puxar os últimos pedidos da loja pra confirmar que tudo funciona.</p>
                </div>
              </div>

              <button
                onClick={sincronizar}
                disabled={sincronizando}
                className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sincronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
              </button>

              {syncResultado && (
                <div className={`p-3 rounded-lg border ${syncResultado.erro ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'} text-sm`}>
                  {syncResultado.erro ? (
                    <div className="text-red-800"><strong>Erro:</strong> {syncResultado.erro}</div>
                  ) : (
                    <>
                      <div className="text-emerald-800 font-semibold">✅ Sincronização concluída!</div>
                      <div className="text-xs text-emerald-700 mt-1">
                        {syncResultado.total} pedidos processados · <strong>{syncResultado.novos}</strong> novos · {syncResultado.atualizados} atualizados
                        {syncResultado.propostas_criadas > 0 && <div>{syncResultado.propostas_criadas} propostas criadas no ERP</div>}
                        {syncResultado.comprovantes_criados > 0 && <div>{syncResultado.comprovantes_criados} comprovantes criados</div>}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
                <strong>🎉 Próximos passos:</strong>
                <ul className="list-disc list-inside ml-1">
                  <li>Pedidos novos da loja vão virar propostas no ERP automaticamente</li>
                  <li>Quando o cliente pagar, gera comprovante automático</li>
                  <li>Os clientes da loja vão aparecer no CRM como leads</li>
                  <li>Estoque, cupons e produtos sincronizam a cada hora (ou em tempo real com webhook)</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer com navegação */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-between items-center sticky bottom-0 bg-white">
          {passo > 1 ? (
            <button
              onClick={() => setPasso((passo - 1) as Passo)}
              className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          ) : <div />}

          {passo < 4 ? (
            <button
              onClick={() => {
                if (passo === 1) salvarPasso1();
                else setPasso((passo + 1) as Passo);
              }}
              disabled={!podeAvancar(passo)}
              className="flex items-center gap-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {passo === 2 && !testResult?.ok ? 'Teste primeiro' : 'Continuar'} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => { onSucesso?.(loja); onClose(); }}
              className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
            >
              Concluir ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
