import React, { useMemo, useCallback } from 'react';
import { Box, Cylinder, Html, Line, Plane } from '@react-three/drei';
import { animated } from '@react-spring/three';
import * as THREE from 'three';
import { AcabamentoMetalKey, MaterialDegrauKey, acabamentosMetal, materiaisDegrau } from '../../../data/materiaisDB';
import { Cota3D } from '../Cota3D';

interface EscadaRetaIndustrialProps {
  explodedFactor?: number;
  altura?: number;
  comprimento?: number;
  largura?: number;
  tipoChegada?: 'Abaixo' | 'Nivelado';
  acabamentoMetal?: AcabamentoMetalKey;
  materialDegrau?: MaterialDegrauKey;
  temGuardaCorpo?: boolean;
  ladoGuardaCorpo?: 'esquerdo' | 'direito' | 'ambos';
  mostrarCotas?: boolean;
  onBOMCalculated?: (bom: any[]) => void;
}

const PART_COLORS = {
  BANZO: '#1e293b',
  DEGRAU: '#475569',
  GUARDACORPO: '#64748b',
  SAPATA: '#0f172a',
};

const PART_CODES = {
  BANZO: 'A',
  DEGRAU: 'B',
  GUARDACORPO: 'C',
  MONTANTE_GC: 'D',
  SAPATA: 'E',
};

const Label = ({ text, position }: { text: string, position: [number, number, number] }) => (
  <Html position={position} center distanceFactor={10}>
    <div className="bg-white/95 text-slate-900 px-2 py-0.5 rounded text-[7px] font-bold border border-slate-300 shadow-xl whitespace-nowrap pointer-events-none uppercase tracking-tighter">
      {text}
    </div>
  </Html>
);

