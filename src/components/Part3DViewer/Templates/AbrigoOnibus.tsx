import React from 'react';
import { Box, Cylinder, Html } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { Cota3D } from '../Cota3D';

interface AbrigoOnibusProps {
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

export const AbrigoOnibus: React.FC<AbrigoOnibusProps> = ({
  explodedFactor = 0,
  mostrarCotas = false,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        {
          code: 'AO-01',
          name: 'Pilares Traseiros (Metalon 100x100x3mm)',
          quantity: 3 * 2.5, // 3 pilares de 2.5m
          unit: 'm',
          material: 'Metalon 100x100x3.0mm',
          weight: (3 * 2.5) * 9.0,
          cost: (3 * 2.5) * 65.0
        },
        {
          code: 'AO-02',
          name: 'Vigas de Cobertura (Metalon 100x50x2mm)',
          quantity: 3 * 1.5, // 3 vigas de 1.5m
          unit: 'm',
          material: 'Metalon 100x50x2.0mm',
          weight: (3 * 1.5) * 4.5,
          cost: (3 * 1.5) * 35.0
        },
        {
          code: 'AO-03',
          name: 'Cobertura (Policarbonato Alveolar 6mm)',
          quantity: 4.0 * 1.6, // 4m x 1.6m
          unit: 'm²',
          material: 'Policarbonato Alveolar 6mm',
          weight: (4.0 * 1.6) * 1.3,
          cost: (4.0 * 1.6) * 85.0
        },
        {
          code: 'AO-04',
          name: 'Fechamento Traseiro (Vidro Temperado 8mm)',
          quantity: 3.6 * 2.0, // 3.6m x 2.0m
          unit: 'm²',
          material: 'Vidro Temperado 8mm Incolor',
          weight: (3.6 * 2.0) * 20.0,
          cost: (3.6 * 2.0) * 180.0
        },
        {
          code: 'AO-05',
          name: 'Banco (Madeira Plástica)',
          quantity: 3.0, // 3 metros
          unit: 'm',
          material: 'Perfil Madeira Plástica',
          weight: 3.0 * 5.0,
          cost: 3.0 * 120.0
        },
        {
          code: 'AO-06',
          name: 'Painel Publicitário (MUPI)',
          quantity: 1,
          unit: 'cj',
          material: 'Caixa Metálica com Acrílico e LED',
          weight: 45.0,
          cost: 1200.0
        }
      ];
      onBOMCalculated(bom);
    }
  }, [onBOMCalculated]);

  // Materiais
  const matAcoCarbono = <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />;
  const matPolicarbonato = <meshPhysicalMaterial color="#f8fafc" transmission={0.6} opacity={0.8} transparent roughness={0.2} />;
  const matVidro = <meshPhysicalMaterial color="#e2e8f0" transmission={0.9} opacity={1} transparent roughness={0.1} thickness={0.01} />;
  const matInox = <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />;
  const matMupi = <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />;
  const matMadeira = <meshStandardMaterial color="#854d0e" roughness={0.8} />;

  return (
    <group position={[0, 1.25, 0]}> {/* Centro Y em 1.25 para base no chão */}
      
      {/* GRUPO 1: ESTRUTURA PRINCIPAL */}
      <animated.group position={exp(0, 0, -0.5)}>
        {/* Pilares Traseiros */}
        {[-1.8, 0.0, 1.8].map((posX, i) => (
          <group key={`pilar-${i}`} position={[posX, 0, -0.70]}>
            <Box args={[0.10, 2.50, 0.10]}>
              {matAcoCarbono}
            </Box>
            {/* Sapatas de Fixação */}
            <Box args={[0.20, 0.012, 0.20]} position={[0, -1.25 + 0.006, 0]}>
              {matAcoCarbono}
            </Box>
            {explodedFactor > 0.6 && i === 1 && <Label text="Pilares Traseiros (Metalon 100x100)" position={[0, 0, 0.1]} />}
            {explodedFactor > 0.6 && i === 1 && <Label text="Sapatas de Fixação (1/2 pol)" position={[0, -1.2, 0.15]} />}
          </group>
        ))}

        {/* Longarinas da Cobertura */}
        <group position={[0, 1.25 - 0.04, 0]}>
          <Box args={[4.00, 0.08, 0.04]} position={[0, 0, -0.78]}>
            {matAcoCarbono}
          </Box>
          <Box args={[4.00, 0.08, 0.04]} position={[0, 0, 0.78]}>
            {matAcoCarbono}
          </Box>
          {explodedFactor > 0.6 && <Label text="Longarinas da Cobertura (80x40)" position={[0, 0.1, 0.8]} />}
        </group>

        {/* Travessas da Cobertura */}
        {[-1.8, -0.6, 0.6, 1.8].map((posX, i) => (
          <group key={`travessa-${i}`} position={[posX, 1.25 - 0.04, 0]}>
            <Box args={[0.04, 0.08, 1.60]}>
              {matAcoCarbono}
            </Box>
            {explodedFactor > 0.6 && i === 1 && <Label text="Travessas da Cobertura (80x40)" position={[0, 0.1, 0]} />}
          </group>
        ))}
      </animated.group>

      {/* GRUPO 2: FECHAMENTOS TRANSLÚCIDOS E FIXAÇÃO */}
      <animated.group position={exp(0, 0.8, -0.2)}>
        {/* Teto (Policarbonato Alveolar) */}
        <group position={[0, 1.25 + 0.005, 0]}>
          <Box args={[4.20, 0.01, 1.80]}>
            {matPolicarbonato}
          </Box>
          {explodedFactor > 0.6 && <Label text="Teto (Policarbonato Alveolar 10mm)" position={[0, 0.1, 0]} />}
        </group>

        {/* Vidros Traseiros */}
        {[-0.9, 0.9].map((posX, i) => (
          <group key={`vidro-${i}`} position={[posX, 0, -0.70 + 0.06]}>
            <Box args={[1.75, 2.00, 0.01]}>
              {matVidro}
            </Box>
            {/* Garras (Prolongadores Inox) */}
            {[[-0.8, 0.9], [0.8, 0.9], [-0.8, -0.9], [0.8, -0.9]].map(([gX, gY], j) => (
              <Cylinder key={`garra-${i}-${j}`} args={[0.02, 0.02, 0.04]} position={[gX, gY, -0.02]} rotation={[Math.PI/2, 0, 0]}>
                {matInox}
              </Cylinder>
            ))}
            {explodedFactor > 0.6 && i === 0 && <Label text="Vidro Traseiro (Temperado 10mm)" position={[0, 0, 0.1]} />}
            {explodedFactor > 0.6 && i === 0 && <Label text="Garras (Prolongadores Inox)" position={[-0.8, 0.9, 0.1]} />}
          </group>
        ))}
      </animated.group>

      {/* GRUPO 3: PAINEL DE PUBLICIDADE (MUPI Lateral) */}
      <animated.group position={exp(0.8, 0, 0)}>
        <group position={[1.8, -0.15, 0]}>
          {/* Caixa Estrutural do MUPI */}
          <Box args={[0.20, 2.20, 1.30]}>
            {matMupi}
          </Box>
          {/* Vidro Frontal do MUPI */}
          <Box args={[0.008, 2.00, 1.10]} position={[-0.104, 0, 0]}>
            {matVidro}
          </Box>
          {/* Rodapé do MUPI */}
          <Box args={[0.21, 0.15, 1.31]} position={[0, -1.025, 0]}>
            <meshStandardMaterial color="#0f172a" />
          </Box>
          {explodedFactor > 0.6 && <Label text="Caixa Estrutural do MUPI (Chapa 2mm)" position={[0.15, 0, 0]} />}
          {explodedFactor > 0.6 && <Label text="Vidro Frontal do MUPI (Temperado 8mm)" position={[-0.15, 0, 0]} />}
          {explodedFactor > 0.6 && <Label text="Rodapé do MUPI" position={[0, -1.1, 0.65]} />}
        </group>
      </animated.group>

      {/* GRUPO 4: MOBILIÁRIO URBANO (Banco e Lixeira) */}
      <animated.group position={exp(0, 0, 0.8)}>
        {/* Banco */}
        <group position={[0, -1.25, -0.2]}>
          {/* Pés do Banco */}
          {[-0.8, 0.8].map((posX, i) => (
            <group key={`pe-banco-${i}`} position={[posX, 0.225, 0]}>
              <Box args={[0.008, 0.45, 0.40]}>
                {matAcoCarbono}
              </Box>
              {explodedFactor > 0.6 && i === 0 && <Label text="Pés do Banco (Chapa 8mm)" position={[-0.1, 0, 0]} />}
            </group>
          ))}
          {/* Assento (Ripas) */}
          <group position={[0, 0.45, 0]}>
            {[-0.15, -0.05, 0.05, 0.15].map((posZ, i) => (
              <Box key={`assento-${i}`} args={[2.00, 0.04, 0.10]} position={[0, 0, posZ]}>
                {matMadeira}
              </Box>
            ))}
            {explodedFactor > 0.6 && <Label text="Assento (Ripas de Madeira Tratada)" position={[0, 0.1, 0]} />}
          </group>
          {/* Encosto (Ripas) */}
          <group position={[0, 0.65, -0.18]} rotation={[0.2, 0, 0]}>
            {[-0.07, 0.07].map((posY, i) => (
              <Box key={`encosto-${i}`} args={[2.00, 0.12, 0.04]} position={[0, posY, 0]}>
                {matMadeira}
              </Box>
            ))}
            {explodedFactor > 0.6 && <Label text="Encosto (Ripas de Madeira Tratada)" position={[0, 0.2, 0]} />}
          </group>
        </group>

        {/* Lixeira Inox */}
        <group position={[-1.5, -1.25 + 0.30, 0.2]}>
          <Cylinder args={[0.20, 0.20, 0.60, 32, 1, true]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} side={THREE.DoubleSide} />
          </Cylinder>
          {/* Fundo da lixeira */}
          <Cylinder args={[0.20, 0.20, 0.01, 32]} position={[0, -0.30, 0]}>
            {matInox}
          </Cylinder>
          {explodedFactor > 0.6 && <Label text="Lixeira Inox (Chapa 2mm)" position={[0, 0.4, 0]} />}
        </group>
      </animated.group>

      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          {/* Altura Total */}
          <Cota3D
            pontoInicio={[2.2, -1.25, 0]}
            pontoFim={[2.2, 1.25, 0]}
            valorTexto="2500 mm"
            offset={[0.2, 0, 0]}
            cor="#3b82f6"
          />
          {/* Comprimento Total */}
          <Cota3D
            pontoInicio={[-2.1, -1.25, 0.9]}
            pontoFim={[2.1, -1.25, 0.9]}
            valorTexto="4200 mm"
            offset={[0, 0, 0.2]}
            cor="#3b82f6"
          />
          {/* Profundidade Total */}
          <Cota3D
            pontoInicio={[-2.1, -1.25, -0.9]}
            pontoFim={[-2.1, -1.25, 0.9]}
            valorTexto="1800 mm"
            offset={[-0.2, 0, 0]}
            cor="#3b82f6"
          />
        </>
      )}

    </group>
  );
};
