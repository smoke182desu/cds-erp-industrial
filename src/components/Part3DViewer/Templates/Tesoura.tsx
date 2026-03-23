import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { InstancedPecas, PecaInstance } from '../InstancedPecas';
import { PerfilData } from '../../../data/perfisDB';
import { AcabamentoMetalKey } from '../../../data/materiaisDB';
import { Cota3D } from '../Cota3D';

interface TesouraProps {
  largura: number;
  altura: number;
  profundidade: number; // Nova propriedade para profundidade
  eaveHeight?: number; // Altura mínima nas extremidades (apoios)
  perfilBanzo: PerfilData;
  perfilInterno: PerfilData;
  perfilDiagonal?: PerfilData;
  tipoTesoura: 'pratt' | 'howe' | 'fink' | 'warren';
  acabamentoMetal?: AcabamentoMetalKey;
  colorBanzo?: string;
  colorMontante?: string;
  colorDiagonal?: string;
  explodedFactor?: number;
  yOffset?: number;
  zOffset?: number;
  numPanels?: number;
  mostrarNodes?: boolean;
  mostrarCotas?: boolean;
  onBOMCalculated?: (bom: any[]) => void;
}

const PART_COLORS = {
  BANZO_SUP: '#1e293b',
  BANZO_INF: '#475569',
  MONTANTE: '#64748b',
  DIAGONAL: '#94a3b8',
  GUSSET: '#cbd5e1',
};

const PART_CODES = {
  BANZO_SUP: 'A',
  BANZO_INF: 'B',
  MONTANTE: 'C',
  DIAGONAL: 'D',
  GUSSET: 'E',
};

const Label = ({ text, position }: { text: string, position: [number, number, number] }) => (
  <Html position={position} center distanceFactor={10}>
    <div className="bg-white/95 text-slate-900 px-2 py-0.5 rounded text-[7px] font-bold border border-slate-300 shadow-xl whitespace-nowrap pointer-events-none uppercase tracking-tighter">
      {text}
    </div>
  </Html>
);

const GussetPlate: React.FC<{ position: [number, number, number], rotation?: [number, number, number], color?: string }> = ({ position, rotation = [0, 0, 0], color = '#94a3b8' }) => (
  <mesh position={position} rotation={rotation}>
    <boxGeometry args={[0.15, 0.15, 0.00635]} />
    <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
  </mesh>
);

const getShear = (start: number[], end: number[], up: number[], cutDir: number[]): [number, number] => {
  const Z = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]).normalize();
  const Y = new THREE.Vector3(up[0], up[1], up[2]).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  
  const N_plane = new THREE.Vector3(-cutDir[1], cutDir[0], 0).normalize();
  
  const nx = N_plane.dot(X);
  const ny = N_plane.dot(Y);
  const nz = N_plane.dot(Z);
  
  if (Math.abs(nz) < 1e-6) return [0, 0];
  
  return [-nx / nz, -ny / nz];
};

