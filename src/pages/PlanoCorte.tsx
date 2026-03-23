import React, { useMemo, useState } from 'react';
import { Scissors, Inbox, Info, ClipboardList, Layers } from 'lucide-react';
import { useERP } from '../contexts/ERPContext';
import { calculateCutPlan, GuillotineSheet } from '../utils/nesting';
import { Component } from '../types';

interface Piece {
  id: string;
  nome: string;
  length: number;
  osId: string;
}

interface Bar {
  pieces: Piece[];
  remaining: number;
  usedWithKerf: number;
}

const BAR_LENGTH = 6000;
const ESPESSURA_DISCO = 3; // mm (Kerf)

// Algoritmo 1D Bin Packing - First Fit Decreasing com Desconto de Disco
const calculateLinearCuttingPlan = (pieces: Piece[]): Bar[] => {
  const sortedPieces = [...pieces].sort((a, b) => b.length - a.length);
  const bars: Bar[] = [];

  for (const piece of sortedPieces) {
    let placed = false;
    for (const bar of bars) {
      const neededSpace = piece.length + ESPESSURA_DISCO;
      if (bar.remaining >= neededSpace) {
        bar.pieces.push(piece);
        bar.remaining -= neededSpace;
        bar.usedWithKerf += neededSpace;
        placed = true;
        break;
      }
    }
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
  
  // Pegar todas as OS em Fila de Produção ou Corte e Dobra para otimizar em lote
  const osAtivas = state.ordensServico.filter(os => 
    os.status === 'Fila de Produção' || os.status === 'Corte e Dobra'
  );

  const { linearPieces, sheetPieces } = useMemo(() => {
    const linear: Piece[] = [];
    const sheets: Component[] = [];
    
    osAtivas.forEach(os => {
      os.itens.forEach((item: any) => {
        if (item.pecas && Array.isArray(item.pecas)) {
          item.pecas.forEach((peca: any, idx: number) => {
            const medidaStr = peca.medida || '';
            const is2D = medidaStr.includes('x');
            
            if (is2D) {
              // Parse 2D: "1500.0 x 1000.0 mm"
              const parts = medidaStr.replace('mm', '').split('x');
              if (parts.length >= 2) {
                const w = parseFloat(parts[0].trim());
                const h = parseFloat(parts[1].trim());
                if (!isNaN(w) && !isNaN(h)) {
                  sheets.push({
                    id: `${os.id}-${item.id || 'item'}-${idx}`,
                    name: `${peca.nome || peca.item} (OS: ${os.id})`,
                    width: w,
                    height: h,
                    quantity: peca.qtd || peca.quantidade || 1,
                    material: item.material || 'Chapa Padrão'
                  });
                }
              }
            } else {
              // Parse 1D: "1500 mm" ou "1500.0 mm"
              const match = medidaStr.match(/([\d.]+)/);
              if (match) {
                const length = parseFloat(match[1]);
                if (!isNaN(length)) {
                  const qtd = peca.qtd || peca.quantidade || 1;
                  for (let i = 0; i < qtd; i++) {
                    linear.push({
                      id: `${os.id}-${item.id || 'item'}-${idx}-${i}`,
                      nome: `${peca.nome || peca.item} (OS: ${os.id})`,
                      length,
                      osId: os.id
                    });
                  }
                }
              }
            }
          });
        }
      });
    });
    
    return { linearPieces: linear, sheetPieces: sheets };
  }, [osAtivas]);

  const bars = useMemo(() => calculateLinearCuttingPlan(linearPieces), [linearPieces]);
  const guillotineSheets = useMemo(() => calculateCutPlan(sheetPieces), [sheetPieces]);

  const totalUsedLength = linearPieces.reduce((sum, p) => sum + p.length, 0);
  const totalCapacity = bars.length * BAR_LENGTH;
  const efficiencyLinear = totalCapacity > 0 ? (totalUsedLength / totalCapacity) * 100 : 0;
  const wasteLinear = 100 - efficiencyLinear;

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

  if (osAtivas.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <Inbox size={64} className="mb-4 opacity-20" />
        <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma Ordem de Serviço na fila de corte.</h3>
        <p className="max-w-md">Aprove as propostas para gerar O.S. e visualizar o plano de corte otimizado.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 p-4 overflow-y-auto bg-slate-50">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
          <Scissors className="text-blue-500" /> Plano de Corte Otimizado
        </h2>
        <div className="flex gap-2">
          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-mono">
            {osAtivas.length} O.S. em Lote
          </span>
        </div>
      </div>

      {/* --- SEÇÃO 1: POLICORTE (LINEAR) --- */}
      {linearPieces.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
            <Scissors className="text-orange-500" size={20} />
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-widest">Policorte com Disco (Barras 6m)</h3>
            <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full flex items-center gap-2 ml-auto">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Kerf: {ESPESSURA_DISCO}mm</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Barras (6m)</p>
              <p className="text-2xl font-black text-slate-900">{bars.length}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Aproveitamento</p>
              <p className="text-2xl font-black text-emerald-400">{efficiencyLinear.toFixed(1)}%</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Perda Total</p>
              <p className="text-2xl font-black text-rose-500">{wasteLinear.toFixed(1)}%</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Cortes Totais</p>
              <p className="text-2xl font-black text-blue-400">{linearPieces.length}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl">
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Info size={14} className="text-orange-500" /> Mapa de Corte Linear
            </h3>
            <div className="space-y-8">
              {bars.map((bar, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Barra #{index + 1}</span>
                    <span className="text-[10px] font-mono text-slate-600">Espaço Livre: {bar.remaining}mm</span>
                  </div>
                  <div className="w-full h-14 bg-slate-50 rounded-xl flex overflow-hidden border border-slate-200 p-1">
                    {bar.pieces.map((piece, pIndex) => (
                      <React.Fragment key={piece.id}>
                        <div 
                          className="h-full bg-orange-600/90 hover:bg-orange-500 flex flex-col items-center justify-center text-[9px] font-bold text-slate-900 border-r border-orange-400/20 transition-colors group relative"
                          style={{ width: `${(piece.length / BAR_LENGTH) * 100}%` }}
                        >
                          <span className="truncate px-1">{piece.nome}</span>
                          <span className="opacity-70">{piece.length}mm</span>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-2 py-1 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                            {piece.nome} | {piece.length}mm
                          </div>
                        </div>
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
                        className="h-full bg-slate-100/30 flex items-center justify-center text-[9px] font-bold text-slate-600 italic"
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

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-100/50 px-6 py-4 border-b border-slate-300 flex items-center gap-3">
              <ClipboardList className="text-emerald-500" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Guia do Operador (Policorte)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest">
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
                      <tr key={`${instr.barIdx}-${gIdx}`} className="hover:bg-slate-100/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-500">#{instr.barIdx}</td>
                        <td className="px-6 py-4">
                          <span className="bg-orange-500/10 text-orange-400 px-2 py-1 rounded font-bold">AJUSTAR GABARITO</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800">{group.nome}</td>
                        <td className="px-6 py-4 font-mono text-lg text-emerald-400 font-black">{group.length}mm</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-slate-100 text-slate-900 w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold border border-slate-300">
                            {group.count}
                          </span>
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SEÇÃO 2: GUILHOTINA (CHAPAS 2D) --- */}
      {guillotineSheets.length > 0 && (
        <div className="space-y-6 mt-8">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
            <Layers className="text-blue-500" size={20} />
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-widest">Guilhotina (Chapas 3000x1200)</h3>
          </div>

          <div className="bg-blue-50 p-4 border border-blue-200 rounded-xl flex items-start gap-3">
            <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              <strong>Furação:</strong> Todos os furos necessários nas peças devem ser realizados na <strong>Furadeira de Bancada</strong> após o corte na guilhotina. Utilize punção para marcar os centros antes de furar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Chapas Necessárias</p>
              <p className="text-2xl font-black text-slate-900">{guillotineSheets.length}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Aproveitamento Médio</p>
              <p className="text-2xl font-black text-emerald-400">
                {guillotineSheets.length > 0 
                  ? (guillotineSheets.reduce((acc, s) => acc + (s.usedArea / (s.width * s.height)) * 100, 0) / guillotineSheets.length).toFixed(1) 
                  : 0}%
              </p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Peças Totais</p>
              <p className="text-2xl font-black text-blue-400">{sheetPieces.reduce((acc, p) => acc + p.quantity, 0)}</p>
            </div>
          </div>

          <div className="space-y-8">
            {guillotineSheets.map((sheet, index) => (
              <div key={index} className="bg-white border border-slate-200 p-6 rounded-2xl">
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Info size={14} className="text-blue-500" /> Chapa #{index + 1} - {sheet.material} ({sheet.width}x{sheet.height}mm)
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400">Eficiência: {((sheet.usedArea / (sheet.width * sheet.height)) * 100).toFixed(1)}%</span>
                </div>
                
                {/* Representação Visual da Chapa */}
                <div className="relative bg-slate-50 border-2 border-slate-300 rounded-sm overflow-hidden" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}>
                  {sheet.components.map((comp, cIdx) => (
                    <div
                      key={cIdx}
                      className="absolute bg-blue-600/80 border border-blue-400/50 flex items-center justify-center group hover:bg-blue-500 transition-colors cursor-pointer"
                      style={{
                        left: `${(comp.x / sheet.width) * 100}%`,
                        top: `${(comp.y / sheet.height) * 100}%`,
                        width: `${(comp.width / sheet.width) * 100}%`,
                        height: `${(comp.height / sheet.height) * 100}%`,
                      }}
                    >
                      <span className="text-[8px] font-bold text-slate-900 truncate px-1 text-center">
                        {comp.width}x{comp.height}
                      </span>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-2 py-1 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                        {comp.name} | {comp.width}x{comp.height}mm
                      </div>
                    </div>
                  ))}
                  {/* Sobras */}
                  {sheet.leftovers.map((leftover, lIdx) => (
                    <div
                      key={`leftover-${lIdx}`}
                      className="absolute bg-slate-100/30 border border-slate-300/50 flex items-center justify-center"
                      style={{
                        left: `${(leftover.x / sheet.width) * 100}%`,
                        top: `${(leftover.y / sheet.height) * 100}%`,
                        width: `${(leftover.width / sheet.width) * 100}%`,
                        height: `${(leftover.height / sheet.height) * 100}%`,
                      }}
                    >
                      <span className="text-[8px] font-bold text-slate-500">Sobra</span>
                    </div>
                  ))}
                </div>

                {/* Sequência de Cortes da Guilhotina */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">Sequência de Cortes (Guilhotina)</h4>
                  <ul className="space-y-1">
                    {sheet.cuts.map((cut, cutIdx) => (
                      <li key={cutIdx} className="text-xs text-slate-700 font-mono flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">Corte {cutIdx + 1}</span>
                        {cut.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
