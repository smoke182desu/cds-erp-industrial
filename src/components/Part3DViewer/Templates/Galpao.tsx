import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PecaParametrica } from '../PecaParametrica';
import { InstancedPecas, PecaInstance } from '../InstancedPecas';
import { PerfilData } from '../../../data/perfisDB';
import { AcabamentoMetalKey } from '../../../data/materiaisDB';
import { telhasDB } from '../../../data/telhasDB';
import { TelhaGalvanizada } from '../TelhaGalvanizada';
import { Cota3D } from '../Cota3D';
import { Tesoura } from './Tesoura';

interface GalpaoProps {
  largura: number;
  profundidade: number;
  altura: number;
  inclinacaoPercentual: number;
  perfilData: PerfilData;
  perfilColunaData?: PerfilData;
  perfilVigaData?: PerfilData;
  perfilDiagonalData?: PerfilData;
  perfilTercaData?: PerfilData;
  acabamentoMetal: AcabamentoMetalKey;
  mostrarCotas?: boolean;
  qtdTercas?: number;
  materialCobertura?: 'vidro' | 'policarbonato' | 'telha' | 'vazio';
  telhaSelecionadaId?: string;
  fixacao?: 'chumbado' | 'sapata_parafuso';
  tipoTesouraId?: string;
  explodedFactor?: number;
  mostrarNodes?: boolean;
  colorBanzo?: string;
  colorMontante?: string;
  colorDiagonal?: string;
  colorTerca?: string;
  colorColuna?: string;
  colorViga?: string;
  colorFechamento?: string;
}

