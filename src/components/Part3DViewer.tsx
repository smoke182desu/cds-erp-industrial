import React, { useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center, Grid, GizmoHelper, GizmoViewport, Text, Line, Bounds, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { calculatePartWeight } from '../utils/calculations';

interface PartData {
  id: string;
  name: string;
  dimW: number;
  dimH: number;
  dimD?: number;
  thickness: number;
  type: 'L-Shape' | 'U-Profile' | 'Flat' | 'Trapezoid' | 'Bent' | 'RoundTube' | 'SquareTube' | 'RectangularTube' | 'Profile' | 'Hinge' | 'Parametric';
  color: string;
  details?: any;
  description?: string;
  position?: { x: number, y: number, z: number };
  rotation?: { x: number, y: number, z: number };
  welds?: any[];
  cutType?: 'straight' | 'miter-start' | 'miter-end' | 'miter-both';
  invertCuts?: boolean;
}

interface VisibleDimensions {
  width: boolean;
  height: boolean;
  depth: boolean;
  thickness: boolean;
  angles: boolean;
}

interface Part3DViewerProps {
  part: PartData;
  interactionMode?: 'rotate' | 'pan';
  onInteractionModeChange?: (mode: 'rotate' | 'pan') => void;
  visibleDimensions?: VisibleDimensions;
  dimensionType?: 'internal' | 'external' | 'both';
  isUnfolded?: boolean;
  isExploded?: boolean;
  isWeldingMode?: boolean;
  activeWelds?: string[];
  toggleWeld?: (id: string) => void;
  activeIntersections?: string[];
  toggleIntersection?: (id: string) => void;
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot';
}

// Helper to snap values to 5mm grid
const snapTo5 = (val: number) => Math.round(val / 5) * 5;

// Material for the metal parts
const metalMaterial = new THREE.MeshStandardMaterial({
  color: "#a0a0a0", // Base grey
  roughness: 0.5,
  metalness: 0.6,
  side: THREE.DoubleSide
});

// Material for MDF/Wood parts
const woodMaterial = new THREE.MeshStandardMaterial({
  color: "#d4a373", // Base wood color
  roughness: 0.8,
  metalness: 0.1,
  side: THREE.DoubleSide
});

// Helper to check if a part is MDF/Wood
export const isMDFPart = (part: PartData) => {
  return (part.name || '').toLowerCase().includes('mdf') || 
         (part.name || '').toLowerCase().includes('madeira') ||
         (part.description && (part.description.toLowerCase().includes('mdf') || part.description.toLowerCase().includes('madeira'))) ||
         (part.details && part.details.material && (part.details.material.toLowerCase().includes('mdf') || part.details.material.toLowerCase().includes('madeira')));
};

// Helper to check if a part is a leg
const isLeg = (part: PartData) => {
  const name = (part.name || '').toLowerCase();
  const desc = (part.description || '').toLowerCase();
  const type = (part.type || '').toLowerCase();
  
  const terms = ['pé', 'leg', 'foot', 'coluna', 'column', 'post', 'pillar', 'montante', 'upright', 'base'];
  
  // Check if any term is in name or description
  const matchesTerm = terms.some(term => name.includes(term) || desc.includes(term));
  
  // Also check if it's a vertical tube (heuristic)
  // If height > width * 5 and rotation is vertical (approx 0 on X and Z)
  // This might be too aggressive, so let's stick to naming for now, but expanded.
  
  return matchesTerm;
};

// Helper to get material based on part properties
export const getMaterialForPart = (part: PartData) => {
  // Explicit check for MDF/Wood in name or details
  const isWood = isMDFPart(part);

  if (isWood) {
      // Use a wood-like color if the part has a specific color, otherwise default wood
      if (part.color && part.color !== '#a0a0a0') {
          return new THREE.MeshStandardMaterial({
              color: part.color,
              roughness: 0.8,
              metalness: 0.1,
              side: THREE.DoubleSide
          });
      }
      return woodMaterial;
  }

  // If color is explicitly provided and looks like wood/mdf (brownish/yellowish)
  if (part.color && (part.color.toLowerCase().includes('#d') || part.color.toLowerCase().includes('#c') || part.color.toLowerCase().includes('#e') || part.color.toLowerCase().includes('#8'))) {
     // We could dynamically create a material with the specific color, but for now let's use the generic wood material if it's not a standard metal color
     if (part.type === 'Flat' && part.thickness > 5) { // Heuristic: thick flat parts are often MDF
         return new THREE.MeshStandardMaterial({
            color: part.color,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
         });
     }
  }
  
  if (part.type === 'Flat' && part.thickness >= 15) {
      return woodMaterial; // Default to wood for thick plates if no color logic matches
  }

  // Default to metal, but use the part's color if provided
  if (part.color && part.color !== '#a0a0a0') {
      return new THREE.MeshStandardMaterial({
          color: part.color,
          roughness: 0.5,
          metalness: 0.6,
          side: THREE.DoubleSide
      });
  }

  return metalMaterial;
};

// Colors for nodes A, B, C, D
const NODE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f97316']; // Red, Blue, Green, Orange

// Dimension Line Component
function DimensionLine({ start, end, label, offset = 0, color = "black" }: { start: [number, number, number], end: [number, number, number], label: string, offset?: number, color?: string }) {
    if (start.some(isNaN) || end.some(isNaN)) return null;
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    
    // Calculate direction
    const dir = new THREE.Vector3().subVectors(e, s).normalize();
    
    // Calculate perpendicular vector for offset
    let perp = new THREE.Vector3(0, 1, 0);
    
    // If line is roughly vertical (Y axis), perp is X
    if (Math.abs(dir.y) > 0.9) {
        perp = new THREE.Vector3(1, 0, 0);
    } 
    // If line is in YZ plane (roughly), perp should be in YZ plane
    else if (Math.abs(dir.x) < 0.1) {
        // Rotate 90 degrees in YZ plane: (y, z) -> (-z, y)
        perp = new THREE.Vector3(0, -dir.z, dir.y).normalize();
    }
    
    // Apply offset
    const offsetVec = perp.clone().multiplyScalar(offset);
    const sOff = s.clone().add(offsetVec);
    const eOff = e.clone().add(offsetVec);
    
    // Midpoint for text
    const mid = new THREE.Vector3().addVectors(sOff, eOff).multiplyScalar(0.5);
    
    // Offset text slightly further in the direction of the offset
    const textOffsetDist = 8; // Distance from line to text center
    const textPos = mid.clone().add(perp.clone().multiplyScalar(offset >= 0 ? textOffsetDist : -textOffsetDist));

    return (
        <group>
            {/* Main Line */}
            <Line points={[sOff, eOff]} color={color} lineWidth={1} />
            
            {/* End ticks */}
            <Line points={[s, sOff]} color={color} lineWidth={0.5} dashed opacity={0.5} />
            <Line points={[e, eOff]} color={color} lineWidth={0.5} dashed opacity={0.5} />
            
            {/* Label */}
            <Billboard position={textPos}>
                <Text 
                    fontSize={14} 
                    color={color} 
                    anchorX="center" 
                    anchorY="middle"
                    fillOpacity={1}
                >
                    {label}
                </Text>
            </Billboard>
        </group>
    )
}

// ----------------------------------------------------------------------
// Intersection Point Component
// ----------------------------------------------------------------------
function IntersectionPoint({ id, position, isActive, onClick, baseColor = "#cbd5e1" }: { 
  id: string, 
  position: [number, number, number], 
  isActive: boolean, 
  onClick: (id: string) => void,
  baseColor?: string
}) {
  const [hovered, setHovered] = React.useState(false);
  
  let color = baseColor;
  let opacity = 0.8; // Increased opacity for visibility
  let scale = 1;
  
  if (isActive) {
    color = "#10b981"; // Emerald for active selection
    opacity = 1;
    scale = 1.5;
  } else if (hovered) {
    // color = "#94a3b8"; // Keep base color but lighter/darker? Or just scale
    opacity = 1;
    scale = 1.2;
  }

  // Extract node identifier from ID (e.g., 'node-start-1' -> '1')
  const label = id.split('-').pop() || '';

  return (
    <group position={position}>
        <mesh 
          scale={scale}
          onClick={(ev) => { ev.stopPropagation(); onClick(id); }}
          onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        >
          <sphereGeometry args={[6, 16, 16]} />
          <meshStandardMaterial 
            color={color} 
            transparent 
            opacity={opacity} 
            emissive={isActive ? color : "black"}
            emissiveIntensity={isActive ? 0.5 : 0}
          />
        </mesh>
        <Billboard>
            <Text 
                fontSize={12} 
                color="black" 
                anchorX="center" 
                anchorY="middle"
                position={[0, 10, 0]}
            >
                {label}
            </Text>
        </Billboard>
    </group>
  );
}
// ----------------------------------------------------------------------
// Weldable Edge Component
// ----------------------------------------------------------------------
function WeldableEdge({ id, start, end, isActive, onClick, mode = 'weld' }: { 
  id: string, 
  start: [number, number, number], 
  end: [number, number, number], 
  isActive: boolean, 
  onClick: (id: string) => void,
  mode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
  const [hovered, setHovered] = React.useState(false);
  
  const s = new THREE.Vector3(...start);
  const e = new THREE.Vector3(...end);
  const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
  const length = s.distanceTo(e);
  
  // Calculate rotation to align box with edge
  const dir = new THREE.Vector3().subVectors(e, s).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  
  let color = "#cbd5e1";
  let opacity = 0.2;
  let scale: [number, number, number] = [1, 1, 1];
  
  if (isActive) {
    opacity = 0.8;
    if (mode === 'weld') color = "#3b82f6";
    else if (mode === 'stitch-short' || mode === 'stitch-long') color = "#6366f1";
    else if (mode === 'spot') color = "#ef4444";
    scale = [1.5, 1, 1.5];
  } else if (hovered) {
    opacity = 0.5;
    color = "#94a3b8";
  }

  return (
    <mesh 
      position={mid} 
      quaternion={quaternion}
      onClick={(ev) => { ev.stopPropagation(); onClick(id); }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      <boxGeometry args={[10, length, 10]} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={opacity} 
        emissive={isActive ? color : "black"}
        emissiveIntensity={isActive ? 0.5 : 0}
      />
      {isActive && (mode === 'stitch-short' || mode === 'stitch-long') && (
        <mesh scale={[1.1, 1, 1.1]}>
          <boxGeometry args={[10, length, 10]} />
          <meshStandardMaterial 
            color="white" 
            wireframe 
            transparent
            opacity={0.5}
          />
          <Line 
            points={[[-5, -length/2, 5], [-5, length/2, 5]]} 
            color="white" 
            lineWidth={3} 
            dashed 
            dashSize={mode === 'stitch-short' ? 20 : 60} 
            gapSize={20} 
          />
        </mesh>
      )}
    </mesh>
  );
}

// Helper to calculate L-Shape nodes
function calculateLShapeNodes(
  width: number,
  height: number,
  depth: number,
  thickness: number,
  cutType: string | undefined,
  invertCuts: boolean | undefined
) {
  const w2 = width / 2;
  const h2 = height / 2;
  const d2 = depth / 2;
  const offset = width; // Miter offset based on width

  // 2D Profile Vertices (at Y=0) - Reduced to 4 key nodes
  // 1. Outer Corner (-x, -z)
  // 2. Tip 1 Outer (+x, -z)
  // 3. Inner Corner (-x+t, -z+t)
  // 4. Tip 2 Outer (-x, +z)
  
  const v2d = [
    { x: -w2, z: -d2 },           // 1. Outer Corner
    { x: w2, z: -d2 },            // 2. Tip 1 Outer
    { x: -w2 + thickness, z: -d2 + thickness }, // 3. Inner Corner
    { x: -w2, z: d2 }             // 4. Tip 2 Outer
  ];

  const nodes: { id: string, pos: number[] }[] = [];

  // Generate nodes for Start (Bottom) and End (Top)
  // Start: Y = -h2
  // End: Y = h2
  
  const ends = [
    { yBase: -h2, suffix: 'start', isStart: true },
    { yBase: h2, suffix: 'end', isStart: false }
  ];

  ends.forEach(end => {
    v2d.forEach((v, idx) => {
      let y = end.yBase;
      
      // Apply Miter Logic (Linear slope on X)
      // If invertCuts: Left (-x) moves UP (+y) relative to Right (+x)
      // If normal: Right (+x) moves UP (+y) relative to Left (-x)
      
      // Calculate normalized X (0 to 1) from Left to Right
      // Left (-w2) -> 0
      // Right (w2) -> 1
      const xNorm = (v.x - (-w2)) / width; 
      
      let yShift = 0;
      
      if (end.isStart) {
        // Bottom cut
        if (cutType === 'miter-start' || cutType === 'miter-both') {
           if (invertCuts) {
             // Left side moves UP (positive shift)
             yShift = offset * (1 - xNorm);
           } else {
             // Right side moves UP
             yShift = offset * xNorm;
           }
        }
      } else {
        // Top cut
        if (cutType === 'miter-end' || cutType === 'miter-both') {
           if (invertCuts) {
             // Left side moves DOWN (negative shift)
             yShift = -offset * (1 - xNorm);
           } else {
             // Right side moves DOWN
             yShift = -offset * xNorm;
           }
        }
      }

      nodes.push({
        id: `node-${end.suffix}-${idx + 1}`,
        pos: [v.x, y + yShift, v.z]
      });
    });
  });

  return nodes;
}

// Helper to calculate U-Profile nodes
function calculateUProfileNodes(
  width: number,
  height: number,
  depth: number,
  thickness: number,
  cutType: string | undefined,
  invertCuts: boolean | undefined
) {
  const w2 = width / 2;
  const h2 = height / 2;
  const d2 = depth / 2;
  const offset = width;

  // U Profile Vertices (at Y=0) - Reduced to 4 key nodes (Outer Corners)
  // 1. Bottom Left (-x, -z)
  // 2. Bottom Right (+x, -z)
  // 3. Top Right (+x, +z)
  // 4. Top Left (-x, +z)

  const v2d = [
    { x: -w2, z: -d2 },   // 1. Bottom Left
    { x: w2, z: -d2 },    // 2. Bottom Right
    { x: w2, z: d2 },     // 3. Top Right
    { x: -w2, z: d2 }     // 4. Top Left
  ];

  const nodes: { id: string, pos: number[] }[] = [];
  
  const ends = [
    { yBase: -h2, suffix: 'start', isStart: true },
    { yBase: h2, suffix: 'end', isStart: false }
  ];

  ends.forEach(end => {
    v2d.forEach((v, idx) => {
      let y = end.yBase;
      const xNorm = (v.x - (-w2)) / width;
      let yShift = 0;

      if (end.isStart) {
        if (cutType === 'miter-start' || cutType === 'miter-both') {
           if (invertCuts) yShift = offset * (1 - xNorm);
           else yShift = offset * xNorm;
        }
      } else {
        if (cutType === 'miter-end' || cutType === 'miter-both') {
           if (invertCuts) yShift = -offset * (1 - xNorm);
           else yShift = -offset * xNorm;
        }
      }

      nodes.push({
        id: `node-${end.suffix}-${idx + 1}`,
        pos: [v.x, y + yShift, v.z]
      });
    });
  });

  return nodes;
}

// Helper to calculate Flat nodes
function calculateFlatNodes(
  width: number,
  height: number,
  thickness: number,
  cutType: string | undefined,
  invertCuts: boolean | undefined,
  miterAxis: 'x' | 'y' = 'x'
) {
  const w2 = width / 2;
  const h2 = height / 2;
  const t2 = thickness / 2;
  
  // Flat Profile Vertices (at Y=0)
  // 1. BL (-x, -z)
  // 2. BR (+x, -z)
  // 3. TR (+x, +z)
  // 4. TL (-x, +z)
  // Note: Here Z is thickness.
  
  const v2d = [
    { x: -w2, z: -t2 }, // 1
    { x: w2, z: -t2 },  // 2
    { x: w2, z: t2 },   // 3
    { x: -w2, z: t2 }   // 4
  ];

  const nodes: { id: string, pos: number[] }[] = [];
  const ends = [
    { yBase: -h2, suffix: 'start', isStart: true },
    { yBase: h2, suffix: 'end', isStart: false }
  ];

  // Offset depends on axis
  // If miterAxis is 'x' (default for Flat), we cut along width. Offset = width.
  // If miterAxis is 'y', we cut along thickness? (uncommon for flat bar miter, usually 'x' means cutting the face)
  // Wait, MiterBox logic:
  // if miterAxis === 'x': "Box panel miter". Recede BACK face.
  // This means the cut slope is along Z (thickness).
  // But Flat component uses `miterAxis={cutType ? 'x' : 'y'}`.
  // If cutType is set, it uses 'x'.
  // So it slopes along Z (thickness).
  
  // Let's re-read MiterBox logic for 'x':
  // v[5][0] += depth; (Left Back X moves)
  // This seems to change X based on Z?
  // "Recede the BACK face".
  // Back face is -Z (or +Z depending on view).
  // If I have a panel, and I miter the edge, I bevel the edge.
  
  // If the user wants a "picture frame" miter on a flat bar (lying flat):
  // The cut is 45 deg across the WIDTH.
  // This corresponds to `miterAxis='y'` in MiterBox logic (slope Y based on X).
  // But `Flat` component sets `miterAxis='x'`.
  // This might be a bug in `Flat` component or my understanding.
  // If `Flat` is standing up (like a skirting board), cutting 45 deg across thickness is a miter.
  
  // Let's assume `miterAxis='y'` (slope Y based on X) is what we want for "frame" miters of flat bars.
  // But if the code uses 'x', I should follow the code's behavior or fix it.
  // The code: `miterAxis={cutType ? 'x' : 'y'}`.
  // If I change it here, I should change it in the component too.
  // For now, let's assume the user wants standard frame miters.
  // Standard frame miter for flat bar = cut across width.
  // This requires Y to change based on X.
  // This is `miterAxis='y'` behavior.
  
  // Let's use the same logic as LShape/UProfile (slope Y based on X) for now, 
  // assuming the flat bar is "width" along X.
  
  const offset = width; // For frame miter

  ends.forEach(end => {
    v2d.forEach((v, idx) => {
      let y = end.yBase;
      const xNorm = (v.x - (-w2)) / width;
      let yShift = 0;

      if (end.isStart) {
        if (cutType === 'miter-start' || cutType === 'miter-both') {
           if (invertCuts) yShift = offset * (1 - xNorm);
           else yShift = offset * xNorm;
        }
      } else {
        if (cutType === 'miter-end' || cutType === 'miter-both') {
           if (invertCuts) yShift = -offset * (1 - xNorm);
           else yShift = -offset * xNorm;
        }
      }

      nodes.push({
        id: `node-${end.suffix}-${idx + 1}`,
        pos: [v.x, y + yShift, v.z]
      });
    });
  });

  return nodes;
}

export function LShape({ 
  part, 
  visibleDimensions, 
  dimensionType = 'external', 
  isUnfolded = false,
  isExploded = false,
  isWeldingMode = false,
  activeWelds = [],
  toggleWeld = () => {},
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode = 'weld'
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions, 
  dimensionType?: 'internal' | 'external' | 'both', 
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
  const { dimW: w, dimH: h, dimD: d = 0, thickness: t, cutType, invertCuts } = part;
  
  // Snap dimensions to 5mm grid
  const sw = snapTo5(w);
  const sh = snapTo5(h); // Length
  const sd = snapTo5(d || w);
  const st = Math.max(2, t); // Real thickness

  const explodedOffset = isExploded ? 50 : 0;

  const nodes = useMemo(() => 
    calculateLShapeNodes(sw, sh, sd, st, cutType, invertCuts),
  [sw, sh, sd, st, cutType, invertCuts]);

  return (
    <group position={[0, explodedOffset, 0]}>
      {/* Leg 1 (Front face) */}
      <group position={[0, 0, -sd/2 + st/2]}>
        <MiterBox 
          width={sw} height={sh} depth={st} 
          cutType={cutType} invertCuts={invertCuts} 
          material={getMaterialForPart(part)} 
          castShadow receiveShadow 
        />
      </group>
      
      {/* Leg 2 (Side face) */}
      <group position={[-sw/2 + st/2, 0, 0]}>
        <MiterBox 
          width={st} height={sh} depth={sd} 
          cutType={cutType} invertCuts={invertCuts} 
          material={getMaterialForPart(part)} 
          castShadow receiveShadow 
        />
      </group>

      {/* Dimensions */}
      {visibleDimensions.width && (
          <DimensionLine start={[-sw/2, sh/2 + 20, -sd/2]} end={[sw/2, sh/2 + 20, -sd/2]} label={`${w}mm`} offset={10} />
      )}
      {visibleDimensions.height && (
          <DimensionLine start={[sw/2 + 20, -sh/2, -sd/2]} end={[sw/2 + 20, sh/2, -sd/2]} label={`${h}mm`} offset={10} />
      )}
      {visibleDimensions.depth && (
          <DimensionLine start={[-sw/2 - 20, sh/2, -sd/2]} end={[-sw/2 - 20, sh/2, sd/2]} label={`${sd}mm`} offset={10} />
      )}

      {/* Label */}
      <Billboard position={[0, sh/2 + 40, 0]}>
          <Text 
              fontSize={20} 
              color="black" 
              anchorX="center" 
              anchorY="middle"
          >
              {part.name} ({part.type})
          </Text>
      </Billboard>

      {/* Welding Edges & Intersections */}
      {isWeldingMode && (
        <group>
           {nodes.map((node, index) => (
              <IntersectionPoint 
                  key={node.id}
                  id={node.id} 
                  position={node.pos as [number, number, number]} 
                  isActive={activeIntersections.includes(node.id)} 
                  onClick={toggleIntersection}
                  baseColor={NODE_COLORS[index % 4]}
              />
          ))}
        </group>
      )}
    </group>
  );
}

export function UProfile({ 
  part, 
  visibleDimensions, 
  dimensionType = 'external', 
  isUnfolded = false,
  isExploded = false,
  isWeldingMode = false,
  activeWelds = [],
  toggleWeld = () => {},
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode = 'weld'
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions, 
  dimensionType?: 'internal' | 'external' | 'both', 
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: w, dimH: h, dimD: d = 0, thickness: t, cutType, invertCuts } = part;
    
    // Snap dimensions to 5mm grid
    const sw = snapTo5(w);
    const sh = snapTo5(h); // Length
    const sd = snapTo5(d || w);
    const st = Math.max(2, t);

    const explodedOffset = isExploded ? 50 : 0;

    const nodes = useMemo(() => 
      calculateUProfileNodes(sw, sh, sd, st, cutType, invertCuts),
    [sw, sh, sd, st, cutType, invertCuts]);

    return (
        <group position={[0, explodedOffset, 0]}>
            {/* Base (Back face) */}
            <group position={[0, 0, -sd/2 + st/2]}>
                <MiterBox 
                  width={sw} height={sh} depth={st} 
                  cutType={cutType} invertCuts={invertCuts} 
                  material={getMaterialForPart(part)} 
                  castShadow receiveShadow 
                />
            </group>

            {/* Flange 1 (Left side) */}
            <group position={[-sw/2 + st/2, 0, 0]}>
                <MiterBox 
                  width={st} height={sh} depth={sd} 
                  cutType={cutType} invertCuts={invertCuts} 
                  material={getMaterialForPart(part)} 
                  castShadow receiveShadow 
                />
            </group>

            {/* Flange 2 (Right side) */}
            <group position={[sw/2 - st/2, 0, 0]}>
                <MiterBox 
                  width={st} height={sh} depth={sd} 
                  cutType={cutType} invertCuts={invertCuts} 
                  material={getMaterialForPart(part)} 
                  castShadow receiveShadow 
                />
            </group>

            {/* Dimensions */}
            {visibleDimensions.width && (
                <DimensionLine start={[-sw/2, sh/2 + 20, -sd/2]} end={[sw/2, sh/2 + 20, -sd/2]} label={`${w}mm`} offset={10} />
            )}
            {visibleDimensions.height && (
                <DimensionLine start={[sw/2 + 20, -sh/2, -sd/2]} end={[sw/2 + 20, sh/2, -sd/2]} label={`${h}mm`} offset={10} />
            )}
            {visibleDimensions.depth && (
                <DimensionLine start={[-sw/2 - 20, sh/2, -sd/2]} end={[-sw/2 - 20, sh/2, sd/2]} label={`${sd}mm`} offset={10} />
            )}

            {/* Label */}
            <Billboard position={[0, sh/2 + 40, 0]}>
                <Text 
                    fontSize={20} 
                    color="black" 
                    anchorX="center" 
                    anchorY="middle"
                >
                    {part.name} ({part.type})
                </Text>
            </Billboard>

            {/* Welding Edges & Intersections */}
            {isWeldingMode && (
              <group>
                {nodes.map((node, index) => (
                    <IntersectionPoint 
                        key={node.id}
                        id={node.id} 
                        position={node.pos as [number, number, number]} 
                        isActive={activeIntersections.includes(node.id)} 
                        onClick={toggleIntersection}
                        baseColor={NODE_COLORS[index % 4]}
                    />
                ))}
              </group>
            )}
        </group>
    );
}

export function Flat({ 
  part, 
  visibleDimensions, 
  dimensionType,
  isExploded = false,
  isWeldingMode = false,
  activeWelds = [],
  toggleWeld = () => {},
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode = 'weld'
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions, 
  dimensionType?: 'internal' | 'external' | 'both',
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: w, dimH: h, thickness: t, cutType, invertCuts } = part;
    const sw = snapTo5(w);
    const sh = snapTo5(h);
    const st = Math.max(1, t); // Use actual thickness, min 1mm
    
    const explodedOffset = isExploded ? 50 : 0;

    const nodes = useMemo(() => 
      calculateFlatNodes(sw, sh, st, cutType, invertCuts),
    [sw, sh, st, cutType, invertCuts]);
    
    return (
        <group position={[0, explodedOffset, 0]}>
            <MiterBox 
              width={sw} height={sh} depth={st} 
              cutType={cutType} invertCuts={invertCuts} 
              miterAxis={cutType ? 'x' : 'y'}
              material={getMaterialForPart(part)} 
              castShadow receiveShadow 
            />
            
             {/* Dimensions */}
            {visibleDimensions.width && (
                <DimensionLine start={[-w/2, -h/2 - 10, 0]} end={[w/2, -h/2 - 10, 0]} label={`${w}mm`} offset={10} />
            )}
            {visibleDimensions.height && (
                <>
                    <DimensionLine start={[w/2 + 10, -h/2, 0]} end={[w/2 + 10, h/2, 0]} label={`${h}mm`} offset={10} />
                    <DimensionLine start={[-w/2 - 10, -h/2, 0]} end={[-w/2 - 10, h/2, 0]} label={`${h}mm`} offset={-10} />
                </>
            )}

            {/* Label */}
            <Billboard position={[0, h/2 + 40, 0]}>
                <Text 
                    fontSize={20} 
                    color="black" 
                    anchorX="center" 
                    anchorY="middle"
                >
                    {part.name} ({part.type})
                </Text>
            </Billboard>

            {/* Welding Edges & Intersections */}
            {isWeldingMode && (
              <group>
                <WeldableEdge id="edge-1" start={[-w/2, h/2, st/2]} end={[w/2, h/2, st/2]} isActive={activeWelds.includes('edge-1')} onClick={toggleWeld} mode={weldMode} />
                <WeldableEdge id="edge-2" start={[-w/2, -h/2, st/2]} end={[w/2, -h/2, st/2]} isActive={activeWelds.includes('edge-2')} onClick={toggleWeld} mode={weldMode} />
                <WeldableEdge id="edge-3" start={[-w/2, -h/2, st/2]} end={[-w/2, h/2, st/2]} isActive={activeWelds.includes('edge-3')} onClick={toggleWeld} mode={weldMode} />
                <WeldableEdge id="edge-4" start={[w/2, -h/2, st/2]} end={[w/2, h/2, st/2]} isActive={activeWelds.includes('edge-4')} onClick={toggleWeld} mode={weldMode} />
                
                {/* Intersections at corners */}
                {nodes.map((node, index) => (
                    <IntersectionPoint 
                        key={node.id}
                        id={node.id} 
                        position={node.pos as [number, number, number]} 
                        isActive={activeIntersections.includes(node.id)} 
                        onClick={toggleIntersection}
                        baseColor={NODE_COLORS[index % 4]}
                    />
                ))}
              </group>
            )}
        </group>
    );
}

export function Trapezoid({ 
  part, 
  visibleDimensions, 
  dimensionType, 
  isUnfolded = false,
  isExploded = false,
  isWeldingMode = false,
  activeWelds = [],
  toggleWeld = () => {},
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode = 'weld'
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions, 
  dimensionType?: 'internal' | 'external' | 'both', 
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: w, dimH: h, thickness: t, details } = part;
    const topW = snapTo5(details?.top || w);
    const bottomW = snapTo5(details?.bottom || w);
    const sh = snapTo5(h);
    const st = Math.max(5, snapTo5(t));

    const shape = useMemo(() => {
        const s = new THREE.Shape();
        s.moveTo(-topW/2, sh/2);              // Top-Left
        s.lineTo(topW/2, sh/2);               // Top-Right
        s.lineTo(bottomW/2, -sh/2);           // Bottom-Right
        s.lineTo(-bottomW/2, -sh/2);          // Bottom-Left
        s.closePath();
        return s;
    }, [sh, topW, bottomW]);
    
    const explodedOffset = isExploded ? 50 : 0;

    return (
        <group position={[0, explodedOffset, 0]}>
            <mesh castShadow receiveShadow material={getMaterialForPart(part)}>
                <extrudeGeometry args={[shape, { depth: st, bevelEnabled: false }]} />
            </mesh>
            
            {visibleDimensions.width && (
                <>
                    <DimensionLine start={[-topW/2, h/2 + 20, 0]} end={[topW/2, h/2 + 20, 0]} label={`${topW}mm`} offset={10} />
                    <DimensionLine start={[-bottomW/2, -h/2 - 20, 0]} end={[bottomW/2, -h/2 - 20, 0]} label={`${bottomW}mm`} offset={10} />
                </>
            )}
            {visibleDimensions.height && (
                <DimensionLine start={[-Math.max(topW, bottomW)/2 - 20, -h/2, 0]} end={[-Math.max(topW, bottomW)/2 - 20, h/2, 0]} label={`${h}mm`} offset={-10} />
            )}

            {/* Welding Edges & Intersections */}
            {isWeldingMode && (
              <group>
                <WeldableEdge id="edge-1" start={[-topW/2, h/2, t]} end={[topW/2, h/2, t]} isActive={activeWelds.includes('edge-1')} onClick={toggleWeld} mode={weldMode} />
                <WeldableEdge id="edge-2" start={[-bottomW/2, -h/2, t]} end={[bottomW/2, -h/2, t]} isActive={activeWelds.includes('edge-2')} onClick={toggleWeld} mode={weldMode} />
                <WeldableEdge id="edge-3" start={[-topW/2, h/2, t]} end={[-bottomW/2, -h/2, t]} isActive={activeWelds.includes('edge-3')} onClick={toggleWeld} mode={weldMode} />
                <WeldableEdge id="edge-4" start={[topW/2, h/2, t]} end={[bottomW/2, -h/2, t]} isActive={activeWelds.includes('edge-4')} onClick={toggleWeld} mode={weldMode} />
                
                {/* Intersections at corners (Front Face Z+) */}
                <IntersectionPoint id="int-1-front" position={[-topW/2, h/2, t/2]} isActive={activeIntersections.includes('int-1-front')} onClick={toggleIntersection} baseColor={NODE_COLORS[0]} />
                <IntersectionPoint id="int-2-front" position={[topW/2, h/2, t/2]} isActive={activeIntersections.includes('int-2-front')} onClick={toggleIntersection} baseColor={NODE_COLORS[1]} />
                <IntersectionPoint id="int-3-front" position={[bottomW/2, -h/2, t/2]} isActive={activeIntersections.includes('int-3-front')} onClick={toggleIntersection} baseColor={NODE_COLORS[2]} />
                <IntersectionPoint id="int-4-front" position={[-bottomW/2, -h/2, t/2]} isActive={activeIntersections.includes('int-4-front')} onClick={toggleIntersection} baseColor={NODE_COLORS[3]} />

                {/* Intersections at corners (Back Face Z-) */}
                <IntersectionPoint id="int-1-back" position={[-topW/2, h/2, -t/2]} isActive={activeIntersections.includes('int-1-back')} onClick={toggleIntersection} baseColor={NODE_COLORS[0]} />
                <IntersectionPoint id="int-2-back" position={[topW/2, h/2, -t/2]} isActive={activeIntersections.includes('int-2-back')} onClick={toggleIntersection} baseColor={NODE_COLORS[1]} />
                <IntersectionPoint id="int-3-back" position={[bottomW/2, -h/2, -t/2]} isActive={activeIntersections.includes('int-3-back')} onClick={toggleIntersection} baseColor={NODE_COLORS[2]} />
                <IntersectionPoint id="int-4-back" position={[-bottomW/2, -h/2, -t/2]} isActive={activeIntersections.includes('int-4-back')} onClick={toggleIntersection} baseColor={NODE_COLORS[3]} />
              </group>
            )}
        </group>
    );
}

export function Bent({ 
  part, 
  visibleDimensions, 
  dimensionType = 'external', 
  isUnfolded = false,
  isExploded = false,
  isWeldingMode = false,
  activeWelds = [],
  toggleWeld = () => {},
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode = 'weld'
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions, 
  dimensionType?: 'internal' | 'external' | 'both', 
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: w, dimH: h, dimD: d = 0, thickness: t } = part;
    const sw = snapTo5(w);
    const sh = snapTo5(h);
    const sd = snapTo5(d);
    const st = Math.max(5, snapTo5(t));
    
    const showExt = dimensionType === 'external' || dimensionType === 'both';
    const showInt = dimensionType === 'internal' || dimensionType === 'both';
    
    const explodedOffset = isExploded ? 50 : 0;

    return (
        <group position={[0, explodedOffset, 0]}>
            {/* Base Plate */}
            <mesh material={getMaterialForPart(part)} castShadow receiveShadow>
                <boxGeometry args={[sw, sh, st]} />
            </mesh>

            {/* Top Flange */}
            <group position={[0, sh/2 - st/2, isUnfolded ? 0 : st/2]}>
                <mesh material={getMaterialForPart(part)} position={[0, isUnfolded ? sd/2 + st/2 : 0, isUnfolded ? 0 : sd/2]} rotation={[isUnfolded ? 0 : -Math.PI/2, 0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[sw, sd, st]} />
                </mesh>
            </group>

            {/* Bottom Flange */}
            <group position={[0, -sh/2 + st/2, isUnfolded ? 0 : st/2]}>
                <mesh material={getMaterialForPart(part)} position={[0, isUnfolded ? -sd/2 - st/2 : 0, isUnfolded ? 0 : sd/2]} rotation={[isUnfolded ? 0 : Math.PI/2, 0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[sw, sd, st]} />
                </mesh>
            </group>

            {/* Right Flange */}
            <group position={[sw/2 - st/2, 0, isUnfolded ? 0 : st/2]}>
                 <mesh material={getMaterialForPart(part)} position={[isUnfolded ? sd/2 + st/2 : 0, 0, isUnfolded ? 0 : sd/2]} rotation={[0, isUnfolded ? 0 : -Math.PI/2, isUnfolded ? 0 : -Math.PI/2]} castShadow receiveShadow>
                    <boxGeometry args={[isUnfolded ? sd : sh - 2*st, isUnfolded ? sh : sd, st]} /> 
                </mesh>
            </group>

            {/* Left Flange */}
            <group position={[-sw/2 + st/2, 0, isUnfolded ? 0 : st/2]}>
                 <mesh material={getMaterialForPart(part)} position={[isUnfolded ? -sd/2 - st/2 : 0, 0, isUnfolded ? 0 : sd/2]} rotation={[0, isUnfolded ? 0 : Math.PI/2, isUnfolded ? 0 : Math.PI/2]} castShadow receiveShadow>
                    <boxGeometry args={[isUnfolded ? sd : sh - 2*st, isUnfolded ? sh : sd, st]} /> 
                </mesh>
            </group>

            {/* Bend Lines */}
            {isUnfolded && (
                <>
                    <Line points={[[-w/2, h/2, t/2 + 0.5], [w/2, h/2, t/2 + 0.5]]} color="#ef4444" lineWidth={2} dashed dashSize={10} gapSize={5} />
                    <Line points={[[-w/2, -h/2, t/2 + 0.5], [w/2, -h/2, t/2 + 0.5]]} color="#ef4444" lineWidth={2} dashed dashSize={10} gapSize={5} />
                    <Line points={[[w/2, -h/2, t/2 + 0.5], [w/2, h/2, t/2 + 0.5]]} color="#ef4444" lineWidth={2} dashed dashSize={10} gapSize={5} />
                    <Line points={[[-w/2, -h/2, t/2 + 0.5], [-w/2, h/2, t/2 + 0.5]]} color="#ef4444" lineWidth={2} dashed dashSize={10} gapSize={5} />
                </>
            )}

            {/* Dimensions */}
            {visibleDimensions.width && (
                <DimensionLine start={[-w/2, -h/2 - 20, 0]} end={[w/2, -h/2 - 20, 0]} label={`${w}mm`} offset={10} />
            )}
            {visibleDimensions.height && (
                <>
                    {showExt && (
                        <>
                            <DimensionLine start={[-w/2 - 20, -h/2, 0]} end={[-w/2 - 20, h/2, 0]} label={`${h}mm`} offset={-10} />
                            <DimensionLine start={[w/2 + 20, -h/2, 0]} end={[w/2 + 20, h/2, 0]} label={`${h}mm`} offset={10} />
                        </>
                    )}
                    {showInt && (
                        <DimensionLine start={[w/2 + 40, -h/2 + t, 0]} end={[w/2 + 40, h/2 - t, 0]} label={`${(h - 2*t).toFixed(1)}mm`} offset={10} color="#2563eb" />
                    )}
                </>
            )}
            {visibleDimensions.depth && (
                <>
                    {showExt && (
                        <>
                            <DimensionLine start={[w/2 + 10, h/2, 0]} end={[w/2 + 10, h/2, d]} label={`${d}mm`} offset={20} />
                            <DimensionLine start={[-w/2 - 10, h/2, 0]} end={[-w/2 - 10, h/2, d]} label={`${d}mm`} offset={20} />
                        </>
                    )}
                    {showInt && (
                        <DimensionLine start={[w/2 + 30, h/2 - t, t/2]} end={[w/2 + 30, h/2 - t, t/2 + d - t]} label={`${(d - t).toFixed(1)}mm`} offset={20} color="#2563eb" />
                    )}
                </>
            )}

            {/* Welding Edges & Intersections */}
            {isWeldingMode && (
              <group>
                <WeldableEdge id="edge-1" start={[-w/2, h/2, t/2]} end={[w/2, h/2, t/2]} isActive={activeWelds.includes('edge-1')} onClick={toggleWeld} mode={weldMode} />
                <WeldableEdge id="edge-2" start={[-w/2, -h/2, t/2]} end={[w/2, -h/2, t/2]} isActive={activeWelds.includes('edge-2')} onClick={toggleWeld} mode={weldMode} />
                
                {/* Intersections at corners */}
                <IntersectionPoint id="int-1" position={[-w/2, h/2, t/2 + 5]} isActive={activeIntersections.includes('int-1')} onClick={toggleIntersection} baseColor={NODE_COLORS[0]} />
                <IntersectionPoint id="int-2" position={[w/2, h/2, t/2 + 5]} isActive={activeIntersections.includes('int-2')} onClick={toggleIntersection} baseColor={NODE_COLORS[1]} />
                <IntersectionPoint id="int-3" position={[w/2, -h/2, t/2 + 5]} isActive={activeIntersections.includes('int-3')} onClick={toggleIntersection} baseColor={NODE_COLORS[2]} />
                <IntersectionPoint id="int-4" position={[-w/2, -h/2, t/2 + 5]} isActive={activeIntersections.includes('int-4')} onClick={toggleIntersection} baseColor={NODE_COLORS[3]} />
                
                {/* Flange corners */}
                <IntersectionPoint id="int-5" position={[-w/2, h/2, t/2 + d + 5]} isActive={activeIntersections.includes('int-5')} onClick={toggleIntersection} baseColor={NODE_COLORS[0]} />
                <IntersectionPoint id="int-6" position={[w/2, h/2, t/2 + d + 5]} isActive={activeIntersections.includes('int-6')} onClick={toggleIntersection} baseColor={NODE_COLORS[1]} />
                <IntersectionPoint id="int-7" position={[-w/2, -h/2, t/2 + d + 5]} isActive={activeIntersections.includes('int-7')} onClick={toggleIntersection} baseColor={NODE_COLORS[2]} />
                <IntersectionPoint id="int-8" position={[w/2, -h/2, t/2 + d + 5]} isActive={activeIntersections.includes('int-8')} onClick={toggleIntersection} baseColor={NODE_COLORS[3]} />
              </group>
            )}
        </group>
    );
}

function MiterBox({ width, height, depth, cutType, material, castShadow, receiveShadow, invertCuts = false, miterAxis = 'y' }: any) {
  const geometry = useMemo(() => {
    const w2 = width / 2;
    const h2 = height / 2;
    const d2 = depth / 2;

    // Vertices for 8 corners
    // 0: BL Front, 1: BR Front, 2: TR Front, 3: TL Front
    // 4: BR Back, 5: BL Back, 6: TL Back, 7: TR Back
    
    let v = [
      [-w2, -h2, d2], [w2, -h2, d2], [w2, h2, d2], [-w2, h2, d2], // Front
      [w2, -h2, -d2], [-w2, -h2, -d2], [-w2, h2, -d2], [w2, h2, -d2] // Back
    ];

    const offset = miterAxis === 'y' ? width : depth;

    if (miterAxis === 'y') {
      // Frame miter (top/bottom ends)
      if (cutType === 'miter-start' || cutType === 'miter-both') {
        if (invertCuts) { v[0][1] += offset; v[5][1] += offset; } 
        else { v[1][1] += offset; v[4][1] += offset; }
      }
      if (cutType === 'miter-end' || cutType === 'miter-both') {
        if (invertCuts) { v[3][1] -= offset; v[6][1] -= offset; }
        else { v[2][1] -= offset; v[7][1] -= offset; }
      }
    } else if (miterAxis === 'x') {
      // Box panel miter (left/right edges)
      // We recede the BACK face to create the 45 deg angle through thickness
      if (cutType === 'miter-start' || cutType === 'miter-both') {
        // Left edge
        v[5][0] += depth; v[6][0] += depth;
      }
      if (cutType === 'miter-end' || cutType === 'miter-both') {
        // Right edge
        v[4][0] -= depth; v[7][0] -= depth;
      }
    }

    // Flatten vertices for BufferGeometry
    const v_front = [...v[0], ...v[1], ...v[2], ...v[3]];
    const v_back = [...v[4], ...v[5], ...v[6], ...v[7]];
    const v_top = [...v[3], ...v[2], ...v[7], ...v[6]];
    const v_bottom = [...v[0], ...v[5], ...v[4], ...v[1]];
    const v_left = [...v[5], ...v[0], ...v[3], ...v[6]];
    const v_right = [...v[1], ...v[4], ...v[7], ...v[2]];

    const vertices = new Float32Array([
        ...v_front, ...v_back, ...v_top, ...v_bottom, ...v_left, ...v_right
    ]);
    
    const indices = [
        0, 1, 2, 0, 2, 3, // Front
        4, 5, 6, 4, 6, 7, // Back
        8, 9, 10, 8, 10, 11, // Top
        12, 13, 14, 12, 14, 15, // Bottom
        16, 17, 18, 16, 18, 19, // Left
        20, 21, 22, 20, 22, 23  // Right
    ];
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    
    return geom;
  }, [width, height, depth, cutType, invertCuts, miterAxis]);

  return (
    <mesh geometry={geometry} material={material} castShadow={castShadow} receiveShadow={receiveShadow} />
  );
}

// Helper to calculate Round Tube nodes (4 quadrants)
function calculateRoundTubeNodes(
  diameter: number,
  length: number,
  cutType: string | undefined,
  invertCuts: boolean | undefined
) {
  const r = diameter / 2;
  const h2 = length / 2;
  const offset = diameter; // Miter offset based on diameter

  // 4 Quadrants at Y=0
  // 1. Left (-x)
  // 2. Right (+x)
  // 3. Top (+z) - Note: In our coordinate system, Y is length. Z is depth.
  // 4. Bottom (-z)
  
  const v2d = [
    { x: -r, z: 0 }, // Left
    { x: r, z: 0 },  // Right
    { x: 0, z: r },  // Front/Top (depending on view)
    { x: 0, z: -r }  // Back/Bottom
  ];

  const nodes: { id: string, pos: number[] }[] = [];
  const ends = [
    { yBase: -h2, suffix: 'start', isStart: true },
    { yBase: h2, suffix: 'end', isStart: false }
  ];

  ends.forEach(end => {
    v2d.forEach((v, idx) => {
      let y = end.yBase;
      const xNorm = (v.x - (-r)) / diameter; // 0 to 1
      let yShift = 0;

      if (end.isStart) {
        if (cutType === 'miter-start' || cutType === 'miter-both') {
           if (invertCuts) yShift = offset * (1 - xNorm);
           else yShift = offset * xNorm;
        }
      } else {
        if (cutType === 'miter-end' || cutType === 'miter-both') {
           if (invertCuts) yShift = -offset * (1 - xNorm);
           else yShift = -offset * xNorm;
        }
      }

      nodes.push({
        id: `node-${end.suffix}-${idx + 1}`,
        pos: [v.x, y + yShift, v.z]
      });
    });
  });

  return nodes;
}

export function RoundTube({ 
  part, 
  visibleDimensions,
  dimensionType,
  isUnfolded,
  isWeldingMode,
  activeWelds,
  toggleWeld,
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode,
  isExploded
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions,
  dimensionType?: 'internal' | 'external' | 'both',
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: diameter, dimH: length, cutType, invertCuts } = part;
    const sd = snapTo5(diameter);
    const sl = snapTo5(length);
    const explodedOffset = isExploded ? 50 : 0;

    const nodes = useMemo(() => 
      calculateRoundTubeNodes(sd, sl, cutType, invertCuts),
    [sd, sl, cutType, invertCuts]);

    return (
        <group position={[0, explodedOffset, 0]}>
            <mesh material={getMaterialForPart(part)} castShadow receiveShadow>
                <cylinderGeometry args={[sd/2, sd/2, sl, 32]} />
            </mesh>
            {visibleDimensions.width && (
                <DimensionLine start={[-diameter/2, length/2, 0]} end={[diameter/2, length/2, 0]} label={`Ø${diameter}mm`} offset={10} />
            )}
            {visibleDimensions.height && (
                <DimensionLine start={[diameter/2 + 10, -length/2, 0]} end={[diameter/2 + 10, length/2, 0]} label={`${length}mm`} offset={10} />
            )}

            {/* Welding Nodes */}
            {isWeldingMode && (
                <group>
                    {nodes.map((node, index) => (
                        <IntersectionPoint 
                            key={node.id}
                            id={node.id} 
                            position={node.pos as [number, number, number]} 
                            isActive={activeIntersections.includes(node.id)} 
                            onClick={toggleIntersection}
                            baseColor={NODE_COLORS[index % 4]}
                        />
                    ))}
                </group>
            )}
        </group>
    );
}

// Helper to calculate tube nodes (corners) based on cuts
function calculateTubeNodes(
  width: number,
  height: number, // Length
  depth: number,
  cutType: string | undefined,
  invertCuts: boolean | undefined
) {
  const w2 = width / 2;
  const h2 = height / 2;
  const d2 = depth / 2;
  const offset = width; // MiterBox defaults to 'y' axis miter using width as offset

  // Base coordinates
  // Bottom (Start) - Indices match MiterBox vertices logic
  // 0: BL Front, 1: BR Front, 4: BR Back, 5: BL Back
  let n1 = [-w2, -h2, d2];  // BL Front
  let n2 = [w2, -h2, d2];   // BR Front
  let n3 = [w2, -h2, -d2];  // BR Back
  let n4 = [-w2, -h2, -d2]; // BL Back

  // Top (End)
  // 3: TL Front, 2: TR Front, 7: TR Back, 6: TL Back
  let n5 = [-w2, h2, d2];   // TL Front
  let n6 = [w2, h2, d2];    // TR Front
  let n7 = [w2, h2, -d2];   // TR Back
  let n8 = [-w2, h2, -d2];  // TL Back

  // Apply Miter Logic (matching MiterBox)
  if (cutType === 'miter-start' || cutType === 'miter-both') {
    if (invertCuts) {
       // Invert: Left side moves up
       n1[1] += offset; // BL Front
       n4[1] += offset; // BL Back
    } else {
       // Normal: Right side moves up
       n2[1] += offset; // BR Front
       n3[1] += offset; // BR Back
    }
  }

  if (cutType === 'miter-end' || cutType === 'miter-both') {
    if (invertCuts) {
       // Invert: Left side moves down
       n5[1] -= offset; // TL Front
       n8[1] -= offset; // TL Back
    } else {
       // Normal: Right side moves down
       n6[1] -= offset; // TR Front
       n7[1] -= offset; // TR Back
    }
  }

  return [
    { id: 'node-1', pos: n1 },
    { id: 'node-2', pos: n2 },
    { id: 'node-3', pos: n3 },
    { id: 'node-4', pos: n4 },
    { id: 'node-5', pos: n5 },
    { id: 'node-6', pos: n6 },
    { id: 'node-7', pos: n7 },
    { id: 'node-8', pos: n8 }
  ];
}

export function SquareTube({ 
  part, 
  visibleDimensions,
  dimensionType,
  isUnfolded,
  isWeldingMode,
  activeWelds,
  toggleWeld,
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode,
  isExploded
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions,
  dimensionType?: 'internal' | 'external' | 'both',
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: size, dimH: length, cutType, invertCuts } = part;
    const ss = snapTo5(size);
    const sl = snapTo5(length);
    const explodedOffset = isExploded ? 50 : 0;

    const nodes = useMemo(() => 
        calculateTubeNodes(ss, sl, ss, cutType, invertCuts),
    [ss, sl, cutType, invertCuts]);

    return (
        <group position={[0, explodedOffset, 0]}>
            <MiterBox width={ss} height={sl} depth={ss} cutType={cutType} invertCuts={invertCuts} material={getMaterialForPart(part)} castShadow receiveShadow />
            {visibleDimensions.width && (
                <DimensionLine start={[-size/2, length/2, ss/2]} end={[size/2, length/2, ss/2]} label={`${size}mm`} offset={10} />
            )}
            {visibleDimensions.height && (
                <DimensionLine start={[size/2 + 10, -length/2, 0]} end={[size/2 + 10, length/2, 0]} label={`${length}mm`} offset={10} />
            )}

            {/* Welding Nodes */}
            {isWeldingMode && (
                <group>
                    {nodes.map((node, index) => (
                        <IntersectionPoint 
                            key={node.id}
                            id={node.id} 
                            position={node.pos as [number, number, number]} 
                            isActive={activeIntersections.includes(node.id)} 
                            onClick={toggleIntersection}
                            baseColor={NODE_COLORS[index % 4]}
                        />
                    ))}
                </group>
            )}
        </group>
    );
}

export function RectangularTube({ 
  part, 
  visibleDimensions,
  dimensionType,
  isUnfolded,
  isWeldingMode,
  activeWelds,
  toggleWeld,
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode,
  isExploded
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions,
  dimensionType?: 'internal' | 'external' | 'both',
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: w, dimH: length, dimD: d = 0, cutType, invertCuts } = part;
    const sw = snapTo5(w);
    const sl = snapTo5(length);
    const sd = snapTo5(d || w);
    const explodedOffset = isExploded ? 50 : 0;

    const nodes = useMemo(() => 
        calculateTubeNodes(sw, sl, sd, cutType, invertCuts),
    [sw, sl, sd, cutType, invertCuts]);

    return (
        <group position={[0, explodedOffset, 0]}>
            <MiterBox width={sw} height={sl} depth={sd} cutType={cutType} invertCuts={invertCuts} material={getMaterialForPart(part)} castShadow receiveShadow />
            {visibleDimensions.width && (
                <DimensionLine start={[-w/2, length/2, sd/2]} end={[w/2, length/2, sd/2]} label={`${w}mm`} offset={10} />
            )}
            {visibleDimensions.height && (
                <DimensionLine start={[w/2 + 10, -length/2, 0]} end={[w/2 + 10, length/2, 0]} label={`${length}mm`} offset={10} />
            )}
            {visibleDimensions.depth && (
                <DimensionLine start={[w/2, length/2, -sd/2]} end={[w/2, length/2, sd/2]} label={`${sd}mm`} offset={10} />
            )}

            {/* Welding Nodes */}
            {isWeldingMode && (
                <group>
                    {nodes.map((node, index) => (
                        <IntersectionPoint 
                            key={node.id}
                            id={node.id} 
                            position={node.pos as [number, number, number]} 
                            isActive={activeIntersections.includes(node.id)} 
                            onClick={toggleIntersection}
                            baseColor={NODE_COLORS[index % 4]}
                        />
                    ))}
                </group>
            )}
        </group>
    );
}

export function Hinge({ 
  part, 
  visibleDimensions,
  dimensionType,
  isUnfolded,
  isWeldingMode,
  activeWelds,
  toggleWeld,
  activeIntersections,
  toggleIntersection,
  weldMode,
  isExploded
}: { 
  part: PartData, 
  visibleDimensions?: VisibleDimensions,
  dimensionType?: 'internal' | 'external' | 'both',
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const { dimW: diameter, dimH: length } = part;
    const sd = snapTo5(diameter);
    const sl = snapTo5(length);
    return (
        <group>
            <mesh material={getMaterialForPart(part)} position={[0, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[sd/2, sd/2, sl, 16]} />
            </mesh>
            <mesh material={getMaterialForPart(part)} position={[sd/2, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[sd, sl, 5]} />
            </mesh>
        </group>
    );
}

export function Parametric({ 
  part
}: { 
  part: PartData
}) {
    const { dimW: w, dimH: h, dimD: d = 0 } = part;
    const sw = snapTo5(w);
    const sh = snapTo5(h);
    const sd = snapTo5(d);
    return (
        <group>
            <mesh material={getMaterialForPart(part)} castShadow receiveShadow>
                <boxGeometry args={[sw, sh, sd]} />
            </mesh>
            {/* Placeholder for parametric details */}
            <Billboard position={[0, sh/2 + 20, 0]}>
                <Text fontSize={10} color="black">Parametric: {part.name}</Text>
            </Billboard>
        </group>
    );
}

function WeldVisual({ weld }: { weld: any }) {
  const color = weld.type === 'spot' ? '#f59e0b' : '#ef4444';
  const size = weld.type === 'spot' ? 5 : 8;
  
  return (
    <mesh position={[weld.position.x, weld.position.y, weld.position.z]}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

function LevelingFoot({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Threaded rod */}
      <mesh position={[0, -10, 0]}>
        <cylinderGeometry args={[4, 4, 20, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Base */}
      <mesh position={[0, -22, 0]}>
        <cylinderGeometry args={[15, 15, 5, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Rubber pad */}
      <mesh position={[0, -25, 0]}>
        <cylinderGeometry args={[15, 15, 1, 32]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

function PartModel({  
  part, 
  visibleDimensions, 
  dimensionType = 'external', 
  isUnfolded = false,
  isExploded = false,
  isWeldingMode = false,
  activeWelds = [],
  toggleWeld = () => {},
  activeIntersections = [],
  toggleIntersection = () => {},
  weldMode = 'weld'
}: { 
  part: PartData, 
  visibleDimensions: VisibleDimensions, 
  dimensionType?: 'internal' | 'external' | 'both', 
  isUnfolded?: boolean,
  isExploded?: boolean,
  isWeldingMode?: boolean,
  activeWelds?: string[],
  toggleWeld?: (id: string) => void,
  activeIntersections?: string[],
  toggleIntersection?: (id: string) => void,
  weldMode?: 'weld' | 'stitch-short' | 'stitch-long' | 'spot'
}) {
    const renderPart = () => {
        switch (part.type) {
            case 'L-Shape': return <LShape part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'U-Profile': return <UProfile part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'Flat': return <Flat part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'Trapezoid': return <Trapezoid part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'Bent': return <Bent part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'RoundTube': return <RoundTube part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'SquareTube': return <SquareTube part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'RectangularTube': return <RectangularTube part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'Profile': return <UProfile part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />; // Fallback to UProfile
            case 'Hinge': return <Hinge part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isUnfolded={isUnfolded} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
            case 'Parametric': return <Parametric part={part} />;
            default: return <Flat part={part} visibleDimensions={visibleDimensions} dimensionType={dimensionType} isExploded={isExploded} isWeldingMode={isWeldingMode} activeWelds={activeWelds} toggleWeld={toggleWeld} activeIntersections={activeIntersections} toggleIntersection={toggleIntersection} weldMode={weldMode} />;
        }
    };

    return (
        <group>
            {renderPart()}
            {part.welds?.map((w, idx) => (
                <WeldVisual key={idx} weld={w} />
            ))}
            {isLeg(part) && <LevelingFoot position={[0, -snapTo5(part.dimH)/2, 0]} />}
        </group>
    );
}

function ControlsHandler({ interactionMode, onInteractionModeChange }: { interactionMode: 'rotate' | 'pan', onInteractionModeChange?: (mode: 'rotate' | 'pan') => void }) {
    const { gl } = useThree();
    
    useEffect(() => {
        let downTime = 0;
        
        const handleDown = (e: PointerEvent) => {
            if (e.button === 1) { // Middle button
                downTime = Date.now();
            }
        };
        
        const handleUp = (e: PointerEvent) => {
            if (e.button === 1) {
                const elapsed = Date.now() - downTime;
                if (elapsed < 200 && onInteractionModeChange) {
                    // Short click: toggle mode
                    onInteractionModeChange(interactionMode === 'rotate' ? 'pan' : 'rotate');
                }
            }
        };
        
        const domElement = gl.domElement;
        domElement.addEventListener('pointerdown', handleDown);
        domElement.addEventListener('pointerup', handleUp);
        
        return () => {
            domElement.removeEventListener('pointerdown', handleDown);
            domElement.removeEventListener('pointerup', handleUp);
        };
    }, [gl, interactionMode, onInteractionModeChange]);
    
    return null;
}

export default function Part3DViewer({ 
    part, 
    interactionMode = 'rotate', 
    onInteractionModeChange,
    visibleDimensions = { width: true, height: true, depth: true, thickness: false, angles: true },
    dimensionType = 'external',
    isUnfolded = false,
    isExploded = false,
    isWeldingMode = false,
    activeWelds = [],
    toggleWeld = () => {},
    activeIntersections = [],
    toggleIntersection = () => {},
    weldMode = 'weld'
}: Part3DViewerProps) {
  
  useEffect(() => {
    console.log("Part3DViewer rendering part:", part);
  }, [part]);
  
  // Configure mouse buttons based on interaction mode
  const mouseButtons = useMemo(() => {
      return {
          LEFT: interactionMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: interactionMode === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN, // Swap action for Middle Button
          RIGHT: THREE.MOUSE.ROTATE // Right click rotates as backup
      }
  }, [interactionMode]);

  const [gridY, setGridY] = React.useState(-1);

  // Calculate max dimension for dynamic grid sizing
  const maxDim = Math.max(part.dimW, part.dimH, part.dimD || 0);
  
  const gridConfig = useMemo(() => {
      // Adaptive grid based on part size, always using 5mm base
      if (maxDim <= 50) return { cell: 5, section: 25, fade: 150 };
      if (maxDim <= 200) return { cell: 5, section: 50, fade: 500 };
      if (maxDim <= 1000) return { cell: 5, section: 250, fade: 1500 };
      if (maxDim <= 3000) return { cell: 5, section: 500, fade: 4000 };
      return { cell: 5, section: 2500, fade: 10000 };
  }, [maxDim]);

  return (
    <Canvas shadows camera={{ position: [0, 0, 1500], fov: 45 }}>
      <color attach="background" args={['#f1f5f9']} /> {/* slate-100 */}
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />

      <Bounds fit clip observe margin={1.2}>
        <Center onCentered={({ boundingBox }) => setGridY(boundingBox.min.y)}>
            <PartModel 
              part={part} 
              visibleDimensions={visibleDimensions} 
              dimensionType={dimensionType} 
              isUnfolded={isUnfolded} 
              isExploded={isExploded}
              isWeldingMode={isWeldingMode}
              activeWelds={activeWelds}
              toggleWeld={toggleWeld}
              activeIntersections={activeIntersections}
              toggleIntersection={toggleIntersection}
              weldMode={weldMode}
            />
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
      
      <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 1.5} 
          mouseButtons={mouseButtons}
          zoomSpeed={3.0}
      />
      
      <ControlsHandler interactionMode={interactionMode} onInteractionModeChange={onInteractionModeChange} />
      
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="black" />
      </GizmoHelper>
    </Canvas>
  );
}
