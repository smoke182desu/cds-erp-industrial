import React from 'react';

interface MetalonProps {
  width: number; // in mm
  height: number; // in mm
  length: number; // in mm
}

export const Metalon: React.FC<MetalonProps> = ({ width, height, length }) => {
  // Convert mm to meters (Three.js units)
  const w = width / 1000;
  const h = height / 1000;
  const l = length / 1000;

  return (
    <mesh>
      <boxGeometry args={[w, h, l]} />
      <meshStandardMaterial 
        color="#333333" 
        metalness={0.8} 
        roughness={0.2} 
      />
    </mesh>
  );
};
