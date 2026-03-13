import React from 'react';
import { PerfilData } from '../../data/perfisDB';

interface TechnicalDrawingProps {
  tipo: string;
  largura: number;
  altura: number;
  profundidade: number;
  espessura: number;
  abaExtra?: number;
}

export const TechnicalDrawing: React.FC<TechnicalDrawingProps> = ({
  tipo,
  largura,
  altura,
  profundidade,
  espessura,
  abaExtra = 0
}) => {
  const padding = 60;
  const svgWidth = 600;
  const svgHeight = 400;

  // Helper to draw dimension lines
  const DimensionLine = ({ x1, y1, x2, y2, label, offset = 20, vertical = false }: any) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    let lineX1 = x1, lineY1 = y1, lineX2 = x2, lineY2 = y2;
    let textX = midX, textY = midY;
    let angle = 0;

    if (vertical) {
      lineX1 = x1 - offset;
      lineX2 = x2 - offset;
      textX = lineX1 - 5;
      angle = -90;
    } else {
      lineY1 = y1 - offset;
      lineY2 = y2 - offset;
      textY = lineY1 - 5;
    }

    return (
      <g className="text-[10px] font-mono fill-white stroke-white/50">
        <line x1={x1} y1={y1} x2={lineX1} y2={lineY1} strokeDasharray="2,2" />
        <line x1={x2} y1={y2} x2={lineX2} y2={lineY2} strokeDasharray="2,2" />
        <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text 
          x={textX} 
          y={textY} 
          fill="#4ade80" 
          textAnchor="middle" 
          transform={angle !== 0 ? `rotate(${angle}, ${textX}, ${textY})` : ''}
          className="font-bold"
        >
          {label}mm
        </text>
      </g>
    );
  };

  const renderProfile = () => {
    if (tipo === 'chapa_dobrada_u' || tipo === 'perfil_u_enrijecido') {
      const w = 240;
      const h = 120;
      const t = Math.max(2, (espessura / largura) * w); 
      const startX = (svgWidth - w) / 2;
      const startY = (svgHeight - h) / 2;
      const isEnrijecido = tipo === 'perfil_u_enrijecido';
      const lip = isEnrijecido ? 20 : 0;

      return (
        <g>
          {/* Outer Path */}
          <path 
            d={`M ${startX + lip} ${startY} L ${startX} ${startY} L ${startX} ${startY + h} L ${startX + w} ${startY + h} L ${startX + w} ${startY} L ${startX + w - lip} ${startY}`} 
            fill="none" 
            stroke="#4ade80" 
            strokeWidth="2" 
          />
          {/* Inner Path */}
          <path 
            d={`M ${startX + lip} ${startY + t} L ${startX + t} ${startY + t} L ${startX + t} ${startY + h - t} L ${startX + w - t} ${startY + h - t} L ${startX + w - t} ${startY + t} L ${startX + w - lip} ${startY + t}`} 
            fill="none" 
            stroke="#4ade80" 
            strokeWidth="1" 
            opacity="0.3"
          />
          
          <DimensionLine x1={startX} y1={startY + h} x2={startX + w} y2={startY + h} label={largura} offset={-40} />
          <DimensionLine x1={startX} y1={startY} x2={startX} y2={startY + h} label={altura} vertical={true} offset={30} />
          {isEnrijecido && <DimensionLine x1={startX + w} y1={startY} x2={startX + w - lip} y2={startY} label={abaExtra} offset={20} />}
          
          {/* Thickness Callout */}
          <g transform={`translate(${startX + w + 40}, ${startY + h/2})`}>
            <line x1="-30" y1="0" x2="0" y2="0" stroke="#4ade80" strokeWidth="1" strokeDasharray="2,2" />
            <text x="5" y="4" fill="#4ade80" className="text-[10px] font-bold">e={espessura}mm</text>
          </g>
        </g>
      );
    }

    if (tipo === 'chapa_dobrada_z') {
      const w = 180;
      const h = 120;
      const t = Math.max(2, (espessura / largura) * w);
      const startX = (svgWidth - w) / 2;
      const startY = (svgHeight - h) / 2;

      return (
        <g>
          <path 
            d={`M ${startX} ${startY} L ${startX + w/2} ${startY} L ${startX + w/2} ${startY + h} L ${startX + w} ${startY + h}`} 
            fill="none" 
            stroke="#4ade80" 
            strokeWidth="2" 
          />
          <DimensionLine x1={startX} y1={startY} x2={startX + w/2} y2={startY} label={largura/2} offset={20} />
          <DimensionLine x1={startX + w/2} y1={startY + h} x2={startX + w} y2={startY + h} label={largura/2} offset={-20} />
          <DimensionLine x1={startX + w/2} y1={startY} x2={startX + w/2} y2={startY + h} label={altura} vertical={true} offset={20} />
        </g>
      );
    }

    if (tipo === 'chapa_dobrada_cartola') {
      const w = 200;
      const h = 80;
      const a = 40; // aba
      const startX = (svgWidth - (w + 2*a)) / 2;
      const startY = (svgHeight - h) / 2;

      return (
        <g>
          <path 
            d={`M ${startX} ${startY} L ${startX + a} ${startY} L ${startX + a} ${startY + h} L ${startX + a + w} ${startY + h} L ${startX + a + w} ${startY} L ${startX + 2*a + w} ${startY}`} 
            fill="none" 
            stroke="#4ade80" 
            strokeWidth="2" 
          />
          <DimensionLine x1={startX + a} y1={startY + h} x2={startX + a + w} y2={startY + h} label={largura} offset={-30} />
          <DimensionLine x1={startX} y1={startY} x2={startX + a} y2={startY} label={abaExtra} offset={20} />
          <DimensionLine x1={startX + a} y1={startY} x2={startX + a} y2={startY + h} label={altura} vertical={true} offset={20} />
        </g>
      );
    }

    if (tipo === 'chapa_dobrada_l') {
      const w = 150;
      const h = 150;
      const t = (espessura / largura) * w;
      const startX = (svgWidth - w) / 2;
      const startY = (svgHeight - h) / 2;

      return (
        <g>
          <path 
            d={`M ${startX} ${startY} L ${startX} ${startY + h} L ${startX + w} ${startY + h}`} 
            fill="none" 
            stroke="#4ade80" 
            strokeWidth="2" 
          />
          <DimensionLine x1={startX} y1={startY + h} x2={startX + w} y2={startY + h} label={largura} offset={-30} />
          <DimensionLine x1={startX} y1={startY} x2={startX} y2={startY + h} label={altura} vertical={true} offset={20} />
        </g>
      );
    }

    if (tipo === 'chapa_cortada') {
      const w = 300;
      const h = 200;
      const startX = (svgWidth - w) / 2;
      const startY = (svgHeight - h) / 2;

      return (
        <g>
          <rect x={startX} y={startY} width={w} height={h} fill="none" stroke="#4ade80" strokeWidth="2" />
          <DimensionLine x1={startX} y1={startY + h} x2={startX + w} y2={startY + h} label={largura} offset={-30} />
          <DimensionLine x1={startX} y1={startY} x2={startX} y2={startY + h} label={altura} vertical={true} offset={20} />
          <text x={startX + w/2} y={startY + h/2} fill="white" textAnchor="middle" className="text-[10px] opacity-50">VISTA SUPERIOR (PLANIFICADA)</text>
        </g>
      );
    }

    // Default placeholder for other types
    return (
      <g>
        <rect x="100" y="100" width="400" height="200" fill="none" stroke="#4ade80" strokeWidth="2" />
        <text x="300" y="200" fill="white" textAnchor="middle" className="text-sm font-bold">
          Technical Drawing: {tipo.replace(/_/g, ' ').toUpperCase()}
        </text>
        <DimensionLine x1={100} y1={300} x2={500} y2={300} label={largura} offset={-30} />
        <DimensionLine x1={100} y1={100} x2={100} y2={300} label={altura} vertical={true} offset={20} />
      </g>
    );
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800 p-4">
      <div className="mb-4 text-center">
        <h3 className="text-emerald-400 font-black uppercase tracking-widest text-sm">Desenho Técnico de Fabricação</h3>
        <p className="text-[10px] text-zinc-500 font-mono uppercase">Escala: NTS | Unidade: mm</p>
      </div>
      
      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="max-w-4xl">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="white" />
          </marker>
        </defs>
        
        {/* Grid Background */}
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {renderProfile()}
      </svg>

      <div className="mt-4 grid grid-cols-3 gap-8 text-[10px] font-mono text-zinc-400 border-t border-zinc-800 pt-4 w-full">
        <div>
          <span className="block text-zinc-600 font-bold">PRODUTO:</span>
          {tipo.replace(/_/g, ' ').toUpperCase()}
        </div>
        <div>
          <span className="block text-zinc-600 font-bold">MATERIAL:</span>
          AÇO CARBONO / INOX
        </div>
        <div>
          <span className="block text-zinc-600 font-bold">ESPESSURA:</span>
          {espessura} mm
        </div>
      </div>
    </div>
  );
};
