import React, { useEffect } from 'react';
import { Box, Cylinder, Sphere, Torus, Html } from '@react-three/drei';
import { animated } from '@react-spring/three';
import * as THREE from 'three';

const Label = ({ text, position }: { text: string, position: [number, number, number] }) => (
  <Html position={position} center distanceFactor={10}>
    <div className="bg-white/95 text-slate-900 px-2 py-0.5 rounded text-[7px] font-bold border border-slate-300 shadow-xl whitespace-nowrap pointer-events-none uppercase tracking-tighter">
      {text}
    </div>
  </Html>
);

export const materiaisRampa: Record<string, { nome: string; precoM2: number; color: string; roughness: number; metalness: number }> = {
  'chapa_xadrez_1_2': { nome: 'Chapa Xadrez 1,2mm', precoM2: 180.00, color: '#64748b', roughness: 0.9, metalness: 0.3 },
  'chapa_xadrez_2_65': { nome: 'Chapa Xadrez 2,65mm', precoM2: 350.00, color: '#64748b', roughness: 0.9, metalness: 0.3 },
  'chapa_galvanizada_2': { nome: 'Chapa Galvanizada 2mm', precoM2: 220.00, color: '#94a3b8', roughness: 0.4, metalness: 0.8 },
  'chapa_galvanizada_3': { nome: 'Chapa Galvanizada 3mm', precoM2: 320.00, color: '#94a3b8', roughness: 0.4, metalness: 0.8 },
  'chapa_aco_carbono_2': { nome: 'Chapa de Aço Carbono 2mm', precoM2: 190.00, color: '#475569', roughness: 0.7, metalness: 0.5 },
  'chapa_aco_carbono_3': { nome: 'Chapa de Aço Carbono 3mm', precoM2: 280.00, color: '#475569', roughness: 0.7, metalness: 0.5 },
  'chapa_antiderrapante_aco_2_65': { nome: 'Chapa Antiderrapante Aço 2,65mm', precoM2: 380.00, color: '#52525b', roughness: 0.9, metalness: 0.4 },
  'chapa_antiderrapante_aco_3': { nome: 'Chapa Antiderrapante Aço 3mm', precoM2: 422.50, color: '#52525b', roughness: 0.9, metalness: 0.4 },
};

interface RampaAcessibilidadeProps {
  largura?: number;
  comprimento?: number;
  altura?: number;
  explodedFactor?: number;
  mostrarCotas?: boolean;
  tipoFixacao?: 'Sapata Flangeada' | 'Chumbador Embutido';
  materialCoberturaRampa?: string;
  onBOMCalculated?: (bom: any) => void;
}

const PART_COLORS = {
  ESTRUTURA: '#1e293b',
  PISO: '#475569',
  CORRIMAO_SUP: '#64748b',
  CORRIMAO_INT: '#94a3b8',
  MONTANTE: '#cbd5e1',
  FIXACAO: '#0f172a',
};

const PART_CODES = {
  ESTRUTURA: 'A',
  PISO: 'B',
  CORRIMAO_SUP: 'C',
  CORRIMAO_INT: 'D',
  MONTANTE: 'E',
  FIXACAO: 'F',
};