export const EscadaRetaIndustrial: React.FC<EscadaRetaIndustrialProps> = ({
  explodedFactor = 0,
  altura = 3000,
  comprimento = 3600,
  largura = 1000,
  tipoChegada = 'Abaixo',
  acabamentoMetal = 'aco_carbono',
  materialDegrau = 'chapa_aco',
  temGuardaCorpo = true,
  ladoGuardaCorpo = 'ambos',
  mostrarCotas = false,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];

  // Dimensões principais (convertidas de mm para metros)
  const H = altura / 1000; // Desnível Total (Y)
  const L = comprimento / 1000; // Avanço Total (Z)
  const W = largura / 1000; // Largura Total (X)
  
  // Lógica Paramétrica de Engenharia
  const numEspelhos = Math.round((H * 1000) / 180);
  
  // Número de degraus físicos a renderizar
  const numDegraus = tipoChegada === 'Abaixo' ? numEspelhos - 1 : numEspelhos;

  // BOM Calculation
  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        { 
          code: PART_CODES.BANZO, 
          name: 'Peça A - Banzo Lateral (Viga U)', 
          color: PART_COLORS.BANZO, 
          quantity: 2, 
          unit: 'un',
          material: 'Perfil U Enrijecido 150x50',
          weight: 2 * Math.sqrt(Math.pow(H, 2) + Math.pow(L, 2)) * 12.5,
          cost: 2 * Math.sqrt(Math.pow(H, 2) + Math.pow(L, 2)) * 180
        },
        { 
          code: PART_CODES.DEGRAU, 
          name: 'Peça B - Degrau Antiderrapante', 
          color: PART_COLORS.DEGRAU, 
          quantity: numDegraus, 
          unit: 'un',
          material: materialDegrau === 'madeira_clara' || materialDegrau === 'madeira_escura' ? 'Madeira Maciça' : 'Chapa Xadrez Aço',
          weight: numDegraus * (W * 0.28 * 25), // Aproximado
          cost: numDegraus * 85
        },
        { 
          code: PART_CODES.SAPATA, 
          name: 'Peça E - Sapata de Fixação', 
          color: PART_COLORS.SAPATA, 
          quantity: 4, 
          unit: 'un',
          material: 'Chapa de Aço 8mm',
          weight: 4 * 2.5,
          cost: 4 * 45
        }
      ];

      if (temGuardaCorpo) {
        const mult = ladoGuardaCorpo === 'ambos' ? 2 : 1;
        bom.push({
          code: PART_CODES.GUARDACORPO,
          name: 'Peça C - Corrimão Superior',
          color: PART_COLORS.GUARDACORPO,
          quantity: mult,
          unit: 'un',
          material: 'Tubo Redondo 1.1/2"',
          weight: mult * Math.sqrt(Math.pow(H, 2) + Math.pow(L, 2)) * 3.5,
          cost: mult * Math.sqrt(Math.pow(H, 2) + Math.pow(L, 2)) * 45
        });
        bom.push({
          code: PART_CODES.MONTANTE_GC,
          name: 'Peça D - Montante do Guarda-corpo',
          color: PART_COLORS.GUARDACORPO,
          quantity: Math.ceil(numDegraus / 3) * mult,
          unit: 'un',
          material: 'Tubo Redondo 1.1/4"',
          weight: (Math.ceil(numDegraus / 3) * mult) * 1.0 * 2.8,
          cost: (Math.ceil(numDegraus / 3) * mult) * 1.0 * 35
        });
      }

      onBOMCalculated(bom);
    }
  }, [altura, comprimento, largura, materialDegrau, temGuardaCorpo, ladoGuardaCorpo, numDegraus, onBOMCalculated]);
  
  // Materiais Dinâmicos
  const metalProps = acabamentosMetal[acabamentoMetal] || acabamentosMetal['aco_carbono'];
  const degrauProps = materiaisDegrau[materialDegrau] || materiaisDegrau['chapa_aco'];

  const matAcoCarbono = <meshStandardMaterial color={metalProps.color} metalness={metalProps.metalness} roughness={metalProps.roughness} side={THREE.DoubleSide} />;
  const matChapaXadrez = <meshStandardMaterial color={degrauProps.color} metalness={degrauProps.metalness} roughness={degrauProps.roughness} />;
  const matGuardaCorpo = <meshStandardMaterial color={metalProps.color} metalness={metalProps.metalness} roughness={metalProps.roughness} />;
  const matTransparente = <meshStandardMaterial color="#94a3b8" transparent opacity={0.2} depthWrite={false} />;

  const espessura_chapa = 0.008; // 8mm para chapas de ancoragem
  
  // Perfil U Enrijecido 150x50x15x3mm
  const profileH = 0.15; // Altura do perfil (150mm)
  const profileW = 0.05; // Largura da aba (50mm)
  
  // O Banzo Caixão é formado por 2 perfis U soldados boca a boca
  const caixaoWidth = profileW * 2; // 100mm total

  // O passo no eixo Z depende de quantos degraus físicos cabem no comprimento L
  const p = L / numDegraus; 
  const e = H / numEspelhos; // O espelho no eixo Y
  
  // A inclinação mestre da escada deve seguir a relação exata entre espelho e passo
  const m = e / p; 

  const Y_fim = L * m; // Altura final baseada na inclinação
  const profundidadeDegrau = p + 0.04; // 4cm de sobreposição (nosing)

  const angle = Math.atan2(e, p); // Ângulo real da escada
  const length = Math.sqrt(H * H + L * L); // Comprimento da viga
  const cosAlpha = Math.cos(angle);
  const sinAlpha = Math.sin(angle);
  
  // Ajuste de Altura do Banzo - Geometria Industrial Precisa
  // Usamos uma viga de 200mm (0.20m) de largura perpendicular
  const larguraVigaPerp = 0.20; 
  const folgaSuperiorPerp = 0.03; // 3cm acima do degrau
  
  // Conversão para medidas verticais (Y)
  const offset_up = folgaSuperiorPerp / cosAlpha;
  const offset_down = (larguraVigaPerp - folgaSuperiorPerp) / cosAlpha;
  const dy = offset_up + offset_down;
  const dx = dy / m; // Largura do corte horizontal no chão
  
  // 1. Definição das Variáveis de Largura:
  const larguraTotal = W;
  const espessuraBanzo = caixaoWidth;
  const folgaDegrau = 0.005; // 5mm de cada lado (almofadas)
  const larguraDegrau = larguraTotal - (2 * espessuraBanzo) - (2 * folgaDegrau);
  
  const posX = (larguraTotal / 2) - (espessuraBanzo / 2);
  
  // Gerar posições dos montantes dinamicamente (a cada ~3 degraus)
  const montanteIndices = [];
  for (let i = 0; i <= numDegraus; i += 3) {
    montanteIndices.push(i);
  }
  if (montanteIndices[montanteIndices.length - 1] !== numDegraus) {
    montanteIndices.push(numDegraus);
  }

  // Definição dos limites horizontais do banzo
  // O banzo deve começar um pouco antes do primeiro degrau e terminar na parede
  const L_start = -0.05; 
  const L_end = L + profundidadeDegrau;

  const targetH = tipoChegada === 'Abaixo' ? H - e : H;

  // Geometria do Banzo (Paralelogramo com joelho 90 graus no piso e corte vertical na chegada)
  const banzoData = useMemo(() => {
    const shape = new THREE.Shape();
    
    // Usaremos um sistema onde X_shape = World Z.
    // Para isso, a rotação do mesh será [0, Math.PI / 2, 0].
    
    // 1. Topo da viga na frente (Z = 0)
    const y_top_front = e + offset_up;
    shape.moveTo(0, y_top_front);
    
    // 2. Base da viga na frente (Z = 0, Y = 0) - Joelho 90 graus
    shape.lineTo(0, 0);
    
    // 3. Ponto onde a linha inferior da viga encontra o chão
    // Y_bottom(Z) = m * Z + e - offset_down = 0  =>  Z = (offset_down - e) / m
    const z_floor_intersect = (offset_down - e) / m;
    
    if (z_floor_intersect > 0) {
      // Aresta inferior cruza o chão em Z > 0
      shape.lineTo(z_floor_intersect, 0);
    } else {
      // Aresta inferior começa acima do chão em Z = 0
      shape.lineTo(0, e - offset_down);
    }
    
    // 4. Base da viga na parede (Z = L)
    const y_bottom_wall = m * L + e - offset_down;
    shape.lineTo(L, y_bottom_wall);
    
    // 5. Topo da viga na parede (Z = L) - Corte vertical
    const y_top_wall = m * L + e + offset_up;
    shape.lineTo(L, y_top_wall);
    
    // 6. Fecha no ponto inicial
    shape.lineTo(0, y_top_front);
    
    const z_mid_floor = z_floor_intersect > 0 ? z_floor_intersect / 2 : 0;
    const width_floor = z_floor_intersect > 0 ? z_floor_intersect : 0;
    
    const y_mid_wall = (y_top_wall + y_bottom_wall) / 2;
    const height_wall = y_top_wall - y_bottom_wall;
    
    return { shape, z_mid_floor, width_floor, y_mid_wall, height_wall };
  }, [L, H, m, e, offset_up, offset_down]);

  const banzoShape = banzoData.shape;

  // Geometria do Degrau (Chapa em U Invertido, indo de 0 até prof no eixo Z local)
  const createDegrauShape = useCallback((prof: number) => {
    const esp = 0.003; 
    const shape = new THREE.Shape();
    // Aqui X_shape do degrau também mapeará para World Z
    shape.moveTo(0, 0); // Nariz
    shape.lineTo(prof, 0); // Costas
    shape.lineTo(prof, -0.025); // Desce aba
    shape.lineTo(prof - 0.015, -0.025); // Retorno
    shape.lineTo(prof - 0.015, -0.025 + esp); // Sobe
    shape.lineTo(prof - esp, -0.025 + esp); // Volta
    shape.lineTo(prof - esp, -esp); // Sobe 
    shape.lineTo(esp, -esp); // Vai pro nariz
    shape.lineTo(esp, -0.025 + esp); // Desce aba
    shape.lineTo(0.015, -0.025 + esp); // Retorno
    shape.lineTo(0.015, -0.025); // Fundo
    shape.lineTo(0, -0.025); // Frente
    shape.lineTo(0, 0); // Fecha no nariz
    return shape;
  }, []);

  const degrauShapeNormal = useMemo(() => createDegrauShape(profundidadeDegrau), [createDegrauShape, profundidadeDegrau]);
  const degrauShapeUltimo = useMemo(() => createDegrauShape(p), [createDegrauShape, p]);

  // Rotação Mestre: Mapeia X_shape -> World Z, Y_shape -> World Y, Z_geo -> World X
  // Com -PI/2: World X = -Local Z, World Z = Local X
  const rotMestre: [number, number, number] = [0, -Math.PI / 2, 0];
  const stepWidth = larguraDegrau;

  return (
    <group position={[0, 0, 0]}>
      
      {/* GRUPO 4: SIMULAÇÃO DE ESTRUTURAS DE FIXAÇÃO (LAJE E PISO) */}
      <group position={[0, H - 0.1, L + 0.5]}>
        <Box args={[W + 0.4, 0.2, 1.0]}>
          {matTransparente}
        </Box>
        {explodedFactor > 0.6 && <Label text="Laje de Fixação Superior" position={[0, 0.2, 0]} />}
      </group>
      
      <group position={[0, -0.1, L / 2]}>
        <Box args={[W + 2, 0.2, L + 2]}>
          {matTransparente}
        </Box>
        {explodedFactor > 0.6 && <Label text="Piso Base" position={[0, 0.2, 0]} />}
      </group>

      {/* --- PROJEÇÃO NO PISO --- */}
      <group position={[0, 0.001, 0]}>
        {Array.from({ length: numDegraus }).map((_, i) => {
          const stepZ = i * p;
          const stepY = (i + 1) * e;
          const stepColor = new THREE.Color().setHSL(i / numDegraus, 0.7, 0.5).getStyle();
          
          return (
            <group key={`proj-${i}`}>
              {/* Plano transparente como guia */}
              <Plane args={[larguraTotal, p]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, stepZ + p / 2]}>
                <meshBasicMaterial color={stepColor} transparent opacity={0.3} side={THREE.DoubleSide} />
              </Plane>

              {/* Retângulo no chão */}
              <Line
                points={[
                  [-larguraTotal / 2, 0, stepZ],
                  [larguraTotal / 2, 0, stepZ],
                  [larguraTotal / 2, 0, stepZ + p],
                  [-larguraTotal / 2, 0, stepZ + p],
                  [-larguraTotal / 2, 0, stepZ],
                ]}
                color={stepColor}
                lineWidth={1}
                dashed={true}
                dashSize={0.05}
                gapSize={0.05}
              />
              
              {/* Linha pontilhada ligando o degrau ao chão (canto esquerdo) */}
              <Line
                points={[
                  [-larguraTotal / 2, stepY, stepZ],
                  [-larguraTotal / 2, 0, stepZ],
                ]}
                color={stepColor}
                lineWidth={1}
                dashed={true}
                dashSize={0.05}
                gapSize={0.05}
                transparent
                opacity={0.5}
              />
              {/* Linha pontilhada ligando o degrau ao chão (canto direito) */}
              <Line
                points={[
                  [larguraTotal / 2, stepY, stepZ],
                  [larguraTotal / 2, 0, stepZ],
                ]}
                color={stepColor}
                lineWidth={1}
                dashed={true}
                dashSize={0.05}
                gapSize={0.05}
                transparent
                opacity={0.5}
              />

              {/* Numeração e Medida do degrau na projeção */}
              <Html
                position={[0, 0, stepZ + p / 2]}
                center
                transform
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', pointerEvents: 'none' }}>
                  <div style={{
                    color: stepColor,
                    fontSize: '12px',
                    fontWeight: 'bold',
                    fontFamily: 'sans-serif',
                    background: 'rgba(255,255,255,0.9)',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: `2px solid ${stepColor}`
                  }}>
                    {i + 1}
                  </div>
                  {i === 0 && (
                    <div style={{
                      color: stepColor,
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      background: 'rgba(255,255,255,0.8)',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      border: `1px solid ${stepColor}`
                    }}>
                      {Math.round(p * 1000)}mm
                    </div>
                  )}
                </div>
              </Html>
            </group>
          );
        })}
        
        {/* Cota total da projeção */}
        <Cota3D
          pontoInicio={[-larguraTotal / 2 - 0.2, 0, 0]}
          pontoFim={[-larguraTotal / 2 - 0.2, 0, L]}
          valorTexto={`${numDegraus}x ${Math.round(p * 1000)} = ${Math.round(L * 1000)}mm`}
          offset={[-0.2, 0, 0]}
          cor="#666"
        />
      </group>

      {/* GRUPO 1: BANZOS LATERAIS (SISTEMA UNIFICADO) */}
      <animated.group position={exp(-0.1, 0, 0)}>
        {/* Banzo Direito (Face de fora na largura total, extruda para dentro) */}
        <mesh
          position={[larguraTotal / 2, 0, 0]}
          rotation={rotMestre}
        >
          <extrudeGeometry args={[banzoShape, { depth: espessuraBanzo, bevelEnabled: false }]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </animated.group>

      <animated.group position={exp(0.1, 0, 0)}>
        {/* Banzo Esquerdo (Começa encostado no degrau, extruda para o limite esquerdo) */}
        <mesh
          position={[-larguraTotal / 2 + espessuraBanzo, 0, 0]}
          rotation={rotMestre}
        >
          <extrudeGeometry args={[banzoShape, { depth: espessuraBanzo, bevelEnabled: false }]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </animated.group>

      {/* GRUPO 3: GUARDA-CORPO E ANCORAGEM */}
      {[-posX, posX].map((x, i) => {
        const isLeft = i === 0;
        const dir = isLeft ? -1 : 1;
        
        return (
          <group key={`lateral-${i}`}>
            
            {/* --- CHAPAS DE ANCORAGEM (FIXADAS NO BANZO) --- */}
            {/* Base (No chão) */}
            <animated.group position={exp(isLeft ? -0.2 : 0.2, 0, 0)}>
              <group position={[x, espessura_chapa / 2, banzoData.z_mid_floor]}>
                <Box args={[caixaoWidth + 0.06, espessura_chapa, banzoData.width_floor + 0.04]}>
                  {matAcoCarbono}
                </Box>
              </group>
            </animated.group>
            
            {/* --- GRUPO 3: GUARDA-CORPO --- */}
            {temGuardaCorpo && (ladoGuardaCorpo === 'ambos' || (isLeft && ladoGuardaCorpo === 'esquerdo') || (!isLeft && ladoGuardaCorpo === 'direito')) && (
              <animated.group position={exp(dir * 0.5, 0.2, 0)}>
                
                {/* Montantes Verticais (Perfil Enrijecido Duplo 50mm) */}
                {montanteIndices.map((stepIdx) => {
                  const isFirst = stepIdx === 0;
                  const isLast = stepIdx === numDegraus;
                  
                  let mZ, startY;
                  
                  if (isFirst) {
                    mZ = 0;
                    startY = e + offset_up; 
                  } else if (isLast) {
                    mZ = L;
                    startY = banzoData.y_mid_wall + banzoData.height_wall / 2; // Alinhado com o topo da viga
                  } else {
                    mZ = stepIdx * p;
                    startY = ((mZ/p + 1) * e) + offset_up; // No topo da viga
                  }

                  // A altura do corrimão é fixa em relação à linha de inclinação
                  const y_handrail = m * mZ + e + offset_up + 1.0;
                  const montanteH = y_handrail - startY; 
                  
                  return (
                    <group key={`montante-${stepIdx}`} position={[x, startY + montanteH/2, mZ]}>
                      <Box args={[0.05, montanteH, 0.05]}>
                        {matGuardaCorpo}
                      </Box>
                    </group>
                  );
                })}

                {/* Corrimão Superior */}
                <group position={[x, m * (L/2) + e + offset_up + 1.0, L/2]} rotation={[-angle, 0, 0]}>
                  <Cylinder args={[0.025, 0.025, L / cosAlpha, 16]} rotation={[Math.PI/2, 0, 0]}>
                    {matGuardaCorpo}
                  </Cylinder>
                </group>

              </animated.group>
            )}

          </group>
        );
      })}

      {/* --- GRUPO 2: DEGRAUS E ALMOFADAS --- */}
      {Array.from({ length: numDegraus }).map((_, i) => {
        const stepZ = i * p;
        const stepY = (i + 1) * e;
        const isLastStep = i === numDegraus - 1;
        const currentProfundidade = isLastStep ? p : profundidadeDegrau;
        const currentShape = isLastStep ? degrauShapeUltimo : degrauShapeNormal;
        const stepColor = new THREE.Color().setHSL(i / numDegraus, 0.7, 0.5).getStyle();
        
        return (
          <animated.group 
            key={`degrau-${i}`} 
            position={exp(0, 0.1 + i * 0.02, 0.1 + i * 0.02)}
          >
            {/* Degrau Principal */}
            <mesh
              position={[larguraTotal / 2 - espessuraBanzo - folgaDegrau, stepY, stepZ]} 
              rotation={rotMestre}
            >
              <extrudeGeometry args={[currentShape, { depth: stepWidth, bevelEnabled: false }]} />
              <meshStandardMaterial color={stepColor} />
            </mesh>

            {/* Almofadas de Fixação (Pads laterais) */}
            {[-1, 1].map(side => (
              <mesh 
                key={`almofada-${side}`}
                position={[side * (larguraTotal/2 - espessuraBanzo - folgaDegrau/2), stepY - 0.012, stepZ + currentProfundidade/2]}
              >
                <Box args={[folgaDegrau, 0.025, currentProfundidade * 0.8]}>
                  {matAcoCarbono}
                </Box>
              </mesh>
            ))}
          </animated.group>
        );
      })}

      {/* CHAPA DE FIXAÇÃO SUPERIOR UNIFICADA (Vertical na parede) */}
      <animated.group position={exp(0, 0, 0.1)}>
        <mesh position={[0, banzoData.y_mid_wall, L + espessura_chapa / 2]}>
          <Box args={[larguraTotal, banzoData.height_wall + 0.04, espessura_chapa]}>
            {matAcoCarbono}
          </Box>
          {explodedFactor > 0.6 && <Label text="Chapa de Fixação Superior" position={[0, 0.2, 0]} />}
        </mesh>
      </animated.group>

      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          <Cota3D
            pontoInicio={[W / 2 + 0.3, 0, L]}
            pontoFim={[W / 2 + 0.3, H, L]}
            valorTexto={`${altura} mm`}
            offset={[0.2, 0, 0]}
            cor="#3b82f6"
          />
          <Cota3D
            pontoInicio={[W / 2 + 0.3, 0, 0]}
            pontoFim={[W / 2 + 0.3, 0, L]}
            valorTexto={`${comprimento} mm`}
            offset={[0.2, 0, 0]}
            cor="#3b82f6"
          />
          <Cota3D
            pontoInicio={[-W / 2, 0, 0]}
            pontoFim={[W / 2, 0, 0]}
            valorTexto={`${largura} mm`}
            offset={[0, 0, -0.3]}
            cor="#3b82f6"
          />
        </>
      )}
    </group>
  );
};
