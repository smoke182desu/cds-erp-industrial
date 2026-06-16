import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { PecaParametrica } from '../PecaParametrica';
import { PerfilData } from '../../../data/perfisDB';
import { Cota3D } from '../Cota3D';
import { AcabamentoMetalKey, MaterialDegrauKey, materiaisDegrau, acabamentosMetal } from '../../../data/materiaisDB';

interface EscadaLProps {
  alturaTotal: number;
  larguraEscada: number;
  profundidade?: number;
  alturaPatamar: number;
  direcaoCurva: 'esquerda' | 'direita';
  numDegraus1Prop?: number;
  numDegraus2Prop?: number;
  perfilSelecionado: PerfilData;
  acabamentoMetal?: AcabamentoMetalKey;
  materialDegrau?: MaterialDegrauKey;
  mostrarCotas?: boolean;
  colorViga?: string;
  explodedFactor?: number;
  onBOMCalculated?: (bom: any[]) => void;
}

const Label = ({ text, position }: { text: string, position: [number, number, number] }) => (
  <Html position={position} center distanceFactor={10}>
    <div className="bg-white/95 text-slate-900 px-2 py-0.5 rounded text-[7px] font-bold border border-slate-300 shadow-xl whitespace-nowrap pointer-events-none uppercase tracking-tighter">
      {text}
    </div>
  </Html>
);

