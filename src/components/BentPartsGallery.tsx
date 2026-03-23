import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProjectState } from '../types';
import { calculatePartWeight } from '../utils/calculations';
import { Box, ArrowRight, Maximize2, X, Rotate3d, ZoomIn, Clock, AlertTriangle, Hammer, PaintBucket, Scissors, Calculator, Move, Ruler, Weight, ShoppingCart } from 'lucide-react'; // Test
import Part3DViewer, { LShape, UProfile, Flat, Trapezoid, Bent, RoundTube, SquareTube, RectangularTube, Hinge, isMDFPart } from './Part3DViewer';
import { MaterialList } from './MaterialList';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Grid, GizmoHelper, GizmoViewport, Bounds } from '@react-three/drei';
import { generateWeldingStrategy } from '../services/geminiService';

interface BentPartsGalleryProps {
  project: ProjectState;
}

interface PartData {
  id: string;
  name: string;
  dimW: number;
  dimH: number;
  dimD?: number; // Depth/Flange size
  thickness: number; // Material thickness in mm
  type: 'L-Shape' | 'U-Profile' | 'Flat' | 'Trapezoid' | 'Bent' | 'RoundTube' | 'SquareTube' | 'RectangularTube' | 'Profile' | 'Hinge';
  cutType?: 'straight' | 'miter-start' | 'miter-end' | 'miter-both';
  invertCuts?: boolean;
  description: string;
  color: string;
  details?: any;
  position?: { x: number, y: number, z: number };
  rotation?: { x: number, y: number, z: number };
  times: {
    cutting: number; // minutes
    bending: number; // minutes
    welding: number; // minutes
    painting: number; // minutes
  };
}

function getPartHexColor(id: string) {
  const colors = [
    '#60a5fa', // blue-400
    '#818cf8', // indigo-400
    '#4ade80', // green-400
    '#2dd4bf', // teal-400
    '#c084fc', // purple-400
    '#fbbf24', // amber-400
    '#fb923c', // orange-400
    '#facc15', // yellow-400
    '#fb7185', // rose-400
  ];
  const index = parseInt(id.replace(/\D/g, '')) || 0;
  return colors[index % colors.length];
}

