import React, { useMemo } from 'react';
import * as THREE from 'three';

interface TelhaGalvanizadaProps {
  largura: number;
  comprimento: number;
  cor?: string;
  tipo?: 'galvanizada' | 'sanduiche';
}

export const criarShapeTelha = (largura: number, tipo: string) => {
  const s = new THREE.Shape();
  const h = 0.05; // 50mm altura do vinco (mais alto para visibilidade)
  const espessura = tipo === 'sanduiche' ? 0.04 : 0.0015; // Telha sanduíche é mais grossa
  
  const ribTopWidth = 0.04;
  const ribBottomWidth = 0.08;
  const ribSpacing = 0.20; // 5 vincos por metro
  const numRibs = Math.floor(largura / ribSpacing);
  
  // Início
  s.moveTo(0, 0);
  
  for (let i = 0; i < numRibs; i++) {
    const startX = i * ribSpacing;
    const flatWidth = (ribSpacing - ribBottomWidth) / 2;
    
    // Parte plana inicial do módulo
    s.lineTo(startX + flatWidth, 0);
    
    // Subida do trapézio
    s.lineTo(startX + flatWidth + (ribBottomWidth - ribTopWidth) / 2, h);
    
    // Topo do trapézio
    s.lineTo(startX + flatWidth + (ribBottomWidth + ribTopWidth) / 2, h);
    
    // Descida do trapézio
    s.lineTo(startX + ribSpacing - flatWidth, 0);
  }
  
  // Final da largura
  s.lineTo(largura, 0);
  
  // Volta por baixo para dar espessura real
  s.lineTo(largura, -espessura);
  
  for (let i = numRibs - 1; i >= 0; i--) {
    const startX = i * ribSpacing;
    const flatWidth = (ribSpacing - ribBottomWidth) / 2;
    
    s.lineTo(startX + ribSpacing - flatWidth, -espessura);
    s.lineTo(startX + flatWidth + (ribBottomWidth + ribTopWidth) / 2, h - espessura);
    s.lineTo(startX + flatWidth + (ribBottomWidth - ribTopWidth) / 2, h - espessura);
    s.lineTo(startX + flatWidth, -espessura);
  }
  
  s.lineTo(0, -espessura);
  s.closePath();
  
  return s;
};

export const TelhaGalvanizada: React.FC<TelhaGalvanizadaProps> = ({ 
  largura, 
  comprimento, 
  cor = "#94a3b8",
  tipo = 'galvanizada'
}) => {
  const shape = useMemo(() => criarShapeTelha(largura, tipo), [largura, tipo]);

  const extrudeSettings = useMemo(() => ({
    steps: 1,
    depth: comprimento,
    bevelEnabled: false
  }), [comprimento]);

  const geometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [shape, extrudeSettings]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial 
        color={cor} 
        roughness={0.2} 
        metalness={0.9} 
        side={THREE.DoubleSide} 
      />
    </mesh>
  );
};