// Longarina (chapa lateral) com pontas cortadas no PRUMO (vertical), paralelas a face do patamar.
const LongarinaPrumo: React.FC<{
  a: [number, number]; b: [number, number];
  xCenter: number; thickness: number; halfH: number;
  color: string; metalness?: number; roughness?: number;
}> = ({ a, b, xCenter, thickness, halfH, color, metalness = 0.6, roughness = 0.4 }) => {
  const geom = React.useMemo(() => {
    const [zA, yA] = a; const [zB, yB] = b;
    const dz0 = zB - zA; const dy0 = yB - yA;
    const len = Math.hypot(dz0, dy0) || 1;
    const cos = Math.abs(dz0 / len);
    const off = cos > 1e-4 ? halfH / cos : halfH; // meia-altura vertical da chapa (corte a prumo)
    const P: [number, number][] = [
      [zA, yA - off], [zB, yB - off], [zB, yB + off], [zA, yA + off],
    ];
    const hx = thickness / 2;
    const vp: number[][] = [];
    for (const x of [xCenter - hx, xCenter + hx]) for (const pt of P) vp.push([x, pt[1], pt[0]]);
    const tris = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[3,2,6],[3,6,7],[0,3,7],[0,7,4],[1,5,6],[1,6,2]];
    const pos: number[] = [];
    for (const t of tris) for (const i of t) pos.push(vp[i][0], vp[i][1], vp[i][2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, [a[0], a[1], b[0], b[1], xCenter, thickness, halfH]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const EscadaL: React.FC<EscadaLProps> = ({
  alturaTotal,
  larguraEscada,
  profundidade,
  alturaPatamar,
  direcaoCurva,
  numDegraus1Prop,
  numDegraus2Prop,
  perfilSelecionado,
  acabamentoMetal = 'preto_fosco',
  materialDegrau = 'madeira_clara',
  mostrarCotas = false,
  colorViga,
  explodedFactor = 0,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];
  const { numDegraus1, espelho1, comprimento1, numDegraus2, espelho2, comprimento2, pisada, alturaPatamarCalc } = useMemo(() => {
    const numDegraus1 = (numDegraus1Prop && numDegraus1Prop > 0) ? numDegraus1Prop : Math.max(1, Math.round(alturaPatamar / 180));
    const numDegraus2 = (numDegraus2Prop && numDegraus2Prop > 0) ? numDegraus2Prop : Math.max(1, Math.round((alturaTotal - alturaPatamar) / 180));
    const totalDeg = Math.max(1, numDegraus1 + numDegraus2);
    const espelho = alturaTotal / totalDeg; // espelho UNICO e igual em toda a escada
    const espelho1 = espelho;
    const espelho2 = espelho;
    const alturaPatamarCalc = numDegraus1 * espelho; // patamar derivado dos degraus
    const pisada = profundidade ? Math.max(200, (profundidade - larguraEscada) / Math.max(1, numDegraus1)) : 280;
    const comprimento1 = numDegraus1 * pisada;
    const comprimento2 = numDegraus2 * pisada;
    return { numDegraus1, espelho1, comprimento1, numDegraus2, espelho2, comprimento2, pisada, alturaPatamarCalc };
  }, [alturaTotal, alturaPatamar, profundidade, larguraEscada, numDegraus1Prop, numDegraus2Prop]);

  const perfilVigaM = useMemo(() => ({
    ...perfilSelecionado,
    largura: perfilSelecionado.largura ? perfilSelecionado.largura / 1000 : undefined,
    altura: perfilSelecionado.altura ? perfilSelecionado.altura / 1000 : undefined,
    diametro: perfilSelecionado.diametro ? perfilSelecionado.diametro / 1000 : undefined,
    abas: perfilSelecionado.abas ? perfilSelecionado.abas / 1000 : undefined,
    espessura: perfilSelecionado.espessura / 1000,
  }), [perfilSelecionado]);

  const perfilDegrauM: PerfilData = {
    id: 'degrau_chapa',
    nome: 'Degrau',
    tipoShape: 'chapa',
    largura: 280 / 1000,
    espessura: 4.75 / 1000,
  } as any;

  const espessuraViga = ((perfilSelecionado.id === 'sob_medida') ? (perfilSelecionado.largura || 50) : (perfilSelecionado.tipoShape === 'redondo_oco' ? (perfilSelecionado.diametro || 50) : (perfilSelecionado.altura || perfilSelecionado.abas || 50))) / 1000;

  // Converter para metros para o Three.js
  const w = larguraEscada / 1000;
  const hTotal = alturaTotal / 1000;
  const hPatamar = alturaPatamarCalc / 1000;
  const c1 = comprimento1 / 1000;
  const c2 = comprimento2 / 1000;
  const pZ = (comprimento1 + larguraEscada / 2) / 1000;
  const p = pisada / 1000;
  // SOB MEDIDA: centraliza o degrau na altura da longarina (sobe meio espelho)
  const isSob = perfilSelecionado.id === 'sob_medida';
  const cy1 = isSob ? (espelho1 / 1000) / 2 : 0;
  const _vigaMat = (acabamentosMetal as any)[acabamentoMetal] || { color: '#777', metalness: 0.6, roughness: 0.4 };
  const _vigaColor = colorViga || _vigaMat.color;
  const _halfHViga = (perfilSelecionado.altura || 100) / 1000 / 2;
  const cy2 = isSob ? (espelho2 / 1000) / 2 : 0;

  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        {
          code: 'EL-01',
          name: `Vigas Laterais Lance 1 (${perfilSelecionado.nome})`,
          quantity: 2 * Math.sqrt(Math.pow(c1, 2) + Math.pow(hPatamar, 2)),
          unit: 'm',
          material: perfilSelecionado.nome,
          weight: (2 * Math.sqrt(Math.pow(c1, 2) + Math.pow(hPatamar, 2))) * (perfilSelecionado.pesoPorMetro || 10),
          cost: (2 * Math.sqrt(Math.pow(c1, 2) + Math.pow(hPatamar, 2))) * ((perfilSelecionado.pesoPorMetro || 10) * 15)
        },
        {
          code: 'EL-02',
          name: `Vigas Laterais Lance 2 (${perfilSelecionado.nome})`,
          quantity: 2 * Math.sqrt(Math.pow(c2, 2) + Math.pow(hTotal - hPatamar, 2)),
          unit: 'm',
          material: perfilSelecionado.nome,
          weight: (2 * Math.sqrt(Math.pow(c2, 2) + Math.pow(hTotal - hPatamar, 2))) * (perfilSelecionado.pesoPorMetro || 10),
          cost: (2 * Math.sqrt(Math.pow(c2, 2) + Math.pow(hTotal - hPatamar, 2))) * ((perfilSelecionado.pesoPorMetro || 10) * 15)
        },
        {
          code: 'EL-03',
          name: `Estrutura Patamar (${perfilSelecionado.nome})`,
          quantity: 2 * w + 2 * w,
          unit: 'm',
          material: perfilSelecionado.nome,
          weight: (4 * w) * (perfilSelecionado.pesoPorMetro || 10),
          cost: (4 * w) * ((perfilSelecionado.pesoPorMetro || 10) * 15)
        },
        {
          code: 'EL-04',
          name: 'Degraus',
          quantity: (numDegraus1 - 1) + numDegraus2,
          unit: 'un',
          material: materiaisDegrau[materialDegrau]?.nome || 'Chapa Xadrez',
          weight: (numDegraus1 + numDegraus2) * (w * p * 25), // Aproximado
          cost: (numDegraus1 + numDegraus2) * 85
        },
        {
          code: 'EL-05',
          name: 'Piso Patamar',
          quantity: w * w,
          unit: 'm²',
          material: materiaisDegrau[materialDegrau]?.nome || 'Chapa Xadrez',
          weight: (w * w) * 25,
          cost: (w * w) * 250
        }
      ];
      onBOMCalculated(bom);
    }
  }, [onBOMCalculated, c1, c2, hTotal, hPatamar, w, p, numDegraus1, numDegraus2, perfilSelecionado, materialDegrau]);

  return (
    <group position={[0, -hTotal / 2, -pZ / 2]}>
      {/* LANCE 1 */}
      <group position={exp(0, 0, -0.4)}>
        {/* Vigas Laterais Lance 1 */}
        <group position={exp(-0.2, 0, 0)}>
          {isSob ? (
            <LongarinaPrumo a={[0, cy1]} b={[c1, hPatamar + cy1]} xCenter={-w / 2 + espessuraViga / 2} thickness={espessuraViga} halfH={_halfHViga} color={_vigaColor} metalness={_vigaMat.metalness} roughness={_vigaMat.roughness} />
          ) : (
            <PecaParametrica
              pontoInicio={[-w / 2 + espessuraViga / 2, cy1, 0]}
              pontoFim={[-w / 2 + espessuraViga / 2, hPatamar + cy1, c1]}
              perfil={perfilVigaM}
              tipoCorte="reto"
              acabamentoMetal={acabamentoMetal}
              up={[0, 1, 0]}
              colorOverride={colorViga}
            />
          )}
          {explodedFactor > 0.5 && <Label text="Viga Lance 1 Esq." position={[-w/2 - 0.2, hPatamar/2, c1/2]} />}
        </group>
        <group position={exp(0.2, 0, 0)}>
          {isSob ? (
            <LongarinaPrumo a={[0, cy1]} b={[c1, hPatamar + cy1]} xCenter={w / 2 - espessuraViga / 2} thickness={espessuraViga} halfH={_halfHViga} color={_vigaColor} metalness={_vigaMat.metalness} roughness={_vigaMat.roughness} />
          ) : (
            <PecaParametrica
              pontoInicio={[w / 2 - espessuraViga / 2, cy1, 0]}
              pontoFim={[w / 2 - espessuraViga / 2, hPatamar + cy1, c1]}
              perfil={perfilVigaM}
              tipoCorte="reto"
              acabamentoMetal={acabamentoMetal}
              up={[0, 1, 0]}
              colorOverride={colorViga}
            />
          )}
          {explodedFactor > 0.5 && <Label text="Viga Lance 1 Dir." position={[w/2 + 0.2, hPatamar/2, c1/2]} />}
        </group>

        {/* Degraus Lance 1 */}
        <group position={exp(0, 0.2, 0)}>
          {Array.from({ length: numDegraus1 - 1 }).map((_, i) => {
            const zPos = (i + 0.5) * p;
            const yPos = (i + 1) * (espelho1 / 1000);
            return (
              <PecaParametrica
                key={`degrau1-${i}`}
                pontoInicio={[-w / 2 + espessuraViga, yPos - 0.005, zPos]}
                pontoFim={[w / 2 - espessuraViga, yPos - 0.005, zPos]}
                perfil={{ ...perfilDegrauM, largura: p }}
                tipoCorte="reto"
                materialProps={materiaisDegrau[materialDegrau]}
                up={[0, 1, 0]}
              />
            );
          })}
          {explodedFactor > 0.5 && <Label text="Degraus Lance 1" position={[0, hPatamar/2, c1/2]} />}
        </group>
      </group>

      {/* PATAMAR */}
      <group position={[0, hPatamar, c1 - p + w / 2 + exp(0, 0.4, 0.4)[2]]}>
        {/* Estrutura do Patamar */}
        <group position={exp(0, -0.1, 0)}>
          <PecaParametrica
            pontoInicio={[-w / 2, -0.05, -w / 2]}
            pontoFim={[w / 2, -0.05, -w / 2]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            colorOverride={colorViga}
          />
          <PecaParametrica
            pontoInicio={[-w / 2, -0.05, w / 2]}
            pontoFim={[w / 2, -0.05, w / 2]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            colorOverride={colorViga}
          />
          <PecaParametrica
            pontoInicio={[-w / 2, -0.05, -w / 2]}
            pontoFim={[-w / 2, -0.05, w / 2]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            colorOverride={colorViga}
          />
          <PecaParametrica
            pontoInicio={[w / 2, -0.05, -w / 2]}
            pontoFim={[w / 2, -0.05, w / 2]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            colorOverride={colorViga}
          />
          {explodedFactor > 0.5 && <Label text="Estrutura Patamar" position={[0, -0.1, 0]} />}
        </group>
        {/* Piso do Patamar */}
        <group position={exp(0, 0.1, 0)}>
          <PecaParametrica
            pontoInicio={[-w / 2, 0, 0]}
            pontoFim={[w / 2, 0, 0]}
            perfil={{ ...perfilDegrauM, largura: w }}
            tipoCorte="reto"
            materialProps={materiaisDegrau[materialDegrau]}
            up={[0, 1, 0]}
          />
          {explodedFactor > 0.5 && <Label text="Piso Patamar" position={[0, 0.1, 0]} />}
        </group>
      </group>

      {/* LANCE 2 */}
      <group 
        position={[0, hPatamar, c1 - p + w / 2 + exp(0, 0, 0.8)[2]]} 
        rotation={[0, direcaoCurva === 'direita' ? Math.PI / 2 : -Math.PI / 2, 0]}
      >
        {/* Vigas Laterais Lance 2 */}
        <group position={exp(-0.2, 0, 0)}>
          {isSob ? (
            <LongarinaPrumo a={[w / 2, cy2]} b={[w / 2 + c2, hTotal - hPatamar + cy2]} xCenter={-w / 2 + espessuraViga / 2} thickness={espessuraViga} halfH={_halfHViga} color={_vigaColor} metalness={_vigaMat.metalness} roughness={_vigaMat.roughness} />
          ) : (
            <PecaParametrica
              pontoInicio={[-w / 2 + espessuraViga / 2, cy2, w / 2]}
              pontoFim={[-w / 2 + espessuraViga / 2, hTotal - hPatamar + cy2, w / 2 + c2]}
              perfil={perfilVigaM}
              tipoCorte="reto"
              acabamentoMetal={acabamentoMetal}
              up={[0, 1, 0]}
              colorOverride={colorViga}
            />
          )}
          {explodedFactor > 0.5 && <Label text="Viga Lance 2 Esq." position={[-w/2 - 0.2, (hTotal-hPatamar)/2, w/2 + c2/2]} />}
        </group>
        <group position={exp(0.2, 0, 0)}>
          {isSob ? (
            <LongarinaPrumo a={[w / 2, cy2]} b={[w / 2 + c2, hTotal - hPatamar + cy2]} xCenter={w / 2 - espessuraViga / 2} thickness={espessuraViga} halfH={_halfHViga} color={_vigaColor} metalness={_vigaMat.metalness} roughness={_vigaMat.roughness} />
          ) : (
            <PecaParametrica
              pontoInicio={[w / 2 - espessuraViga / 2, cy2, w / 2]}
              pontoFim={[w / 2 - espessuraViga / 2, hTotal - hPatamar + cy2, w / 2 + c2]}
              perfil={perfilVigaM}
              tipoCorte="reto"
              acabamentoMetal={acabamentoMetal}
              up={[0, 1, 0]}
              colorOverride={colorViga}
            />
          )}
          {explodedFactor > 0.5 && <Label text="Viga Lance 2 Dir." position={[w/2 + 0.2, (hTotal-hPatamar)/2, w/2 + c2/2]} />}
        </group>

        {/* Degraus Lance 2 */}
        <group position={exp(0, 0.2, 0)}>
          {Array.from({ length: numDegraus2 }).map((_, i) => {
            const zPos = w / 2 + (i + 0.5) * p;
            const yPos = (i + 1) * (espelho2 / 1000);
            return (
              <PecaParametrica
                key={`degrau2-${i}`}
                pontoInicio={[-w / 2 + espessuraViga, yPos - 0.005, zPos]}
                pontoFim={[w / 2 - espessuraViga, yPos - 0.005, zPos]}
                perfil={{ ...perfilDegrauM, largura: p }}
                tipoCorte="reto"
                materialProps={materiaisDegrau[materialDegrau]}
                up={[0, 1, 0]}
              />
            );
          })}
          {explodedFactor > 0.5 && <Label text="Degraus Lance 2" position={[0, (hTotal-hPatamar)/2, w/2 + c2/2]} />}
        </group>
      </group>

      {/* Cotas Dimensionais */}
      {mostrarCotas && explodedFactor === 0 && (
        <>
          {/* Cota de Altura Total */}
          <Cota3D
            pontoInicio={[w / 2 + 0.2, 0, pZ]}
            pontoFim={[w / 2 + 0.2, hTotal, pZ]}
            valorTexto={`${alturaTotal} mm`}
            offset={[0.2, 0, 0]}
            cor="#3b82f6"
          />
          
          {/* Cota de Altura do Patamar */}
          <Cota3D
            pontoInicio={[w / 2 + 0.2, 0, c1 / 2]}
            pontoFim={[w / 2 + 0.2, hPatamar, c1 / 2]}
            valorTexto={`${alturaPatamar} mm`}
            offset={[0.2, 0, 0]}
            cor="#10b981" // Verde para diferenciar
          />

          {/* Cota de Comprimento Lance 1 */}
          <Cota3D
            pontoInicio={[w / 2 + 0.2, 0, 0]}
            pontoFim={[w / 2 + 0.2, 0, c1]}
            valorTexto={`${Math.round(comprimento1)} mm`}
            offset={[0.2, 0, 0]}
            cor="#3b82f6"
          />

          {/* Cota de Largura */}
          <Cota3D
            pontoInicio={[-w / 2, 0, 0]}
            pontoFim={[w / 2, 0, 0]}
            valorTexto={`${larguraEscada} mm`}
            offset={[0, 0, -0.3]}
            cor="#3b82f6"
          />
        </>
      )}

      {/* Chão */}
      {explodedFactor === 0 && (
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5, 5]} />
          <meshBasicMaterial color="#444" transparent={true} opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Plataforma */}
      {explodedFactor === 0 && (
        <mesh position={[0, hTotal, pZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.5, w + 0.5]} />
          <meshBasicMaterial color="#444" transparent={true} opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
