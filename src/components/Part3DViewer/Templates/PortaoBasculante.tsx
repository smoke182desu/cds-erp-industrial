import React from 'react';
import { Box, Cylinder, Html, Sphere } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import { Cota3D } from '../Cota3D';
import { perfisDB } from '../../../data/perfisDB';

import { QuadroNode } from '../QuadroNode';

interface PortaoBasculanteProps {
  largura: number; // em mm
  altura: number;  // em mm
  anguloAbertura?: number; // em radianos (se passado via props)
  aberto?: boolean;        // toggle para animação
  acabamentoMetal?: string;
  color?: string;
  revestimento?: 'chapa' | 'grade' | 'madeira';
  mostrarCotas?: boolean;
  explodedFactor?: number;
  onBOMCalculated?: (bom: any[]) => void;
  perfilQuadroId?: string;
  perfilCaixaId?: string;
  perfilTrilhoId?: string;
  perfilTravessaId?: string;
  perfilBracoId?: string;
  perfilMontanteId?: string;
  perfilGradeId?: string;
}

const PART_COLORS = {
  CAIXA: '#1e293b',
  TRILHO: '#475569',
  TRAVESSA: '#0f172a',
  MANCAL: '#64748b',
  MOTOR: '#334155',
  CALHA: '#94a3b8',
  POLIA: '#64748b',
  CONTRAPESO: '#334155',
  BRACO: '#94a3b8',
  CABO: '#cbd5e1',
  ROLDANA: '#1e293b',
  QUADRO: '#475569',
  REVESTIMENTO: '#334155',
};

const PART_CODES = {
  CAIXA: 'A',
  TRILHO: 'B',
  TRAVESSA: 'C',
  MANCAL: 'D',
  MOTOR: 'E',
  CALHA: 'F',
  POLIA: 'G',
  CONTRAPESO: 'H',
  BRACO: 'I',
  CABO: 'J',
  ROLDANA: 'K',
  QUADRO: 'L',
  REVESTIMENTO: 'M',
};

const Label = ({ text, position }: { text: string, position: [number, number, number] }) => (
  <Html position={position} center distanceFactor={10}>
    <div className="bg-white/95 text-slate-900 px-2 py-0.5 rounded text-[7px] font-bold border border-slate-300 shadow-xl whitespace-nowrap pointer-events-none uppercase tracking-tighter">
      {text}
    </div>
  </Html>
);

