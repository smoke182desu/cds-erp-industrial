import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Center, Html } from '@react-three/drei';
import { Cota3D } from '../Cota3D';
import { PerfilData } from '../../../data/perfisDB';
import { AcabamentoMetalKey } from '../../../data/materiaisDB';
import { useMaterials } from '../../../hooks/useMaterials';

interface SheetMetal3DProps {
  tipo: string;
  largura: number;
  altura: number;
  profundidade: number;
  espessura: number;
  abaExtra?: number;
  acabamentoMetal?: AcabamentoMetalKey;
  planificada?: boolean;
}

export const SheetMetal3D: React.FC<SheetMetal3DProps> = ({
  tipo,
  largura,
  altura,
  profundidade,
  espessura,
  abaExtra = 15,
  acabamentoMetal = 'zincado',
  planificada = false
}) => {
  const { getMetalMaterial } = useMaterials();
  
  const material = useMemo(() => 
    getMetalMaterial(acabamentoMetal as any), 
  [acabamentoMetal, getMetalMaterial]);

  // Matemática Defensiva e Conversão para Metros
  const w = Math.max(0.001, (largura || 100) / 1000);
  const h = Math.max(0.001, (altura || 100) / 1000);
  const d = Math.max(0.001, (profundidade || 1000) / 1000);
  const t = Math.max(0.001, (espessura || 1.2) / 1000); // Mínimo 1mm para evitar quebra WebGL
  const ae = Math.max(0.001, (abaExtra || 15) / 1000);

  const shape = useMemo(() => {
    const s = new THREE.Shape();

    if (planificada) {
      // Calculate developed width
      let devW = w;
      switch (tipo) {
        case 'chapa_dobrada_l': devW = w + h; break;
        case 'chapa_dobrada_u': devW = w + 2 * h; break;
        case 'perfil_u_enrijecido': devW = w + 2 * h + 2 * ae; break;
        case 'chapa_dobrada_z': devW = w + 2 * h; break;
        case 'chapa_dobrada_cartola': devW = w + 2 * h + 2 * ae; break;
        case 'bandeja_metalica': devW = w + 2 * h; break;
      }
      
      s.moveTo(0, 0);
      s.lineTo(devW, 0);
      s.lineTo(devW, t);
      s.lineTo(0, t);
      s.lineTo(0, 0);
      return s;
    }

    switch (tipo) {
      case 'chapa_cortada':
        s.moveTo(0, 0);
        s.lineTo(w, 0);
        s.lineTo(w, t);
        s.lineTo(0, t);
        s.lineTo(0, 0);
        break;

      case 'chapa_dobrada_l':
        // L-Shape: w = base, h = height
        s.moveTo(0, h);
        s.lineTo(0, 0);
        s.lineTo(w, 0);
        s.lineTo(w, t);
        s.lineTo(t, t);
        s.lineTo(t, h);
        s.lineTo(0, h);
        break;

      case 'chapa_dobrada_u':
        // U-Shape: w = base, h = height (sides)
        s.moveTo(0, h);
        s.lineTo(0, 0);
        s.lineTo(w, 0);
        s.lineTo(w, h);
        s.lineTo(w - t, h);
        s.lineTo(w - t, t);
        s.lineTo(t, t);
        s.lineTo(t, h);
        s.lineTo(0, h);
        break;

      case 'perfil_u_enrijecido':
        // U with returns: w = base, h = height, ae = return
        s.moveTo(0, h);
        s.lineTo(0, 0);
        s.lineTo(w, 0);
        s.lineTo(w, h);
        s.lineTo(w - ae, h);
        s.lineTo(w - ae, h - t);
        s.lineTo(w - t, h - t);
        s.lineTo(w - t, t);
        s.lineTo(t, t);
        s.lineTo(t, h - t);
        s.lineTo(ae, h - t);
        s.lineTo(ae, h);
        s.lineTo(0, h);
        break;

      case 'chapa_dobrada_z':
        // Z-Shape: w = middle, h = height (sides)
        s.moveTo(0, h + h);
        s.lineTo(w, h + h);
        s.lineTo(w, h + h - t);
        s.lineTo(t, h + h - t);
        s.lineTo(t, h);
        s.lineTo(-w + t, h);
        s.lineTo(-w + t, h + t);
        s.lineTo(0, h + t);
        s.lineTo(0, h + h);
        break;

      case 'chapa_dobrada_cartola':
        // Hat shape: ae = flanges, h = height, w = top width
        s.moveTo(0, t);
        s.lineTo(ae, t);
        s.lineTo(ae, h);
        s.lineTo(ae + w, h);
        s.lineTo(ae + w, t);
        s.lineTo(ae + w + ae, t);
        s.lineTo(ae + w + ae, 0);
        s.lineTo(ae + w + t, 0);
        s.lineTo(ae + w + t, t);
        s.lineTo(ae + t, t);
        s.lineTo(ae + t, 0);
        s.lineTo(0, 0);
        s.lineTo(0, t);
        break;

      case 'bandeja_metalica':
        s.moveTo(0, h);
        s.lineTo(0, 0);
        s.lineTo(w, 0);
        s.lineTo(w, h);
        s.lineTo(w - t, h);
        s.lineTo(w - t, t);
        s.lineTo(t, t);
        s.lineTo(t, h);
        s.lineTo(0, h);
        break;

      default:
        s.moveTo(0, 0);
        s.lineTo(w, 0);
        s.lineTo(w, t);
        s.lineTo(0, t);
        s.lineTo(0, 0);
    }

    return s;
  }, [tipo, w, h, t, ae, planificada]);

  const extrudeSettings = useMemo(() => ({
    depth: d,
    bevelEnabled: false
  }), [d]);

  const Label = ({ position, text }: { position: [number, number, number], text: string }) => (
    <Html position={position} center zIndexRange={[100, 0]}>
      <div className="bg-white/90 px-2 py-1 rounded shadow-md border border-slate-200 text-[10px] font-black text-slate-800 whitespace-nowrap">
        {text}
      </div>
    </Html>
  );

  return (
    <Center>
      <group rotation={[0, Math.PI / 4, 0]}>
        {tipo === 'chapa_cortada' && !planificada ? (
          <mesh material={material} castShadow receiveShadow>
            <boxGeometry args={[w, t, d]} />
          </mesh>
        ) : (
          <mesh material={material} castShadow receiveShadow>
            <extrudeGeometry args={[shape, extrudeSettings]} />
          </mesh>
        )}

        {/* Cotas 3D Simplificadas */}
        {!planificada ? (
          <>
            {/* Cota LARGURA (Base) */}
            <Label position={[w / 2, -0.05, d / 2]} text={`L: ${largura} mm`} />
            
            {/* Cota ALTURA (Abas) - Só se não for chapa cortada */}
            {tipo !== 'chapa_cortada' && (
              <Label position={[-0.05, h / 2, d / 2]} text={`H: ${altura} mm`} />
            )}
            
            {/* Cota COMPRIMENTO (Profundidade) */}
            <Label position={[w + 0.05, h / 2, d / 2]} text={`C: ${profundidade} mm`} />
          </>
        ) : (
          <>
            <Label position={[w / 2, 0.05, d / 2]} text={`Desenv: ${
              tipo === 'chapa_dobrada_l' ? largura + altura :
              tipo === 'chapa_dobrada_u' ? largura + 2*altura :
              tipo === 'perfil_u_enrijecido' ? largura + 2*altura + 2*abaExtra :
              tipo === 'chapa_dobrada_z' ? largura + 2*altura :
              tipo === 'chapa_dobrada_cartola' ? largura + 2*altura + 2*abaExtra :
              tipo === 'bandeja_metalica' ? largura + 2*altura : largura
            } mm`} />
            <Label position={[w / 2, 0.05, 0]} text={`C: ${profundidade} mm`} />
          </>
        )}
      </group>
    </Center>
  );
};
