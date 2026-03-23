import React from 'react';
import { Box, Cylinder, Html } from '@react-three/drei';
import { animated } from '@react-spring/three';
import * as THREE from 'three';
import { Cota3D } from '../Cota3D';

interface GaiolaRollContainerProps {
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

export const GaiolaRollContainer: React.FC<GaiolaRollContainerProps> = ({
  explodedFactor = 0,
  mostrarCotas = false,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  // Dimensões
  const w = 0.80;
  const d = 0.70;
  const h = 1.50; // Altura dos painéis
  const baseY = 0.15;

  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        {
          code: 'GR-01',
          name: 'Chassi Tubular (Metalon 30x30x1.5mm)',
          quantity: (w * 2) + (d * 2) + (w * 2), // Perímetro + 2 travessas
          unit: 'm',
          material: 'Metalon 30x30x1.5mm',
          weight: ((w * 2) + (d * 2) + (w * 2)) * 1.3,
          cost: ((w * 2) + (d * 2) + (w * 2)) * 12.5
        },
        {
          code: 'GR-02',
          name: 'Painéis Laterais (Metalon 20x20x1.2mm)',
          quantity: ((h * 2) + (d * 2)) * 2, // 2 painéis laterais
          unit: 'm',
          material: 'Metalon 20x20x1.2mm',
          weight: (((h * 2) + (d * 2)) * 2) * 0.7,
          cost: (((h * 2) + (d * 2)) * 2) * 8.5
        },
        {
          code: 'GR-03',
          name: 'Painel Traseiro (Metalon 20x20x1.2mm)',
          quantity: (h * 2) + (w * 2), // 1 painel traseiro
          unit: 'm',
          material: 'Metalon 20x20x1.2mm',
          weight: ((h * 2) + (w * 2)) * 0.7,
          cost: ((h * 2) + (w * 2)) * 8.5
        },
        {
          code: 'GR-04',
          name: 'Malha de Aço (50x50x4mm)',
          quantity: (d * h * 2) + (w * h), // 2 laterais + 1 traseira
          unit: 'm²',
          material: 'Malha de Aço 50x50x4mm',
          weight: ((d * h * 2) + (w * h)) * 4.5,
          cost: ((d * h * 2) + (w * h)) * 45
        },
        {
          code: 'GR-05',
          name: 'Rodízios Giratórios 5" (Nylon)',
          quantity: 2,
          unit: 'un',
          material: 'Rodízio Nylon 5" Giratório',
          weight: 2 * 1.0,
          cost: 2 * 45
        },
        {
          code: 'GR-06',
          name: 'Rodízios Fixos 5" (Nylon)',
          quantity: 2,
          unit: 'un',
          material: 'Rodízio Nylon 5" Fixo',
          weight: 2 * 0.8,
          cost: 2 * 35
        }
      ];
      onBOMCalculated(bom);
    }
  }, [onBOMCalculated, w, d, h]);

  // Materiais
  const matAcoCarbono = <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />;
  const matMalha = <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.4} transparent opacity={0.6} wireframe />;
  const matNylon = <meshStandardMaterial color="#f8fafc" roughness={0.5} />; // Branco
  const matZincado = <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />;
  const matLousa = <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.8} />; // Preto fosco

  return (
    <group position={[0, 0, 0]}>
      {/* GRUPO 1: CHASSI E MOVIMENTAÇÃO (Base) */}
      <animated.group position={exp(0, -0.2, 0)}>
        {/* Base Estrutural Tubular */}
        <group position={[0, baseY, 0]}>
          {/* Quadro Metalon 30x30 */}
          <Box args={[w, 0.03, 0.03]} position={[0, 0, -d/2 + 0.015]}>{matAcoCarbono}</Box>
          <Box args={[w, 0.03, 0.03]} position={[0, 0, d/2 - 0.015]}>{matAcoCarbono}</Box>
          <Box args={[0.03, 0.03, d - 0.06]} position={[-w/2 + 0.015, 0, 0]}>{matAcoCarbono}</Box>
          <Box args={[0.03, 0.03, d - 0.06]} position={[w/2 - 0.015, 0, 0]}>{matAcoCarbono}</Box>
          
          {/* Malha Inferior (Estrado) */}
          <Box args={[w - 0.06, 0.005, d - 0.06]} position={[0, 0.015, 0]}>
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.4} transparent opacity={0.8} wireframe />
          </Box>
          
          {explodedFactor > 0.6 && <Label text="Base Estrutural (Metalon 30x30mm)" position={[0, 0.05, d/2]} />}
          {explodedFactor > 0.6 && <Label text="Malha Inferior (Estrado)" position={[0, 0.05, 0]} />}
        </group>

        {/* Rodízios Fixos (Dianteiros) - Z positivo */}
        {[-w/2 + 0.1, w/2 - 0.1].map((posX, i) => (
          <group key={`rodizio-fixo-${i}`} position={[posX, 0.05, d/2 - 0.1]}>
            <Cylinder args={[0.05, 0.05, 0.04, 32]} rotation={[0, 0, Math.PI/2]}>{matNylon}</Cylinder>
            <group position={[0, 0.05, 0]}>
              <Box args={[0.05, 0.08, 0.06]}><meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} transparent opacity={0.8} /></Box>
              <Box args={[0.08, 0.01, 0.1]} position={[0, 0.045, 0]}>{matZincado}</Box>
            </group>
            {explodedFactor > 0.6 && i === 0 && <Label text="Rodízio Fixo de Nylon" position={[0, -0.05, 0]} />}
          </group>
        ))}

        {/* Rodízios Giratórios (Traseiros) - Z negativo */}
        {[-w/2 + 0.1, w/2 - 0.1].map((posX, i) => (
          <group key={`rodizio-giratorio-${i}`} position={[posX, 0.05, -d/2 + 0.1]}>
            <Cylinder args={[0.05, 0.05, 0.04, 32]} rotation={[0, 0, Math.PI/2]}>{matNylon}</Cylinder>
            <group position={[0, 0.05, -0.02]} rotation={[0.2, 0, 0]}>
              <Box args={[0.05, 0.08, 0.06]}><meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} transparent opacity={0.8} /></Box>
            </group>
            <group position={[0, 0.09, 0]}>
              <Cylinder args={[0.03, 0.03, 0.02, 16]}>{matZincado}</Cylinder>
              <Box args={[0.08, 0.01, 0.1]} position={[0, 0.015, 0]}>{matZincado}</Box>
            </group>
            {explodedFactor > 0.6 && i === 0 && <Label text="Rodízio Giratório de Nylon" position={[0, -0.05, 0]} />}
          </group>
        ))}
      </animated.group>

      {/* GRUPO 2: FECHAMENTOS ARAMADOS (Laterais e Fundo) */}
      
      {/* Painel Lateral Esquerdo */}
      <animated.group position={exp(-0.4, 0, 0)}>
        <group position={[-w/2 + 0.0125, baseY + 0.015 + h/2, 0]}>
          <Box args={[0.025, h, d]}>{matMalha}</Box>
          {/* Quadro tubular */}
          <Box args={[0.025, h, 0.025]} position={[0, 0, -d/2 + 0.0125]}>{matAcoCarbono}</Box>
          <Box args={[0.025, h, 0.025]} position={[0, 0, d/2 - 0.0125]}>{matAcoCarbono}</Box>
          <Box args={[0.025, 0.025, d - 0.05]} position={[0, h/2 - 0.0125, 0]}>{matAcoCarbono}</Box>
          {explodedFactor > 0.6 && <Label text="Painel Lateral Aramado (Esq)" position={[-0.1, 0, 0]} />}
        </group>
      </animated.group>

      {/* Painel Lateral Direito */}
      <animated.group position={exp(0.4, 0, 0)}>
        <group position={[w/2 - 0.0125, baseY + 0.015 + h/2, 0]}>
          <Box args={[0.025, h, d]}>{matMalha}</Box>
          {/* Quadro tubular */}
          <Box args={[0.025, h, 0.025]} position={[0, 0, -d/2 + 0.0125]}>{matAcoCarbono}</Box>
          <Box args={[0.025, h, 0.025]} position={[0, 0, d/2 - 0.0125]}>{matAcoCarbono}</Box>
          <Box args={[0.025, 0.025, d - 0.05]} position={[0, h/2 - 0.0125, 0]}>{matAcoCarbono}</Box>
          {explodedFactor > 0.6 && <Label text="Painel Lateral Aramado (Dir)" position={[0.1, 0, 0]} />}
        </group>
      </animated.group>

      {/* Painel Traseiro */}
      <animated.group position={exp(0, 0, -0.4)}>
        <group position={[0, baseY + 0.015 + h/2, -d/2 + 0.0125]}>
          <Box args={[w - 0.05, h, 0.025]}>{matMalha}</Box>
          {/* Quadro tubular */}
          <Box args={[w - 0.05, 0.025, 0.025]} position={[0, h/2 - 0.0125, 0]}>{matAcoCarbono}</Box>
          {explodedFactor > 0.6 && <Label text="Painel Traseiro Aramado" position={[0, 0, -0.1]} />}
          
          {/* Placa de Identificação (Lousa) */}
          <Box args={[0.25, 0.15, 0.002]} position={[0, h/2 - 0.15, 0.015]}>
            {matLousa}
          </Box>
          {explodedFactor > 0.6 && <Label text="Placa de Identificação (Lousa)" position={[0, h/2 - 0.15, 0.05]} />}
        </group>
      </animated.group>

      {/* GRUPO 3: PORTA FRONTAL E PRATELEIRA */}
      
      {/* Porta Frontal Esquerda */}
      <animated.group 
        position={[-w/2 + 0.025, baseY + 0.015 + h/2, d/2 - 0.0125]} 
        rotation-y={explodedFactor * (Math.PI / 2)}
      >
        <animated.group position={exp(0, 0, 0.2)}>
          <group position={[(w/2 - 0.025)/2, 0, 0]}>
            <Box args={[w/2 - 0.025, h, 0.025]}>{matMalha}</Box>
            <Box args={[w/2 - 0.025, 0.025, 0.025]} position={[0, h/2 - 0.0125, 0]}>{matAcoCarbono}</Box>
            <Box args={[w/2 - 0.025, 0.025, 0.025]} position={[0, -h/2 + 0.0125, 0]}>{matAcoCarbono}</Box>
            <Box args={[0.025, h - 0.05, 0.025]} position={[(w/2 - 0.025)/2 - 0.0125, 0, 0]}>{matAcoCarbono}</Box>
            
            {/* Dobradiças */}
            <Cylinder args={[0.015, 0.015, 0.05]} position={[-(w/2 - 0.025)/2, h/4, 0]}>{matZincado}</Cylinder>
            <Cylinder args={[0.015, 0.015, 0.05]} position={[-(w/2 - 0.025)/2, -h/4, 0]}>{matZincado}</Cylinder>
            
            {explodedFactor > 0.6 && <Label text="Porta Frontal (Esq)" position={[0, 0, 0.1]} />}
          </group>
        </animated.group>
      </animated.group>

      {/* Porta Frontal Direita */}
      <animated.group 
        position={[w/2 - 0.025, baseY + 0.015 + h/2, d/2 - 0.0125]} 
        rotation-y={explodedFactor * (-Math.PI / 2)}
      >
        <animated.group position={exp(0, 0, 0.2)}>
          <group position={[-(w/2 - 0.025)/2, 0, 0]}>
            <Box args={[w/2 - 0.025, h, 0.025]}>{matMalha}</Box>
            <Box args={[w/2 - 0.025, 0.025, 0.025]} position={[0, h/2 - 0.0125, 0]}>{matAcoCarbono}</Box>
            <Box args={[w/2 - 0.025, 0.025, 0.025]} position={[0, -h/2 + 0.0125, 0]}>{matAcoCarbono}</Box>
            <Box args={[0.025, h - 0.05, 0.025]} position={[-(w/2 - 0.025)/2 + 0.0125, 0, 0]}>{matAcoCarbono}</Box>
            
            {/* Dobradiças */}
            <Cylinder args={[0.015, 0.015, 0.05]} position={[(w/2 - 0.025)/2, h/4, 0]}>{matZincado}</Cylinder>
            <Cylinder args={[0.015, 0.015, 0.05]} position={[(w/2 - 0.025)/2, -h/4, 0]}>{matZincado}</Cylinder>
            
            {/* Trava Central */}
            <Box args={[0.06, 0.02, 0.03]} position={[-(w/2 - 0.025)/2, 0, 0.015]}>{matZincado}</Box>

            {explodedFactor > 0.6 && <Label text="Porta Frontal (Dir)" position={[0, 0, 0.1]} />}
            {explodedFactor > 0.6 && <Label text="Trava Central" position={[-(w/2 - 0.025)/2, 0.05, 0.05]} />}
          </group>
        </animated.group>
      </animated.group>

      {/* Prateleira Intermediária */}
      <animated.group position={exp(0, 0.5, 0)}>
        <group position={[0, 0.85, 0]}>
          <Box args={[w - 0.05, 0.01, d - 0.05]}>
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.4} transparent opacity={0.8} wireframe />
          </Box>
          {/* Borda da prateleira */}
          <Box args={[w - 0.05, 0.015, 0.015]} position={[0, 0, d/2 - 0.025]}>{matAcoCarbono}</Box>
          <Box args={[w - 0.05, 0.015, 0.015]} position={[0, 0, -d/2 + 0.025]}>{matAcoCarbono}</Box>
          {explodedFactor > 0.6 && <Label text="Prateleira Intermediária" position={[0, 0.1, 0]} />}
        </group>
      </animated.group>

      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          {/* Altura Total */}
          <Cota3D
            pontoInicio={[w/2 + 0.1, 0, d/2]}
            pontoFim={[w/2 + 0.1, baseY + h, d/2]}
            valorTexto="1650 mm"
            offset={[0.1, 0, 0]}
            cor="#3b82f6"
          />
          {/* Largura Total */}
          <Cota3D
            pontoInicio={[-w/2, baseY + h + 0.1, d/2]}
            pontoFim={[w/2, baseY + h + 0.1, d/2]}
            valorTexto="800 mm"
            offset={[0, 0.1, 0]}
            cor="#3b82f6"
          />
          {/* Profundidade Total */}
          <Cota3D
            pontoInicio={[-w/2 - 0.1, baseY + h/2, -d/2]}
            pontoFim={[-w/2 - 0.1, baseY + h/2, d/2]}
            valorTexto="700 mm"
            offset={[-0.1, 0, 0]}
            cor="#3b82f6"
          />
        </>
      )}

    </group>
  );
};
