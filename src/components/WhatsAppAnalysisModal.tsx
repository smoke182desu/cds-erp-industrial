import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Loader2, Sparkles, MessageSquare, CheckCircle2, AlertCircle, FileText, User } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { Cliente, Proposta, ChatMessage } from '../types';

interface Props {
  clienteId?: string;   // quando acionado pelo card do CRM
  onClose: () => void;
}

/**
 * Modal Ãºnico que lÃª a conversa do WhatsApp e, em UMA chamada do Gemini Flash,
 * extrai:
 *   1. Dados cadastrais do cliente (nome, CPF/CNPJ, contato, endereÃ§o)
 *   2. Itens da proposta (produto, quantidade, medidas, prazo)
 *   3. Valor estimado e observaÃ§Ãµes
 *
 * EstratÃ©gia de economia de tokens:
 *   - Gemini 2.0 Flash (modelo mais barato)
 *   - Prompt curto em PT-BR
 *   - responseSchema garante JSON limpo sem retries
 *   - Usa apenas as ÃLTIMAS 40 linhas da conversa (suficiente p/ pedido atual)
 *   - Uma chamada = cadastro + proposta + movimento no funil
 */
export const WhatsAppAnalysisModal: React.FC<Props> = ({ clienteId, onClose }) => {
  // atualizarCliente e adicionarPropostaDireta sao opcionais — fallback pra adicionarProposta
  const erp = useERP() as any;
  const { state, adicionarCliente } = erp;
  const atualizarCliente = erp.atualizarCliente as ((id: string, patch: any) => void) | undefined;
  const adicionarPropostaDireta = (erp.adicionarPropostaDireta || erp.adicionarProposta) as ((p: any) => void) | undefined;
  const clienteAtual = useMemo(
    () => state.clientes.find(c => c.id === clienteId),
    [state.clientes, clienteId]
  );

  // PrÃ©-carrega mensagens jÃ¡ salvas do cliente (se houver)
  const mensagensSalvas = useMemo(() => {
    if (!clienteAtual?.mensagens?.length) return '';
    return clienteAtual.mensagens
      .slice(-40)
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Empresa'}: ${m.content}`)
      .join('\n');
  }, [clienteAtual]);

  const [conversa, setConversa] = useState(mensagensSalvas);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);

  const analisar = async () => {
    const texto = conversa.trim();
    if (!texto) {
      setError('Cole a conversa do WhatsApp primeiro.');
      return;
    }
    setLoading(true); setError(null);
    try {
      // Economia: mantÃ©m sÃ³ as Ãºltimas 40 linhas (pedido atual)
      const linhas = texto.split('\n').filter(Boolean).slice(-40).join('\n');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `VocÃª Ã© um assistente de CRM de serralheria. Leia a conversa abaixo e devolva JSON com:
- cliente: nome, email, telefone, tipo (PF/PJ), documento, endereco
- proposta: resumo curto (max 120 chars), itens [{descricao, quantidade, medidas, valorUnit}], valorTotalEstimado
- proximaAcao: "enviar_proposta" | "coletar_mais_info" | "agendar_visita"
Se algum campo nÃ£o aparecer, deixe vazio. NÃ£o invente valores. Seja conciso.

CONVERSA:
${linhas}`;

      const res = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cliente: {
                type: Type.OBJECT,
                properties: {
                  nome: { type: Type.STRING },
                  email: { type: Type.STRING },
                  telefone: { type: Type.STRING },
                  tipo: { type: Type.STRING, enum: ['PF', 'PJ', 'GOV'] },
                  documento: { type: Type.STRING },
                  endereco: { type: Type.STRING },
                },
              },
              proposta: {
                type: Type.OBJECT,
                properties: {
                  resumo: { type: Type.STRING },
                  itens: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        descricao: { type: Type.STRING },
                        quantidade: { type: Type.NUMBER },
                        medidas: { type: Type.STRING },
                        valorUnit: { type: Type.NUMBER },
                      },
                    },
                  },
                  valorTotalEstimado: { type: Type.NUMBER },
                },
              },
              proximaAcao: { type: Type.STRING },
            },
          },
        },
      });

      const data = JSON.parse(res.text);
      setResultado(data);
    } catch (e) {
      console.error(e);
      setError('Falha ao processar. Verifique a chave GEMINI_API_KEY.');
    } finally {
      setLoading(false);
    }
  };

  const aplicar = () => {
    if (!resultado) return;
    const cli = resultado.cliente || {};
    const prop = resultado.proposta || {};

    // Salva mensagens brutas para histÃ³rico (Ãºtil em futuras anÃ¡lises)
    const mensagensParaSalvar: ChatMessage[] = conversa
      .split('\n').filter(Boolean)
      .map((l, i) => ({
        id: `wa-${Date.now()}-${i}`,
        role: l.toLowerCase().startsWith('empresa') ? 'ai' : 'user',
        content: l.replace(/^(Cliente|Empresa):\s*/i, ''),
        timestamp: Date.now() + i,
      }));

    let idFinal = clienteId;
    if (clienteId && clienteAtual) {
      // Atualiza cliente existente (se a funcao existir no contexto)
      if (atualizarCliente) {
        atualizarCliente(clienteId, {
          nome: cli.nome || clienteAtual.nome,
          email: cli.email || clienteAtual.email,
          telefone: cli.telefone || clienteAtual.telefone,
          tipo: (cli.tipo as any) || clienteAtual.tipo,
          documento: cli.documento || clienteAtual.documento,
          endereco: cli.endereco || clienteAtual.endereco,
          mensagens: mensagensParaSalvar,
          funnelStage: 'Negociação',
        });
      }
    } else {
      // Cria cliente novo
      idFinal = `CLI-${Date.now()}`;
      const novo: Cliente = {
        id: idFinal,
        nome: cli.nome || 'Cliente WhatsApp',
        email: cli.email || '',
        telefone: cli.telefone || '',
        tipo: (cli.tipo as any) || 'PF',
        documento: cli.documento || '',
        endereco: cli.endereco || '',
        cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '',
        funnelStage: 'Negociação',
        mensagens: mensagensParaSalvar,
      };
      adicionarCliente(novo);
    }

    // Cria proposta rascunho com os itens extraÃ­dos
    if (prop.itens?.length || prop.valorTotalEstimado) {
      const proposta: Proposta = {
        id: `PROP-${Date.now()}`,
        clienteId: idFinal!,
        clienteNome: cli.nome || clienteAtual?.nome || 'Cliente WhatsApp',
        items: (prop.itens || []).map((it: any, i: number) => ({
          id: `it-${i}`,
          name: it.descricao || 'Item',
          descricao: it.descricao,
          medidas: it.medidas,
          quantidade: it.quantidade || 1,
          price: it.valorUnit || 0,
        })),
        total: prop.valorTotalEstimado || 0,
        status: 'Rascunho',
        data: new Date().toISOString(),
      };
      if (adicionarPropostaDireta) adicionarPropostaDireta(proposta);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><MessageSquare size={22} /></div>
          <div>
            <h3 className="font-bold text-slate-900">Analisar conversa do WhatsApp</h3>
            <p className="text-xs text-slate-500">A IA extrai cadastro + proposta em uma Ãºnica chamada (Gemini Flash Â· baixo custo)</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {clienteAtual && (
            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
              Cliente atual: <b>{clienteAtual.nome}</b> Â· {clienteAtual.telefone || 'sem telefone'}
            </div>
          )}

          <textarea
            value={conversa}
            onChange={(e) => setConversa(e.target.value)}
            placeholder={`Cole aqui as Ãºltimas mensagens, ex.:\nCliente: boa tarde, preciso de um portÃ£o basculante 3x2m\nEmpresa: claro! endereÃ§o para orÃ§amento?\nCliente: Rua X, 123 - SÃ£o Paulo/SP, CPF 123...`}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 h-56 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={analisar}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {loading ? 'IA analisando...' : 'Analisar com IA'}
            </button>
            <button onClick={onClose} className="px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium">Fechar</button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {resultado && (
            <div className="space-y-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <CheckCircle2 size={16} /> Dados extraÃ­dos â revise e aplique
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1"><User size={12}/> CLIENTE</div>
                  <div><b>{resultado.cliente?.nome || 'â'}</b></div>
                  <div className="text-slate-600 text-xs">{resultado.cliente?.telefone} Â· {resultado.cliente?.email}</div>
                  <div className="text-slate-600 text-xs">{resultado.cliente?.documento}</div>
                  <div className="text-slate-600 text-xs">{resultado.cliente?.endereco}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1"><FileText size={12}/> PROPOSTA</div>
                  <div className="text-xs text-slate-700">{resultado.proposta?.resumo}</div>
                  <ul className="mt-1 text-xs text-slate-600 list-disc pl-4">
                    {(resultado.proposta?.itens || []).map((it: any, i: number) => (
                      <li key={i}>{it.quantidade}x {it.descricao} {it.medidas && `(${it.medidas})`} {it.valorUnit ? `Â· R$ ${it.valorUnit}` : ''}</li>
                    ))}
                  </ul>
                  {resultado.proposta?.valorTotalEstimado ? (
                    <div className="mt-2 font-bold text-emerald-700">Total est.: R$ {Number(resultado.proposta.valorTotalEstimado).toLocaleString('pt-BR')}</div>
                  ) : null}
                </div>
              </div>

              <button
                onClick={aplicar}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} /> Aplicar: cadastrar cliente + criar rascunho de proposta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
