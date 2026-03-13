import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, ChatMessage } from '../types';
import { Send, Bot, User, Sparkles, Undo2, History, Image as ImageIcon, Paperclip, Loader2, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeProjectInput } from '../services/aiService';

interface AIChatProps {
  project: ProjectState;
  onAIProjectUpdate: (project: Partial<ProjectState>) => void;
  onUndo: () => void;
  onClose?: () => void;
}

function LongWaitMessage() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const timers = [
      setTimeout(() => setMessage('Isso está demorando um pouco mais que o normal...'), 15000),
      setTimeout(() => setMessage('Ainda processando... Projetos complexos podem levar até 2 minutos.'), 45000),
      setTimeout(() => setMessage('Quase lá! Finalizando a análise técnica...'), 90000),
      setTimeout(() => setMessage('A IA está pensando profundamente nos detalhes...'), 150000),
      setTimeout(() => setMessage('Persistindo... A conexão pode estar lenta, mas não desista!'), 240000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!message) return null;

  return (
    <motion.span 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-[10px] text-slate-400 italic flex items-center gap-1"
    >
      <Loader2 size={10} className="animate-spin" />
      {message}
    </motion.span>
  );
}

export function AIChat({ project, onAIProjectUpdate, onUndo, onClose }: AIChatProps) {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ step: string; percent: number }>({ step: '', percent: 0 });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'system',
      content: 'Olá! Sou seu Braço Direito técnico. Agora estou mais inteligente: posso ler notas em desenhos, calibrar medidas por fotos com referência (como uma trena), retificar perspectivas e sugerir reforços estruturais. O que vamos projetar e fabricar hoje?',
      timestamp: Date.now()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const processMessage = async (text: string, images?: string[]) => {
    setIsAnalyzing(true);
    setAnalysisProgress({ step: 'Iniciando análise...', percent: 5 });
    
    // Create a new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev.percent < 15) return { step: 'Analisando solicitações e desenhos...', percent: 15 };
        if (prev.percent < 30) return { step: 'Identificando materiais, vazios e notas técnicas...', percent: 30 };
        if (prev.percent < 45) return { step: 'Calibrando escala e retificando perspectiva...', percent: 45 };
        if (prev.percent < 65) return { step: 'Calculando dimensões e explodindo peças...', percent: 65 };
        if (prev.percent < 80) return { step: 'Verificando simetria e viabilidade de dobra...', percent: 80 };
        if (prev.percent < 90) return { step: 'Projetando reforços e padrões de mercado...', percent: 90 };
        if (prev.percent < 95) return { step: 'Finalizando projeto técnico...', percent: 95 };
        return prev;
      });
    }, 2000);

    try {
      // Note: The service doesn't currently support true aborting of the fetch request,
      // but we can ignore the result if cancelled.
      const result = await analyzeProjectInput(
        text || "Analise este projeto e gere as especificações técnicas.", 
        project,
        images && images.length > 0 ? images : undefined
      );
      
      if (controller.signal.aborted) return;

      clearInterval(progressInterval);
      setAnalysisProgress({ step: 'Concluído!', percent: 100 });

      if (result.name) {
        onAIProjectUpdate(result);
        
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: result.message || `Projeto "${result.name}" gerado com sucesso!\n\nDimensões: ${result.dimensions?.width}x${result.dimensions?.height}x${result.dimensions?.depth}mm\nMaterial: ${result.material}\n\nO projeto foi atualizado no visualizador 3D e o plano de corte foi recalculado.`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);
      } else if (result.message) {
        // Handle error or informational message without project update
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: result.message,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error("A IA não retornou um projeto válido.");
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      if (controller.signal.aborted) return;

      console.error("Erro no chat:", error);
      
      let errorMessage = error.message || "Erro desconhecido";
      if (errorMessage.includes("demorou mais que o esperado")) {
          errorMessage = "A análise demorou mais que o esperado devido à complexidade ou instabilidade na conexão. Por favor, tente novamente.";
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Desculpe, tive um problema técnico: ${errorMessage}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      clearInterval(progressInterval);
      if (!controller.signal.aborted) {
        setIsAnalyzing(false);
        setSelectedImages([]);
        abortControllerRef.current = null;
        setAnalysisProgress({ step: '', percent: 0 });
      }
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    setSelectedImages([]);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: 'Operação cancelada.',
      timestamp: Date.now()
    }]);
  };

  const handleSend = async () => {
    if (!input.trim() && selectedImages.length === 0) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input || (selectedImages.length > 0 ? `Analisando ${selectedImages.length} imagem(ns) enviada(s)...` : ''),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    const currentImages = [...selectedImages];
    
    setInput('');
    
    await processMessage(currentInput, currentImages.length > 0 ? currentImages : undefined);
  };

  const handleRetry = () => {
    // Find last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
       // Remove the last error message if it exists (optional, but cleaner)
       if (messages[messages.length - 1].role === 'ai' && messages[messages.length - 1].content.includes("problema técnico")) {
           setMessages(prev => prev.slice(0, -1));
       }
       processMessage(lastUserMsg.content, undefined); // We lose the image context on retry for now unless we store it
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setSelectedImages(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 w-96 shadow-xl z-20">
      <div className="p-4 border-b border-slate-700 bg-slate-950 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 lg:hidden"
            >
              <XCircle size={18} />
            </button>
          )}
          <h3 className="font-bold text-slate-200 flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-400" /> Braço Direito Técnico
          </h3>
        </div>
        <button onClick={onUndo} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition-colors" title="Desfazer">
          <Undo2 size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {messages.map((msg) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id} 
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                msg.role === 'ai' || msg.role === 'system' 
                ? (msg.content.includes("problema técnico") ? 'bg-red-500 text-white' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white') 
                : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
            }`}>
              {msg.role === 'user' ? <User size={14} /> : (msg.content.includes("problema técnico") ? <AlertCircle size={14} /> : <Bot size={14} />)}
            </div>
            <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : (msg.content.includes("problema técnico") ? 'bg-red-900/20 border border-red-500/50 text-red-200 rounded-tl-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none')
            }`}>
              <p className="whitespace-pre-line">{msg.content}</p>
              {msg.content.includes("problema técnico") && (
                  <button 
                    onClick={handleRetry}
                    className="mt-2 text-xs flex items-center gap-1 text-red-300 hover:text-white transition-colors underline"
                  >
                    <RefreshCw size={10} /> Tentar novamente
                  </button>
              )}
              <span className="text-[10px] opacity-50 mt-1 block text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </motion.div>
        ))}
        {isAnalyzing && (
           <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md">
              <Bot size={14} />
            </div>
            <div className="bg-slate-800 text-slate-200 border border-slate-700 rounded-2xl rounded-tl-none p-4 flex flex-col gap-3 relative group min-w-[240px]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <button 
                  onClick={handleCancel}
                  className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  title="Cancelar"
                >
                  <XCircle size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{analysisProgress.step}</span>
                  <span className="text-emerald-400">{analysisProgress.percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${analysisProgress.percent}%` }}
                    className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  />
                </div>
              </div>

              <LongWaitMessage />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <AnimatePresence>
          {selectedImages.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-3 flex flex-wrap gap-2"
            >
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative inline-block">
                  <img src={img} alt={`Preview ${idx}`} className="w-16 h-16 object-cover rounded-lg border-2 border-emerald-500 shadow-lg" />
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                  >
                    <XCircle size={10} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors border border-slate-700"
            title="Anexar Imagem"
          >
            <ImageIcon size={18} />
          </button>
          
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isAnalyzing ? "IA Analisando..." : "Descreva o produto ou anexe foto..."}
              disabled={isAnalyzing}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none shadow-inner disabled:opacity-50"
            />
            <button 
              onClick={handleSend}
              disabled={isAnalyzing}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:bg-slate-700"
            >
              {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center flex items-center justify-center gap-1">
          <Sparkles size={8} /> IA Multimodal: Fotos, Prints e Voz
        </p>
      </div>
    </div>
  );
}
