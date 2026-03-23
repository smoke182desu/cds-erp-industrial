import React, { useState, useEffect } from 'react';
import { Box, Cylinder, Html } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import { Cota3D } from '../Cota3D';
import { PerfilData } from '../../../data/perfisDB';
import { AcabamentoMetalKey } from '../../../data/materiaisDB';

interface PortaoDeslizanteProps {
  largura: number;
  altura: number;
  perfilData: PerfilData;
  perfilTrilhoData?: PerfilData;
  perfilGuiaData?: PerfilData;
  perfilBatenteData?: PerfilData;
  perfilColunaPortaoData?: PerfilData;
  incluirPortaoPedestre?: boolean;
  quantidadeGrades: number;
  tipoMontagem: 'reto' | 'meia-esquadria';
  anguloAbertura?: number; 
  aberto?: boolean;
  acabamentoMetal?: AcabamentoMetalKey;
  mostrarCotas?: boolean;
  explodedFactor?: number;
  onBOMCalculated?: (bom: any[]) => void;
}

const PART_COLORS = {
  TRILHO: '#475569',
  BATENTE: '#1e293b',
  GUIA: '#334155',
  QUADRO: '#475569',
  REVESTIMENTO: '#334155',
  ROLDANA: '#1e293b',
};

const PART_CODES = {
  TRILHO: 'A',
  BATENTE: 'B',
  GUIA: 'C',
  QUADRO: 'D',
  REVESTIMENTO: 'E',
  ROLDANA: 'F',
};

const Label = ({ text, position }: { text: string, position: [number, number, number] }) => (
  <Html position={position} center distanceFactor={10}>
    <div className="bg-white/95 text-slate-900 px-2 py-0.5 rounded text-[7px] font-bold border border-slate-300 shadow-xl whitespace-nowrap pointer-events-none uppercase tracking-tighter">
      {text}
    </div>
  </Html>
);

