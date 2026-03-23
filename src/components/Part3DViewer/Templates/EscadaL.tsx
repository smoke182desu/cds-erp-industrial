import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { PecaParametrica } from '../PecaParametrica';
import { PerfilData } from '../../../data/perfisDB';
import { Cota3D } from '../Cota3D';
import { AcabamentoMetalKey, MaterialDegrauKey, materiaisDegrau } from '../../../data/materiaisDB';

interface EscadaLProps {
  alturaTotal: number;
  larguraEscada: number;
  profundidade?: number;
  alturaPatamar: number;
  direcaoCurva: 'esquerda' | 'direita';
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

export const EscadaL: React.FC<EscadaLProps> = ({
  alturaTotal,
  larguraEscada,
  profundidade,
  alturaPatamar,
  direcaoCurva,
  perfilSelecionado,
  acabamentoMetal = 'preto_fosco',
  materialDegrau = 'madeira_clara',
  mostrarCotas = false,
  colorViga,
  explodedFactor = 0,
  onBOMCalculated
}) => {
  const exp = (x: number, y: number, z: number) => [x * explodedFactor, y * explodedFactor, z * explodedFactor] as [number, number, number];
  const { numDegraus1, espelho1, comprimento1, numDegraus2, espelho2, comprimento2, pisada } = useMemo(() => {
    // Lance 1
    const numDegraus1 = Math.max(1, Math.round(alturaPatamar / 180));
    const espelho1 = alturaPatamar / numDegraus1;
    
    // Calcula a pisada baseada na profundidade total (profundidade = comprimento1 + larguraEscada)
    const pisadaCalculada = profundidade ? Math.max(200, (profundidade - larguraEscada) / numDegraus1) : 280;
    const pisada = pisadaCalculada;
    
    const comprimento1 = numDegraus1 * pisada;
    
    // Lance 2
    const alturaRestante = alturaTotal - alturaPatamar;
    const numDegraus2 = Math.max(1, Math.round(alturaRestante / 180));
    const espelho2 = alturaRestante / numDegraus2;
    const comprimento2 = numDegraus2 * pisada;

    return { numDegraus1, espelho1, comprimento1, numDegraus2, espelho2, comprimento2, pisada };
  }, [alturaTotal, alturaPatamar, profundidade, larguraEscada]);

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

  const espessuraViga = (perfilSelecionado.tipoShape === 'redondo_oco' ? (perfilSelecionado.diametro || 50) : (perfilSelecionado.altura || perfilSelecionado.abas || 50)) / 1000;

  // Converter para metros para o Three.js
  const w = larguraEscada / 1000;
  const hTotal = alturaTotal / 1000;
  const hPatamar = alturaPatamar / 1000;
  const c1 = comprimento1 / 1000;
  const c2 = comprimento2 / 1000;
  const pZ = (comprimento1 + larguraEscada / 2) / 1000;
  const p = pisada / 1000;

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
          quantity: numDegraus1 + numDegraus2,
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
          <PecaParametrica
            pontoInicio={[-w / 2 + espessuraViga / 2, 0, 0]}
            pontoFim={[-w / 2 + espessuraViga / 2, hPatamar, c1]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            up={[0, 1, 0]}
            colorOverride={colorViga}
          />
          {explodedFactor > 0.5 && <Label text="Viga Lance 1 Esq." position={[-w/2 - 0.2, hPatamar/2, c1/2]} />}
        </group>
        <group position={exp(0.2, 0, 0)}>
          <PecaParametrica
            pontoInicio={[w / 2 - espessuraViga / 2, 0, 0]}
            pontoFim={[w / 2 - espessuraViga / 2, hPatamar, c1]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            up={[0, 1, 0]}
            colorOverride={colorViga}
          />
          {explodedFactor > 0.5 && <Label text="Viga Lance 1 Dir." position={[w/2 + 0.2, hPatamar/2, c1/2]} />}
        </group>

        {/* Degraus Lance 1 */}
        <group position={exp(0, 0.2, 0)}>
          {Array.from({ length: numDegraus1 }).map((_, i) => {
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
      <group position={[0, hPatamar, c1 + w / 2 + exp(0, 0.4, 0.4)[2]]}>
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
        position={[0, hPatamar, c1 + w / 2 + exp(0, 0, 0.8)[2]]} 
        rotation={[0, direcaoCurva === 'direita' ? Math.PI / 2 : -Math.PI / 2, 0]}
      >
        {/* Vigas Laterais Lance 2 */}
        <group position={exp(-0.2, 0, 0)}>
          <PecaParametrica
            pontoInicio={[-w / 2 + espessuraViga / 2, 0, w / 2]}
            pontoFim={[-w / 2 + espessuraViga / 2, hTotal - hPatamar, w / 2 + c2]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            up={[0, 1, 0]}
            colorOverride={colorViga}
          />
          {explodedFactor > 0.5 && <Label text="Viga Lance 2 Esq." position={[-w/2 - 0.2, (hTotal-hPatamar)/2, w/2 + c2/2]} />}
        </group>
        <group position={exp(0.2, 0, 0)}>
          <PecaParametrica
            pontoInicio={[w / 2 - espessuraViga / 2, 0, w / 2]}
            pontoFim={[w / 2 - espessuraViga / 2, hTotal - hPatamar, w / 2 + c2]}
            perfil={perfilVigaM}
            tipoCorte="reto"
            acabamentoMetal={acabamentoMetal}
            up={[0, 1, 0]}
            colorOverride={colorViga}
          />
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