export const Galpao: React.FC<GalpaoProps> = ({
  largura,
  profundidade,
  altura,
  inclinacaoPercentual,
  perfilData,
  perfilColunaData: perfilColunaDataProp,
  perfilVigaData: perfilVigaDataProp,
  perfilDiagonalData: perfilDiagonalDataProp,
  perfilTercaData: perfilTercaDataProp,
  acabamentoMetal,
  mostrarCotas = false,
  qtdTercas: qtdTercasProp,
  materialCobertura = 'telha',
  telhaSelecionadaId = 'telha_galvanizada_trap_40',
  fixacao = 'sapata_parafuso',
  tipoTesouraId = 'fink',
  explodedFactor = 0,
  mostrarNodes = true,
  colorBanzo,
  colorMontante,
  colorDiagonal,
  colorTerca,
  colorColuna,
  colorViga,
  colorFechamento
}) => {
  // Convert to meters
  const w = largura / 1000;
  const d = profundidade / 1000;
  const h = altura / 1000;
  const eaveHeightM = 0; // 0mm height at eaves to match the standalone Tesoura product

  // Calculate ridge height (altura da cumeeira)
  const ridgeHeight = useMemo(() => {
    const halfWidth = w / 2;
    const effectiveInclinacao = inclinacaoPercentual;
    const rise = halfWidth * (effectiveInclinacao / 100);
    return h + eaveHeightM + rise;
  }, [w, inclinacaoPercentual, h, eaveHeightM]);

  const perfilVigaData = perfilVigaDataProp || perfilData;
  const perfilDiagonalData = perfilDiagonalDataProp || perfilVigaData || perfilData;

  const perfilVigaConvertido: PerfilData = {
    ...perfilVigaData,
    largura: perfilVigaData.largura ? perfilVigaData.largura / 1000 : undefined,
    altura: perfilVigaData.altura ? perfilVigaData.altura / 1000 : undefined,
    diametro: perfilVigaData.diametro ? perfilVigaData.diametro / 1000 : undefined,
    abas: perfilVigaData.abas ? perfilVigaData.abas / 1000 : undefined,
    enrijecedor: perfilVigaData.enrijecedor ? perfilVigaData.enrijecedor / 1000 : undefined,
    espessura: perfilVigaData.espessura / 1000,
  };

  const perfilColunaData = perfilColunaDataProp || perfilData;
  const perfilColunaW = (perfilColunaData.tipoShape === 'redondo_oco' ? (perfilColunaData.diametro || 50) : (perfilColunaData.largura || 50)) / 1000;

  const ColumnPlate: React.FC<{ position: [number, number, number], size: number, color?: string }> = ({ position, size, color = '#94a3b8' }) => {
    const isLeft = position[0] < 0;
    // Plate width (inward extension)
    const plateWidth = size * 1.5;
    // Plate thickness: 1/4 inch = 0.00635m
    const plateThickness = 0.00635;
    
    // Plate position:
    // If left, inner face is at position[0] + size/2. Plate center is at position[0] + size/2 + plateWidth/2
    // If right, inner face is at position[0] - size/2. Plate center is at position[0] - size/2 - plateWidth/2
    const xOffset = isLeft ? (size / 2 + plateWidth / 2) : -(size / 2 + plateWidth / 2);
    
    // Position the plate so its top is at the truss base height (h)
    return (
      <mesh position={[position[0] + xOffset, position[1] - plateThickness / 2, position[2]]}>
        <boxGeometry args={[plateWidth, plateThickness, size * 1.5]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
    );
  };

  const perfilColunaConvertido: PerfilData = {
    ...perfilColunaData,
    largura: perfilColunaData.largura ? perfilColunaData.largura / 1000 : undefined,
    altura: perfilColunaData.altura ? perfilColunaData.altura / 1000 : undefined,
    diametro: perfilColunaData.diametro ? perfilColunaData.diametro / 1000 : undefined,
    abas: perfilColunaData.abas ? perfilColunaData.abas / 1000 : undefined,
    enrijecedor: perfilColunaData.enrijecedor ? perfilColunaData.enrijecedor / 1000 : undefined,
    espessura: perfilColunaData.espessura ? perfilColunaData.espessura / 1000 : 0.002,
  };

  const perfilTercaData = perfilTercaDataProp || perfilData;
  // A terça fica "em pé", então a altura dela perpendicular ao telhado é a alma (largura/altura) para perfis U, ou abas para cantoneira
  const perfilTercaH = (perfilTercaData.tipoShape === 'redondo_oco' 
    ? (perfilTercaData.diametro || 50) 
    : (perfilTercaData.tipoShape === 'cantoneira' ? (perfilTercaData.abas || 25) : (perfilTercaData.altura || perfilTercaData.largura || 75))) / 1000;

  const perfilTercaConvertido: PerfilData = {
    ...perfilTercaData,
    largura: perfilTercaData.largura ? perfilTercaData.largura / 1000 : undefined,
    altura: perfilTercaData.altura ? perfilTercaData.altura / 1000 : undefined,
    diametro: perfilTercaData.diametro ? perfilTercaData.diametro / 1000 : undefined,
    abas: perfilTercaData.abas ? perfilTercaData.abas / 1000 : undefined,
    enrijecedor: perfilTercaData.enrijecedor ? perfilTercaData.enrijecedor / 1000 : undefined,
    espessura: perfilTercaData.espessura ? perfilTercaData.espessura / 1000 : 0.002,
  };

  // --- NORMAS TÉCNICAS: ESPAÇAMENTO DE TESOURAS ---
  // Padrão: Máximo de 5 metros entre pórticos para galpões leves (ABNT)
  const numTesouras = Math.ceil(profundidade / 5000) + 1;
  const trussSpacing = d / (numTesouras - 1);

  // O banzo superior da tesoura tem a alma no plano XY, então a altura perpendicular ao telhado é a aba para perfis U e cantoneiras
  const perfilBanzoH = (perfilData.tipoShape === 'redondo_oco' 
    ? (perfilData.diametro || 50) 
    : (perfilData.tipoShape.includes('perfil_u') || perfilData.tipoShape === 'cantoneira' ? (perfilData.abas || 40) : (perfilData.altura || perfilData.largura || 50))) / 1000;

  // Number of purlins (terças) per slope - calculated automatically based on tile type
  const qtdTerçasSlope = useMemo(() => {
    const telha = telhasDB.find(t => t.id === telhaSelecionadaId) || telhasDB[0];
    // Padrão técnico: 1.5m para trapezoidal 40, 2.0m para sanduíche
    const maxSpan = telha.tipo === 'sanduiche' ? 2.0 : 1.5;
    
    const halfW = w / 2;
    const rise = ridgeHeight - (h + eaveHeightM);
    const slopeLength = Math.sqrt(Math.pow(halfW, 2) + Math.pow(rise, 2));
    
    return Math.max(2, Math.ceil(slopeLength / maxSpan) + 1);
  }, [w, ridgeHeight, h, eaveHeightM, telhaSelecionadaId]);

  // Exploded View Offsets
  const colOffset = explodedFactor * 1.5;
  const trussOffset = explodedFactor * 2.5;
  const tercaOffset = explodedFactor * 3.5;
  const telhaOffset = explodedFactor * 4.5;

  // Arrays for InstancedMesh
  const colunasPecas = useMemo(() => {
    const pecas = [];
    for (let i = 0; i < numTesouras; i++) {
      const z = d / 2 - i * trussSpacing;
      // Coluna Esquerda
      pecas.push({
        start: [-w / 2 + perfilColunaW / 2 - colOffset, 0, z],
        end: [-w / 2 + perfilColunaW / 2 - colOffset, h, z],
        up: [1, 0, 0]
      });
      // Coluna Direita
      pecas.push({
        start: [w / 2 - perfilColunaW / 2 + colOffset, 0, z],
        end: [w / 2 - perfilColunaW / 2 + colOffset, h, z],
        up: [1, 0, 0]
      });
    }
    return pecas;
  }, [numTesouras, d, trussSpacing, w, perfilColunaW, colOffset, h]);

  const calhasInstances = useMemo(() => {
    const instances: PecaInstance[] = [];
    // Calha Esquerda
    instances.push({
      start: [-w / 2, h, d / 2],
      end: [-w / 2, h, -d / 2],
      up: [1, 0, 0]
    });
    // Calha Direita
    instances.push({
      start: [w / 2, h, d / 2],
      end: [w / 2, h, -d / 2],
      up: [-1, 0, 0]
    });
    return instances;
  }, [w, h, d]);

  const tercasInstances = useMemo(() => {
    const instances: PecaInstance[] = [];
    const slopeX = w / 2;
    const slopeY = ridgeHeight - (h + eaveHeightM);
    const slopeLen = Math.sqrt(slopeX * slopeX + slopeY * slopeY);
    const normalY = slopeX / slopeLen;
    const normalX = slopeY / slopeLen;

    // To make the purlins stand up (web perpendicular to the roof):
    // The local Y axis must point OUT of the roof (normal).
    // For the right side, normal is (slopeY, slopeX, 0).
    // For the left side, normal is (slopeY, -slopeX, 0).
    const upRight: [number, number, number] = [slopeY, slopeX, 0];
    const upLeft: [number, number, number] = [slopeY, -slopeX, 0];

    // Offset the purlin along the normal so it rests ON TOP of the truss top chord
    const normalOffset = (perfilBanzoH / 2) + (perfilTercaH / 2) + tercaOffset + 0.01;

    for (let i = 0; i < qtdTerçasSlope; i++) {
      const xProgress = i / (qtdTerçasSlope - 1);
      const baseX = (w / 2) * (1 - xProgress);
      const baseY = h + eaveHeightM + xProgress * (ridgeHeight - h - eaveHeightM);

      // Lado Direito
      const rightX = baseX + normalX * normalOffset;
      const rightY = baseY + normalY * normalOffset;
      instances.push({
        start: [rightX, rightY, d / 2],
        end: [rightX, rightY, -d / 2],
        up: upRight
      });
      
      // Lado Esquerdo
      const leftX = -baseX - normalX * normalOffset;
      const leftY = baseY + normalY * normalOffset;
      instances.push({
        start: [leftX, leftY, d / 2],
        end: [leftX, leftY, -d / 2],
        up: upLeft
      });
    }
    return instances;
  }, [qtdTerçasSlope, w, perfilColunaW, h, eaveHeightM, ridgeHeight, tercaOffset, perfilTercaH, d, perfilBanzoH]);

  return (
    <group>
      {/* Colunas (Renderizadas individualmente para garantir solidez) */}
      {colunasPecas.map((col, i) => (
        <group key={`col-${i}`}>
          <PecaParametrica 
            pontoInicio={col.start}
            pontoFim={col.end}
            perfil={perfilColunaConvertido}
            tipoCorte="reto"
            up={col.up as any}
            acabamentoMetal={acabamentoMetal}
            colorOverride={colorColuna}
          />
        </group>
      ))}

      {/* Terças Instanciadas */}
      <InstancedPecas 
        perfil={perfilTercaConvertido} 
        instances={tercasInstances} 
        acabamentoMetal={acabamentoMetal} 
        colorOverride={colorTerca}
      />

      {/* Calhas - Comentado para teste */}
      {/* <InstancedPecas
        perfil={{
          id: 'calha_u',
          nome: 'Calha U',
          tipoShape: 'perfil_u_simples',
          largura: 0.2,
          altura: 0.15,
          espessura: 0.002,
          abas: 0.1,
          uso: 'viga'
        }}
        instances={calhasInstances}
        acabamentoMetal={acabamentoMetal}
        colorOverride={colorFechamento}
      /> */}

      {/* Tesouras e Chapas de Base */}
      {Array.from({ length: numTesouras }).map((_, i) => {
        const z = d / 2 - i * trussSpacing;
        return (
          <group key={`truss-${i}`}>
            {/* Tesoura (Gable Truss) */}
            <group position={[0, trussOffset, 0]}>
              <Tesoura
                largura={largura}
                altura={Math.round((ridgeHeight - h - eaveHeightM) * 1000)}
                profundidade={0}
                eaveHeight={eaveHeightM * 1000}
                perfilBanzo={perfilData}
                perfilInterno={perfilVigaData}
                perfilDiagonal={perfilDiagonalData}
                tipoTesoura={tipoTesouraId as any}
                acabamentoMetal={acabamentoMetal}
                explodedFactor={0} // Exploded factor is handled by the parent group
                yOffset={h}
                zOffset={z}
                numPanels={qtdTerçasSlope - 1} // Sincroniza painéis com as terças (ABNT)
                mostrarNodes={mostrarNodes}
                colorBanzo={colorBanzo}
                colorMontante={colorMontante}
                colorDiagonal={colorDiagonal}
              />

              {/* Chapa de Apoio da Tesoura (Lateral da Coluna) */}
              {/* Chapa posicionada para que seu topo fique em h */}
              <ColumnPlate position={[-w / 2, h - 0.00635 / 2, z]} size={perfilColunaW} color={colorColuna} />
              <ColumnPlate position={[w / 2, h - 0.00635 / 2, z]} size={perfilColunaW} color={colorColuna} />
            </group>
          </group>
        );
      })}

      {/* Cobertura (Telhas) */}
      {materialCobertura === 'telha' && (
        <group>
          {(() => {
            const telha = telhasDB.find(t => t.id === telhaSelecionadaId) || telhasDB[0];
            const larguraUtil = telha.larguraUtil / 1000;
            const larguraTotalTelha = telha.larguraTotal / 1000;
            
            // Calculate slope length and angle
            const halfW = w / 2;
            const rise = ridgeHeight - (h + eaveHeightM);
            const slopeLength = Math.sqrt(Math.pow(halfW, 2) + Math.pow(rise, 2));
            const angle = Math.atan2(rise, halfW);

            // Altura da base da telha: topo da terça (distância a partir da linha central da tesoura)
            const offsetTile = (perfilBanzoH / 2) + perfilTercaH + tercaOffset;
            
            // Centralização no eixo Z para cobrir toda a profundidade
            const numTelhas = Math.ceil(d / larguraUtil);
            const sobraZ = (numTelhas * larguraUtil - d) / 2;
            const startZ = d / 2 + sobraZ;
            const actualTotalZLength = (numTelhas - 1) * larguraUtil + larguraTotalTelha;
            const centerZ = startZ - actualTotalZLength / 2;

            return (
              <group position={[0, telhaOffset, 0]}>
                {/* Cumeeira em formato de telha (V invertido) */}
                <group position={[0, ridgeHeight + offsetTile / Math.cos(angle) + 0.02, centerZ]}>
                  {/* Lado Direito da Cumeeira */}
                  <mesh position={[0.2 * Math.cos(angle), -0.2 * Math.sin(angle), 0]} rotation={[0, 0, -angle]}>
                    <boxGeometry args={[0.4, 0.002, actualTotalZLength]} />
                    <meshStandardMaterial color={telha.tipo === 'sanduiche' ? "#e2e8f0" : "#94a3b8"} metalness={0.8} roughness={0.2} />
                  </mesh>
                  {/* Lado Esquerdo da Cumeeira */}
                  <mesh position={[-0.2 * Math.cos(angle), -0.2 * Math.sin(angle), 0]} rotation={[0, 0, angle]}>
                    <boxGeometry args={[0.4, 0.002, actualTotalZLength]} />
                    <meshStandardMaterial color={telha.tipo === 'sanduiche' ? "#e2e8f0" : "#94a3b8"} metalness={0.8} roughness={0.2} />
                  </mesh>
                </group>

                {/* Lado Direito */}
                {Array.from({ length: numTelhas }).map((_, i) => (
                  <group 
                    key={`telha-r-${i}`} 
                    position={[0, ridgeHeight, startZ - i * larguraUtil]} 
                    rotation={[0, 0, -angle]}
                  >
                    <group 
                      position={[0, offsetTile, 0]}
                      rotation={[0, Math.PI / 2, 0]}
                    >
                      <TelhaGalvanizada 
                        largura={larguraTotalTelha} 
                        comprimento={slopeLength} 
                        tipo={telha.tipo}
                        cor={telha.tipo === 'sanduiche' ? "#e2e8f0" : "#94a3b8"}
                      />
                    </group>
                  </group>
                ))}
                {/* Lado Esquerdo */}
                {Array.from({ length: numTelhas }).map((_, i) => (
                  <group 
                    key={`telha-l-${i}`} 
                    position={[0, ridgeHeight, startZ - i * larguraUtil]} 
                    rotation={[0, 0, angle]}
                  >
                    <group 
                      position={[0, offsetTile, -larguraTotalTelha]}
                      rotation={[0, -Math.PI / 2, 0]}
                    >
                      <TelhaGalvanizada 
                        largura={larguraTotalTelha} 
                        comprimento={slopeLength} 
                        tipo={telha.tipo}
                        cor={telha.tipo === 'sanduiche' ? "#e2e8f0" : "#94a3b8"}
                      />
                    </group>
                  </group>
                ))}
              </group>
            );
          })()}
        </group>
      )}

      {/* Cotas */}
      {mostrarCotas && (
        <group>
          <Cota3D 
            pontoInicio={[-w / 2, 0, d / 2 + 0.5]} 
            pontoFim={[w / 2, 0, d / 2 + 0.5]} 
            valor={largura} 
            label="Largura (Vão)"
          />
          <Cota3D 
            pontoInicio={[w / 2 + 0.5, 0, d / 2]} 
            pontoFim={[w / 2 + 0.5, 0, -d / 2]} 
            valor={profundidade} 
            label="Profundidade"
          />
          <Cota3D 
            pontoInicio={[-w / 2 - 0.5, 0, d / 2]} 
            pontoFim={[-w / 2 - 0.5, h, d / 2]} 
            valor={altura} 
            label="Pé Direito"
          />
          <Cota3D 
            pontoInicio={[0, 0, d / 2 + 0.5]} 
            pontoFim={[0, ridgeHeight, d / 2 + 0.5]} 
            valor={Math.round(ridgeHeight * 1000)} 
            label="Altura Cumeeira"
          />
        </group>
      )}
    </group>
  );
};