export const PortaoBasculante: React.FC<PortaoBasculanteProps> = ({
  largura = 3000,
  altura = 2500,
  aberto = false,
  acabamentoMetal = 'preto_fosco',
  color = '#334155',
  revestimento = 'chapa',
  mostrarCotas = false,
  explodedFactor = 0,
  onBOMCalculated,
  perfilQuadroId,
  perfilCaixaId,
  perfilTrilhoId,
  perfilTravessaId,
  perfilBracoId,
  perfilMontanteId,
  perfilGradeId
}) => {
  const [isAberto, setIsAberto] = React.useState(aberto);
  const [quadroBOM, setQuadroBOM] = React.useState<any[]>([]);
  
  React.useEffect(() => {
    setIsAberto(aberto);
  }, [aberto]);

  React.useEffect(() => {
    if (onBOMCalculated) {
      const getPerfilNome = (id?: string, fallback = 'Aço Carbono') => {
        if (!id) return fallback;
        return perfisDB.find(p => p.id === id)?.nome || fallback;
      };

      const baseBOM = [
        { code: PART_CODES.CAIXA, name: 'Peça A - Caixa de Contrapeso', color: PART_COLORS.CAIXA, quantity: 2, material: getPerfilNome(perfilCaixaId, 'Chapa Dobrada') },
        { code: PART_CODES.TRILHO, name: 'Peça B - Trilho Guia Interno', color: PART_COLORS.TRILHO, quantity: 2, material: getPerfilNome(perfilTrilhoId, 'Perfil U') },
        { code: PART_CODES.TRAVESSA, name: 'Peça C - Travessa Superior', color: PART_COLORS.TRAVESSA, quantity: 1, material: getPerfilNome(perfilTravessaId, 'Metalon Estrutural') },
        { code: PART_CODES.MANCAL, name: 'Peça D - Mancal de Articulação', color: PART_COLORS.MANCAL, quantity: 2, material: 'Aço Carbono' },
        { code: PART_CODES.MOTOR, name: 'Peça E - Motorredutor', color: PART_COLORS.MOTOR, quantity: 1, material: 'Kit Automação' },
        { code: PART_CODES.CALHA, name: 'Peça F - Calha de Acionamento', color: PART_COLORS.CALHA, quantity: 1, material: 'Perfil Fuso' },
        { code: PART_CODES.POLIA, name: 'Peça G - Polia Superior', color: PART_COLORS.POLIA, quantity: 2, material: 'Nylon/Aço' },
        { code: PART_CODES.CONTRAPESO, name: 'Peça H - Contrapeso Interno', color: PART_COLORS.CONTRAPESO, quantity: 2, material: 'Aço Maciço' },
        { code: PART_CODES.BRACO, name: 'Peça I - Braço Articulador', color: PART_COLORS.BRACO, quantity: 2, material: getPerfilNome(perfilBracoId, 'Metalon 50x30') },
        { code: PART_CODES.CABO, name: 'Peça J - Cabo de Aço', color: PART_COLORS.CABO, quantity: 2, material: 'Aço Galvanizado' },
        { code: PART_CODES.ROLDANA, name: 'Peça K - Roldana de Guia', color: PART_COLORS.ROLDANA, quantity: 2, material: 'Nylon' },
        { code: PART_CODES.QUADRO, name: 'Peça L - Quadro Estrutural', color: PART_COLORS.QUADRO, quantity: 1, material: getPerfilNome(perfilQuadroId, 'Metalon 50x50') },
        { code: PART_CODES.REVESTIMENTO, name: 'Peça M - Revestimento Lambril', color: color, quantity: 1, material: 'Chapa de Aço' },
      ];

      // Map QuadroNode codes to letters
      const mappedQuadroBOM = quadroBOM.map(item => {
        if (item.code === 'A') return { ...item, name: 'Peça N - Travessa do Quadro', code: 'N' };
        if (item.code === 'B') return { ...item, name: 'Peça O - Montante do Quadro', code: 'O' };
        if (item.code === 'C') return { ...item, name: 'Peça P - Grade Interna', code: 'P' };
        return item;
      });

      onBOMCalculated([...baseBOM, ...mappedQuadroBOM]);
    }
  }, [largura, altura, color, onBOMCalculated, perfilQuadroId, perfilCaixaId, perfilTrilhoId, perfilTravessaId, perfilBracoId, perfilMontanteId, perfilGradeId, quadroBOM]);

  const handleToggle = (e: any) => {
    e.stopPropagation();
    setIsAberto(!isAberto);
  };

  const L = largura / 1000;
  const A = altura / 1000;
  
  // Dimensões reais
  const larguraCaixa = 0.18;   
  const profundidadeCaixa = 0.18;
  const espessuraPerfil = 0.05; 
  const folgaLateral = 0.03;    
  const folgaInferior = 0.02;   
  
  const L_folha = L - (folgaLateral * 2);
  const A_folha = A - 0.05; 
  
  const alturaPinoNaFolha = A_folha / 2; // Eixo no centro da folha
  const posY_Fechado = alturaPinoNaFolha + folgaInferior; 
  
  const { theta } = useSpring({
    theta: isAberto ? -1.5 : 0,
    config: { mass: 2, tension: 100, friction: 30 }
  });

  const positionY = theta.to(t => posY_Fechado + (A / 2) * (1 - Math.cos(t)));
  const rotationX = theta;
  const rotacaoBracoX = theta.to(t => -t);
  
  const alturaContrapeso = 0.6;
  const folgaPisoContrapeso = 0.05;
  const Y_fechado_contrapeso = A - (alturaContrapeso / 2) - folgaPisoContrapeso;
  const Y_aberto_contrapeso = (alturaContrapeso / 2) + folgaPisoContrapeso;

  const contrapesoY = theta.to(t => {
    const progress = (1 - Math.cos(t)) / (1 - Math.cos(-1.5));
    return Y_fechado_contrapeso - progress * (Y_fechado_contrapeso - Y_aberto_contrapeso);
  });

  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  return (
    <group onClick={handleToggle}>
      
      {/* 1. ESTRUTURA FIXA */}
      <group name="EstruturaFixa">
        {/* Caixa Esquerda */}
        <group position={exp(-0.8, 0, 0)}>
          {/* Chapa Dobrada (Fundo, Lateral Externa, Frente) */}
          <group position={[-L/2 - larguraCaixa/2, A/2, 0]}>
            {/* Fundo */}
            <Box args={[larguraCaixa, A, 0.01]} position={[0, 0, -profundidadeCaixa/2]}>
              <meshStandardMaterial color={PART_COLORS.CAIXA} />
            </Box>
            {/* Lateral Externa */}
            <Box args={[0.01, A, profundidadeCaixa]} position={[-larguraCaixa/2, 0, 0]}>
              <meshStandardMaterial color={PART_COLORS.CAIXA} />
            </Box>
            {/* Frente */}
            <Box args={[larguraCaixa, A, 0.01]} position={[0, 0, profundidadeCaixa/2]}>
              <meshStandardMaterial color={PART_COLORS.CAIXA} />
            </Box>
          </group>
          
          {/* Trilho Guia Interno (Perfil U) */}
          <group position={[-L/2 - 0.02, A/2, 0]}>
            {/* Fundo do U */}
            <Box args={[0.01, A, 0.04]} position={[-0.015, 0, 0]}>
              <meshStandardMaterial color={PART_COLORS.TRILHO} />
            </Box>
            {/* Abas do U */}
            <Box args={[0.03, A, 0.01]} position={[0, 0, -0.015]}>
              <meshStandardMaterial color={PART_COLORS.TRILHO} />
            </Box>
            <Box args={[0.03, A, 0.01]} position={[0, 0, 0.015]}>
              <meshStandardMaterial color={PART_COLORS.TRILHO} />
            </Box>
          </group>
          {explodedFactor > 0.5 && <Label text="Caixa Contrapeso Esq." position={[-L/2 - larguraCaixa, A, 0]} />}
          {explodedFactor > 0.7 && <Label text="Trilho Guia (Perfil U)" position={[-L/2, A/2, 0]} />}
        </group>

        {/* Caixa Direita */}
        <group position={exp(0.8, 0, 0)}>
          {/* Chapa Dobrada (Fundo, Lateral Externa, Frente) */}
          <group position={[L/2 + larguraCaixa/2, A/2, 0]}>
            {/* Fundo */}
            <Box args={[larguraCaixa, A, 0.01]} position={[0, 0, -profundidadeCaixa/2]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
            {/* Lateral Externa */}
            <Box args={[0.01, A, profundidadeCaixa]} position={[larguraCaixa/2, 0, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
            {/* Frente */}
            <Box args={[larguraCaixa, A, 0.01]} position={[0, 0, profundidadeCaixa/2]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
          </group>

          {/* Trilho Guia Interno (Perfil U) */}
          <group position={[L/2 + 0.02, A/2, 0]}>
            {/* Fundo do U */}
            <Box args={[0.01, A, 0.04]} position={[0.015, 0, 0]}>
              <meshStandardMaterial color="#475569" />
            </Box>
            {/* Abas do U */}
            <Box args={[0.03, A, 0.01]} position={[0, 0, -0.015]}>
              <meshStandardMaterial color="#475569" />
            </Box>
            <Box args={[0.03, A, 0.01]} position={[0, 0, 0.015]}>
              <meshStandardMaterial color="#475569" />
            </Box>
          </group>
          {explodedFactor > 0.5 && <Label text="Caixa Contrapeso Dir." position={[L/2 + larguraCaixa, A, 0]} />}
        </group>

        {/* Travessa Superior */}
        <group position={exp(0, 0.6, 0)}>
          <Box args={[L + larguraCaixa * 2, 0.08, profundidadeCaixa]} position={[0, A + 0.04, 0]}>
            <meshStandardMaterial color={PART_COLORS.TRAVESSA} />
          </Box>
          {explodedFactor > 0.5 && <Label text="Travessa Superior" position={[0, A + 0.2, 0]} />}
        </group>

        {/* Mancais de Articulação */}
        <group position={exp(0, 0.4, 0)}>
          {/* Mancal Esq */}
          <group position={[-L/2 - 0.04, A, 0]}>
            <Box args={[0.04, 0.06, 0.08]}>
              <meshStandardMaterial color={PART_COLORS.MANCAL} />
            </Box>
            {/* Pino */}
            <Cylinder args={[0.015, 0.015, 0.06]} position={[0.02, 0, 0]} rotation={[0, 0, Math.PI/2]}>
              <meshStandardMaterial color="#94a3b8" />
            </Cylinder>
          </group>
          {/* Mancal Dir */}
          <group position={[L/2 + 0.04, A, 0]}>
            <Box args={[0.04, 0.06, 0.08]}>
              <meshStandardMaterial color="#475569" />
            </Box>
            {/* Pino */}
            <Cylinder args={[0.015, 0.015, 0.06]} position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI/2]}>
              <meshStandardMaterial color="#94a3b8" />
            </Cylinder>
          </group>
          {explodedFactor > 0.6 && <Label text="Mancal de Articulação" position={[L/2 + 0.04, A + 0.1, 0]} />}
        </group>

        {/* Kit de Automação */}
        <group name="Automacao">
          {/* Motor Redutor */}
          <group position={exp(1.2, -0.2, -0.5)}>
            <Box args={[0.15, 0.25, 0.15]} position={[L/2 + larguraCaixa/2, 0.25, -profundidadeCaixa/2 - 0.075]}>
              <meshStandardMaterial color={PART_COLORS.MOTOR} />
            </Box>
            {explodedFactor > 0.6 && <Label text="Motorredutor" position={[L/2 + larguraCaixa/2 + 0.15, 0.25, -profundidadeCaixa/2 - 0.075]} />}
          </group>
          
          {/* Calha de Acionamento (Fuso) */}
          <group position={exp(1.2, 0, -0.5)}>
            <Box args={[0.04, A - 0.5, 0.04]} position={[L/2 + larguraCaixa/2, A/2 + 0.1, -profundidadeCaixa/2 - 0.02]}>
              <meshStandardMaterial color={PART_COLORS.CALHA} />
            </Box>
            {explodedFactor > 0.6 && <Label text="Calha de Acionamento" position={[L/2 + larguraCaixa/2 + 0.1, A/2, -profundidadeCaixa/2 - 0.02]} />}
          </group>
        </group>
      </group>

      {/* 2. MECÂNICA DE ARTICULAÇÃO E TRAÇÃO */}
      <group name="Mecanica">
        {/* Polias e Contrapesos */}
        <group position={exp(0, 0.8, -0.4)}>
          {/* Polia Esq */}
          <group position={[-L/2 - larguraCaixa/2, A - 0.05, 0]} rotation={[Math.PI/2, 0, 0]}>
            <Cylinder args={[0.05, 0.05, 0.02]}>
              <meshStandardMaterial color={PART_COLORS.POLIA} />
            </Cylinder>
            {/* Sulco da Polia */}
            <Cylinder args={[0.04, 0.04, 0.022]}>
              <meshStandardMaterial color="#1e293b" />
            </Cylinder>
          </group>
          {/* Polia Dir */}
          <group position={[L/2 + larguraCaixa/2, A - 0.05, 0]} rotation={[Math.PI/2, 0, 0]}>
            <Cylinder args={[0.05, 0.05, 0.02]}>
              <meshStandardMaterial color="#64748b" />
            </Cylinder>
            {/* Sulco da Polia */}
            <Cylinder args={[0.04, 0.04, 0.022]}>
              <meshStandardMaterial color="#1e293b" />
            </Cylinder>
          </group>
          {explodedFactor > 0.6 && <Label text="Polia Superior" position={[L/2 + larguraCaixa/2, A, 0]} />}
        </group>

        {/* Contrapesos Internos */}
        <animated.group position={contrapesoY.to(y => [0, y, 0])}>
          <group position={exp(-1.2, 0, 0)}>
            <Box args={[0.1, alturaContrapeso, 0.1]} position={[-L/2 - larguraCaixa/2, 0, 0]}>
              <meshStandardMaterial color={PART_COLORS.CONTRAPESO} />
            </Box>
            {explodedFactor > 0.6 && <Label text="Contrapeso Interno" position={[-L/2 - larguraCaixa/2, -0.4, 0]} />}
          </group>
          <group position={exp(1.2, 0, 0)}>
            <Box args={[0.1, alturaContrapeso, 0.1]} position={[L/2 + larguraCaixa/2, 0, 0]}>
              <meshStandardMaterial color="#334155" />
            </Box>
          </group>
        </animated.group>

        {/* Braços Articuladores */}
        <group name="Bracos" position={exp(0, 0, -0.6)}>
          {/* Braço Esq */}
          <animated.group 
            position={[-(L_folha / 2) - 0.04, A, 0]} 
            rotation={rotacaoBracoX.to(x => [x, 0, 0])}
          >
            {/* Metalon 50x30mm (0.05 x 0.03) */}
            <Box args={[0.03, A / 4, 0.05]} position={[0, -(A / 4) / 2, 0]}>
              <meshStandardMaterial color={PART_COLORS.BRACO} metalness={0.8} roughness={0.2} />
            </Box>
            {explodedFactor > 0.6 && <Label text="Braço Articulador" position={[0, -0.2, 0]} />}
          </animated.group>
          {/* Braço Dir */}
          <animated.group 
            position={[(L_folha / 2) + 0.04, A, 0]} 
            rotation={rotacaoBracoX.to(x => [x, 0, 0])}
          >
            {/* Metalon 50x30mm (0.05 x 0.03) */}
            <Box args={[0.03, A / 4, 0.05]} position={[0, -(A / 4) / 2, 0]}>
              <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
            </Box>
          </animated.group>
        </group>

        {/* Cabos de Aço (Simulados com cilindros finos) */}
        <group position={exp(0, 0, -0.2)} visible={explodedFactor > 0.2}>
          {/* Cabo Esq (desce para o contrapeso e desce para a folha) */}
          <group position={[-L/2 - larguraCaixa/2, A/2, 0]}>
            <Cylinder args={[0.003, 0.003, A]} position={[0.02, 0, 0]}>
              <meshStandardMaterial color={PART_COLORS.CABO} />
            </Cylinder>
            <Cylinder args={[0.003, 0.003, A]} position={[-0.02, 0, 0]}>
              <meshStandardMaterial color={PART_COLORS.CABO} />
            </Cylinder>
          </group>
          {/* Cabo Dir */}
          <group position={[L/2 + larguraCaixa/2, A/2, 0]}>
            <Cylinder args={[0.003, 0.003, A]} position={[0.02, 0, 0]}>
              <meshStandardMaterial color="#cbd5e1" />
            </Cylinder>
            <Cylinder args={[0.003, 0.003, A]} position={[-0.02, 0, 0]}>
              <meshStandardMaterial color="#cbd5e1" />
            </Cylinder>
          </group>
          {explodedFactor > 0.6 && <Label text="Cabo de Aço" position={[0, A/2, 0]} />}
        </group>
      </group>

      {/* 3. FOLHA DO PORTÃO */}
      <animated.group 
        name="FolhaMovel" 
        position={positionY.to(y => [0, y, exp(0, 0, 1.2)[2]])}
        rotation={rotationX.to(x => [x, 0, 0])}
      >
        <group position={[0, -alturaPinoNaFolha, 0]}>
          
          {/* Roldanas de Guia */}
          <group position={exp(0.4, 0, 0)}>
            <Cylinder args={[0.025, 0.025, 0.06]} position={[-(L_folha / 2) - 0.03, alturaPinoNaFolha, 0]} rotation={[0, 0, Math.PI / 2]}>
              <meshStandardMaterial color={PART_COLORS.ROLDANA} />
            </Cylinder>
            {explodedFactor > 0.6 && <Label text="Roldana de Guia" position={[-(L_folha / 2) - 0.1, alturaPinoNaFolha, 0]} />}
          </group>
          <group position={exp(-0.4, 0, 0)}>
            <Cylinder args={[0.025, 0.025, 0.06]} position={[(L_folha / 2) + 0.03, alturaPinoNaFolha, 0]} rotation={[0, 0, Math.PI / 2]}>
              <meshStandardMaterial color="#1e293b" />
            </Cylinder>
          </group>

          {/* Quadro Estrutural de Metalon */}
          <group name="QuadroEstrutural" position={exp(0, 0, -0.4)}>
            <QuadroNode
              largura={largura}
              altura={altura}
              perfilData={perfisDB.find(p => p.id === (perfilQuadroId || 'metalon50x50x1.5')) || perfisDB[0]}
              quantidadeGrades={revestimento === 'grade' ? 8 : 0}
              tipoMontagem="reto"
              acabamentoMetal={acabamentoMetal as any}
              explodedFactor={0}
              onBOMCalculated={setQuadroBOM}
              perfilTravessaData={perfisDB.find(p => p.id === perfilTravessaId)}
              perfilMontanteData={perfisDB.find(p => p.id === perfilMontanteId)}
              perfilGradeData={perfisDB.find(p => p.id === perfilGradeId)}
            />
          </group>

          {/* Braço de Tração */}
          <group position={exp(1.5, 0, -0.5)}>
            <Box args={[0.15, 0.02, 0.02]} position={[(L_folha / 2) + 0.075, A_folha / 4, -profundidadeCaixa/2 - 0.02]}>
              <meshStandardMaterial color="#cbd5e1" />
            </Box>
            {explodedFactor > 0.6 && <Label text="Braço de Tração" position={[(L_folha / 2) + 0.15, A_folha / 4, -profundidadeCaixa/2 - 0.02]} />}
          </group>

          {/* Revestimento Frontal (Lambril) */}
          <group name="Revestimento" position={exp(0, 0, 0.4)}>
            <Box args={[L_folha, A_folha, 0.01]} position={[0, A_folha / 2, espessuraPerfil / 2 + 0.01]}>
              <meshStandardMaterial color={color} metalness={0.4} roughness={0.6} />
            </Box>
            {/* Detalhes do Lambril (Frisos) */}
            {Array.from({ length: 12 }).map((_, i) => (
              <Box 
                key={i} 
                args={[L_folha - 0.02, 0.005, 0.005]} 
                position={[0, (A_folha / 13) * (i + 1), espessuraPerfil / 2 + 0.016]}
              >
                <meshStandardMaterial color="#1e293b" />
              </Box>
            ))}
            {explodedFactor > 0.5 && <Label text="Revestimento Lambril" position={[0, A_folha / 2, 0.1]} />}
          </group>

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
        </>
      )}
    </group>
  );
};