export function BentPartsGallery({ project }: BentPartsGalleryProps) {
  const [selectedPart, setSelectedPart] = useState<PartData | null>(null);
  const [isWeldingModalOpen, setIsWeldingModalOpen] = useState(false);
  const [isMaterialListOpen, setIsMaterialListOpen] = useState(false);
  
  // Per-part welding state
  const [partWelds, setPartWelds] = useState<Record<string, string[]>>({});
  const [partIntersections, setPartIntersections] = useState<Record<string, string[]>>({});
  const [partInvertCuts, setPartInvertCuts] = useState<Record<string, boolean>>({});
  const [weldMode, setWeldMode] = useState<'weld' | 'stitch-short' | 'stitch-long' | 'spot'>('weld');

  const togglePartWeld = (partId: string, weldId: string) => {
    setPartWelds(prev => {
      const currentWelds = prev[partId] || [];
      if (currentWelds.includes(weldId)) {
        return { ...prev, [partId]: currentWelds.filter(id => id !== weldId) };
      } else {
        return { ...prev, [partId]: [...currentWelds, weldId] };
      }
    });
  };

  const togglePartIntersection = (partId: string, intId: string) => {
    setPartIntersections(prev => {
      const currentInts = prev[partId] || [];
      if (currentInts.includes(intId)) {
        return { ...prev, [partId]: currentInts.filter(id => id !== intId) };
      } else {
        return { ...prev, [partId]: [...currentInts, intId] };
      }
    });
  };

  const toggleInvertCuts = (partId: string) => {
    setPartInvertCuts(prev => ({
      ...prev,
      [partId]: !prev[partId]
    }));
  };

  const { width: pr_w, height: pr_h, depth: fu_h } = project.dimensions;

  // Recalculate dimensions based on project dimensions (Matching CuttingPlan logic)
  const pi_w = pr_w;
  const pi_h = pr_h + 27;
  
  const fu_w = pr_w;
  // fu_h is depth
  
  const lt_h = pr_h - 20;
  const lt_t = fu_h + 220;
  const lt_b = fu_h;
  
  const ta_w = (pr_w / 2) + 120; 
  const ta_h = lt_t + 80; 
  
  const ptr_w = pr_w;
  const ptr_h = 212;
  
  const pfr_w = pr_w;
  const pfr_h = 192;
  
  const pl_w = fu_h + 340;
  const pl_h = 212;
  
  const pc_w = pr_h + 23;
  const pc_h = 212;

  // Material thickness based on gauge (Chapa 14 = ~2.0mm)
  const THICKNESS = 2.0;

  const calculateWeight = (part: PartData) => {
    // Density of steel: ~7.85 g/cm³ = 0.00000785 kg/mm³
    const density = 0.00000785;
    let volume = 0;

    switch (part.type) {
      case 'L-Shape':
        // Approx: (H + D) * W * T
        volume = (part.dimH + (part.dimD || 0)) * part.dimW * part.thickness;
        break;
      case 'U-Profile':
      case 'Bent':
      case 'Profile':
        // Approx: (H + 2*D) * W * T
        volume = (part.dimH + 2 * (part.dimD || 0)) * part.dimW * part.thickness;
        break;
      case 'Trapezoid':
         // Approx: ((Top + Bottom) / 2) * H * T
         const top = part.details?.top || part.dimW;
         const bottom = part.details?.bottom || part.dimW;
         volume = ((top + bottom) / 2) * part.dimH * part.thickness;
         break;
      case 'RoundTube':
        // Volume of a hollow cylinder: pi * h * (R^2 - r^2)
        const R = part.dimW / 2;
        const r = R - part.thickness;
        volume = Math.PI * part.dimH * (R * R - r * r);
        break;
      case 'SquareTube':
        // Volume of a hollow square tube: h * (W^2 - w^2)
        const W = part.dimW;
        const w = W - 2 * part.thickness;
        volume = part.dimH * (W * W - w * w);
        break;
      case 'RectangularTube':
        // Volume of a hollow rectangular tube: h * (W*D - w*d)
        const W_rect = part.dimW;
        const D_rect = part.dimD || part.dimW;
        const w_rect = W_rect - 2 * part.thickness;
        const d_rect = D_rect - 2 * part.thickness;
        volume = part.dimH * (W_rect * D_rect - w_rect * d_rect);
        break;
      case 'Hinge':
        // Approximate volume for a hinge
        volume = Math.PI * Math.pow(part.dimW / 2, 2) * part.dimH + part.dimW * part.dimH * 2;
        break;
      case 'Flat':
      default:
        volume = part.dimW * part.dimH * part.thickness;
        break;
    }

    return (volume * density).toFixed(2);
  };

  // Map project components to PartData format for the gallery and 3D viewer
  const parts: PartData[] = useMemo(() => {
    return project.components.map(comp => {
      // Default times if not provided by AI (AI currently doesn't provide times in schema)
      const defaultTimes = {
        cutting: Math.ceil(comp.width * comp.height / 50000),
        bending: comp.type === 'Flat' ? 0 : 2,
        welding: 5,
        painting: 5
      };

      return {
        id: comp.id,
        name: comp.name,
        dimW: comp.width,
        dimH: comp.height,
        dimD: (comp as any).dimD || 20, // Fallback for depth
        thickness: THICKNESS,
        type: comp.type || 'Flat',
        cutType: comp.cutType,
        invertCuts: partInvertCuts[comp.id] || false,
        description: comp.description || '',
        color: getPartColor(comp.id),
        details: comp.details,
        times: defaultTimes,
        position: comp.position,
        rotation: comp.rotation,
        welds: comp.welds
      } as PartData;
    });
  }, [project.components, partInvertCuts]);

  function getPartColor(id: string) {
    const colors = [
      'bg-blue-100 border-blue-300 text-blue-800',
      'bg-indigo-100 border-indigo-300 text-indigo-800',
      'bg-green-100 border-green-300 text-green-800',
      'bg-teal-100 border-teal-300 text-teal-800',
      'bg-purple-100 border-purple-300 text-purple-800',
      'bg-amber-100 border-amber-300 text-amber-800',
      'bg-orange-100 border-orange-300 text-orange-800',
      'bg-yellow-100 border-yellow-300 text-yellow-800',
      'bg-rose-100 border-rose-300 text-rose-800',
    ];
    const index = parseInt(id.replace(/\D/g, '')) || 0;
    return colors[index % colors.length];
  }

  // Calculate Global Project Totals
  const totalProjectTime = parts.reduce((acc, part) => {
    return acc + part.times.cutting + part.times.bending + part.times.welding + part.times.painting;
  }, 0);

  const totalCutting = parts.reduce((acc, part) => acc + part.times.cutting, 0);
  const totalBending = parts.reduce((acc, part) => acc + part.times.bending, 0);
  const totalWelding = parts.reduce((acc, part) => acc + part.times.welding, 0);
  const totalPainting = parts.reduce((acc, part) => acc + part.times.painting, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto relative min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900 shadow-lg">
            <Box size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Peças & Produção</h2>
            <p className="text-sm text-slate-600">Detalhamento técnico para fabricação</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsMaterialListOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ShoppingCart size={18} className="text-blue-600" />
          Lista de Materiais
        </button>

        {/* Global Production Stats Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tempo Total de Produção</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-800">{Math.ceil(totalProjectTime / 60)}h {totalProjectTime % 60}m</span>
              <span className="text-xs text-slate-600">({totalProjectTime} min)</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
             <div className="flex items-center gap-1 text-slate-600"><Scissors size={12} /> Corte: <b>{totalCutting}m</b></div>
             <div className="flex items-center gap-1 text-slate-600"><Hammer size={12} /> Dobra: <b>{totalBending}m</b></div>
             <div className="flex items-center gap-1 text-slate-600"><Rotate3d size={12} /> Solda: <b>{totalWelding}m</b></div>
             <div className="flex items-center gap-1 text-slate-600"><PaintBucket size={12} /> Pintura: <b>{totalPainting}m</b></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parts.map((part) => (
          <div 
            key={part.id} 
            onClick={() => { console.log('Part clicked:', part); setSelectedPart(part); }}
            className="bg-white rounded-xl border border-slate-300 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer overflow-hidden flex flex-col group"
          >
            <div className={`h-32 ${part.color} bg-opacity-30 flex items-center justify-center relative border-b border-slate-200 group-hover:bg-opacity-40 transition-colors`}>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                 <span className="bg-white/90 text-slate-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                   <Maximize2 size={12} /> Visualizar 3D
                 </span>
              </div>
              
              {/* Simple 2D Preview Icons */}
              <div className="opacity-60 transform group-hover:scale-105 transition-transform duration-300">
                 {part.type === 'U-Profile' && <div className="w-24 h-12 border-b-4 border-x-4 border-slate-300 rounded-b-sm"></div>}
                 {part.type === 'L-Shape' && <div className="w-24 h-16 border-b-4 border-l-4 border-slate-300 rounded-bl-sm"></div>}
                 {part.type === 'Flat' && <div className="w-24 h-16 border-4 border-slate-300 bg-slate-300/20"></div>}
                 {part.type === 'Trapezoid' && <div className="w-24 h-16 border-4 border-slate-300 transform -skew-x-12"></div>}
                 {part.type === 'Bent' && <div className="w-24 h-16 border-4 border-slate-300 rounded-sm"></div>}
              </div>
              
              <span className="absolute bottom-2 right-2 text-[10px] font-mono font-bold bg-white/80 px-1.5 py-0.5 rounded text-slate-600 border border-slate-300">
                {part.type}
              </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${part.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-20 ')}`}>
                    {part.id}
                  </span>
                  {part.cutType && part.cutType !== 'straight' && (
                    <span className="ml-2 text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200" title="Corte em Meia Esquadria">
                      {part.cutType === 'miter-both' ? '45° Ambos' : part.cutType === 'miter-start' ? '45° Início' : '45° Fim'}
                    </span>
                  )}
                  <h3 className="font-bold text-slate-800 mt-1">{part.name}</h3>
                </div>
              </div>
              
              <div className="space-y-2 mt-auto">
                <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
                  <span className="text-slate-600">Dimensões:</span>
                  <div className="flex flex-col items-end">
                    <span className="font-mono font-bold text-slate-700">{part.dimW} x {part.dimH} mm</span>
                    <span className="text-xs text-slate-600 flex items-center gap-1 font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1">
                        <Weight size={10} /> {calculateWeight(part)} kg
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>Total: {part.times.cutting + part.times.bending + part.times.welding + part.times.painting} min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Final Product 3D View Section (Preview) */}
      <div id="welding-project" className="mt-12 bg-white p-8 rounded-2xl border border-slate-300 shadow-sm text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Rotate3d size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Projeto de Soldagem 3D</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Abra o ambiente imersivo para definir cordões de solda, costuras e pontos de interseção diretamente na montagem do container.
          </p>
          <button 
            onClick={() => setIsWeldingModalOpen(true)}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
          >
            <Maximize2 size={20} /> Abrir Ambiente de Soldagem
          </button>
        </div>
      </div>

      {/* Floating Jump Button to Welding Project */}
      <button 
        onClick={() => setIsWeldingModalOpen(true)}
        className="fixed bottom-8 right-[26rem] z-40 bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all hover:scale-110 flex items-center gap-2 group"
      >
        <Rotate3d size={24} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">
          Abrir Projeto de Soldagem
        </span>
      </button>

      {/* Welding Project Modal */}
      {isWeldingModalOpen && (
        <WeldingProjectModal 
          parts={parts}
          project={project}
          partWelds={partWelds}
          partIntersections={partIntersections}
          weldMode={weldMode}
          setWeldMode={setWeldMode}
          onClose={() => setIsWeldingModalOpen(false)}
        />
      )}

      {/* Material List Modal */}
      {isMaterialListOpen && (
        <MaterialList 
          project={project} 
          onClose={() => setIsMaterialListOpen(false)} 
        />
      )}

      {/* 3D Viewer Modal */}
      {selectedPart && (
        <PartViewer3D 
          part={selectedPart} 
          project={project}
          onClose={() => setSelectedPart(null)} 
          onOpenWeldingModal={() => setIsWeldingModalOpen(true)}
          activeWelds={partWelds[selectedPart.id] || []}
          toggleWeld={(weldId) => togglePartWeld(selectedPart.id, weldId)}
          activeIntersections={partIntersections[selectedPart.id] || []}
          toggleIntersection={(intId) => togglePartIntersection(selectedPart.id, intId)}
          weldMode={weldMode}
          setWeldMode={setWeldMode}
          toggleInvertCuts={() => toggleInvertCuts(selectedPart.id)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Weld Component
// ----------------------------------------------------------------------
const Weld = ({ id, args, position, rotation, isActive, onClick, mode = 'weld' }: { 
  id: string, 
  args: [number, number, number], 
  position: [number, number, number], 
  rotation?: [number, number, number],
  isActive: boolean,
  onClick: (id: string) => void,
  mode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) => {
  let color = "#cbd5e1";
  let opacity = 0.3;
  
  if (isActive) {
    opacity = 0.8;
    if (mode === 'weld') color = "#3b82f6";
    else if (mode === 'stitch-short' || mode === 'stitch-long') color = "#6366f1";
    else if (mode === 'spot') color = "#ef4444";
  }
  
  return (
    <mesh 
      position={position} 
      rotation={rotation || [0, 0, 0]} 
      onClick={(e) => { e.stopPropagation(); onClick(id); }}
      onPointerOver={(e) => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { document.body.style.cursor = 'auto'; }}
    >
      <boxGeometry args={mode === 'spot' && isActive ? [15, 15, 15] : args} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={opacity} 
        wireframe={(mode === 'stitch-short' || mode === 'stitch-long') && isActive}
      />
    </mesh>
  );
};

// ----------------------------------------------------------------------
// Intersection Component (Empty Balls)
// ----------------------------------------------------------------------
const IntersectionPoint = ({ id, position, isActive, onClick }: {
  id: string,
  position: [number, number, number],
  isActive: boolean,
  onClick: (id: string) => void
}) => {
  return (
    <mesh 
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick(id); }}
      onPointerOver={(e) => { document.body.style.cursor = 'crosshair'; }}
      onPointerOut={(e) => { document.body.style.cursor = 'auto'; }}
    >
      <sphereGeometry args={[6, 16, 16]} />
      <meshStandardMaterial 
        color={isActive ? "#10b981" : "#ffffff"} 
        transparent 
        opacity={isActive ? 0.9 : 0.6}
        emissive={isActive ? "#10b981" : "#94a3b8"}
        emissiveIntensity={isActive ? 0.5 : 0.2}
      />
      {/* Border for the "empty ball" look */}
      {!isActive && (
        <mesh>
          <sphereGeometry args={[7, 16, 16]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>
      )}
    </mesh>
  );
};

// ----------------------------------------------------------------------
// 3D Viewer Component
// ----------------------------------------------------------------------

/**
 * BlueprintView renders a 2D technical drawing of a part using SVG.
 */
function BlueprintView({ part, isUnfolded }: { part: PartData, isUnfolded: boolean }) {
  const width = part.dimW || 100;
  const height = part.dimH || 100;
  const depth = part.dimD || 0;
  const thickness = part.thickness || 1.5;
  const cutType = part.cutType || 'straight';
  const invertCuts = part.invertCuts || false;

  // Calculate SVG viewBox and scale
  const padding = 40;
  const svgWidth = 800;
  const svgHeight = 600;
  
  // Determine drawing dimensions based on part type
  let drawW = width;
  let drawH = height;
  
  if (part.type === 'L-Shape' && isUnfolded) {
    drawW = width + depth;
  } else if (part.type === 'U-Profile' && isUnfolded) {
    drawW = width + (depth * 2);
  }

  const scale = Math.min((svgWidth - padding * 2) / drawW, (svgHeight - padding * 2) / drawH);
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  
  const rectW = drawW * scale;
  const rectH = drawH * scale;
  const startX = centerX - rectW / 2;
  const startY = centerY - rectH / 2;

  // Miter cut logic for SVG
  const miterOffset = (part.type === 'SquareTube' || part.type === 'RectangularTube') ? (part.dimW * scale) : 0;
  
  let points = "";
  if (cutType === 'straight') {
    points = `${startX},${startY} ${startX + rectW},${startY} ${startX + rectW},${startY + rectH} ${startX},${startY + rectH}`;
  } else if (cutType === 'miter-both') {
    if (invertCuts) {
      points = `${startX + miterOffset},${startY} ${startX + rectW - miterOffset},${startY} ${startX + rectW},${startY + rectH} ${startX},${startY + rectH}`;
    } else {
      points = `${startX},${startY} ${startX + rectW},${startY} ${startX + rectW - miterOffset},${startY + rectH} ${startX + miterOffset},${startY + rectH}`;
    }
  } else if (cutType === 'miter-start') {
    if (invertCuts) {
      points = `${startX + miterOffset},${startY} ${startX + rectW},${startY} ${startX + rectW},${startY + rectH} ${startX},${startY + rectH}`;
    } else {
      points = `${startX},${startY} ${startX + rectW},${startY} ${startX + rectW},${startY + rectH} ${startX + miterOffset},${startY + rectH}`;
    }
  } else if (cutType === 'miter-end') {
    if (invertCuts) {
      points = `${startX},${startY} ${startX + rectW - miterOffset},${startY} ${startX + rectW},${startY + rectH} ${startX},${startY + rectH}`;
    } else {
      points = `${startX},${startY} ${startX + rectW},${startY} ${startX + rectW - miterOffset},${startY + rectH} ${startX},${startY + rectH}`;
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-white p-8">
      <div className="w-full max-w-4xl border-2 border-slate-300 rounded-lg overflow-hidden shadow-inner bg-slate-50 relative">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Part Outline */}
          <polygon 
            points={points} 
            fill={part.color + '20'} 
            stroke={part.color} 
            strokeWidth="2" 
            strokeLinejoin="round"
          />

          {/* Bend lines for L-Shape/U-Profile */}
          {isUnfolded && (part.type === 'L-Shape' || part.type === 'U-Profile') && (
            <>
              <line 
                x1={startX + depth * scale} y1={startY} 
                x2={startX + depth * scale} y2={startY + rectH} 
                stroke={part.color} strokeWidth="1" strokeDasharray="5,5" 
              />
              {part.type === 'U-Profile' && (
                <line 
                  x1={startX + (drawW - depth) * scale} y1={startY} 
                  x2={startX + (drawW - depth) * scale} y2={startY + rectH} 
                  stroke={part.color} strokeWidth="1" strokeDasharray="5,5" 
                />
              )}
            </>
          )}

          {/* Dimensions */}
          {/* Width */}
          <g>
            <line x1={startX} y1={startY - 20} x2={startX + rectW} y2={startY - 20} stroke="#64748b" strokeWidth="1" />
            <line x1={startX} y1={startY - 25} x2={startX} y2={startY - 15} stroke="#64748b" strokeWidth="1" />
            <line x1={startX + rectW} y1={startY - 25} x2={startX + rectW} y2={startY - 15} stroke="#64748b" strokeWidth="1" />
            <text x={centerX} y={startY - 30} textAnchor="middle" fontSize="14" fill="#64748b" fontWeight="bold">
              {drawW.toFixed(1)} mm
            </text>
          </g>

          {/* Height */}
          <g>
            <line x1={startX - 20} y1={startY} x2={startX - 20} y2={startY + rectH} stroke="#64748b" strokeWidth="1" />
            <line x1={startX - 25} y1={startY} x2={startX - 15} y2={startY} stroke="#64748b" strokeWidth="1" />
            <line x1={startX - 25} y1={startY + rectH} x2={startX - 15} y2={startY + rectH} stroke="#64748b" strokeWidth="1" />
            <text x={startX - 30} y={centerY} textAnchor="middle" fontSize="14" fill="#64748b" fontWeight="bold" transform={`rotate(-90, ${startX - 30}, ${centerY})`}>
              {drawH.toFixed(1)} mm
            </text>
          </g>

          {/* Thickness Label */}
          <text x={startX} y={startY + rectH + 30} fontSize="12" fill="#94a3b8" fontStyle="italic">
            Espessura: {thickness}mm | Tipo: {part.type} | Corte: {cutType}
          </text>
        </svg>

        {/* Technical Info Overlay */}
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-3 rounded border border-slate-300 shadow-sm text-[10px] font-mono uppercase tracking-wider text-slate-600">
          <div className="font-bold text-slate-700 mb-1">PRODUÇÃO GRAVIA</div>
          <div>PEÇA: {part.name}</div>
          <div>ID: {part.id}</div>
          <div>DATA: {new Date().toLocaleDateString()}</div>
        </div>
      </div>
      
      <div className="mt-6 text-center max-w-2xl">
        <p className="text-sm text-slate-600 leading-relaxed">
          Este blueprint representa a peça em vista superior técnica. 
          As linhas tracejadas indicam dobras (bending). 
          As extremidades mostram o tipo de corte ({cutType === 'straight' ? 'Reto' : 'Meia Esquadria'}).
        </p>
      </div>
    </div>
  );
}

interface PartViewer3DProps {
  part: PartData;
  project: ProjectState;
  onClose: () => void;
  onOpenWeldingModal: () => void;
  activeWelds: string[];
  toggleWeld: (id: string) => void;
  activeIntersections: string[];
  toggleIntersection: (id: string) => void;
  weldMode: 'weld' | 'stitch-short' | 'stitch-long' | 'spot';
  setWeldMode: (mode: 'weld' | 'stitch-short' | 'stitch-long' | 'spot') => void;
  toggleInvertCuts?: () => void;
}

function PartViewer3D({ 
  part, 
  project,
  onClose, 
  onOpenWeldingModal, 
  activeWelds, 
  toggleWeld,
  activeIntersections,
  toggleIntersection,
  weldMode,
  setWeldMode,
  toggleInvertCuts
}: PartViewer3DProps) {
  const [showIssueReport, setShowIssueReport] = useState(false);
  const [viewType, setViewType] = useState<'3d' | 'blueprint'>('3d');
  const [interactionMode, setInteractionMode] = useState<'rotate' | 'pan'>('pan');
  const [showDimensions, setShowDimensions] = useState(true);
  const [viewMode, setViewMode] = useState<'specs' | 'welding'>('specs');
  const [dimensionType, setDimensionType] = useState<'internal' | 'external' | 'both'>('external');
  const [isUnfolded, setIsUnfolded] = useState(false);
  const [isExploded, setIsExploded] = useState(false);
  const [aiWeldingStrategy, setAiWeldingStrategy] = useState<string | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [dimensionConfig, setDimensionConfig] = useState({
    width: true,
    height: true,
    depth: true,
    thickness: false,
    angles: true
  });

  const handleGenerateStrategy = async () => {
    setIsGeneratingStrategy(true);
    try {
      const dimensions = `${part.dimW}x${part.dimH}${part.dimD ? 'x' + part.dimD : ''}`;
      // Assuming a default of 3 intersections if not specified in the part data
      const intersectionCount = 3; 
      const strategy = await generateWeldingStrategy(part.name, part.type, dimensions, part.thickness, intersectionCount);
      setAiWeldingStrategy(strategy);
    } catch (error) {
      console.error(error);
      setAiWeldingStrategy("Erro ao gerar estratégia.");
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-300 p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
             <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${part.color.replace('text-', 'bg-').replace('border-', '')} bg-opacity-20`}>
                <Box className={part.color.split(' ')[2]} size={20} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-slate-800">{part.name}</h2>
               <p className="text-sm text-slate-600 font-mono">{part.id} - {part.type} - Espessura: {part.thickness}mm</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
              <button 
                onClick={() => setViewType('3d')}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewType === '3d' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}
              >
                <Rotate3d size={16} /> 3D
              </button>
              <button 
                onClick={() => setViewType('blueprint')}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewType === 'blueprint' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}
              >
                <Ruler size={16} /> Blueprint
              </button>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
              <button 
                onClick={() => setViewMode('specs')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'specs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}
              >
                <Calculator size={16} /> Especificações
              </button>
              <button 
                onClick={() => setViewMode('welding')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'welding' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}
              >
                <Hammer size={16} /> Soldagem
              </button>
            </div>
            <button 
              onClick={() => {
                onClose();
                onOpenWeldingModal();
              }}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <Rotate3d size={16} /> Ver na Montagem
            </button>
            <button 
              onClick={() => setIsUnfolded(!isUnfolded)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isUnfolded ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Scissors size={16} /> {isUnfolded ? 'Ver Dobrada' : 'Ver Planificada'}
            </button>
            <button 
              onClick={() => setIsExploded(!isExploded)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isExploded ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Maximize2 size={16} /> {isExploded ? 'Ver Montada' : 'Ver Explodida'}
            </button>
            {part.cutType && part.cutType !== 'straight' && toggleInvertCuts && (
              <button 
                onClick={toggleInvertCuts}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${part.invertCuts ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="Inverter direção do corte em meia esquadria"
              >
                <Rotate3d size={16} className={part.invertCuts ? "rotate-180" : ""} /> Inverter Corte
              </button>
            )}
            <button 
              onClick={() => setShowIssueReport(!showIssueReport)}
              className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors flex items-center gap-2"
            >
              <AlertTriangle size={16} /> Reportar Problema
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X size={24} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* 3D Viewport or Blueprint (React Three Fiber) */}
          <div className="flex-1 bg-slate-100 relative overflow-hidden group">
             {viewType === '3d' ? (
               <Part3DViewer 
                 part={part} 
                 interactionMode={interactionMode}
                 onInteractionModeChange={setInteractionMode}
                 visibleDimensions={showDimensions && viewMode === 'specs' ? dimensionConfig : { width: false, height: false, depth: false, thickness: false, angles: false }}
                 dimensionType={dimensionType}
                 isUnfolded={isUnfolded}
                 isExploded={isExploded}
                 isWeldingMode={viewMode === 'welding'}
                 activeWelds={activeWelds}
                 toggleWeld={toggleWeld}
                 activeIntersections={activeIntersections}
                 toggleIntersection={toggleIntersection}
                 weldMode={weldMode}
               />
             ) : (
               <BlueprintView part={part} isUnfolded={isUnfolded} />
             )}

             {/* 3D Controls Overlay */}
             <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {viewMode === 'welding' && (
                  <div className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-slate-300 flex flex-col gap-2 mb-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-1">
                       <span className="text-xs font-bold text-slate-600 uppercase">Tipo de Solda</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => setWeldMode('weld')}
                        className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors ${weldMode === 'weld' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                        <div className="w-2 h-2 rounded-full bg-blue-400" /> Contínua
                      </button>
                      <button 
                        onClick={() => setWeldMode('stitch-short')}
                        className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors ${weldMode === 'stitch-short' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                        <div className="w-2 h-2 rounded-full bg-indigo-400" /> Faixas Curtas
                      </button>
                      <button 
                        onClick={() => setWeldMode('stitch-long')}
                        className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors ${weldMode === 'stitch-long' ? 'bg-indigo-800 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                        <div className="w-2 h-2 rounded-full bg-indigo-500" /> Faixas Longas
                      </button>
                      <button 
                        onClick={() => setWeldMode('spot')}
                        className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors ${weldMode === 'spot' ? 'bg-red-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                        <div className="w-2 h-2 rounded-full bg-red-400" /> Ponto
                      </button>
                    </div>
                  </div>
                )}
                <div className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-slate-300 flex flex-col gap-2">
                   <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-1">
                      <span className="text-xs font-bold text-slate-600 uppercase">Modo</span>
                   </div>
                   <div className="flex gap-1">
                     <button 
                       onClick={() => setInteractionMode('rotate')}
                       className={`p-2 rounded transition-colors ${interactionMode === 'rotate' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
                       title="Rotacionar (Clique Esquerdo)"
                     >
                       <Rotate3d size={18} />
                     </button>
                     <button 
                       onClick={() => setInteractionMode('pan')}
                       className={`p-2 rounded transition-colors ${interactionMode === 'pan' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
                       title="Mover Pan (Clique Esquerdo)"
                     >
                       <Move size={18} />
                     </button>
                   </div>
                </div>

                <div className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-slate-300 w-48">
                   <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                      <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                        <Ruler size={12} /> Medidas
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} className="sr-only peer" />
                        <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                   </div>
                   
                   {showDimensions && (
                     <div className="space-y-3">
                       <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Tipo de Medida</span>
                          <div className="flex gap-1">
                             <button 
                               onClick={() => setDimensionType('external')}
                               className={`flex-1 py-1 text-[10px] font-bold rounded border ${dimensionType === 'external' ? 'bg-white border-blue-300 text-blue-600 shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}
                             >
                               Externa
                             </button>
                             <button 
                               onClick={() => setDimensionType('internal')}
                               className={`flex-1 py-1 text-[10px] font-bold rounded border ${dimensionType === 'internal' ? 'bg-white border-blue-300 text-blue-600 shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}
                             >
                               Interna
                             </button>
                             <button 
                               onClick={() => setDimensionType('both')}
                               className={`flex-1 py-1 text-[10px] font-bold rounded border ${dimensionType === 'both' ? 'bg-white border-blue-300 text-blue-600 shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}
                             >
                               Ambas
                             </button>
                          </div>
                       </div>

                       <div className="space-y-1.5">
                       <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                         <input type="checkbox" checked={dimensionConfig.width} onChange={e => setDimensionConfig({...dimensionConfig, width: e.target.checked})} className="rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                         Largura (W)
                       </label>
                       <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                         <input type="checkbox" checked={dimensionConfig.height} onChange={e => setDimensionConfig({...dimensionConfig, height: e.target.checked})} className="rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                         Altura (H)
                       </label>
                       {part.dimD && (
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input type="checkbox" checked={dimensionConfig.depth} onChange={e => setDimensionConfig({...dimensionConfig, depth: e.target.checked})} className="rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                            Aba / Prof. (D)
                          </label>
                       )}
                       <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                         <input type="checkbox" checked={dimensionConfig.thickness} onChange={e => setDimensionConfig({...dimensionConfig, thickness: e.target.checked})} className="rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                         Espessura
                       </label>
                     </div>
                   </div>
                   )}
                </div>
             </div>
          </div>

          {/* Sidebar Details */}
          <div className="w-full lg:w-[400px] bg-white border-l border-slate-300 flex flex-col shadow-xl z-20">
             
             {viewMode === 'specs' ? (
               <>
                 {/* Production Times Section */}
                 <div className="p-6 border-b border-slate-200 bg-slate-50">
                   <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <Clock size={18} className="text-blue-600" /> Tempo Estimado (Peça)
                   </h3>
                   
                   <div className="grid grid-cols-2 gap-3">
                     <TimeCard icon={<Scissors size={14} />} label="Corte" time={part.times.cutting} color="bg-blue-50 text-blue-700 border-blue-100" />
                     <TimeCard icon={<Hammer size={14} />} label="Dobra" time={part.times.bending} color="bg-amber-50 text-amber-700 border-amber-100" />
                     <TimeCard icon={<Rotate3d size={14} />} label="Solda" time={part.times.welding} color="bg-red-50 text-red-700 border-red-100" />
                     <TimeCard icon={<PaintBucket size={14} />} label="Pintura" time={part.times.painting} color="bg-green-50 text-green-700 border-green-100" />
                   </div>
                 </div>

                 {/* Technical Details Section */}
                 <div className="p-6 overflow-y-auto flex-1">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <ZoomIn size={18} className="text-blue-600" /> Especificações
                    </h3>
                    
                    <div className="space-y-6">
                       <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-sm">
                         <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                           <Calculator size={12} /> Dimensões Reais
                         </span>
                         <div className="grid grid-cols-2 gap-y-4 gap-x-2 mt-3">
                            <div>
                              <div className="text-xs text-slate-600 mb-1">Largura (W)</div>
                              <div className="font-mono font-bold text-xl text-slate-800">{part.dimW} <span className="text-xs text-slate-600">mm</span></div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-600 mb-1">Altura (H)</div>
                              <div className="font-mono font-bold text-xl text-slate-800">{part.dimH} <span className="text-xs text-slate-600">mm</span></div>
                            </div>
                            {part.dimD && (
                              <div className="col-span-2 bg-slate-50 p-2 rounded border border-slate-200">
                                <div className="text-xs text-slate-600 mb-1">Aba / Profundidade (D)</div>
                                <div className="font-mono font-bold text-xl text-slate-800">{part.dimD} <span className="text-xs text-slate-600">mm</span></div>
                              </div>
                            )}
                         </div>
                       </div>

                       <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Instruções</span>
                          <p className="mt-2 text-sm text-blue-900 leading-relaxed font-medium">
                            {part.description}. 
                            {part.type === 'L-Shape' && " Atenção ao esquadro da dobra."}
                            {part.type === 'U-Profile' && " Manter paralelismo das abas."}
                          </p>
                       </div>

                       {/* Bending Details Section */}
                       {['L-Shape', 'U-Profile', 'Bent', 'Trapezoid'].includes(part.type) && (
                         <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 shadow-sm">
                           <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-2 mb-3">
                             <Rotate3d size={14} /> Detalhamento de Dobra
                           </span>
                           <p className="text-xs text-amber-800 mb-3 bg-amber-100/50 p-2 rounded">
                             <strong>Atenção:</strong> As medidas de projeto são <strong>EXTERNAS</strong>. Para marcação na máquina, utilize as medidas <strong>INTERNAS</strong> (descontando a espessura de {part.thickness}mm).
                           </p>
                           <div className="space-y-2 text-sm">
                             <div className="flex justify-between border-b border-amber-100 pb-1">
                               <span className="text-amber-700">Aba 1 (Largura):</span>
                               <div className="text-right">
                                 <span className="text-xs text-slate-600 line-through mr-2">Ext: {part.dimW}mm</span>
                                 <span className="font-bold text-amber-900">Int: {part.dimW - part.thickness}mm</span>
                               </div>
                             </div>
                             <div className="flex justify-between border-b border-amber-100 pb-1">
                               <span className="text-amber-700">Aba 2 (Altura):</span>
                               <div className="text-right">
                                 <span className="text-xs text-slate-600 line-through mr-2">Ext: {part.dimH}mm</span>
                                 <span className="font-bold text-amber-900">Int: {part.dimH - part.thickness}mm</span>
                               </div>
                             </div>
                             {part.dimD && (
                               <div className="flex justify-between border-b border-amber-100 pb-1">
                                 <span className="text-amber-700">Aba 3 (Profundidade):</span>
                                 <div className="text-right">
                                   <span className="text-xs text-slate-600 line-through mr-2">Ext: {part.dimD}mm</span>
                                   <span className="font-bold text-amber-900">Int: {part.dimD - part.thickness}mm</span>
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>
                       )}

                       {/* Welding Details Section */}
                       <div className="bg-red-50 p-5 rounded-xl border border-red-200 shadow-sm">
                         <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-2 mb-3">
                           <Hammer size={14} /> Detalhamento de Solda e Intersecções
                         </span>
                         <div className="space-y-3 text-sm">
                           <div className="bg-white p-3 rounded border border-red-100">
                             <div className="font-bold text-red-800 mb-1">Processo de Soldagem:</div>
                             <div className="text-red-700 flex items-center gap-2">
                               <span className="bg-red-100 px-2 py-0.5 rounded text-xs font-bold uppercase">{project.processParameters.weldingType}</span>
                               <span>(Intensidade: {project.processParameters.weldingIntensity})</span>
                             </div>
                           </div>
                           <div className="bg-white p-3 rounded border border-red-100">
                             <div className="font-bold text-red-800 mb-1">Padrão de Fixação:</div>
                             <p className="text-red-700 text-xs leading-relaxed">
                               Para todas as intersecções desta peça com a estrutura principal:
                               <br/>• <strong>3 pontos de intersecção</strong> (ponteamento inicial para travamento).
                               <br/>• <strong>+ 1 metro de solda ponteada contínua</strong> distribuída ao longo das arestas de contato.
                             </p>
                           </div>

                            <div className="bg-white p-3 rounded border border-purple-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-bold text-purple-800 flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                  Estratégia de Soldagem com IA
                                </div>
                                {!aiWeldingStrategy && (
                                  <button 
                                    onClick={handleGenerateStrategy}
                                    disabled={isGeneratingStrategy}
                                    className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                  >
                                    {isGeneratingStrategy ? 'Analisando...' : 'Gerar Estratégia'}
                                  </button>
                                )}
                              </div>
                              
                              {aiWeldingStrategy ? (
                                <div className="text-slate-700 text-xs leading-relaxed bg-purple-50 p-2 rounded border border-purple-100 whitespace-pre-line">
                                  {aiWeldingStrategy}
                                </div>
                              ) : (
                                <p className="text-slate-600 text-xs italic">
                                  Clique em "Gerar Estratégia" para analisar a geometria desta peça e recomendar o melhor processo de soldagem.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                    </div>
                 </div>
               </>
             ) : (
               <div className="p-6 flex flex-col h-full bg-slate-50">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Hammer size={18} className="text-red-600" /> Plano de Soldagem Individual
                  </h3>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm mb-6">
                    <p className="text-sm text-slate-600 mb-4">
                      Selecione as arestas e pontos da peça que receberão solda ou interseção.
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-xs font-bold text-slate-600">Arestas Selecionadas</span>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {activeWelds.length}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-xs font-bold text-slate-600">Interseções</span>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {activeIntersections.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Soldas</h4>
                      {activeWelds.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-slate-300 rounded-lg">
                          <p className="text-[10px] text-slate-600">Nenhuma solda.</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {activeWelds.map(w => (
                            <div key={w} className="flex items-center justify-between p-2 bg-white rounded border border-slate-300 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-700">Aresta {w.split('-')[1]}</span>
                              <button onClick={() => toggleWeld(w)} className="text-slate-700 hover:text-red-500"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Interseções</h4>
                      {activeIntersections.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-slate-300 rounded-lg">
                          <p className="text-[10px] text-slate-600">Nenhuma interseção.</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {activeIntersections.map(i => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-slate-300 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-700">Ponto {i.split('-')[1]}</span>
                              <button onClick={() => toggleIntersection(i)} className="text-slate-700 hover:text-red-500"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-300">
                    <button 
                      onClick={() => setViewMode('specs')}
                      className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                    >
                      Concluir Definição
                    </button>
                  </div>
               </div>
             )}

             {/* Issue Report Overlay */}
             {showIssueReport && (
               <div className="absolute inset-0 bg-white/95 backdrop-blur z-30 p-6 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold text-amber-700 flex items-center gap-2">
                     <AlertTriangle size={20} /> Reportar Problema
                   </h3>
                   <button onClick={() => setShowIssueReport(false)} className="p-1 hover:bg-slate-100 rounded">
                     <X size={20} />
                   </button>
                 </div>
                 
                 <div className="space-y-4 flex-1">
                   <p className="text-sm text-slate-600">
                     Descreva o erro de produção para que a IA recalcule o aproveitamento.
                   </p>
                   
                   <div>
                     <label className="block text-xs font-bold text-slate-600 uppercase mb-1">O que aconteceu?</label>
                     <select className="w-full p-3 border border-slate-400 rounded-lg text-sm bg-white">
                       <option>Corte com medida menor que o projeto</option>
                       <option>Dobra feita no lado errado</option>
                       <option>Chapa empenada/danificada</option>
                       <option>Erro de furação</option>
                     </select>
                   </div>

                   <div>
                     <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Detalhes</label>
                     <textarea 
                       className="w-full p-3 border border-slate-400 rounded-lg text-sm h-32 resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                       placeholder="Ex: A chapa foi cortada com 1180mm ao invés de 1200mm..."
                     ></textarea>
                   </div>
                 </div>

                 <button className="w-full py-3 bg-white text-slate-900 rounded-lg font-bold hover:bg-slate-100 transition-colors shadow-lg">
                   Enviar Reporte
                 </button>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Welding Project Modal
// ----------------------------------------------------------------------

interface WeldingProjectModalProps {
  parts: PartData[];
  project: ProjectState;
  partWelds: Record<string, string[]>;
  partIntersections: Record<string, string[]>;
  weldMode: 'weld' | 'stitch-short' | 'stitch-long' | 'spot';
  setWeldMode: (mode: 'weld' | 'stitch-short' | 'stitch-long' | 'spot') => void;
  onClose: () => void;
}

function WeldingProjectModal({ 
  parts, 
  project, 
  partWelds, 
  partIntersections, 
  weldMode, 
  setWeldMode, 
  onClose 
}: WeldingProjectModalProps) {
  const [showMDF, setShowMDF] = useState(true);

  // Aggregate all welds for summary
  const allWelds = Object.values(partWelds).flat();
  const allIntersections = Object.values(partIntersections).flat();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border border-white/20">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-300 p-6 flex justify-between items-center z-10">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Rotate3d size={24} />
             </div>
             <div>
               <h2 className="text-2xl font-bold text-slate-800">Ambiente de Soldagem 3D</h2>
               <p className="text-sm text-slate-600">Defina cordões, costuras e interseções na montagem final</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-300 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                checked={showMDF} 
                onChange={(e) => setShowMDF(e.target.checked)}
                className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-700">Mostrar MDF</span>
            </label>

            <div className="flex bg-slate-200 p-1 rounded-xl border border-slate-400">
              <button 
                onClick={() => setWeldMode('weld')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${weldMode === 'weld' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-700'}`}
              >
                Contínua
              </button>
              <button 
                onClick={() => setWeldMode('stitch-short')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${weldMode === 'stitch-short' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-600 hover:text-slate-700'}`}
              >
                F. Curta
              </button>
              <button 
                onClick={() => setWeldMode('stitch-long')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${weldMode === 'stitch-long' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-600 hover:text-slate-700'}`}
              >
                F. Longa
              </button>
              <button 
                onClick={() => setWeldMode('spot')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${weldMode === 'spot' ? 'bg-white text-red-600 shadow-md' : 'text-slate-600 hover:text-slate-700'}`}
              >
                Ponto
              </button>
            </div>
            
            <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-colors bg-slate-100 text-slate-600">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* 3D Viewport */}
          <div className="flex-1 bg-slate-100 relative overflow-hidden">
             <FinalProductViewer 
               parts={parts} 
               project={project} 
               partWelds={partWelds} 
               partIntersections={partIntersections}
               weldMode={weldMode} 
               showMDF={showMDF}
             />
             
             {/* Legend Overlay */}
             <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur p-4 rounded-2xl border border-slate-300 shadow-xl text-[11px] space-y-3 min-w-[180px]">
                <div className="font-bold text-slate-600 uppercase tracking-widest mb-1 border-b border-slate-200 pb-2">Legenda Técnica</div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-500 rounded shadow-sm"></div>
                  <span className="text-slate-700 font-medium">Solda Contínua</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-indigo-500 rounded border-2 border-white border-dashed shadow-sm"></div>
                  <span className="text-slate-700 font-medium">Faixas Curtas</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-indigo-700 rounded border-2 border-white border-dashed shadow-sm"></div>
                  <span className="text-slate-700 font-medium">Faixas Longas</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full shadow-sm"></div>
                  <span className="text-slate-700 font-medium">Ponto de Solda</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-slate-400 rounded-full bg-white shadow-sm"></div>
                  <span className="text-slate-700 font-medium">Interseção (Vazia)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-emerald-500 rounded-full bg-emerald-100 shadow-sm"></div>
                  <span className="text-slate-700 font-medium">Interseção Definida</span>
                </div>
             </div>
          </div>

          {/* Sidebar Details */}
          <div className="w-full lg:w-[380px] bg-slate-50 border-l border-slate-300 flex flex-col shadow-inner">
             <div className="p-6 overflow-y-auto flex-1">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] mb-6">Elementos Definidos</h3>
                
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Soldas Definidas</h4>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{allWelds.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                      {parts.map(part => {
                        const welds = partWelds[part.id] || [];
                        if (welds.length === 0) return null;
                        return (
                          <div key={part.id} className="bg-white p-3 rounded-xl border border-slate-300 text-[11px] shadow-sm">
                            <div className="font-bold text-slate-800 mb-1">{part.name}</div>
                            <div className="text-slate-600">{welds.length} arestas marcadas</div>
                          </div>
                        );
                      })}
                      {allWelds.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-2xl text-slate-600 text-[11px] italic">
                          Nenhuma solda definida nos componentes.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Interseções</h4>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{allIntersections.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                      {parts.map(part => {
                        const ints = partIntersections[part.id] || [];
                        if (ints.length === 0) return null;
                        return (
                          <div key={part.id} className="bg-white p-3 rounded-xl border border-slate-300 text-[11px] shadow-sm">
                            <div className="font-bold text-slate-800 mb-1">{part.name}</div>
                            <div className="text-slate-600">{ints.length} pontos marcados</div>
                          </div>
                        );
                      })}
                      {allIntersections.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-2xl text-slate-600 text-[11px] italic">
                          Nenhuma interseção marcada.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
             </div>
             
             {/* Footer Actions */}
             <div className="p-6 bg-white border-t border-slate-300">
                <button 
                  onClick={onClose}
                  className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-lg shadow-slate-200"
                >
                  Salvar e Sair
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Final Product Viewer
// ----------------------------------------------------------------------

function FinalProductViewer({ parts, project, partWelds, partIntersections, weldMode, showMDF }: { 
  parts: PartData[], 
  project: ProjectState,
  partWelds: Record<string, string[]>,
  partIntersections: Record<string, string[]>,
  weldMode: 'weld' | 'stitch-short' | 'stitch-long' | 'spot',
  showMDF: boolean
}) {
  const { width: pr_w, height: pr_h, depth: fu_h } = project.dimensions;
  const [gridY, setGridY] = React.useState(-1);

  // Calculate max dimension for dynamic grid sizing
  const maxDim = Math.max(pr_w, pr_h, fu_h);
  
  const gridConfig = useMemo(() => {
      // Adaptive grid based on project size
      if (maxDim <= 50) return { cell: 5, section: 25, fade: 150 };
      if (maxDim <= 200) return { cell: 10, section: 50, fade: 500 };
      if (maxDim <= 1000) return { cell: 50, section: 250, fade: 1500 };
      if (maxDim <= 3000) return { cell: 100, section: 500, fade: 4000 };
      return { cell: 500, section: 2500, fade: 10000 };
  }, [maxDim]);

  // Check if AI provided assembly data
  const hasAssemblyData = parts.some(p => p.position && p.rotation);

  if (hasAssemblyData) {
    return (
      <Canvas shadows camera={{ position: [2000, 2000, 2000], fov: 45 }}>
        <color attach="background" args={['#f1f5f9']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <Bounds fit clip observe margin={1.2}>
          <Center onCentered={({ boundingBox }) => setGridY(boundingBox.min.y)}>
            <group>
               {parts.map(part => {
                 if (!showMDF && isMDFPart(part)) return null;

                 const pos = part.position || { x: 0, y: 0, z: 0 };
                 const rot = part.rotation || { x: 0, y: 0, z: 0 };
                 
                 const PartComponent = {
                   'L-Shape': LShape,
                   'U-Profile': UProfile,
                   'Flat': Flat,
                   'Trapezoid': Trapezoid,
                   'Bent': Bent,
                   'RoundTube': RoundTube,
                   'SquareTube': SquareTube,
                   'RectangularTube': RectangularTube,
                   'Profile': UProfile,
                   'Hinge': Hinge
                 }[part.type] || Flat;

                 return (
                   <group 
                     key={part.id} 
                     position={[pos.x, pos.y, pos.z]} 
                     rotation={[rot.x, rot.y, rot.z]}
                   >
                     <PartComponent 
                       part={{ ...part, color: getPartHexColor(part.id) }}
                       visibleDimensions={{width:false, height:false, depth:false, thickness:false, angles:false}} 
                       dimensionType="external" 
                       isWeldingMode={true}
                       activeWelds={partWelds[part.id] || []}
                       activeIntersections={partIntersections[part.id] || []}
                       weldMode={weldMode}
                     />
                   </group>
                 );
               })}
            </group>
          </Center>
        </Bounds>
        <Grid 
          renderOrder={-1} 
          position={[0, gridY, 0]} 
          infiniteGrid 
          cellSize={gridConfig.cell} 
          sectionSize={gridConfig.section} 
          fadeDistance={gridConfig.fade} 
          sectionColor="#94a3b8" 
          cellColor="#cbd5e1" 
        />
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="black" />
        </GizmoHelper>
      </Canvas>
    );
  }

  // Derived dimensions for assembly (Matching unified logic) - FALLBACK
  const lt_h = pr_h - 20;
  const lt_t = fu_h + 220;
  const lt_b = fu_h;
  const delta_len = lt_t - lt_b;
  
  // Calculate front angle (tilt forward)
  const frontAngle = Math.atan(delta_len / lt_h);

  // Parts
  const pBack = parts.find(p => p.id === 'A1') || parts[0];
  const pFront = parts.find(p => p.id === 'A2') || parts[1];
  const pBottom = parts.find(p => p.id === 'B1') || parts[2];
  const pSide = parts.find(p => p.id === 'C1') || parts[3];
  const pLids = parts.find(p => p.id === 'B4/C3');
  const pRearProfile = parts.find(p => p.id === 'A3');
  const pFrontProfile = parts.find(p => p.id === 'A4');
  const pSideProfile = parts.find(p => p.id === 'B2/C2');
  const pColumns = parts.find(p => p.id === 'B3/B5');

  const noDims = {width:false, height:false, depth:false, thickness:false, angles:false};

  return (
    <Canvas shadows camera={{ position: [2000, 2000, 2000], fov: 45 }}>
      <color attach="background" args={['#f1f5f9']} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />

      <Bounds fit clip observe margin={1.2}>
        <Center onCentered={({ boundingBox }) => setGridY(boundingBox.min.y)}>
          <group>
             {/* Bottom (Fundo) - Centered at Origin Y=0 */}
             {pBottom && (showMDF || !isMDFPart(pBottom)) && (
               <group position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
                  <Flat 
                    part={pBottom} 
                    visibleDimensions={noDims} 
                    dimensionType="external" 
                    isWeldingMode={true}
                    activeWelds={partWelds[pBottom.id] || []}
                    activeIntersections={partIntersections[pBottom.id] || []}
                    weldMode={weldMode}
                  />
               </group>
             )}

             {/* Back (Costas) - Vertical at Z = -fu_h/2 (Rear) */}
             <group position={[0, 0, -fu_h/2]}>
                {pBack && (showMDF || !isMDFPart(pBack)) && (
                  <group position={[0, 0, 0]}>
                      <LShape 
                        part={pBack} 
                        visibleDimensions={noDims} 
                        dimensionType="external" 
                        isWeldingMode={true}
                        activeWelds={partWelds[pBack.id] || []}
                        activeIntersections={partIntersections[pBack.id] || []}
                        weldMode={weldMode}
                      />
                  </group>
                )}
                
                {/* Rear Top Profile (Collar) */}
                {pRearProfile && (showMDF || !isMDFPart(pRearProfile)) && (
                    <group position={[0, pBack.dimH - 40, pBack.thickness]} rotation={[0, 0, 0]}>
                        <UProfile 
                          part={pRearProfile} 
                          visibleDimensions={noDims} 
                          dimensionType="external" 
                          isWeldingMode={true}
                          activeWelds={partWelds[pRearProfile.id] || []}
                          activeIntersections={partIntersections[pRearProfile.id] || []}
                          weldMode={weldMode}
                        />
                    </group>
                )}
             </group>

             {/* Front (Frente) - Angled at Z = fu_h/2 (Front) */}
             <group position={[0, 0, fu_h/2]} rotation={[frontAngle, 0, 0]}>
                {pFront && (showMDF || !isMDFPart(pFront)) && (
                  <group position={[0, 0, 0]}>
                      <LShape 
                        part={pFront} 
                        visibleDimensions={noDims} 
                        dimensionType="external" 
                        isWeldingMode={true}
                        activeWelds={partWelds[pFront.id] || []}
                        activeIntersections={partIntersections[pFront.id] || []}
                        weldMode={weldMode}
                      />
                  </group>
                )}

                {/* Front Top Profile (Collar) */}
                {pFrontProfile && (showMDF || !isMDFPart(pFrontProfile)) && (
                    <group position={[0, pFront.dimH - 40, -pFront.thickness]} rotation={[0, Math.PI, 0]}>
                        <UProfile 
                          part={pFrontProfile} 
                          visibleDimensions={noDims} 
                          dimensionType="external" 
                          isWeldingMode={true}
                          activeWelds={partWelds[pFrontProfile.id] || []}
                          activeIntersections={partIntersections[pFrontProfile.id] || []}
                          weldMode={weldMode}
                        />
                    </group>
                )}
             </group>

             {/* Sides (Laterais) */}
             {/* Left Side */}
             <group position={[-pr_w/2, 0, (lt_t - fu_h)/2]} rotation={[0, -Math.PI/2, 0]}>
                {pSide && (showMDF || !isMDFPart(pSide)) && (
                  <group position={[0, 0, 0]}>
                      <Trapezoid 
                        part={pSide} 
                        visibleDimensions={noDims} 
                        dimensionType="external" 
                        isWeldingMode={true}
                        activeWelds={partWelds[pSide.id] || []}
                        activeIntersections={partIntersections[pSide.id] || []}
                        weldMode={weldMode}
                      />
                  </group>
                )}
                
                {/* Side Top Profile (Collar) - Left */}
                {pSideProfile && (showMDF || !isMDFPart(pSideProfile)) && (
                    <group position={[0, pSide.dimH - 20, 0]} rotation={[0, 0, -Math.PI/2]}> 
                         <group rotation={[0, Math.PI, 0]}>
                             <UProfile 
                               part={pSideProfile} 
                               visibleDimensions={noDims} 
                               dimensionType="external" 
                               isWeldingMode={true}
                               activeWelds={partWelds[pSideProfile.id] || []}
                               activeIntersections={partIntersections[pSideProfile.id] || []}
                               weldMode={weldMode}
                             />
                         </group>
                    </group>
                )}

                {/* Reinforcements (Munhão) - On Side, near Front */}
                {pColumns && (showMDF || !isMDFPart(pColumns)) && (
                    <group position={[(lt_t/2 - 200), pSide.dimH / 3, pSide.thickness + 10]} rotation={[0, 0, Math.PI/2]}>
                         <UProfile 
                           part={pColumns} 
                           visibleDimensions={noDims} 
                           dimensionType="external" 
                           isWeldingMode={true}
                           activeWelds={partWelds[pColumns.id] || []}
                           activeIntersections={partIntersections[pColumns.id] || []}
                           weldMode={weldMode}
                         />
                    </group>
                )}
             </group>

             {/* Right Side */}
             <group position={[pr_w/2, 0, (lt_t - fu_h)/2]} rotation={[0, -Math.PI/2, 0]} scale={[1, 1, -1]}>
                {pSide && (showMDF || !isMDFPart(pSide)) && (
                  <group position={[0, pSide.dimH/2, 0]}>
                      <Trapezoid 
                        part={pSide} 
                        visibleDimensions={noDims} 
                        dimensionType="external" 
                        isWeldingMode={true}
                        activeWelds={partWelds[pSide.id] || []}
                        activeIntersections={partIntersections[pSide.id] || []}
                        weldMode={weldMode}
                      />
                  </group>
                )}

                 {/* Side Top Profile (Collar) - Right */}
                 {pSideProfile && (showMDF || !isMDFPart(pSideProfile)) && (
                    <group position={[0, pSide.dimH - 20, 0]} rotation={[0, 0, -Math.PI/2]}>
                         <group rotation={[0, Math.PI, 0]}>
                             <UProfile 
                               part={pSideProfile} 
                               visibleDimensions={noDims} 
                               dimensionType="external" 
                               isWeldingMode={true}
                               activeWelds={partWelds[pSideProfile.id] || []}
                               activeIntersections={partIntersections[pSideProfile.id] || []}
                               weldMode={weldMode}
                             />
                         </group>
                    </group>
                )}

                {/* Reinforcements (Munhão) - On Side, near Front */}
                {pColumns && (showMDF || !isMDFPart(pColumns)) && (
                    <group position={[(lt_t/2 - 200), pSide.dimH / 3, pSide.thickness + 10]} rotation={[0, 0, Math.PI/2]}>
                         <UProfile 
                           part={pColumns} 
                           visibleDimensions={noDims} 
                           dimensionType="external" 
                           isWeldingMode={true}
                           activeWelds={partWelds[pColumns.id] || []}
                           activeIntersections={partIntersections[pColumns.id] || []}
                           weldMode={weldMode}
                         />
                    </group>
                )}
             </group>

             {/* Lids (Tampas) */}
             {pLids && (showMDF || !isMDFPart(pLids)) && (
                 <group position={[0, lt_h, (lt_t - fu_h)/2]} rotation={[Math.PI/2, 0, 0]}>
                     {/* Left Lid */}
                     <group position={[-pr_w/4, 0, 0]}>
                        <Bent 
                          part={pLids} 
                          visibleDimensions={noDims} 
                          dimensionType="external" 
                          isWeldingMode={true}
                          activeWelds={partWelds[pLids.id] || []}
                          activeIntersections={partIntersections[pLids.id] || []}
                          weldMode={weldMode}
                        />
                     </group>
                     {/* Right Lid */}
                     <group position={[pr_w/4, 0, 0]}>
                        <Bent 
                          part={pLids} 
                          visibleDimensions={noDims} 
                          dimensionType="external" 
                          isWeldingMode={true}
                          activeWelds={partWelds[pLids.id] || []}
                          activeIntersections={partIntersections[pLids.id] || []}
                          weldMode={weldMode}
                        />
                     </group>
                 </group>
             )}

          </group>
        </Center>
      </Bounds>

      <Grid 
        renderOrder={-1} 
        position={[0, gridY, 0]} 
        infiniteGrid 
        cellSize={gridConfig.cell} 
        sectionSize={gridConfig.section} 
        fadeDistance={gridConfig.fade} 
        sectionColor="#94a3b8" 
        cellColor="#cbd5e1" 
      />
      
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="black" />
      </GizmoHelper>
    </Canvas>
  );
}

// ----------------------------------------------------------------------
// Specific 3D Models
// ----------------------------------------------------------------------

function TimeCard({ icon, label, time, color }: { icon: React.ReactNode, label: string, time: number, color: string }) {
  return (
    <div className={`p-3 rounded-lg border ${color} flex flex-col items-center justify-center text-center`}>
      <div className="mb-1 opacity-80">{icon}</div>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="font-bold text-lg leading-none mt-1">{time}m</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Volumetric 3D Models (Cuboids)
// ----------------------------------------------------------------------


