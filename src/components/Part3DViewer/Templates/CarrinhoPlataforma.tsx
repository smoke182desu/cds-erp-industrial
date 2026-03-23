import React from 'react';
import { Box, Cylinder, Html } from '@react-three/drei';
import { animated } from '@react-spring/three';
import * as THREE from 'three';
import { Cota3D } from '../Cota3D';

interface CarrinhoPlataformaProps {
  explodedFactor?: number;
  mostrarCotas?: boolean;
  onBOMCalculated?: (bom: any[]) => void;
}

const Label = ({ text, position }: { text: string, position: [number, number, number] }) => (
  <Html position={position} center distanceFactor={10}>
    <div className="bg-white/95 text-slate-900 px-2 py-0.5 rounded text-[7px] font-bold border border-slate-300 shadow-xl whitespace-nowrap pointer-events-none uppercase tracking-tighter">
      {text}
    </div>
  </Html>
);

export const CarrinhoPlataforma: React.FC<CarrinhoPlataformaProps> = ({
  explodedFactor = 0,
  mostrarCotas = false,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  // Dimensões principais
  const platW = 0.80;
  const platD = 1.20;
  const platY = 0.20;

  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        {
          code: 'CP-01',
          name: 'Chassi Tubular (Metalon 50x30x2.0mm)',
          quantity: (platW * 2) + (platD * 2) + (platW * 2), // Perímetro + 2 travessas
          unit: 'm',
          material: 'Metalon 50x30x2.0mm',
          weight: ((platW * 2) + (platD * 2) + (platW * 2)) * 2.4,
          cost: ((platW * 2) + (platD * 2) + (platW * 2)) * 18.5
        },
        {
          code: 'CP-02',
          name: 'Plataforma (Chapa Xadrez 3mm)',
          quantity: platW * platD,
          unit: 'm²',
          material: 'Chapa Xadrez Aço 3mm',
          weight: (platW * platD) * 24,
          cost: (platW * platD) * 150
        },
        {
          code: 'CP-03',
          name: 'Alça de Empurre (Tubo 1.1/4")',
          quantity: platW + (0.9 * 2), // Largura + 2 alturas
          unit: 'm',
          material: 'Tubo Redondo 1.1/4" x 1.5mm',
          weight: (platW + (0.9 * 2)) * 1.5,
          cost: (platW + (0.9 * 2)) * 15
        },
        {
          code: 'CP-04',
          name: 'Rodízios Giratórios 6" (Poliuretano)',
          quantity: 2,
          unit: 'un',
          material: 'Rodízio PU 6" Giratório',
          weight: 2 * 1.5,
          cost: 2 * 85
        },
        {
          code: 'CP-05',
          name: 'Rodízios Fixos 6" (Poliuretano)',
          quantity: 2,
          unit: 'un',
          material: 'Rodízio PU 6" Fixo',
          weight: 2 * 1.2,
          cost: 2 * 75
        }
      ];
      onBOMCalculated(bom);
    }
  }, [onBOMCalculated, platW, platD]);

  // Materiais
  const matAcoCarbono = <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />;
  const matChapaXadrez = <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.6} />;
  const matPU = <meshStandardMaterial color="#ea580c" roughness={0.7} />; // Laranja PU
  const matBorracha = <meshStandardMaterial color="#1e293b" roughness={0.9} />;
  const matZincado = <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />;
  
  // Geometria Mão Francesa (Triângulo)
  const maoFrancesaShape = new THREE.Shape();
  maoFrancesaShape.moveTo(0, 0);
  maoFrancesaShape.lineTo(0.15, 0);
  maoFrancesaShape.lineTo(0, 0.15);
  maoFrancesaShape.lineTo(0, 0);
  
  const extrudeSettings = { depth: 0.005, bevelEnabled: false };

  return (
    <group position={[0, 0, 0]}>
      {/* GRUPO 1: CHASSI E PLATAFORMA (Base) */}
      
      {/* Chapa Xadrez */}
      <animated.group position={exp(0, 0.4, 0)}>
        <group position={[0, platY, 0]}>
          <Box args={[platW, 0.003, platD]}>
            {matChapaXadrez}
          </Box>
          {explodedFactor > 0.6 && <Label text="Plataforma (Chapa Xadrez 3mm)" position={[0, 0.1, 0]} />}
        </group>
      </animated.group>

      {/* Quadro Estrutural */}
      <animated.group position={exp(0, -0.1, 0)}>
        <group position={[0, platY - 0.02 - 0.0015, 0]}>
          {/* Longarinas (Z) */}
          <Box args={[0.04, 0.04, platD]} position={[-platW/2 + 0.02, 0, 0]}>
            {matAcoCarbono}
          </Box>
          <Box args={[0.04, 0.04, platD]} position={[platW/2 - 0.02, 0, 0]}>
            {matAcoCarbono}
          </Box>
          
          {/* Travessas nas pontas (X) */}
          <Box args={[platW - 0.08, 0.04, 0.04]} position={[0, 0, -platD/2 + 0.02]}>
            {matAcoCarbono}
          </Box>
          <Box args={[platW - 0.08, 0.04, 0.04]} position={[0, 0, platD/2 - 0.02]}>
            {matAcoCarbono}
          </Box>

          {/* Travessas de Reforço Interno */}
          <Box args={[platW - 0.08, 0.04, 0.04]} position={[0, 0, -0.2]}>
            {matAcoCarbono}
          </Box>
          <Box args={[platW - 0.08, 0.04, 0.04]} position={[0, 0, 0.2]}>
            {matAcoCarbono}
          </Box>

          {explodedFactor > 0.6 && <Label text="Quadro Estrutural (Cantoneira 40x40mm)" position={[0, 0, 0.65]} />}
          {explodedFactor > 0.6 && <Label text="Travessas de Reforço Interno" position={[0, 0, -0.2]} />}
        </group>
      </animated.group>

      {/* GRUPO 2: ALÇA DE MOVIMENTAÇÃO (Puxador Tubular) */}
      <animated.group position={exp(0, 0.3, 0.3)}>
        <group position={[0, platY, platD/2 - 0.02]}>
          {/* Montantes (Tubos Verticais) */}
          {[-platW/2 + 0.04, platW/2 - 0.04].map((posX, i) => (
            <group key={`montante-${i}`} position={[posX, 0.85/2, 0]}>
              <Cylinder args={[0.0127, 0.0127, 0.85, 16]}>
                {matAcoCarbono}
              </Cylinder>
              {explodedFactor > 0.6 && i === 0 && <Label text="Montantes da Alça (Tubo 1&quot;)" position={[-0.1, 0, 0]} />}
            </group>
          ))}

          {/* Barra de Empurre (Horizontal Topo) */}
          <group position={[0, 0.85 - 0.0127, 0]}>
            <Cylinder args={[0.0127, 0.0127, platW - 0.08 + 0.0254, 16]} rotation={[0, 0, Math.PI/2]}>
              {matAcoCarbono}
            </Cylinder>
            {explodedFactor > 0.6 && <Label text="Barra de Empurre (Tubo 1&quot;)" position={[0, 0.05, 0]} />}
          </group>

          {/* Travessa de Contenção (Horizontal Meio) */}
          <group position={[0, 0.4, 0]}>
            <Cylinder args={[0.0127, 0.0127, platW - 0.08, 16]} rotation={[0, 0, Math.PI/2]}>
              {matAcoCarbono}
            </Cylinder>
            {explodedFactor > 0.6 && <Label text="Travessa de Contenção" position={[0, 0.05, 0]} />}
          </group>

          {/* Mão Francesa */}
          {[-platW/2 + 0.04, platW/2 - 0.04].map((posX, i) => (
            <group key={`mao-francesa-${i}`} position={[posX - 0.0025, 0, -0.0127]}>
              <mesh rotation={[0, Math.PI/2, 0]}>
                <extrudeGeometry args={[maoFrancesaShape, extrudeSettings]} />
                {matAcoCarbono}
              </mesh>
              {explodedFactor > 0.6 && i === 0 && <Label text="Mão Francesa 5mm" position={[0, 0.1, -0.1]} />}
            </group>
          ))}
        </group>
      </animated.group>

      {/* GRUPO 3: SISTEMA DE RODÍZIOS INDUSTRIAIS */}
      {/* Rodízios Fixos (Dianteiros) */}
      {[-platW/2 + 0.1, platW/2 - 0.1].map((posX, i) => (
        <animated.group key={`rodizio-fixo-${i}`} position={exp(posX > 0 ? 0.3 : -0.3, -0.2, -0.3)}>
          <group position={[posX, 0.075, -platD/2 + 0.15]}>
            {/* Roda de PU */}
            <Cylinder args={[0.075, 0.075, 0.05, 32]} rotation={[0, 0, Math.PI/2]}>
              {matPU}
            </Cylinder>
            {/* Miolo da roda */}
            <Cylinder args={[0.04, 0.04, 0.052, 16]} rotation={[0, 0, Math.PI/2]}>
              {matBorracha}
            </Cylinder>
            
            {/* Garfo Fixo */}
            <group position={[0, 0.04, 0]}>
              <Box args={[0.06, 0.09, 0.08]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} transparent opacity={0.8} />
              </Box>
              {/* Placa de Fixação */}
              <Box args={[0.1, 0.01, 0.12]} position={[0, 0.045, 0]}>
                {matZincado}
              </Box>
            </group>

            {explodedFactor > 0.6 && i === 0 && <Label text="Rodízio Fixo 6&quot; (Poliuretano)" position={[0, -0.1, 0]} />}
          </group>
        </animated.group>
      ))}

      {/* Rodízios Giratórios (Traseiros) */}
      {[-platW/2 + 0.1, platW/2 - 0.1].map((posX, i) => (
        <animated.group key={`rodizio-giratorio-${i}`} position={exp(posX > 0 ? 0.3 : -0.3, -0.2, 0.3)}>
          <group position={[posX, 0.075, platD/2 - 0.15]}>
            {/* Roda de PU */}
            <Cylinder args={[0.075, 0.075, 0.05, 32]} rotation={[0, 0, Math.PI/2]}>
              {matPU}
            </Cylinder>
            {/* Miolo da roda */}
            <Cylinder args={[0.04, 0.04, 0.052, 16]} rotation={[0, 0, Math.PI/2]}>
              {matBorracha}
            </Cylinder>
            
            {/* Garfo Giratório (Inclinado) */}
            <group position={[0, 0.04, -0.02]} rotation={[0.2, 0, 0]}>
              <Box args={[0.06, 0.09, 0.08]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} transparent opacity={0.8} />
              </Box>
            </group>
            
            {/* Base de Giro e Placa de Fixação */}
            <group position={[0, 0.085, 0]}>
              <Cylinder args={[0.04, 0.04, 0.02, 16]}>
                {matZincado}
              </Cylinder>
              <Box args={[0.1, 0.01, 0.12]} position={[0, 0.015, 0]}>
                {matZincado}
              </Box>
            </group>

            {explodedFactor > 0.6 && i === 0 && <Label text="Rodízio Giratório 6&quot; (Poliuretano)" position={[0, -0.1, 0]} />}
          </group>
        </animated.group>
      ))}

      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          {/* Altura Total (chão até alça) */}
          <Cota3D
            pontoInicio={[platW/2 + 0.1, 0, platD/2 - 0.02]}
            pontoFim={[platW/2 + 0.1, platY + 0.85, platD/2 - 0.02]}
            valorTexto="1050 mm"
            offset={[0.1, 0, 0]}
            cor="#3b82f6"
          />
          {/* Comprimento Total */}
          <Cota3D
            pontoInicio={[-platW/2, platY, platD/2]}
            pontoFim={[platW/2, platY, platD/2]}
            valorTexto="800 mm"
            offset={[0, 0, 0.2]}
            cor="#3b82f6"
          />
          {/* Profundidade Total */}
          <Cota3D
            pontoInicio={[-platW/2, platY, -platD/2]}
            pontoFim={[-platW/2, platY, platD/2]}
            valorTexto="1200 mm"
            offset={[-0.2, 0, 0]}
            cor="#3b82f6"
          />
        </>
      )}

    </group>
  );
};
