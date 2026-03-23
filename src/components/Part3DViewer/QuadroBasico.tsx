import React from 'react';

interface QuadroBasicoProps {
  largura: number; // in mm
  altura: number; // in mm
  perfil: number; // in mm
  quantidadeGrades: number;
}

export const QuadroBasico: React.FC<QuadroBasicoProps> = ({ largura, altura, perfil, quantidadeGrades }) => {
  // Convert mm to meters for Three.js
  const w = largura / 1000;
  const h = altura / 1000;
  const p = perfil / 1000;

  const materialAco = (
    <meshStandardMaterial 
      color="#333333" 
      metalness={0.8} 
      roughness={0.2} 
    />
  );

  // Grades internas
  const grades = Array.from({ length: quantidadeGrades }).map((_, index) => {
    const espacoUtil = w - (2 * p);
    const vaoLivre = (espacoUtil - (quantidadeGrades * p)) / (quantidadeGrades + 1);
    const startX = -(w / 2) + p + vaoLivre + (p / 2);
    const posX = startX + index * (vaoLivre + p);
    
    return (
      <mesh key={`grade-${index}`} position={[posX, 0, 0]}>
        <boxGeometry args={[p, h - (2 * p), p]} />
        {materialAco}
      </mesh>
    );
  });

  return (
    <group>
      {/* Barra Superior */}
      <mesh position={[0, (h - p) / 2, 0]}>
        <boxGeometry args={[w, p, p]} />
        {materialAco}
      </mesh>
      
      {/* Barra Inferior */}
      <mesh position={[0, -(h - p) / 2, 0]}>
        <boxGeometry args={[w, p, p]} />
        {materialAco}
      </mesh>

      {/* Barra Esquerda */}
      <mesh position={[-(w - p) / 2, 0, 0]}>
        <boxGeometry args={[p, h - (2 * p), p]} />
        {materialAco}
      </mesh>

      {/* Barra Direita */}
      <mesh position={[(w - p) / 2, 0, 0]}>
        <boxGeometry args={[p, h - (2 * p), p]} />
        {materialAco}
      </mesh>

      {/* Grades Internas */}
      {grades}
    </group>
  );
};
