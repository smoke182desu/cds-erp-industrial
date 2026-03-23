import React from 'react';
import { ProjectState, Component } from '../types';
import { GuillotineSheet } from '../utils/nesting';
import { calculateLinearCutPlan } from '../utils/linearNesting';
import { calculatePartWeight } from '../utils/calculations';
import { generateAssemblySequence } from '../utils/assembly';
import { Wrench, Ruler, Info } from 'lucide-react';

interface CuttingPlanProps {
  project: ProjectState;
}

export function CuttingPlan({ project }: CuttingPlanProps) {
  const sheets = (project.cutPlan as GuillotineSheet[]) || [];
  const linearBars = calculateLinearCutPlan(project.components);
  const assemblySteps = generateAssemblySequence(project.components);

  const pct = (val: number, max: number) => `${(val / max) * 100}%`;

  // Group sheets by material
  const sheetsByMaterial: { [key: string]: GuillotineSheet[] } = {};
  sheets.forEach(sheet => {
    const material = sheet.material || 'Material Padrão';
    if (!sheetsByMaterial[material]) {
      sheetsByMaterial[material] = [];
    }
    sheetsByMaterial[material].push(sheet);
  });

  if (sheets.length === 0 && linearBars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-600">
        <p>Nenhum plano de corte gerado ainda.</p>
        <p className="text-sm">Tente descrever seu projeto no chat para gerar as peças.</p>
      </div>
    );
  }

  // Define colors for cuts
  const cutColors = [
    'border-red-500', 'border-blue-500', 'border-green-500', 
    'border-purple-500', 'border-orange-500', 'border-pink-500',
    'border-teal-500', 'border-indigo-500', 'border-yellow-500'
  ];
  
  const cutBgColors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 
    'bg-purple-500', 'bg-orange-500', 'bg-pink-500',
    'bg-teal-500', 'bg-indigo-500', 'bg-yellow-500'
  ];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'separar': return <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-bold uppercase border border-slate-300">Separar</span>;
      case 'pontear': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold uppercase border border-amber-300">Pontear</span>;
      case 'soldar_cordao': return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold uppercase border border-red-300">Soldar Cordão</span>;
      case 'conferir': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase border border-blue-300">Conferir</span>;
      case 'acabamento': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold uppercase border border-emerald-300">Acabamento</span>;
      default: return null;
    }
  };

  const getComponentName = (id: string) => {
    const comp = project.components.find(c => c.id === id);
    return comp ? comp.name : id;
  };

  return (
    <div className="space-y-8 p-8 max-w-5xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Dossiê de Fabricação</h1>
      </div>

      {/* Linear Cut Plan (Tubes/Profiles) */}
      {linearBars.length > 0 && (
        <div className="space-y-6">
           <h2 className="font-bold text-slate-800 flex items-center gap-2 text-xl border-b pb-2">
            <Ruler size={24} className="text-orange-600" />
            Plano de Corte Linear (Tubos/Perfis) - Policorte
          </h2>
          
          {linearBars.map((bar, index) => (
            <div key={bar.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-2 print:border-[#000000] break-inside-avoid">
              <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="bg-orange-600 text-slate-900 px-2 py-0.5 rounded text-xs">BARRA {index + 1}</span>
                  {bar.material} - 6000mm
                </h3>
                <span className="text-xs font-mono text-slate-500">Sobra: {bar.leftover}mm</span>
              </div>
              
              <div className="p-6">
                {/* Visual Bar Representation */}
                <div className="relative w-full h-16 bg-slate-200 border-2 border-slate-400 rounded flex items-center overflow-hidden mb-4">
                   {bar.parts.map((part, pIdx) => (
                     <div 
                        key={pIdx}
                        className="h-full border-r-2 border-white bg-orange-100 flex flex-col items-center justify-center text-center overflow-hidden relative group"
                        style={{ width: `${(part.length / 6000) * 100}%` }}
                     >
                        <span className="text-[10px] font-bold text-orange-900 truncate px-1 w-full">{part.name}</span>
                        <span className="text-[9px] text-orange-700">{part.length}mm</span>
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                     </div>
                   ))}
                   {/* Leftover */}
                   <div className="flex-1 h-full bg-slate-100 flex items-center justify-center">
                      <span className="text-[10px] text-slate-600 italic">Sobra ({bar.leftover}mm)</span>
                   </div>
                </div>

                {/* Cut List */}
                <div className="bg-white text-slate-800 p-4 rounded-lg text-sm font-mono print:bg-[#ffffff] print:text-[#000000] print:border print:border-[#000000] mb-4">
                   <h4 className="text-orange-400 font-bold uppercase mb-3 border-b border-slate-300 pb-2 print:text-[#000000] print:border-[#000000]">Sequência de Cortes (Policorte)</h4>
                   <ol className="list-decimal list-inside space-y-1 text-xs">
                      {bar.cuts.map((cut, cIdx) => (
                        <li key={cIdx} className="print:text-[#000000]">
                           <span className="text-slate-600 print:text-[#000000]">Posição {cut.pos}mm:</span> {cut.description}
                        </li>
                      ))}
                   </ol>
                </div>

                {/* Parts List with Connections */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 print:border-[#000000]">
                  <h4 className="text-slate-800 font-bold text-sm mb-3 uppercase border-b pb-2 flex items-center gap-2 print:text-[#000000] print:border-[#000000]">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    Detalhes das Peças e Conexões
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {bar.parts.map((part, pIdx) => (
                      <div key={pIdx} className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-100 print:bg-[#ffffff] print:border-[#000000]">
                        <div className="flex justify-between font-bold text-slate-800 mb-1 print:text-[#000000]">
                          <span className="flex items-center gap-1">
                            <span className="w-4 h-4 bg-orange-100 text-orange-700 rounded flex items-center justify-center text-[9px] border border-orange-200 print:border-[#000000] print:text-[#000000] print:bg-transparent">{pIdx + 1}</span>
                            {part.name}
                          </span>
                          <span className="text-slate-500 font-mono print:text-[#000000]">{part.length}mm</span>
                        </div>
                        
                        {part.originalComponent?.welds && part.originalComponent.welds.length > 0 ? (
                          <div className="mt-2 pl-2 border-l-2 border-orange-200 print:border-[#000000]">
                            <span className="block text-[10px] text-orange-600 font-bold uppercase mb-0.5 print:text-[#000000]">Conecta com:</span>
                            <ul className="space-y-1">
                              {part.originalComponent.welds.map((weld, wIdx) => (
                                <li key={wIdx} className="text-[10px] leading-tight print:text-[#000000]">
                                  {weld.targetId ? (
                                    <span className="font-bold text-slate-700 print:text-[#000000]">
                                      {getComponentName(weld.targetId)}: 
                                    </span>
                                  ) : null}
                                  <span className="ml-1">{weld.connectionDetails || weld.description || "Solda padrão"}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-1 pl-2 text-[10px] text-slate-600 italic print:text-[#000000]">Sem conexões de solda especificadas.</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet Cut Plan */}
      {Object.entries(sheetsByMaterial).map(([material, materialSheets]) => (
        <div key={material} className="space-y-6 mt-8">
           <h2 className="font-bold text-slate-800 flex items-center gap-2 text-xl border-b pb-2">
            <div className="w-6 h-6 border-2 border-blue-600 rounded-sm" />
            Plano de Corte de Chapas ({material}) - Guilhotina
          </h2>

          <div className="bg-blue-50 p-4 border border-blue-200 rounded-xl flex items-start gap-3">
            <Info className="text-blue-600 shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Furação:</strong> Todos os furos necessários nas peças devem ser realizados na <strong>Furadeira de Bancada</strong> após o corte na guilhotina. Utilize punção para marcar os centros antes de furar.
            </p>
          </div>

          {materialSheets.map((sheet, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-2 print:border-[#000000] break-inside-avoid">
              <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-900 w-6 h-6 rounded flex items-center justify-center text-xs">
                    {String.fromCharCode(65 + index)}
                  </span>
                  Chapa {String.fromCharCode(65 + index)} - {sheet.width} x {sheet.height} mm
                </h2>
              </div>
              
              <div className="p-6">
                <div className="relative w-full aspect-[2.5/1] bg-slate-100 border-2 border-slate-200 mb-6 overflow-hidden">
                  {/* Render Leftovers */}
                  {sheet.leftovers?.map((leftover, lIdx) => (
                    <div 
                      key={`leftover-${lIdx}`}
                      className="absolute border-2 border-dashed border-slate-400 bg-slate-200/50 flex flex-col items-center justify-center text-center overflow-hidden shadow-inner text-slate-600"
                      style={{ 
                        left: pct(leftover.x, sheet.width), 
                        top: pct(leftover.y, sheet.height), 
                        width: pct(leftover.width, sheet.width), 
                        height: pct(leftover.height, sheet.height),
                      }}
                    >
                      <span className="font-bold text-[10px] uppercase tracking-widest opacity-80">Sobra {lIdx + 1}</span>
                      <span className="font-mono text-[9px] opacity-80">
                        {leftover.width} x {leftover.height} mm
                      </span>
                    </div>
                  ))}

                  {/* Render Components */}
                  {sheet.components.map((comp, cIdx) => {
                    const isEven = cIdx % 2 === 0;
                    const bgColor = isEven ? 'bg-blue-50' : 'bg-amber-50';
                    const borderColor = isEven ? 'border-blue-200' : 'border-amber-200';
                    const textColor = isEven ? 'text-blue-900' : 'text-amber-900';
                    
                    return (
                      <div 
                        key={`comp-${cIdx}`}
                        className={`absolute border flex flex-col items-center justify-center text-center overflow-hidden shadow-sm ${bgColor} ${borderColor} ${textColor}`}
                        style={{ 
                          left: pct(comp.x, sheet.width), 
                          top: pct(comp.y, sheet.height), 
                          width: pct(comp.width, sheet.width), 
                          height: pct(comp.height, sheet.height),
                        }}
                      >
                        <div className="font-black bg-slate-100 text-slate-900 px-2 py-0.5 rounded text-xs mb-1">
                          {comp.id}
                        </div>
                        <span className="font-bold text-[10px] leading-tight px-1">
                          {comp.name}<br/>
                          <span className="font-mono text-[9px] opacity-70">
                            {comp.width} x {comp.height} mm
                          </span>
                        </span>
                      </div>
                    );
                  })}

                  {/* Render Cuts */}
                  {sheet.cuts?.map((cut, cIdx) => {
                    const colorClass = cutColors[cIdx % cutColors.length];
                    const bgClass = cutBgColors[cIdx % cutBgColors.length];
                    
                    if (cut.axis === 'x') {
                      return (
                        <div 
                          key={`cut-${cut.id}`}
                          className={`absolute border-l-2 border-dashed ${colorClass} z-10 flex items-center justify-center`}
                          style={{
                            left: pct(cut.pos, sheet.width),
                            top: pct(cut.start, sheet.height),
                            height: pct(cut.end - cut.start, sheet.height),
                          }}
                        >
                          <div className={`absolute ${bgClass} text-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm ring-2 ring-white`}>
                            {cut.id}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div 
                          key={`cut-${cut.id}`}
                          className={`absolute border-t-2 border-dashed ${colorClass} z-10 flex items-center justify-center`}
                          style={{
                            top: pct(cut.pos, sheet.height),
                            left: pct(cut.start, sheet.width),
                            width: pct(cut.end - cut.start, sheet.width),
                          }}
                        >
                          <div className={`absolute ${bgClass} text-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm ring-2 ring-white`}>
                            {cut.id}
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>

                <div className="bg-white text-slate-800 p-4 rounded-lg text-sm font-mono print:bg-[#ffffff] print:text-[#000000] print:border print:border-[#000000]">
                  <h4 className="text-blue-400 font-bold uppercase mb-3 border-b border-slate-300 pb-2 print:text-[#000000] print:border-[#000000]">Guia de Máquina - Chapa {String.fromCharCode(65 + index)}</h4>
                  
                  <div className="mb-4">
                    <h5 className="text-slate-600 text-xs mb-2 uppercase tracking-wider print:text-[#000000]">Sequência de Cortes</h5>
                    <ol className="list-none space-y-2 text-xs">
                      {sheet.cuts?.length > 0 ? sheet.cuts.map((cut, cIdx) => (
                        <li key={cIdx} className="flex items-start gap-2">
                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-slate-900 ${cutBgColors[cIdx % cutBgColors.length]} mt-0.5 shrink-0 print:border print:border-[#000000] print:text-[#000000] print:bg-transparent`}>
                            {cut.id}
                          </span>
                          <span>
                            <span className="font-bold text-slate-900 print:text-[#000000]">Corte {cut.id}:</span> {cut.description}
                          </span>
                        </li>
                      )) : (
                         <li className="text-slate-500 italic print:text-[#000000]">Nenhum corte registrado.</li>
                      )}
                    </ol>
                  </div>

                  <div>
                    <h5 className="text-slate-600 text-xs mb-2 uppercase tracking-wider print:text-[#000000]">Peças Extraídas</h5>
                    <ul className="list-disc list-inside space-y-1 text-xs mb-4">
                      {sheet.components.map((comp, cIdx) => (
                        <li key={cIdx}>
                          <span className="font-bold text-slate-900 print:text-[#000000]">{comp.name}</span> ({comp.width} x {comp.height} mm) - ID: {comp.id} - Peso: {calculatePartWeight(comp)} kg
                        </li>
                      ))}
                    </ul>
                  </div>

                  {sheet.leftovers && sheet.leftovers.length > 0 && (
                    <div>
                      <h5 className="text-slate-600 text-xs mb-2 uppercase tracking-wider print:text-[#000000]">Retalhos / Sobras</h5>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        {sheet.leftovers.map((leftover, lIdx) => (
                          <li key={lIdx} className="text-slate-600 print:text-[#000000]">
                            Sobra {lIdx + 1}: {leftover.width} x {leftover.height} mm
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Assembly Sequence Section for Dossier */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-2 print:border-[#000000] break-inside-avoid mt-8">
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center print:bg-[#ffffff] print:border-[#000000]">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-xl">
            <Wrench size={24} className="text-indigo-600 print:text-[#000000]" />
            Roteiro de Montagem e Soldagem
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {assemblySteps.map((step, idx) => (
              <div key={idx} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0 print:border-[#000000]">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 text-lg">{step.title}</h3>
                  {getActionBadge(step.action)}
                </div>
                <p className="text-slate-600 mb-3 text-sm print:text-[#000000]">{step.description}</p>
                
                {step.parts.length > 0 && (
                  <div className="bg-slate-50 rounded p-3 border border-slate-200 print:bg-[#ffffff] print:border-[#000000]">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block print:text-[#000000]">Peças Envolvidas:</span>
                    <ul className="list-disc list-inside text-sm text-slate-700 font-medium print:text-[#000000]">
                      {step.parts.map((part, pIdx) => (
                        <li key={pIdx}>{part}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