export const Tesoura: React.FC<TesouraProps> = ({
  largura,
  altura,
  profundidade, // Nova propriedade
  eaveHeight = 0, // Default to 0 for backward compatibility
  perfilBanzo,
  perfilInterno,
  perfilDiagonal,
  tipoTesoura,
  acabamentoMetal = 'preto_fosco',
  colorBanzo,
  colorMontante,
  colorDiagonal,
  explodedFactor = 0,
  yOffset = 0,
  zOffset = 0,
  numPanels: numPanelsProp,
  mostrarNodes = true,
  mostrarCotas = false,
  onBOMCalculated
}) => {
  const w = largura / 1000;
  const h = altura / 1000;
  const d = profundidade / 1000; // Profundidade em metros
  const eaveH = eaveHeight / 1000;
  const yBase = yOffset;
  const zPos = zOffset;

  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  // BOM Calculation
  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        { 
          code: PART_CODES.BANZO_SUP, 
          name: 'Peça A - Banzo Superior', 
          color: PART_COLORS.BANZO_SUP, 
          quantity: 2, 
          unit: 'un',
          material: `${perfilBanzo.nome} (${Math.sqrt((w/2)**2 + h**2).toFixed(0)}mm)`,
          weight: 2 * (Math.sqrt((w/2)**2 + h**2) / 1000) * (perfilBanzo.pesoPorMetro || 10),
          cost: 2 * (Math.sqrt((w/2)**2 + h**2) / 1000) * ((perfilBanzo.pesoPorMetro || 10) * 15)
        },
        { 
          code: PART_CODES.BANZO_INF, 
          name: 'Peça B - Banzo Inferior', 
          color: PART_COLORS.BANZO_INF, 
          quantity: 1, 
          unit: 'un',
          material: `${perfilBanzo.nome} (${largura}mm)`,
          weight: (largura / 1000) * (perfilBanzo.pesoPorMetro || 10),
          cost: (largura / 1000) * ((perfilBanzo.pesoPorMetro || 10) * 15)
        },
        { 
          code: PART_CODES.MONTANTE, 
          name: 'Peça C - Montante Interno', 
          color: PART_COLORS.MONTANTE, 
          quantity: 4, 
          unit: 'un',
          material: `${perfilInterno.nome}`,
          weight: 4 * (h / 2) * (perfilInterno.pesoPorMetro || 10), // Aproximado
          cost: 4 * (h / 2) * ((perfilInterno.pesoPorMetro || 10) * 15)
        },
        { 
          code: PART_CODES.DIAGONAL, 
          name: 'Peça D - Diagonal Interna', 
          color: PART_COLORS.DIAGONAL, 
          quantity: 4, 
          unit: 'un',
          material: `${perfilDiagonal?.nome || perfilInterno.nome}`,
          weight: 4 * (Math.sqrt((w/4)**2 + (h/2)**2)) * (perfilDiagonal?.pesoPorMetro || perfilInterno.pesoPorMetro || 10), // Aproximado
          cost: 4 * (Math.sqrt((w/4)**2 + (h/2)**2)) * ((perfilDiagonal?.pesoPorMetro || perfilInterno.pesoPorMetro || 10) * 15)
        },
        { 
          code: PART_CODES.GUSSET, 
          name: 'Peça E - Chapa de Gusset', 
          color: PART_COLORS.GUSSET, 
          quantity: 10, 
          unit: 'un',
          material: 'Chapa de Aço 6.35mm',
          weight: 10 * 1.5,
          cost: 10 * 25
        }
      ];

      onBOMCalculated(bom);
    }
  }, [largura, altura, perfilBanzo, perfilInterno, perfilDiagonal, onBOMCalculated]);

  // Converte perfis para metros para a PecaParametrica
  const perfilBanzoM = useMemo(() => ({
    ...perfilBanzo,
    largura: perfilBanzo.largura ? perfilBanzo.largura / 1000 : undefined,
    altura: perfilBanzo.altura ? perfilBanzo.altura / 1000 : undefined,
    diametro: perfilBanzo.diametro ? perfilBanzo.diametro / 1000 : undefined,
    abas: perfilBanzo.abas ? perfilBanzo.abas / 1000 : undefined,
    enrijecedor: perfilBanzo.enrijecedor ? perfilBanzo.enrijecedor / 1000 : undefined,
    espessura: perfilBanzo.espessura / 1000,
  }), [perfilBanzo]);

  const perfilInternoM = useMemo(() => ({
    ...perfilInterno,
    largura: perfilInterno.largura ? perfilInterno.largura / 1000 : undefined,
    altura: perfilInterno.altura ? perfilInterno.altura / 1000 : undefined,
    diametro: perfilInterno.diametro ? perfilInterno.diametro / 1000 : undefined,
    abas: perfilInterno.abas ? perfilInterno.abas / 1000 : undefined,
    enrijecedor: perfilInterno.enrijecedor ? perfilInterno.enrijecedor / 1000 : undefined,
    espessura: perfilInterno.espessura / 1000,
  }), [perfilInterno]);

  const perfilDiagonalM = useMemo(() => {
    const p = perfilDiagonal || perfilInterno;
    return {
      ...p,
      largura: p.largura ? p.largura / 1000 : undefined,
      altura: p.altura ? p.altura / 1000 : undefined,
      diametro: p.diametro ? p.diametro / 1000 : undefined,
      abas: p.abas ? p.abas / 1000 : undefined,
      enrijecedor: p.enrijecedor ? p.enrijecedor / 1000 : undefined,
      espessura: p.espessura / 1000,
    };
  }, [perfilDiagonal, perfilInterno]);

  const { banzoInstances, montanteInstances, diagonalInstances, nodePositions } = useMemo(() => {
    const banzos: PecaInstance[] = [];
    const montantes: PecaInstance[] = [];
    const diagonais: PecaInstance[] = [];
    const nodes: [number, number, number][] = [];
    
    const halfSpan = w / 2;
    const totalRise = h;
    
    const isUProfile = perfilBanzoM.tipoShape === 'perfil_u_simples' || perfilBanzoM.tipoShape === 'perfil_u_enrijecido';
    
    // Para perfil U, a profundidade no plano XY é a aba (flange)
    const profileDepthXY = isUProfile 
      ? (perfilBanzoM.abas || 0.04) 
      : (perfilBanzoM.altura || perfilBanzoM.largura || 0.05);
      
    const profileThickness = perfilBanzoM.espessura || 0.002;
    
    // Offset negativo faz com que os montantes e diagonais entrem no perfil U (encaixe dentro do U)
    // Se não for U, usamos o offset positivo normal para não haver colisão
    const offset = isUProfile 
      ? -(profileDepthXY / 2) + profileThickness
      : profileDepthXY / 2;

    const renderFace = (z: number, sideOffset: number, flipFlanges: boolean = false) => {
      const exp = explodedFactor * 0.2;
      const flipMult = flipFlanges ? -1 : 1;
      
      // Vetores UP baseados no tipo de perfil
      // Para perfis U, orientamos a alma (web) horizontalmente (eixo Z) e as abas apontando para dentro da tesoura
      const upBottom = isUProfile ? [0, 0, 1] : [0, 1 * flipMult, 0];
      const upTopLeft = isUProfile ? [0, 0, -1] : [0, 1 * flipMult, 0];
      const upTopRight = isUProfile ? [0, 0, 1] : [0, -1 * flipMult, 0];
      const upInner = isUProfile ? [0, 0, 1] : [-1 * flipMult, 0, 0];
      
      const cutDirBottom = [1, 0, 0];
      const cutDirTopLeft = [halfSpan, totalRise, 0];
      const cutDirTopRight = [halfSpan, -totalRise, 0];
      
      // Banzo Inferior
      banzos.push({
        start: [-halfSpan, yBase - exp, z],
        end: [halfSpan, yBase - exp, z],
        up: upBottom as [number, number, number]
      });

      // Banzos Superiores
      banzos.push({
        start: [-halfSpan, yBase + eaveH, z + exp * sideOffset],
        end: [0, yBase + eaveH + totalRise + exp, z + exp * sideOffset],
        up: upTopLeft as [number, number, number]
      });
      banzos.push({
        start: [halfSpan, yBase + eaveH, z + exp * sideOffset],
        end: [0, yBase + eaveH + totalRise + exp, z + exp * sideOffset],
        up: upTopRight as [number, number, number]
      });

      // Divisão em painéis
      const maxPanelWidth = 1.2;
      const numPanels = numPanelsProp || Math.max(2, Math.ceil(halfSpan / maxPanelWidth));
      const panelWidth = halfSpan / numPanels;
      const getHAtX = (x: number) => eaveH + (1 - Math.abs(x) / halfSpan) * totalRise;

      // Nodes principais
      nodes.push([0, yBase + eaveH + totalRise, z]); // Apex
      nodes.push([-halfSpan, yBase + eaveH, z]); // Left heel top
      nodes.push([halfSpan, yBase + eaveH, z]); // Right heel top
      nodes.push([0, yBase, z]); // Bottom center
      nodes.push([-halfSpan, yBase, z]); // Left heel bottom
      nodes.push([halfSpan, yBase, z]); // Right heel bottom

      // Montante Central
      const mcStart = [0, yBase + offset - exp, z] as [number, number, number];
      const mcEnd = [0, yBase + eaveH + totalRise - offset + exp, z] as [number, number, number];
      montantes.push({
        start: mcStart,
        end: mcEnd,
        up: upInner as [number, number, number],
        shearStart: getShear(mcStart, mcEnd, upInner as [number, number, number], cutDirBottom),
        shearEnd: getShear(mcStart, mcEnd, upInner as [number, number, number], cutDirBottom) // Flat cut at apex
      });

      // Montantes das Extremidades (Apoios)
      if (eaveH > 0) {
        const meLStart = [-halfSpan, yBase + offset - exp, z] as [number, number, number];
        const meLEnd = [-halfSpan, yBase + eaveH - offset + exp, z] as [number, number, number];
        montantes.push({
          start: meLStart,
          end: meLEnd,
          up: upInner as [number, number, number],
          shearStart: getShear(meLStart, meLEnd, upInner as [number, number, number], cutDirBottom),
          shearEnd: getShear(meLStart, meLEnd, upInner as [number, number, number], cutDirTopLeft)
        });
        
        const meRStart = [halfSpan, yBase + offset - exp, z] as [number, number, number];
        const meREnd = [halfSpan, yBase + eaveH - offset + exp, z] as [number, number, number];
        montantes.push({
          start: meRStart,
          end: meREnd,
          up: upInner as [number, number, number],
          shearStart: getShear(meRStart, meREnd, upInner as [number, number, number], cutDirBottom),
          shearEnd: getShear(meRStart, meREnd, upInner as [number, number, number], cutDirTopRight)
        });
      }

      ['L', 'R'].forEach(side => {
        const s = side === 'L' ? -1 : 1;
        const upVec: [number, number, number] = isUProfile ? [0, 0, 1] : (side === 'L' ? [0, 1 * flipMult, 0] : [0, -1 * flipMult, 0]);
        const upVecVert: [number, number, number] = upInner as [number, number, number];
        const cutDirTop = side === 'L' ? cutDirTopLeft : cutDirTopRight;

        for (let j = 1; j <= numPanels; j++) {
          const xStart = (j - 1) * panelWidth;
          const xEnd = j * panelWidth;
          const yStartTop = yBase + getHAtX(xStart);
          const yEndTop = yBase + getHAtX(xEnd);

          // Nodes
          if (j < numPanels) {
            nodes.push([s * xEnd, yBase - exp, z]); // Bottom node
            nodes.push([s * xEnd, yEndTop + exp, z]); // Top node
          }

          // Montantes Verticais (exceto no Warren puro que usa apenas diagonais)
          if (tipoTesoura !== 'warren' && j < numPanels) {
            const xPos = s * xEnd;
            const mStart = [xPos, yBase + offset - exp, z] as [number, number, number];
            const mEnd = [xPos, yEndTop - offset + exp, z] as [number, number, number];
            montantes.push({
              start: mStart,
              end: mEnd,
              up: upVecVert,
              shearStart: getShear(mStart, mEnd, upVecVert, cutDirBottom),
              shearEnd: getShear(mStart, mEnd, upVecVert, cutDirTop)
            });
          }

          // Diagonais
          if (j < numPanels || (j === numPanels && eaveH > 0)) {
            if (tipoTesoura === 'pratt') {
              const dStart = [s * xEnd, yEndTop - offset + exp, z] as [number, number, number];
              const dEnd = [s * xStart, yBase + offset - exp, z] as [number, number, number];
              diagonais.push({
                start: dStart, end: dEnd, up: upVec,
                shearStart: getShear(dStart, dEnd, upVec, cutDirTop),
                shearEnd: getShear(dStart, dEnd, upVec, cutDirBottom)
              });
            } else if (tipoTesoura === 'howe') {
              const dStart = [s * xEnd, yBase + offset - exp, z] as [number, number, number];
              const dEnd = [s * xStart, yStartTop - offset + exp, z] as [number, number, number];
              diagonais.push({
                start: dStart, end: dEnd, up: upVec,
                shearStart: getShear(dStart, dEnd, upVec, cutDirBottom),
                shearEnd: getShear(dStart, dEnd, upVec, cutDirTop)
              });
            } else if (tipoTesoura === 'fink') {
              const isEven = j % 2 === 0;
              const dStart = [s * (isEven ? xEnd : xStart), yBase + offset - exp, z] as [number, number, number];
              const dEnd = [s * (isEven ? xStart : xEnd), (isEven ? yStartTop : yEndTop) - offset + exp, z] as [number, number, number];
              diagonais.push({
                start: dStart, end: dEnd, up: upVec,
                shearStart: getShear(dStart, dEnd, upVec, cutDirBottom),
                shearEnd: getShear(dStart, dEnd, upVec, cutDirTop)
              });
            } else if (tipoTesoura === 'warren') {
              // Warren: Zig-zag diagonals
              const isEven = j % 2 === 0;
              if (isEven) {
                const dStart = [s * xStart, yStartTop - offset + exp, z] as [number, number, number];
                const dEnd = [s * xEnd, yBase + offset - exp, z] as [number, number, number];
                diagonais.push({
                  start: dStart, end: dEnd, up: upVec,
                  shearStart: getShear(dStart, dEnd, upVec, cutDirTop),
                  shearEnd: getShear(dStart, dEnd, upVec, cutDirBottom)
                });
              } else {
                const dStart = [s * xStart, yBase + offset - exp, z] as [number, number, number];
                const dEnd = [s * xEnd, yEndTop - offset + exp, z] as [number, number, number];
                diagonais.push({
                  start: dStart, end: dEnd, up: upVec,
                  shearStart: getShear(dStart, dEnd, upVec, cutDirBottom),
                  shearEnd: getShear(dStart, dEnd, upVec, cutDirTop)
                });
              }
            }
          }
        }
      });
    };

    // Renderizar faces
    if (d > 0) {
      renderFace(zPos - d / 2, -1);
      renderFace(zPos + d / 2, 1);

      // Travessas (Bracing) entre as faces
      const maxPanelWidth = 1.5;
      const numPanels = numPanelsProp || Math.max(2, Math.ceil(halfSpan / maxPanelWidth));
      const panelWidth = halfSpan / numPanels;
      const getHAtX = (x: number) => eaveH + (1 - Math.abs(x) / halfSpan) * totalRise;

      // Apex bracing
      montantes.push({
        start: [0, yBase + eaveH + totalRise, zPos - d / 2],
        end: [0, yBase + eaveH + totalRise, zPos + d / 2],
        up: [0, 1, 0]
      });
      // Bottom center bracing
      montantes.push({
        start: [0, yBase, zPos - d / 2],
        end: [0, yBase, zPos + d / 2],
        up: [0, 1, 0]
      });

      // Eave bracing (top)
      if (eaveH > 0) {
        montantes.push({
          start: [-halfSpan, yBase + eaveH, zPos - d / 2],
          end: [-halfSpan, yBase + eaveH, zPos + d / 2],
          up: [0, 1, 0]
        });
        montantes.push({
          start: [halfSpan, yBase + eaveH, zPos - d / 2],
          end: [halfSpan, yBase + eaveH, zPos + d / 2],
          up: [0, 1, 0]
        });
      }

      ['L', 'R'].forEach(side => {
        const s = side === 'L' ? -1 : 1;
        for (let j = 1; j <= numPanels; j++) {
          const xEnd = j * panelWidth;
          const yEndTop = yBase + getHAtX(xEnd);

          // Bottom bracing
          montantes.push({
            start: [s * xEnd, yBase, zPos - d / 2],
            end: [s * xEnd, yBase, zPos + d / 2],
            up: [0, 1, 0]
          });

          // Top bracing
          if (j < numPanels) {
            montantes.push({
              start: [s * xEnd, yEndTop, zPos - d / 2],
              end: [s * xEnd, yEndTop, zPos + d / 2],
              up: [0, 1, 0]
            });
          }
        }
      });
    } else {
      renderFace(zPos, 0);
    }

    return { banzoInstances: banzos, montanteInstances: montantes, diagonalInstances: diagonais, nodePositions: nodes };
  }, [w, h, d, yBase, zPos, perfilBanzoM, perfilInternoM, perfilDiagonalM, tipoTesoura, numPanelsProp, explodedFactor]);

  return (
    <group>
      <group position={exp(0, 0.3, 0)}>
        <InstancedPecas 
          perfil={perfilBanzoM} 
          instances={banzoInstances} 
          acabamentoMetal={acabamentoMetal} 
          colorOverride={colorBanzo}
        />
        {explodedFactor > 0.5 && <Label text="Banzos (Estrutura Principal)" position={[0, h + 0.5, zPos]} />}
      </group>

      <group position={exp(0, -0.3, 0)}>
        <InstancedPecas 
          perfil={perfilInternoM} 
          instances={montanteInstances} 
          acabamentoMetal={acabamentoMetal} 
          colorOverride={colorMontante}
        />
        {explodedFactor > 0.5 && <Label text="Montantes Verticais" position={[0, h/2, zPos]} />}
      </group>

      <group position={exp(0, 0, 0.3)}>
        <InstancedPecas 
          perfil={perfilDiagonalM} 
          instances={diagonalInstances} 
          acabamentoMetal={acabamentoMetal} 
          colorOverride={colorDiagonal}
        />
        {explodedFactor > 0.5 && <Label text="Diagonais de Travamento" position={[0, h/2, zPos + 0.3]} />}
      </group>
      
      {/* Nodes (Esferas de conexão) */}
      {mostrarNodes && nodePositions.map((pos, idx) => (
        <mesh key={`node-${idx}`} position={pos}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          {/* Altura Total */}
          <Cota3D
            pontoInicio={[0, yBase, zPos + d/2]}
            pontoFim={[0, yBase + eaveH + h, zPos + d/2]}
            valorTexto={`${(eaveHeight + altura).toFixed(0)} mm`}
            offset={[0.2, 0, 0]}
            cor="#3b82f6"
          />
          {/* Largura Total */}
          <Cota3D
            pontoInicio={[-w/2, yBase - 0.1, zPos + d/2]}
            pontoFim={[w/2, yBase - 0.1, zPos + d/2]}
            valorTexto={`${largura.toFixed(0)} mm`}
            offset={[0, -0.2, 0]}
            cor="#3b82f6"
          />
          {/* Profundidade Total (se houver) */}
          {d > 0 && (
            <Cota3D
              pontoInicio={[-w/2 - 0.1, yBase, zPos - d/2]}
              pontoFim={[-w/2 - 0.1, yBase, zPos + d/2]}
              valorTexto={`${profundidade.toFixed(0)} mm`}
              offset={[-0.2, 0, 0]}
              cor="#3b82f6"
            />
          )}
        </>
      )}
    </group>
  );
};