export const PortaoDeslizante: React.FC<PortaoDeslizanteProps> = ({
  largura = 3000,
  altura = 2000,
  aberto = false,
  acabamentoMetal = 'preto_fosco',
  mostrarCotas = false,
  explodedFactor = 0,
  onBOMCalculated,
  perfilData,
  perfilTrilhoData,
  perfilGuiaData,
  perfilBatenteData,
  perfilColunaPortaoData,
  incluirPortaoPedestre
}) => {
  const [isAberto, setIsAberto] = useState(aberto);
  
  useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        {
          code: PART_CODES.TRILHO,
          name: 'Peça A - Trilho de Piso',
          color: PART_COLORS.TRILHO,
          quantity: 1,
          material: `${perfilTrilhoData?.nome || 'Cantoneira V'} (${largura * 2}mm)`
        },
        {
          code: PART_CODES.BATENTE,
          name: 'Peça B - Batente de Recebimento',
          color: PART_COLORS.BATENTE,
          quantity: 1,
          material: `${perfilBatenteData?.nome || 'Perfil U'} (${altura}mm)`
        },
        {
          code: PART_CODES.GUIA,
          name: 'Peça C - Guia Superior',
          color: PART_COLORS.GUIA,
          quantity: 1,
          material: `${perfilGuiaData?.nome || 'Perfil U'} (${largura}mm)`
        },
        {
          code: PART_CODES.QUADRO,
          name: 'Peça D - Quadro da Folha',
          color: PART_COLORS.QUADRO,
          quantity: 1,
          material: `${perfilData.nome} (${(largura * 2 + altura * 2)}mm total)`
        },
        {
          code: PART_CODES.ROLDANA,
          name: 'Peça F - Roldanas',
          color: PART_COLORS.ROLDANA,
          quantity: 2,
          material: 'Roldana de Aço 3"'
        }
      ];

      if (incluirPortaoPedestre) {
        bom.push({
          code: 'P',
          name: 'Peça P - Portão Social Embutido',
          color: '#6366f1',
          quantity: 1,
          material: `${perfilData.nome} (Kit Completo)`
        });
      }

      onBOMCalculated(bom);
    }
  }, [largura, altura, perfilData, perfilTrilhoData, perfilGuiaData, perfilBatenteData, incluirPortaoPedestre, onBOMCalculated]);
  
  useEffect(() => {
    setIsAberto(aberto);
  }, [aberto]);

  const handleToggle = (e: any) => {
    e.stopPropagation();
    setIsAberto(!isAberto);
  };

  const L = largura / 1000;
  const A = altura / 1000;
  
  // Dimensões
  const espessuraPerfil = 0.05;
  const L_folha = L;
  const A_folha = A - 0.08; // Desconta trilho e roldana
  const deslocamentoMaximo = L - 0.1; // Abre quase tudo
  
  const { slideX } = useSpring({
    slideX: isAberto ? deslocamentoMaximo : 0,
    config: { mass: 5, tension: 120, friction: 40 }
  });

  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  return (
    <group onClick={handleToggle}>
      
      {/* 1. ESTRUTURA FIXA E TRILHOS */}
      <group name="EstruturaFixa">
        
        {/* Trilho de Piso (Cantoneira em V sobre base plana) */}
        <group position={exp(0, -0.4, 0)}>
          {/* Base plana */}
          <Box args={[L * 2 + 0.2, 0.01, 0.1]} position={[L/2, 0.005, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          {/* V invertido */}
          <Box args={[L * 2 + 0.2, 0.02, 0.02]} position={[L/2, 0.015, 0]} rotation={[0, 0, 0]}>
            <meshStandardMaterial color="#94a3b8" />
          </Box>
          {explodedFactor > 0.5 && <Label text="Trilho de Piso (Cantoneira em V)" position={[L/2, -0.1, 0]} />}
        </group>

        {/* Coluna de Fechamento (Pilar Batente) e Batente de Recebimento */}
        <group position={exp(-0.8, 0, 0)}>
          {/* Pilar */}
          <Box args={[0.08, A + 0.1, 0.08]} position={[-L/2 - 0.09, (A + 0.1)/2, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          {/* Batente Perfil U */}
          <group position={[-L/2 - 0.05, A/2, 0]}>
            {/* Fundo do U */}
            <Box args={[0.02, A, 0.08]} position={[-0.03, 0, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
            {/* Abas do U */}
            <Box args={[0.04, A, 0.02]} position={[-0.01, 0, -0.03]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
            <Box args={[0.04, A, 0.02]} position={[-0.01, 0, 0.03]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
          </group>
          {explodedFactor > 0.6 && <Label text="Coluna de Fechamento" position={[-L/2 - 0.15, A/2, 0]} />}
          {explodedFactor > 0.6 && <Label text="Batente de Recebimento (Perfil U)" position={[-L/2 - 0.05, A/2 + 0.2, 0]} />}
        </group>

        {/* Coluna de Guia (Pilar Principal) e Guia Superior */}
        <group position={exp(0.8, 0, 0)}>
          {/* Pilar Principal */}
          <Box args={[0.08, A + 0.1, 0.08]} position={[L/2 + 0.09, (A + 0.1)/2, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          {explodedFactor > 0.6 && <Label text="Coluna de Guia" position={[L/2 + 0.15, A/2, 0]} />}
          
          {/* Guia Superior (Cavalete com Roletes) */}
          <group position={[0, exp(0, 0.4, 0)[1], 0]}>
            <group position={[L/2 + 0.05, A + 0.05, 0]}>
              {/* Suporte L/U invertido (Braço Horizontal) */}
              <Box args={[0.1, 0.02, 0.2]} position={[0, 0.03, 0.05]}>
                <meshStandardMaterial color="#334155" />
              </Box>
              {/* Suporte L/U invertido (Pilar Vertical) */}
              <Box args={[0.05, 0.2, 0.02]} position={[0.025, -0.06, -0.04]}>
                <meshStandardMaterial color="#334155" />
              </Box>
              {/* Roletes de Nylon (Verticais) */}
              <Cylinder args={[0.02, 0.02, 0.08]} position={[-0.02, -0.02, 0.005]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.8} />
              </Cylinder>
              <Cylinder args={[0.02, 0.02, 0.08]} position={[-0.02, -0.02, 0.11]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.8} />
              </Cylinder>
            </group>
            {explodedFactor > 0.6 && <Label text="Guia Superior (Cavalete c/ Roletes)" position={[L/2 + 0.05, A + 0.2, 0]} />}
          </group>
        </group>

      </group>

      {/* 3. KIT DE AUTOMAÇÃO (Fixo no chão) */}
      <group name="AutomacaoFixa" position={exp(1.2, 0, -0.6)}>
        {/* Motorredutor Deslizante */}
        <group position={[L/2 + 0.2, 0.15, -0.1]}>
          {/* Base/Corpo */}
          <Box args={[0.25, 0.25, 0.2]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#1e293b" />
          </Box>
          {/* Capa do Motor */}
          <Cylinder args={[0.08, 0.08, 0.2]} position={[0, 0.05, 0]} rotation={[0, 0, Math.PI/2]}>
            <meshStandardMaterial color="#334155" />
          </Cylinder>
          {/* Engrenagem (Pinhão) */}
          <Cylinder args={[0.04, 0.04, 0.03]} position={[-0.05, -0.05, 0.11]} rotation={[Math.PI/2, 0, 0]}>
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </Cylinder>
        </group>
        {explodedFactor > 0.6 && <Label text="Motorredutor Deslizante" position={[L/2 + 0.2, 0.4, -0.1]} />}
      </group>

      {/* 2. FOLHA DO PORTÃO E COMPONENTES MÓVEIS */}
      <animated.group 
        name="ComponentesMoveis" 
        position={slideX.to(x => [x, 0, 0])}
      >
        {/* Roldanas Inferiores */}
        <group position={exp(0, -0.3, 0)}>
          {/* Roldana Esq */}
          <group position={[-L_folha/2 + 0.2, 0.04, 0]}>
            <Cylinder args={[0.04, 0.04, 0.03]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#64748b" />
            </Cylinder>
            {/* Sulco em V */}
            <Cylinder args={[0.03, 0.04, 0.01]} position={[0, 0, -0.015]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Cylinder>
            <Cylinder args={[0.04, 0.03, 0.01]} position={[0, 0, 0.015]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Cylinder>
          </group>
          {/* Roldana Dir */}
          <group position={[L_folha/2 - 0.2, 0.04, 0]}>
            <Cylinder args={[0.04, 0.04, 0.03]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#64748b" />
            </Cylinder>
            {/* Sulco em V */}
            <Cylinder args={[0.03, 0.04, 0.01]} position={[0, 0, -0.015]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Cylinder>
            <Cylinder args={[0.04, 0.03, 0.01]} position={[0, 0, 0.015]} rotation={[Math.PI/2, 0, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Cylinder>
          </group>
          {explodedFactor > 0.6 && <Label text="Roldanas Inferiores (Canal em V)" position={[-L_folha/2 + 0.2, -0.1, 0]} />}
        </group>

        {/* Cremalheira e Ímãs */}
        <group position={exp(0, -0.2, -0.4)}>
          {/* Barra da Cremalheira */}
          <Box args={[L_folha, 0.03, 0.02]} position={[0, 0.1, -0.04]}>
            <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.5} />
          </Box>
          {/* Dentes da Cremalheira (Simulados com textura/cor) */}
          <Box args={[L_folha, 0.01, 0.02]} position={[0, 0.08, -0.04]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          {explodedFactor > 0.6 && <Label text="Cremalheira" position={[0, 0.15, -0.04]} />}

          {/* Ímãs de Fim de Curso */}
          <Box args={[0.04, 0.05, 0.03]} position={[-L_folha/2 + 0.05, 0.12, -0.04]}>
            <meshStandardMaterial color="#ef4444" />
          </Box>
          <Box args={[0.04, 0.05, 0.03]} position={[L_folha/2 - 0.05, 0.12, -0.04]}>
            <meshStandardMaterial color="#ef4444" />
          </Box>
          {explodedFactor > 0.6 && <Label text="Ímãs Fim de Curso" position={[-L_folha/2 + 0.05, 0.2, -0.04]} />}
        </group>

        {/* Quadro Estrutural (Metalon) */}
        <group name="QuadroEstrutural" position={exp(0, 0, -0.2)}>
          {/* Montantes (Verticais) */}
          <Box args={[espessuraPerfil, A_folha, espessuraPerfil]} position={[-L_folha/2 + espessuraPerfil/2, A_folha/2 + 0.08, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          <Box args={[espessuraPerfil, A_folha, espessuraPerfil]} position={[L_folha/2 - espessuraPerfil/2, A_folha/2 + 0.08, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          <Box args={[espessuraPerfil, A_folha, espessuraPerfil]} position={[0, A_folha/2 + 0.08, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          
          {/* Travessas (Horizontais) */}
          <Box args={[L_folha, espessuraPerfil, espessuraPerfil]} position={[0, A_folha + 0.08 - espessuraPerfil/2, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          <Box args={[L_folha, espessuraPerfil, espessuraPerfil]} position={[0, A_folha/2 + 0.08, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          <Box args={[L_folha, espessuraPerfil, espessuraPerfil]} position={[0, 0.08 + espessuraPerfil/2, 0]}>
            <meshStandardMaterial color="#475569" />
          </Box>
          {explodedFactor > 0.5 && <Label text="Quadro Estrutural (Metalon)" position={[0, A_folha + 0.2, 0]} />}
        </group>

        {/* Revestimento Frontal (Lambril) */}
        <group name="Revestimento" position={exp(0, 0, 0.4)}>
          <Box args={[L_folha, A_folha, 0.01]} position={[0, A_folha/2 + 0.08, espessuraPerfil/2 + 0.01]}>
            <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.6} />
          </Box>
          {/* Frisos Horizontais do Lambril */}
          {Array.from({ length: 15 }).map((_, i) => (
            <Box 
              key={i} 
              args={[L_folha - 0.02, 0.005, 0.005]} 
              position={[0, 0.08 + (A_folha / 16) * (i + 1), espessuraPerfil/2 + 0.016]}
            >
              <meshStandardMaterial color="#1e293b" />
            </Box>
          ))}
          {explodedFactor > 0.5 && <Label text="Revestimento Lambril" position={[0, A_folha/2, 0.1]} />}
        </group>

      </animated.group>

      {/* COTAS DIMENSIONAIS */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          <Cota3D
            pontoInicio={[-L/2, 0, 0]}
            pontoFim={[L/2, 0, 0]}
            valorTexto={`${largura} mm`}
            offset={[0, -0.3, 0.1]}
            cor="#3b82f6"
          />
          <Cota3D
            pontoInicio={[L/2 + 0.2, 0, 0]}
            pontoFim={[L/2 + 0.2, A, 0]}
            valorTexto={`${altura} mm`}
            offset={[0.1, 0, 0]}
            cor="#3b82f6"
          />
          <Cota3D
            pontoInicio={[-L/2, 0, 0]}
            pontoFim={[L * 1.5, 0, 0]}
            valorTexto={`Abertura Total: ${largura * 2} mm`}
            offset={[0, -0.6, 0.1]}
            cor="#10b981"
          />
        </>
      )}
    </group>
  );
};

