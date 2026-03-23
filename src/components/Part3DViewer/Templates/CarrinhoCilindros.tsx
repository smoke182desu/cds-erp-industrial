import React from 'react';
import { Box, Cylinder, Torus, Html } from '@react-three/drei';
import { animated } from '@react-spring/three';
import * as THREE from 'three';
import { Cota3D } from '../Cota3D';

interface CarrinhoCilindrosProps {
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

export const CarrinhoCilindros: React.FC<CarrinhoCilindrosProps> = ({
  explodedFactor = 0,
  mostrarCotas = false,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  // Dimensões principais
  const w = 0.50;
  const h = 1.30;
  const d = 0.45;
  const distMontantes = 0.35;

  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        {
          code: 'CC-01',
          name: 'Estrutura Tubular (Tubo 1")',
          quantity: (h * 2) + w + (d * 2), // Montantes + travessas
          unit: 'm',
          material: 'Tubo Redondo 1" x 1.5mm',
          weight: ((h * 2) + w + (d * 2)) * 1.2,
          cost: ((h * 2) + w + (d * 2)) * 12.0
        },
        {
          code: 'CC-02',
          name: 'Base de Carga (Chapa 3mm)',
          quantity: 0.35 * 0.25,
          unit: 'm²',
          material: 'Chapa Aço 3mm',
          weight: (0.35 * 0.25) * 24,
          cost: (0.35 * 0.25) * 150
        },
        {
          code: 'CC-03',
          name: 'Rodas Maciças 8"',
          quantity: 2,
          unit: 'un',
          material: 'Roda Borracha Maciça 8"',
          weight: 2 * 1.5,
          cost: 2 * 65
        },
        {
          code: 'CC-04',
          name: 'Corrente de Segurança',
          quantity: 1,
          unit: 'cj',
          material: 'Corrente Aço Galvanizado',
          weight: 0.5,
          cost: 15
        },
        {
          code: 'CC-05',
          name: 'Manoplas de Borracha',
          quantity: 2,
          unit: 'un',
          material: 'Manopla Borracha 1"',
          weight: 0.2,
          cost: 12
        }
      ];
      onBOMCalculated(bom);
    }
  }, [onBOMCalculated, w, h, d]);

  // Materiais
  const matAcoCarbono = <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />;
  const matBase = <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.5} />;
  const matBorracha = <meshStandardMaterial color="#0f172a" roughness={0.9} />;
  const matManopla = <meshStandardMaterial color="#dc2626" roughness={0.7} />; // Vermelho
  const matCorrente = <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.4} />;
  const matCubo = <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />;

  return (
    <group position={[0, 0, 0]}>
      
      {/* GRUPO 1: CHASSI PRINCIPAL E BASE */}
      
      {/* Base de Carga */}
      <animated.group position={exp(0, -0.2, 0)}>
        <group position={[0, 0.05, 0.15]}>
          <Box args={[0.35, 0.006, 0.25]}>
            {matBase}
          </Box>
          {/* Chanfros visuais na frente (simulados com pequenas caixas) */}
          <Box args={[0.35, 0.002, 0.05]} position={[0, -0.002, 0.125]} rotation={[-0.1, 0, 0]}>
            {matBase}
          </Box>
          {explodedFactor > 0.6 && <Label text="Plataforma Frontal (Chapa 6mm)" position={[0, 0.05, 0.1]} />}
        </group>
      </animated.group>

      {/* Montantes Tubulares e Manoplas */}
      <animated.group position={exp(0, 0.3, 0)}>
        <group position={[0, 0.05 + h/2, 0]}>
          {[-distMontantes/2, distMontantes/2].map((posX, i) => (
            <group key={`montante-${i}`} position={[posX, 0, 0]}>
              {/* Tubo Vertical */}
              <Cylinder args={[0.016, 0.016, h, 16]}>
                {matAcoCarbono}
              </Cylinder>
              
              {/* Curva Superior (simulada) */}
              <group position={[0, h/2, -0.05]} rotation={[0.3, 0, 0]}>
                <Cylinder args={[0.016, 0.016, 0.15, 16]}>
                  {matAcoCarbono}
                </Cylinder>
                {/* Manopla de Borracha */}
                <Cylinder args={[0.02, 0.02, 0.12, 16]} position={[0, 0.015, 0]}>
                  {matManopla}
                </Cylinder>
                {explodedFactor > 0.6 && i === 0 && <Label text="Manopla de Borracha" position={[-0.05, 0.1, 0]} />}
              </group>
              
              {explodedFactor > 0.6 && i === 0 && <Label text="Montante Tubular (1.1/4&quot;)" position={[-0.1, 0, 0]} />}
            </group>
          ))}
        </group>
      </animated.group>

      {/* GRUPO 2: SISTEMA DE CONTENÇÃO DO CILINDRO */}
      <animated.group position={exp(0, 0.1, 0.2)}>
        {/* Berços de Apoio (Encosto Abaulado) */}
        {[0.4, 0.9].map((posY, i) => (
          <group key={`berco-${i}`} position={[0, posY, 0.02]} rotation={[Math.PI/2, 0, 0]}>
            {/* Usando Torus cortado para simular a chapa curva */}
            <Torus args={[0.175, 0.02, 8, 24, Math.PI]} rotation={[0, 0, 0]}>
              {matAcoCarbono}
            </Torus>
            {explodedFactor > 0.6 && i === 1 && <Label text="Berço Abaulado (Chapa Calandrada)" position={[0, -0.2, 0]} />}
          </group>
        ))}

        {/* Corrente de Segurança */}
        <animated.group position={exp(0, 0, 0.3)}>
          <group position={[0, 0.80, 0.18]} rotation={[Math.PI/2, 0, 0]}>
            {/* Simulando a corrente com um Torus fino */}
            <Torus args={[0.18, 0.005, 8, 32, Math.PI]} rotation={[0, 0, 0]}>
              {matCorrente}
            </Torus>
            {explodedFactor > 0.6 && <Label text="Corrente de Contenção" position={[0, -0.2, 0]} />}
          </group>
        </animated.group>
      </animated.group>

      {/* GRUPO 3: SISTEMA DE RODAGEM PESADA */}
      {/* Eixo Maciço Central */}
      <animated.group position={exp(0, -0.1, -0.2)}>
        <group position={[0, 0.125, -0.05]}>
          <Cylinder args={[0.012, 0.012, 0.50, 16]} rotation={[0, 0, Math.PI/2]}>
            {matAcoCarbono}
          </Cylinder>
          {explodedFactor > 0.6 && <Label text="Eixo Maciço (Aço Trefilado)" position={[0, 0.05, -0.05]} />}
        </group>
      </animated.group>

      {/* Rodas de Borracha Maciça */}
      {[-0.25, 0.25].map((posX, i) => (
        <animated.group key={`roda-${i}`} position={exp(posX > 0 ? 0.3 : -0.3, -0.1, -0.2)}>
          <group position={[posX, 0.125, -0.05]}>
            {/* Pneu de Borracha */}
            <Cylinder args={[0.125, 0.125, 0.06, 32]} rotation={[Math.PI/2, 0, Math.PI/2]}>
              {matBorracha}
            </Cylinder>
            {/* Calota/Cubo de Metal */}
            <Cylinder args={[0.06, 0.06, 0.062, 16]} rotation={[Math.PI/2, 0, Math.PI/2]}>
              {matCubo}
            </Cylinder>
            {explodedFactor > 0.6 && i === 0 && <Label text="Roda Maciça 10&quot;" position={[0, 0.15, 0]} />}
          </group>
        </animated.group>
      ))}

      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          {/* Altura Total */}
          <Cota3D
            pontoInicio={[distMontantes/2 + 0.1, 0, 0]}
            pontoFim={[distMontantes/2 + 0.1, h + 0.05, 0]}
            valorTexto="1350 mm"
            offset={[0.1, 0, 0]}
            cor="#3b82f6"
          />
          {/* Largura Total (entre rodas) */}
          <Cota3D
            pontoInicio={[-0.25 - 0.03, 0.125, -0.05 - 0.15]}
            pontoFim={[0.25 + 0.03, 0.125, -0.05 - 0.15]}
            valorTexto="560 mm"
            offset={[0, -0.1, -0.1]}
            cor="#3b82f6"
          />
          {/* Profundidade Total */}
          <Cota3D
            pontoInicio={[-0.35, 0.05, -0.05 - 0.125]}
            pontoFim={[-0.35, 0.05, 0.15 + 0.125]}
            valorTexto="450 mm"
            offset={[-0.1, 0, 0]}
            cor="#3b82f6"
          />
        </>
      )}

    </group>
  );
};
