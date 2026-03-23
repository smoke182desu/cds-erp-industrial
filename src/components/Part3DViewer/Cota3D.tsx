import React from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

interface Cota3DProps {
  pontoInicio: [number, number, number];
  pontoFim: [number, number, number];
  valorTexto?: string;
  valor?: number;
  label?: string;
  offset?: [number, number, number];
  cor?: string;
}

export const Cota3D: React.FC<Cota3DProps> = ({
  pontoInicio,
  pontoFim,
  valorTexto,
  valor,
  label,
  offset = [0, 0, 0],
  cor = '#ff0000',
}) => {
  const displayValue = valorTexto || (valor !== undefined ? `${valor} mm` : '');
  const displayText = label ? `${label}: ${displayValue}` : displayValue;

  const { inicioComOffset, fimComOffset, pontoMedio, perpendicular, setaInicio1, setaInicio2, setaFim1, setaFim2, vInicio, vFim } = React.useMemo(() => {
    // Converte arrays para Vector3 para facilitar a matemática
    const vInicio = new THREE.Vector3(...pontoInicio);
    const vFim = new THREE.Vector3(...pontoFim);
    const vOffset = new THREE.Vector3(...offset);

    // Aplica o offset aos pontos
    const inicioComOffset = vInicio.clone().add(vOffset);
    const fimComOffset = vFim.clone().add(vOffset);

    // Calcula o ponto médio para posicionar o texto
    const pontoMedio = new THREE.Vector3()
      .addVectors(inicioComOffset, fimComOffset)
      .multiplyScalar(0.5);

    // Calcula a direção da linha
    const direcao = new THREE.Vector3().subVectors(fimComOffset, inicioComOffset).normalize();
    
    // Um vetor "up" padrão para calcular a perpendicular
    const up = Math.abs(direcao.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    
    // Calcula o vetor perpendicular (cross product)
    const perpendicular = new THREE.Vector3().crossVectors(direcao, up).normalize();

    // Configurações da seta (ABNT)
    const arrowSize = 0.08;
    const arrowAngle = Math.PI / 6;

    // Seta no fim
    const dirFimInversa = direcao.clone().negate();
    const setaFim1 = fimComOffset.clone().add(dirFimInversa.clone().applyAxisAngle(perpendicular, arrowAngle).multiplyScalar(arrowSize));
    const setaFim2 = fimComOffset.clone().add(dirFimInversa.clone().applyAxisAngle(perpendicular, -arrowAngle).multiplyScalar(arrowSize));

    // Seta no início
    const setaInicio1 = inicioComOffset.clone().add(direcao.clone().applyAxisAngle(perpendicular, arrowAngle).multiplyScalar(arrowSize));
    const setaInicio2 = inicioComOffset.clone().add(direcao.clone().applyAxisAngle(perpendicular, -arrowAngle).multiplyScalar(arrowSize));

    return { inicioComOffset, fimComOffset, pontoMedio, perpendicular, setaInicio1, setaInicio2, setaFim1, setaFim2, vInicio, vFim };
  }, [pontoInicio, pontoFim, offset]);

  return (
    <group>
      {/* Linhas de chamada (linhas de extensão) */}
      <Line points={[vInicio, inicioComOffset.clone().add(perpendicular.clone().multiplyScalar(0.05))]} color={cor} lineWidth={1} transparent opacity={0.5} />
      <Line points={[vFim, fimComOffset.clone().add(perpendicular.clone().multiplyScalar(0.05))]} color={cor} lineWidth={1} transparent opacity={0.5} />

      {/* Linha principal da cota */}
      <Line
        points={[inicioComOffset, fimComOffset]}
        color={cor}
        lineWidth={1.5}
      />
      
      {/* Setas nas pontas (ABNT) */}
      <Line points={[setaInicio1, inicioComOffset, setaInicio2]} color={cor} lineWidth={1.5} />
      <Line points={[setaFim1, fimComOffset, setaFim2]} color={cor} lineWidth={1.5} />

      {/* Texto da medida centralizado */}
      <Html
        position={pontoMedio}
        center
        distanceFactor={6}
        zIndexRange={[100, 0]}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div 
          className="px-2 py-1 text-[10px] font-bold whitespace-nowrap rounded-sm bg-white/95 border border-slate-300 text-slate-900 shadow-lg backdrop-blur-md"
          style={{ 
            transform: 'translateY(-15px)',
            opacity: 0.9,
          }}
        >
          {displayText}
        </div>
      </Html>
    </group>
  );
};
