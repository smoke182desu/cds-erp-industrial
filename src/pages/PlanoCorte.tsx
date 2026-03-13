import React, { useMemo } from 'react';
import { Scissors, Inbox, Info, ClipboardList } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';

interface Piece {
  id: string;
  nome: string;
  length: number;
}

interface Bar {
  pieces: Piece[];
  remaining: number;
  usedWithKerf: number;
}

const BAR_LENGTH = 6000;
const ESPESSURA_DISCO = 3; // mm (Kerf)

// Algoritmo 1D Bin Packing - First Fit Decreasing com Desconto de Disco
const calculateCuttingPlan = (pieces: Piece[]): Bar[] => {
  // 1. Ordenar peças da maior para a menor
  const sortedPieces = [...pieces].sort((a, b) => b.length - a.length);
  
  const bars: Bar[] = [];

  for (const piece of sortedPieces) {
    let placed = false;
    
    // 2. Tentar colocar em uma barra existente
    for (const bar of bars) {
      // Espaço necessário = tamanho da peça + espessura do disco
      const neededSpace = piece.length + ESPESSURA_DISCO;
      
      if (bar.remaining >= neededSpace) {
        bar.pieces.push(piece);
        bar.remaining -= neededSpace;
        bar.usedWithKerf += neededSpace;
        placed = true;
        break;
      }
    }
    
    // 3. Se não couber, criar barra nova
    if (!placed) {
      bars.push({
        pieces: [piece],
        remaining: BAR_LENGTH - (piece.length + ESPESSURA_DISCO),
        usedWithKerf: piece.length + ESPESSURA_DISCO
      });
    }
  }
  
  return bars;
};

