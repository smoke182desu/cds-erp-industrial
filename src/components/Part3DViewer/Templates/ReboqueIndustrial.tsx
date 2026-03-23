import React from 'react';
import { Box, Cylinder, Torus, Html } from '@react-three/drei';
import { animated } from '@react-spring/three';
import * as THREE from 'three';
import { Cota3D } from '../Cota3D';

interface ReboqueIndustrialProps {
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

export const ReboqueIndustrial: React.FC<ReboqueIndustrialProps> = ({
  explodedFactor = 0,
  mostrarCotas = false,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  // Dimensões principais
  const w = 1.00;
  const d = 2.00;
  const platY = 0.50;
  const wheelR = 0.20;
  const eixoY = 0.20;

  // Timão math
  const timaoLength = 1.20;
  const timaoSpread = 0.50; // Largura na base
  const timaoAngle = Math.atan((timaoSpread / 2) / timaoLength);
  const timaoHyp = Math.sqrt(Math.pow(timaoSpread / 2, 2) + Math.pow(timaoLength, 2));

  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        {
          code: 'RI-01',
          name: 'Chassi Principal (Viga U 4")',
          quantity: (w * 2) + (d * 2), // Perímetro
          unit: 'm',
          material: 'Perfil U Laminado 4"',
          weight: ((w * 2) + (d * 2)) * 8.0,
          cost: ((w * 2) + (d * 2)) * 45.0
        },
        {
          code: 'RI-02',
          name: 'Plataforma (Chapa Xadrez 1/8")',
          quantity: w * d,
          unit: 'm²',
          material: 'Chapa Xadrez Aço 1/8"',
          weight: (w * d) * 25.5,
          cost: (w * d) * 180
        },
        {
          code: 'RI-03',
          name: 'Eixos Traseiros e Dianteiros',
          quantity: 2,
          unit: 'cj',
          material: 'Eixo Maciço 1.1/2"',
          weight: 2 * 15.0,
          cost: 2 * 120
        },
        {
          code: 'RI-04',
          name: 'Rodas com Pneu Maciço',
          quantity: 4,
          unit: 'un',
          material: 'Roda Industrial 16"',
          weight: 4 * 8.0,
          cost: 4 * 250
        },
        {
          code: 'RI-05',
          name: 'Sistema de Quinta Roda',
          quantity: 1,
          unit: 'cj',
          material: 'Aço Forjado/Usinado',
          weight: 25.0,
          cost: 450
        },
        {
          code: 'RI-06',
          name: 'Timão de Tração',
          quantity: 1,
          unit: 'cj',
          material: 'Tubo Estrutural e Olhal Forjado',
          weight: 12.0,
          cost: 180
        }
      ];
      onBOMCalculated(bom);
    }
  }, [onBOMCalculated, w, d]);

  // Materiais
  const matAcoCarbono = <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />;
  const matPlataforma = <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.6} />;
  const matQuintaRoda = <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />;
  const matBorracha = <meshStandardMaterial color="#0f172a" roughness={0.9} />;
  const matCubo = <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />;
  const matPino = <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />; // Amarelo zinco

  return (
    <group position={[0, 0, 0]}>
      
      {/* GRUPO 1: CHASSI E PLATAFORMA DE CARGA */}
      
      {/* Plataforma */}
      <animated.group position={exp(0, 0.6, 0)}>
        <group position={[0, platY, 0]}>
          <Box args={[w, 0.005, d]}>
            {matPlataforma}
          </Box>
          {explodedFactor > 0.6 && <Label text="Plataforma de Carga (Chapa 5mm)" position={[0, 0.1, 0]} />}
        </group>
      </animated.group>

      {/* Quadro Estrutural Principal */}
      <animated.group position={exp(0, 0.1, 0)}>
        <group position={[0, platY - 0.05, 0]}>
          {/* Longarinas (Z) */}
          <Box args={[0.05, 0.10, d]} position={[-w/2 + 0.025, 0, 0]}>{matAcoCarbono}</Box>
          <Box args={[0.05, 0.10, d]} position={[w/2 - 0.025, 0, 0]}>{matAcoCarbono}</Box>
          
          {/* Travessas (X) */}
          <Box args={[w - 0.10, 0.10, 0.05]} position={[0, 0, -d/2 + 0.025]}>{matAcoCarbono}</Box>
          <Box args={[w - 0.10, 0.10, 0.05]} position={[0, 0, d/2 - 0.025]}>{matAcoCarbono}</Box>
          
          {/* Travessas Centrais */}
          <Box args={[w - 0.10, 0.10, 0.05]} position={[0, 0, -0.33]}>{matAcoCarbono}</Box>
          <Box args={[w - 0.10, 0.10, 0.05]} position={[0, 0, 0.33]}>{matAcoCarbono}</Box>

          {explodedFactor > 0.6 && <Label text="Quadro Estrutural (Perfil U 100x50mm)" position={[0, 0, 0.5]} />}

          {/* Engate Traseiro */}
          <group position={[0, 0, -d/2 - 0.075]}>
            <Box args={[0.20, 0.02, 0.15]} position={[0, -0.04, 0]}>{matAcoCarbono}</Box>
            <Cylinder args={[0.015, 0.015, 0.12, 16]} position={[0, 0.02, -0.04]}>{matPino}</Cylinder>
            {explodedFactor > 0.6 && <Label text="Engate Traseiro (Pino e Boca)" position={[0, 0.15, 0]} />}
          </group>
        </group>
      </animated.group>

      {/* GRUPO 2: SISTEMA DE DIREÇÃO (Quinta Roda) */}
      
      {/* Parte Fixa da Quinta Roda (Fica com o Chassi) */}
      <animated.group position={exp(0, 0.1, 0)}>
        <group position={[0, 0.38, d/2 - 0.30]}>
          <Cylinder args={[0.25, 0.25, 0.04, 32]}>{matQuintaRoda}</Cylinder>
          {explodedFactor > 0.6 && <Label text="Mancal Superior (Fixo)" position={[0, 0.05, 0.25]} />}
        </group>
      </animated.group>

      {/* Conjunto Direcional (Gira e desce na explosão) */}
      <animated.group 
        position={exp(0, -0.3, 0.2)} 
        rotation-y={explodedFactor * 0.2} // Leve giro para evidenciar a articulação
      >
        <group position={[0, 0, d/2 - 0.30]}>
          
          {/* Parte Móvel da Quinta Roda */}
          <group position={[0, 0.34, 0]}>
            <Cylinder args={[0.25, 0.25, 0.04, 32]}>{matQuintaRoda}</Cylinder>
            {/* Espaçador para o eixo */}
            <Box args={[0.20, 0.10, 0.20]} position={[0, -0.07, 0]}>{matAcoCarbono}</Box>
            {explodedFactor > 0.6 && <Label text="Rolamento Quinta Roda (Móvel)" position={[0, 0.05, -0.25]} />}
          </group>

          {/* Eixo Dianteiro Direcional */}
          <group position={[0, eixoY, 0]}>
            <Box args={[0.90, 0.08, 0.08]}>{matAcoCarbono}</Box>
            {explodedFactor > 0.6 && <Label text="Eixo Dianteiro Direcional (Maciço)" position={[0, -0.1, 0]} />}
          </group>

          {/* Rodas Dianteiras */}
          {[-0.45, 0.45].map((posX, i) => (
            <group key={`roda-diant-${i}`} position={[posX, eixoY, 0]}>
              <Cylinder args={[wheelR, wheelR, 0.10, 32]} rotation={[Math.PI/2, 0, Math.PI/2]}>{matBorracha}</Cylinder>
              <Cylinder args={[0.10, 0.10, 0.102, 16]} rotation={[Math.PI/2, 0, Math.PI/2]}>{matCubo}</Cylinder>
            </group>
          ))}

          {/* Timão de Tração (Cambão) */}
          <animated.group 
            position={[0, eixoY, 0.04]} 
            rotation-x={explodedFactor * (-Math.PI / 6)} // Rotaciona para o chão
          >
            <animated.group position={exp(0, 0, 0.4)}>
              {/* Hastes em V */}
              <group position={[-timaoSpread/2, 0, timaoLength/2]} rotation={[0, -timaoAngle, 0]}>
                <Cylinder args={[0.025, 0.025, timaoHyp, 16]} rotation={[Math.PI/2, 0, 0]}>{matAcoCarbono}</Cylinder>
              </group>
              <group position={[timaoSpread/2, 0, timaoLength/2]} rotation={[0, timaoAngle, 0]}>
                <Cylinder args={[0.025, 0.025, timaoHyp, 16]} rotation={[Math.PI/2, 0, 0]}>{matAcoCarbono}</Cylinder>
              </group>
              
              {/* Olhal de Engate */}
              <group position={[0, 0, timaoLength + 0.05]} rotation={[Math.PI/2, 0, 0]}>
                <Torus args={[0.05, 0.015, 16, 32]}>{matAcoCarbono}</Torus>
                {explodedFactor > 0.6 && <Label text="Olhal de Engate" position={[0, 0.1, 0]} />}
              </group>

              {/* Dobradiças do Timão */}
              <Cylinder args={[0.03, 0.03, 0.08, 16]} position={[-timaoSpread/2, 0, 0]} rotation={[0, 0, Math.PI/2]}>{matAcoCarbono}</Cylinder>
              <Cylinder args={[0.03, 0.03, 0.08, 16]} position={[timaoSpread/2, 0, 0]} rotation={[0, 0, Math.PI/2]}>{matAcoCarbono}</Cylinder>

              {explodedFactor > 0.6 && <Label text="Timão Articulado (Cambão)" position={[0, 0.1, timaoLength/2]} />}
            </animated.group>
          </animated.group>

        </group>
      </animated.group>

      {/* GRUPO 3: EIXO TRASEIRO E RODAGEM PESADA */}
      
      {/* Eixo Traseiro Fixo */}
      <animated.group position={exp(0, 0.1, 0)}>
        <group position={[0, eixoY, -d/2 + 0.30]}>
          <Box args={[0.90, 0.08, 0.08]}>{matAcoCarbono}</Box>
          {/* Suportes do eixo traseiro */}
          <Box args={[0.10, 0.17, 0.10]} position={[-w/2 + 0.15, 0.125, 0]}>{matAcoCarbono}</Box>
          <Box args={[0.10, 0.17, 0.10]} position={[w/2 - 0.15, 0.125, 0]}>{matAcoCarbono}</Box>
          {explodedFactor > 0.6 && <Label text="Eixo Traseiro Fixo (Maciço)" position={[0, -0.1, 0]} />}
        </group>
      </animated.group>

      {/* Rodas Traseiras */}
      {[-0.45, 0.45].map((posX, i) => (
        <animated.group key={`roda-tras-${i}`} position={exp(posX > 0 ? 0.5 : -0.5, 0.1, 0)}>
          <group position={[posX, eixoY, -d/2 + 0.30]}>
            <Cylinder args={[wheelR, wheelR, 0.10, 32]} rotation={[Math.PI/2, 0, Math.PI/2]}>{matBorracha}</Cylinder>
            <Cylinder args={[0.10, 0.10, 0.102, 16]} rotation={[Math.PI/2, 0, Math.PI/2]}>{matCubo}</Cylinder>
            {explodedFactor > 0.6 && i === 0 && <Label text="Roda Maciça 16&quot;" position={[0, 0.25, 0]} />}
          </group>
        </animated.group>
      ))}

      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          {/* Altura Total (chão até plataforma) */}
          <Cota3D
            pontoInicio={[w/2 + 0.1, 0, 0]}
            pontoFim={[w/2 + 0.1, platY, 0]}
            valorTexto="500 mm"
            offset={[0.1, 0, 0]}
            cor="#3b82f6"
          />
          {/* Comprimento Total (Plataforma) */}
          <Cota3D
            pontoInicio={[-w/2 - 0.1, platY, d/2]}
            pontoFim={[-w/2 - 0.1, platY, -d/2]}
            valorTexto="2000 mm"
            offset={[-0.1, 0, 0]}
            cor="#3b82f6"
          />
          {/* Largura Total */}
          <Cota3D
            pontoInicio={[-w/2, platY + 0.1, d/2]}
            pontoFim={[w/2, platY + 0.1, d/2]}
            valorTexto="1000 mm"
            offset={[0, 0.1, 0]}
            cor="#3b82f6"
          />
        </>
      )}

    </group>
  );
};