export const RampaAcessibilidade: React.FC<RampaAcessibilidadeProps> = ({
  largura = 1200,
  comprimento = 3000,
  altura = 240,
  explodedFactor = 0,
  mostrarCotas = false,
  tipoFixacao = 'Sapata Flangeada',
  materialCoberturaRampa = 'chapa_antiderrapante_aco_3',
  onBOMCalculated,
}) => {
  const w = largura / 1000;
  const c = comprimento / 1000;
  const h = altura / 1000;
  const inc = h / c;
  const angle = Math.atan(inc);
  const esp = 0.10;
  
  const r = 0.02; // Raio do tubo
  const h1 = 0.70;
  const h2 = 0.92;
  const prolong = 0;
  const lateral = (w / 2) + 0.05; // Tubo abraça a rampa por fora

  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  // Variáveis para o BOM
  // As variáveis foram movidas para o useMemo para evitar efeitos colaterais no render

  // Componente de Fixação (Sapata ou Chumbador)
  const renderFixacao = (key: string, position: [number, number, number]) => {
    if (tipoFixacao === 'Sapata Flangeada') {
      return (
        <Cylinder key={key} args={[0.06, 0.06, 0.01, 16]} position={[position[0], 0.005, position[2]]}>
          <meshStandardMaterial color="#888" roughness={0.5} metalness={0.8} />
        </Cylinder>
      );
    }
    return null; // Chumbador embutido não tem flange visível
  };

  // Montante vertical até o chão
  const renderMontante = (key: string, x: number, z: number, yTop: number) => {
    const yBase = tipoFixacao === 'Chumbador Embutido' ? -0.15 : 0;
    const length = yTop - yBase;
    const yCenter = yBase + (length / 2);
    
    return (
      <group key={key}>
        <Cylinder args={[r, r, length, 16]} position={[x, yCenter, z]}>
          <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.6} />
        </Cylinder>
        {renderFixacao(`${key}_fix`, [x, 0, z])}
      </group>
    );
  };

  // Curva de retorno (U-turn) nas pontas
  const renderRetorno = (key: string, position: [number, number, number], isStart: boolean, h1: number, h2: number) => {
    const radius = (h2 - h1) / 2;
    // Gira o Torus 90 graus no eixo Y para alinhar com o tubo. isStart inverte o lado.
    const rotY = isStart ? Math.PI / 2 : -Math.PI / 2;
    return (
      <group key={key} position={position}>
        <group rotation={[0, rotY, 0]}>
          <Torus args={[radius, r, 16, 32, Math.PI]} position={[0, h1 + radius, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.6} />
          </Torus>
        </group>
      </group>
    );
  };

  // Cotovelo para quinas de 90 graus
  const renderCotovelo = (key: string, position: [number, number, number]) => {
    return (
      <Sphere key={key} args={[r, 16, 16]} position={position}>
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.6} />
      </Sphere>
    );
  };

  const renderTubeSegment = (key: string, p1: [number, number, number], p2: [number, number, number], h: number) => {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = p2[2] - p1[2];
    const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    const cx = (p1[0] + p2[0]) / 2;
    const cy = (p1[1] + p2[1]) / 2 + h;
    const cz = (p1[2] + p2[2]) / 2;
    
    const angleY = Math.atan2(dx, dz);
    const lengthXZ = Math.sqrt(dx*dx + dz*dz);
    const angleX = Math.atan2(dy, lengthXZ);
    
    return (
      <group key={key} position={[cx, cy, cz]} rotation={[0, angleY, 0]}>
        <mesh rotation={[-angleX + Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r, length, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
    );
  };

  const renderContinuousHandrail = (points: [number, number, number][], side: string) => {
    const segments = [];
    const elbows = [];
    const montantes = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const dz = p2[2] - p1[2];
      
      const lengthXZ = Math.sqrt(dx*dx + dz*dz);
      const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      segments.push(
        <group key={`seg_${side}_${i}`}>
          {renderTubeSegment(`tube_${side}_${i}_h1`, p1, p2, h1)}
          {renderTubeSegment(`tube_${side}_${i}_h2`, p1, p2, h2)}
        </group>
      );
      
      if (lengthXZ > 0.3) {
        const numMontantes = Math.max(2, Math.ceil(lengthXZ / 1.5) + 1);
        for (let j = 0; j < numMontantes; j++) {
          const inset = Math.min(0.1, lengthXZ / 4);
          const t = inset + (j * (lengthXZ - 2 * inset) / Math.max(1, numMontantes - 1));
          const ratio = t / lengthXZ;
          
          const mx = p1[0] + dx * ratio;
          const my = p1[1] + dy * ratio;
          const mz = p1[2] + dz * ratio;
          
          montantes.push(
            renderMontante(`montante_${side}_${i}_${j}`, mx, mz, my + h2)
          );
        }
      }
    }
    
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      elbows.push(
        <group key={`elbow_${side}_${i}`} position={[p[0], p[1], p[2]]}>
          {renderCotovelo(`cot_${side}_${i}_h1`, [0, h1, 0])}
          {renderCotovelo(`cot_${side}_${i}_h2`, [0, h2, 0])}
        </group>
      );
    }
    
    const pStart = points[0];
    const pStartNext = points[1];
    const angleStart = Math.atan2(pStartNext[0] - pStart[0], pStartNext[2] - pStart[2]);
    
    const pEnd = points[points.length - 1];
    const pEndPrev = points[points.length - 2];
    const angleEnd = Math.atan2(pEnd[0] - pEndPrev[0], pEnd[2] - pEndPrev[2]);

    return (
      <group key={`handrail_${side}`}>
        {segments}
        {elbows}
        {montantes}
        <group position={pStart} rotation={[0, angleStart, 0]}>
          {renderRetorno(`retorno_${side}_start`, [0, 0, 0], true, h1, h2)}
        </group>
        <group position={pEnd} rotation={[0, angleEnd, 0]}>
          {renderRetorno(`retorno_${side}_end`, [0, 0, 0], false, h1, h2)}
        </group>
      </group>
    );
  };

  // Registra áreas (removido para evitar efeitos colaterais)
  const innerHandrailPoints: [number, number, number][] = [
    [-0.65, 0, 0.30],
    [-0.65, 0, 0],
    [-0.65, 0.583, -7.0],
    [-0.65, 0.583, -6.95],
    [-0.60, 0.583, -6.95],
    [-4.28, 0.889, -6.95],
    [-4.23, 0.889, -6.95],
    [-4.23, 0.889, -7.0],
    [-4.23, 1.639, 2.0],
    [-4.23, 1.639, 3.8]
  ];

  const outerHandrailPoints: [number, number, number][] = [
    [0.65, 0, 0.30],
    [0.65, 0, 0],
    [0.65, 0.583, -7.0],
    [0.65, 0.583, -8.25],
    [-0.60, 0.583, -8.25],
    [-4.28, 0.889, -8.25],
    [-5.53, 0.889, -8.25],
    [-5.53, 0.889, -7.0],
    [-5.53, 1.639, 2.0],
    [-5.53, 1.639, 3.8]
  ];

  // Calcula BOM
  const bomData = React.useMemo(() => {
    let tTubo = 0;
    let tArea = 0;
    let tMontantes = 0;

    // Áreas (Cobertura/Piso)
    const areas = [
      1.20 * 7.024, // Rampa Inicial
      1.20 * 1.20,  // Patamar 1
      3.693 * 1.20, // Rampa Intermediária
      1.20 * 1.20,  // Patamar 2
      1.20 * 9.031, // Rampa Final
      1.30 * 1.80   // Patamar Chegada
    ];
    tArea = areas.reduce((a, b) => a + b, 0);

    // Estrutura (Perímetro dos segmentos para estimar perfis)
    const perimetros = [
      (1.20 + 7.024) * 2,
      (1.20 + 1.20) * 2,
      (3.693 + 1.20) * 2,
      (1.20 + 1.20) * 2,
      (1.20 + 9.031) * 2,
      (1.30 + 1.80) * 2
    ];
    const tPerimetroEstrutura = perimetros.reduce((a, b) => a + b, 0);
    tTubo += tPerimetroEstrutura;

    const calcHandrail = (points: [number, number, number][]) => {
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const dz = p2[2] - p1[2];
        const lengthXZ = Math.sqrt(dx*dx + dz*dz);
        const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        tTubo += length * 2; // h1 e h2
        
        if (lengthXZ > 0.3) {
          const numMontantes = Math.max(2, Math.ceil(lengthXZ / 1.5) + 1);
          for (let j = 0; j < numMontantes; j++) {
            const yBase = tipoFixacao === 'Chumbador Embutido' ? -0.15 : 0;
            const ratio = (Math.min(0.1, lengthXZ / 4) + (j * (lengthXZ - 2 * Math.min(0.1, lengthXZ / 4)) / Math.max(1, numMontantes - 1))) / lengthXZ;
            const my = p1[1] + dy * ratio;
            tTubo += (my + h2) - yBase;
            tMontantes++;
          }
        }
      }
    };

    calcHandrail(innerHandrailPoints);
    calcHandrail(outerHandrailPoints);

    const precoTubo = 39.00;
    const materialSelecionado = materiaisRampa[materialCoberturaRampa] || materiaisRampa['chapa_antiderrapante_aco_3'];
    const precoChapa = materialSelecionado.precoM2;
    const precoSapata = 58.50;
    const precoChumbador = 11.05;

    const custoTubo = tTubo * precoTubo;
    const custoChapa = tArea * precoChapa;
    
    let qtdSapatas = 0;
    let qtdChumbadores = 0;
    let custoFixacao = 0;

    if (tipoFixacao === 'Sapata Flangeada') {
      qtdSapatas = tMontantes;
      qtdChumbadores = tMontantes * 4;
      custoFixacao = (qtdSapatas * precoSapata) + (qtdChumbadores * precoChumbador);
    } else {
      qtdChumbadores = tMontantes;
      custoFixacao = qtdChumbadores * precoChumbador;
    }

    return {
      tubo: { qtd: tTubo.toFixed(2), unidade: 'm', custo: custoTubo },
      chapa: { qtd: tArea.toFixed(2), unidade: 'm²', custo: custoChapa, nome: materialSelecionado.nome },
      fixacao: { qtd: tipoFixacao === 'Sapata Flangeada' ? qtdSapatas : qtdChumbadores, unidade: 'un', custo: custoFixacao },
      total: custoTubo + custoChapa + custoFixacao
    };
  }, [tipoFixacao, materialCoberturaRampa]);

  const lastBomRef = React.useRef<string>('');
  useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        { 
          code: PART_CODES.ESTRUTURA, 
          name: 'Peça A - Estrutura da Rampa (Viga U)', 
          color: PART_COLORS.ESTRUTURA, 
          quantity: 1, 
          unit: 'cj',
          material: 'Perfil U Enrijecido 100x40',
          cost: 1500, // Estimativa base
          weight: 120
        },
        { 
          code: PART_CODES.PISO, 
          name: 'Peça B - Piso Antiderrapante', 
          color: PART_COLORS.PISO, 
          quantity: parseFloat(bomData.chapa.qtd), 
          unit: 'm²',
          material: bomData.chapa.nome,
          cost: bomData.chapa.custo,
          weight: parseFloat(bomData.chapa.qtd) * 20 // 20kg/m2 aprox
        },
        { 
          code: PART_CODES.CORRIMAO_SUP, 
          name: 'Peça C - Corrimão Superior', 
          color: PART_COLORS.CORRIMAO_SUP, 
          quantity: parseFloat(bomData.tubo.qtd) * 0.4, // Aprox 40% do tubo total
          unit: 'm',
          material: 'Tubo Redondo 1.1/2"',
          cost: bomData.tubo.custo * 0.4,
          weight: parseFloat(bomData.tubo.qtd) * 0.4 * 2.5
        },
        { 
          code: PART_CODES.CORRIMAO_INT, 
          name: 'Peça D - Corrimão Intermediário', 
          color: PART_COLORS.CORRIMAO_INT, 
          quantity: parseFloat(bomData.tubo.qtd) * 0.4, 
          unit: 'm',
          material: 'Tubo Redondo 1.1/4"',
          cost: bomData.tubo.custo * 0.4,
          weight: parseFloat(bomData.tubo.qtd) * 0.4 * 2.0
        },
        { 
          code: PART_CODES.MONTANTE, 
          name: 'Peça E - Montante Vertical', 
          color: PART_COLORS.MONTANTE, 
          quantity: bomData.fixacao.qtd, 
          unit: 'un',
          material: 'Tubo Redondo 1.1/2"',
          cost: bomData.tubo.custo * 0.2, // Aprox 20% do tubo total
          weight: parseFloat(bomData.tubo.qtd) * 0.2 * 2.5
        },
        { 
          code: PART_CODES.FIXACAO, 
          name: 'Peça F - Fixação (Sapata/Chumbador)', 
          color: PART_COLORS.FIXACAO, 
          quantity: bomData.fixacao.qtd, 
          unit: 'un',
          material: tipoFixacao,
          cost: bomData.fixacao.custo,
          weight: bomData.fixacao.qtd * 0.5
        }
      ];

      const bomString = JSON.stringify(bom);
      if (lastBomRef.current !== bomString) {
        lastBomRef.current = bomString;
        onBOMCalculated(bom);
      }
    }
  }, [bomData, onBOMCalculated, tipoFixacao]);

  const materialSelecionado = materiaisRampa[materialCoberturaRampa] || materiaisRampa['chapa_antiderrapante_aco_3'];
  const materialProps = {
    color: materialSelecionado.color,
    roughness: materialSelecionado.roughness,
    metalness: materialSelecionado.metalness
  };

  const RampSegment = ({ name, args, position, rotation = [0, 0, 0], labelCota }: any) => {
    const [w, h, d] = args;
    const beamThickness = 0.04;
    
    return (
      <group position={position} rotation={rotation}>
        {/* Cobertura (Piso) */}
        <animated.group position={exp(0, 1.2, 0)}>
          <mesh castShadow receiveShadow position={[0, h/2 - 0.005, 0]}>
            <boxGeometry args={[w, 0.01, d]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {explodedFactor > 0.5 && <Label text={`${name} (Cobertura)`} position={[0, 0.2, 0]} />}
        </animated.group>

        {/* Estrutura de Suporte (Chassi Metálico) */}
        <animated.group position={exp(0, -0.4, 0)}>
          <group position={[0, -0.005, 0]}>
            {/* Longarinas Laterais */}
            <Box args={[beamThickness, h - 0.01, d]} position={[-w/2 + beamThickness/2, 0, 0]}>
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
            </Box>
            <Box args={[beamThickness, h - 0.01, d]} position={[w/2 - beamThickness/2, 0, 0]}>
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
            </Box>
            
            {/* Travessas Transversais */}
            {Array.from({ length: Math.max(2, Math.ceil(d / 0.6) + 1) }).map((_, i) => {
              const posZ = -d/2 + (i * d / (Math.max(2, Math.ceil(d / 0.6) + 1) - 1));
              return (
                <Box key={`travessa-${i}`} args={[w - beamThickness * 2, beamThickness, beamThickness]} position={[0, (h-0.01)/2 - beamThickness/2, posZ]}>
                  <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
                </Box>
              );
            })}
          </group>
          {explodedFactor > 0.5 && <Label text={`${name} (Estrutura)`} position={[0, -0.3, 0]} />}
        </animated.group>

        {mostrarCotas && explodedFactor === 0 && labelCota && (
          <Html position={[0, h/2 + 0.05, 0]} center distanceFactor={10}>
            <div className="bg-white/80 px-1 rounded text-[10px] text-black font-bold whitespace-nowrap">{labelCota}</div>
          </Html>
        )}
      </group>
    );
  };

  return (
    <group position={[0, 0, 0]}>
      {/* CHÃO */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial transparent opacity={0.3} color="#a0a0a0" />
      </mesh>

      {/* PEÇA 1: Rampa Inicial */}
      <RampSegment 
        name="Rampa Inicial"
        args={[1.20, 0.10, 7.024]}
        position={[0, 0.2915, -3.5]}
        rotation={[0.0831, 0, 0]}
        labelCota="7.00m"
      />

      {/* PEÇA 2: Patamar 1 */}
      <RampSegment 
        name="Patamar 1"
        args={[1.20, 0.10, 1.20]}
        position={[0, 0.583, -7.6]}
        labelCota="1.20x1.20m"
      />

      {/* PEÇA 3: Rampa Intermediária */}
      <RampSegment 
        name="Rampa Intermediária"
        args={[3.693, 0.10, 1.20]}
        position={[-2.44, 0.736, -7.6]}
        rotation={[0, 0, -0.0831]}
        labelCota="3.68m"
      />

      {/* PEÇA 4: Patamar 2 */}
      <RampSegment 
        name="Patamar 2"
        args={[1.20, 0.10, 1.20]}
        position={[-4.88, 0.889, -7.6]}
        labelCota="1.20x1.20m"
      />

      {/* PEÇA 5: Rampa Final */}
      <RampSegment 
        name="Rampa Final"
        args={[1.20, 0.10, 9.031]}
        position={[-4.88, 1.264, -2.5]}
        rotation={[-0.0831, 0, 0]}
        labelCota="9.00m"
      />

      {/* PEÇA 6: Patamar Chegada */}
      <RampSegment 
        name="Patamar Chegada"
        args={[1.30, 0.10, 1.80]}
        position={[-4.88, 1.639, 2.9]}
        labelCota="1.30x1.80m"
      />

      {/* CORRIMÃOS CONTÍNUOS */}
      <animated.group position={exp(0, 4.0, 0)}>
        {renderContinuousHandrail(innerHandrailPoints, "inner")}
        {renderContinuousHandrail(outerHandrailPoints, "outer")}
        {explodedFactor > 0.6 && <Label text="Sistema de Corrimão Duplo" position={[-2.5, 2.5, -3.5]} />}
      </animated.group>

      {/* MONTANTES GLOBAIS */}
      <group position={[0, 0, 0]}>
        {/* montantesElements removed */}
      </group>
    </group>
  );
};