export const PlanoCorte: React.FC = () => {
  const { state } = useERP();
  const lastProject = state.budget.items[state.budget.items.length - 1];

  // Geração de peças com nomenclatura e agrupamento
  const pieces: Piece[] = useMemo(() => {
    if (!lastProject) return [];
    
    const { largura, profundidade, altura } = lastProject.dimensoes;
    const p: Piece[] = [];
    
    // Pilares
    for (let i = 0; i < 4; i++) p.push({ id: `pilar-${i}`, nome: 'Pilar Estrutural', length: altura });
    // Vigas
    for (let i = 0; i < 2; i++) p.push({ id: `viga-${i}`, nome: 'Viga Principal', length: largura });
    // Terças
    for (let i = 0; i < 6; i++) p.push({ id: `terca-${i}`, nome: 'Terça de Cobertura', length: profundidade });
    
    return p;
  }, [lastProject]);

  const bars = useMemo(() => calculateCuttingPlan(pieces), [pieces]);

  const totalUsedLength = pieces.reduce((sum, p) => sum + p.length, 0);
  const totalCapacity = bars.length * BAR_LENGTH;
  const efficiency = totalCapacity > 0 ? (totalUsedLength / totalCapacity) * 100 : 0;
  const waste = 100 - efficiency;

  // Agrupar instruções para o guia do operador
  const operatorInstructions = useMemo(() => {
    return bars.map((bar, barIdx) => {
      const groups: { nome: string, length: number, count: number }[] = [];
      
      bar.pieces.forEach(p => {
        const existing = groups.find(g => g.nome === p.nome && g.length === p.length);
        if (existing) {
          existing.count++;
        } else {
          groups.push({ nome: p.nome, length: p.length, count: 1 });
        }
      });
      
      return { barIdx: barIdx + 1, groups };
    });
  }, [bars]);

  if (!lastProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <Inbox size={64} className="mb-4 opacity-20" />
        <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum projeto na fila de corte.</h3>
        <p className="max-w-md">Vá até 'Projetos 3D', configure sua estrutura e clique em 'Enviar para Produção'.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 p-4 overflow-y-auto bg-slate-950">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
          <Scissors className="text-blue-500" /> Plano de Corte Profissional
        </h2>
        <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Kerf: {ESPESSURA_DISCO}mm</span>
        </div>
      </div>

      {/* Resumo de Eficiência */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Barras (6m)</p>
          <p className="text-2xl font-black text-white">{bars.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Aproveitamento</p>
          <p className="text-2xl font-black text-emerald-400">{efficiency.toFixed(1)}%</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Perda Total</p>
          <p className="text-2xl font-black text-rose-500">{waste.toFixed(1)}%</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Peças Totais</p>
          <p className="text-2xl font-black text-blue-400">{pieces.length}</p>
        </div>
      </div>

      {/* Visualização das Barras */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <Info size={14} className="text-blue-500" /> Mapa de Corte Visual
        </h3>
        <div className="space-y-8">
          {bars.map((bar, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Barra #{index + 1}</span>
                <span className="text-[10px] font-mono text-slate-600">Espaço Livre: {bar.remaining}mm</span>
              </div>
              <div className="w-full h-14 bg-slate-950 rounded-xl flex overflow-hidden border border-slate-800 p-1">
                {bar.pieces.map((piece, pIndex) => (
                  <React.Fragment key={piece.id}>
                    <div 
                      className="h-full bg-blue-600/90 hover:bg-blue-500 flex flex-col items-center justify-center text-[9px] font-bold text-white border-r border-blue-400/20 transition-colors group relative"
                      style={{ width: `${(piece.length / BAR_LENGTH) * 100}%` }}
                    >
                      <span className="truncate px-1">{piece.nome}</span>
                      <span className="opacity-70">{piece.length}mm</span>
                      
                      {/* Tooltip Simulado */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-2 py-1 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                        {piece.nome} | {piece.length}mm
                      </div>
                    </div>
                    {/* Linha de Kerf (Disco) */}
                    <div 
                      className="h-full bg-rose-600/50 w-[2px] relative group"
                      style={{ width: `${(ESPESSURA_DISCO / BAR_LENGTH) * 100}%`, minWidth: '2px' }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-2 py-1 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                        {ESPESSURA_DISCO}mm (Disco)
                      </div>
                    </div>
                  </React.Fragment>
                ))}
                {bar.remaining > 0 && (
                  <div 
                    className="h-full bg-slate-800/30 flex items-center justify-center text-[9px] font-bold text-slate-600 italic"
                    style={{ width: `${(bar.remaining / BAR_LENGTH) * 100}%` }}
                  >
                    Sobra
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guia do Operador (Gabarito) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex items-center gap-3">
          <ClipboardList className="text-emerald-500" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Guia do Operador (Gabarito de Corte)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-500 font-bold uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3">Barra #</th>
                <th className="px-6 py-3">Ação</th>
                <th className="px-6 py-3">Peça (Identificação)</th>
                <th className="px-6 py-3">Medida no Gabarito</th>
                <th className="px-6 py-3 text-center">Qtd a Cortar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {operatorInstructions.map((instr) => (
                instr.groups.map((group, gIdx) => (
                  <tr key={`${instr.barIdx}-${gIdx}`} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-500">#{instr.barIdx}</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded font-bold">AJUSTAR GABARITO</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-200">{group.nome}</td>
                    <td className="px-6 py-4 font-mono text-lg text-emerald-400 font-black">{group.length}mm</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-800 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold border border-slate-700">
                        {group.count}
                      </span>
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-rose-950/30 p-4 border-t border-rose-900/50 flex items-start gap-3">
          <Info className="text-rose-500 shrink-0 mt-0.5" size={16} />
          <p className="text-[10px] text-rose-300 leading-relaxed italic">
            <strong>⚠️ Atenção Operador:</strong> O sistema já calculou a perda de <strong>{ESPESSURA_DISCO}mm</strong> do disco de corte (Kerf). 
            Ajuste o gabarito da policorte <strong>EXATAMENTE</strong> na medida indicada acima. 
            Não adicione folgas manuais, o cálculo matemático já otimizou o uso da barra de 6m considerando o disco.
          </p>
        </div>
      </div>
    </div>
  );
};
