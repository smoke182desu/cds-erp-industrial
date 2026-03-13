import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PecaParametrica } from '../PecaParametrica';
import { InstancedPecas, PecaInstance } from '../InstancedPecas';
import { PerfilData } from '../../../data/perfisDB';
import { AcabamentoMetalKey } from '../../../data/materiaisDB';
import { telhasDB } from '../../../data/telhasDB';
import { TelhaGalvanizada } from '../TelhaGalvanizada';

import { Cota3D } from '../Cota3D';

interface CoberturaParametricaProps {
  largura: number;
  profundidade: number;
  alturaFrontal: number;
  inclinacaoPercentual: number;
  perfilData: PerfilData;
  perfilColunaData?: PerfilData;
  perfilVigaData?: PerfilData;
  acabamentoMetal: AcabamentoMetalKey;
  mostrarCotas?: boolean;
  qtdTercas?: number;
  qtdColunasExtras?: number;
  perfilTercaData?: PerfilData;
  materialCobertura?: 'vidro' | 'policarbonato' | 'telha' | 'vazio';
  telhaSelecionadaId?: string;
  fixacao?: 'chumbado' | 'sapata_parafuso';
  tipoTelhado?: 'uma_agua' | 'duas_aguas' | 'invertido';
  explodedFactor?: number;
  colorTerca?: string;
  colorColuna?: string;
  colorViga?: string;
  colorFechamento?: string;
}

export const CoberturaParametrica: React.FC<CoberturaParametricaProps> = ({
  largura,
  profundidade,
  alturaFrontal,
  inclinacaoPercentual,
  perfilData,
  perfilColunaData: perfilColunaDataProp,
  perfilVigaData: perfilVigaDataProp,
  acabamentoMetal,
  mostrarCotas = false,
  qtdTercas: qtdTercasProp,
  qtdColunasExtras = 0,
  perfilTercaData: perfilTercaDataProp,
  materialCobertura = 'vidro',
  telhaSelecionadaId = 'telha_galvanizada_trap_40',
  fixacao = 'sapata_parafuso',
  tipoTelhado = 'uma_agua',
  explodedFactor = 0,
  colorTerca,
  colorColuna,
  colorViga,
  colorFechamento
}) => {
  // Convert to meters
  const w = largura / 1000;
  const d = profundidade / 1000;
  const hF = alturaFrontal / 1000;

  const hT = useMemo(() => {
    const diferenca = d * (inclinacaoPercentual / 100);
    if (tipoTelhado === 'invertido') {
      return hF + diferenca;
    }
    return hF + diferenca;
  }, [d, inclinacaoPercentual, hF, tipoTelhado]);

  const perfilVigaData = perfilVigaDataProp || perfilData;
  const perfilVigaH = (perfilVigaData.tipoShape === 'redondo_oco' ? (perfilVigaData.diametro || 50) : (perfilVigaData.altura || 50)) / 1000;
  const perfilVigaW = (perfilVigaData.tipoShape === 'redondo_oco' ? (perfilVigaData.diametro || 50) : (perfilVigaData.largura || 50)) / 1000;

  const perfilVigaConvertido: PerfilData = {
    ...perfilVigaData,
    largura: perfilVigaData.largura ? perfilVigaData.largura / 1000 : undefined,
    altura: perfilVigaData.altura ? perfilVigaData.altura / 1000 : undefined,
    diametro: perfilVigaData.diametro ? perfilVigaData.diametro / 1000 : undefined,
    abas: perfilVigaData.abas ? perfilVigaData.abas / 1000 : undefined,
    espessura: perfilVigaData.espessura / 1000,
  };

  const perfilColunaData = perfilColunaDataProp || perfilData;
  const perfilColunaW = (perfilColunaData.tipoShape === 'redondo_oco' ? (perfilColunaData.diametro || 50) : (perfilColunaData.largura || 50)) / 1000;

  const perfilColunaConvertido: PerfilData = {
    ...perfilColunaData,
    largura: perfilColunaData.largura ? perfilColunaData.largura / 1000 : undefined,
    altura: perfilColunaData.altura ? perfilColunaData.altura / 1000 : undefined,
    diametro: perfilColunaData.diametro ? perfilColunaData.diametro / 1000 : undefined,
    abas: perfilColunaData.abas ? perfilColunaData.abas / 1000 : undefined,
    espessura: perfilColunaData.espessura / 1000,
  };

  const perfilTercaData = perfilTercaDataProp || perfilData;
  const perfilTercaH = (perfilTercaData.tipoShape === 'redondo_oco' ? (perfilTercaData.diametro || 50) : (perfilTercaData.altura || 50)) / 1000;

  const perfilTercaConvertido: PerfilData = {
    ...perfilTercaData,
    largura: perfilTercaData.largura ? perfilTercaData.largura / 1000 : undefined,
    altura: perfilTercaData.altura ? perfilTercaData.altura / 1000 : undefined,
    diametro: perfilTercaData.diametro ? perfilTercaData.diametro / 1000 : undefined,
    abas: perfilTercaData.abas ? perfilTercaData.abas / 1000 : undefined,
    espessura: perfilTercaData.espessura / 1000,
  };

  const qtdTerças = qtdTercasProp || (Math.ceil(profundidade / 500) + 1);

  // Exploded View Offsets
  const colOffset = explodedFactor * 1.5;
  const beamOffset = explodedFactor * 2.5;
  const tercaOffset = explodedFactor * 3.5;
  const roofOffset = explodedFactor * 4.5;

  // Arrays for InstancedMesh
  const colunasInstances = useMemo(() => {
    const instances: PecaInstance[] = [
      { start: [-w / 2 + perfilColunaW / 2 - colOffset, 0, d / 2 - perfilColunaW / 2 + colOffset], end: [-w / 2 + perfilColunaW / 2 - colOffset, hF - perfilVigaH, d / 2 - perfilColunaW / 2 + colOffset] },
      { start: [w / 2 - perfilColunaW / 2 + colOffset, 0, d / 2 - perfilColunaW / 2 + colOffset], end: [w / 2 - perfilColunaW / 2 + colOffset, hF - perfilVigaH, d / 2 - perfilColunaW / 2 + colOffset] },
      { start: [-w / 2 + perfilColunaW / 2 - colOffset, 0, -d / 2 + perfilColunaW / 2 - colOffset], end: [-w / 2 + perfilColunaW / 2 - colOffset, hT - perfilVigaH, -d / 2 + perfilColunaW / 2 - colOffset] },
      { start: [w / 2 - perfilColunaW / 2 + colOffset, 0, -d / 2 + perfilColunaW / 2 - colOffset], end: [w / 2 - perfilColunaW / 2 + colOffset, hT - perfilVigaH, -d / 2 + perfilColunaW / 2 - colOffset] }
    ];

    if (qtdColunasExtras > 0) {
      let remaining = qtdColunasExtras;
      if (largura >= profundidade) {
        const numFrente = Math.ceil(remaining / 2);
        const numTras = remaining - numFrente;
        for (let i = 0; i < numFrente; i++) {
          const x = numFrente === 1 ? 0 : (-w / 2 + (w / (numFrente + 1)) * (i + 1));
          instances.push({ start: [x, 0, d / 2 - perfilColunaW / 2 + colOffset], end: [x, hF - perfilVigaH, d / 2 - perfilColunaW / 2 + colOffset] });
        }
        for (let i = 0; i < numTras; i++) {
          const x = numTras === 1 ? 0 : (-w / 2 + (w / (numTras + 1)) * (i + 1));
          instances.push({ start: [x, 0, -d / 2 + perfilColunaW / 2 - colOffset], end: [x, hT - perfilVigaH, -d / 2 + perfilColunaW / 2 - colOffset] });
        }
      } else {
        const numEsq = Math.ceil(remaining / 2);
        const numDir = remaining - numEsq;
        for (let i = 0; i < numEsq; i++) {
          const z = numEsq === 1 ? 0 : (d / 2 - (d / (numEsq + 1)) * (i + 1));
          const progress = (d / 2 - z) / d;
          const hAtZ = hF + (hT - hF) * progress;
          instances.push({ start: [-w / 2 + perfilColunaW / 2 - colOffset, 0, z], end: [-w / 2 + perfilColunaW / 2 - colOffset, hAtZ - perfilVigaH, z] });
        }
        for (let i = 0; i < numDir; i++) {
          const z = numDir === 1 ? 0 : (d / 2 - (d / (numDir + 1)) * (i + 1));
          const progress = (d / 2 - z) / d;
          const hAtZ = hF + (hT - hF) * progress;
          instances.push({ start: [w / 2 - perfilColunaW / 2 + colOffset, 0, z], end: [w / 2 - perfilColunaW / 2 + colOffset, hAtZ - perfilVigaH, z] });
        }
      }
    }
    return instances;
  }, [w, d, hF, hT, perfilColunaW, perfilVigaH, colOffset, qtdColunasExtras, largura, profundidade]);

  const vigasInstances = useMemo(() => {
    const instances: PecaInstance[] = [];
    
    // Frontal
    instances.push({ start: [-w / 2, (tipoTelhado === 'invertido' ? hT : hF) - perfilVigaH / 2 + beamOffset, d / 2 - perfilVigaW / 2], end: [w / 2, (tipoTelhado === 'invertido' ? hT : hF) - perfilVigaH / 2 + beamOffset, d / 2 - perfilVigaW / 2] });
    // Traseira
    instances.push({ start: [-w / 2, hT - perfilVigaH / 2 + beamOffset, -d / 2 + perfilVigaW / 2], end: [w / 2, hT - perfilVigaH / 2 + beamOffset, -d / 2 + perfilVigaW / 2] });

    if (tipoTelhado === 'invertido') {
      instances.push({ start: [-w / 2 + perfilVigaW / 2, hT - perfilVigaH / 2 + beamOffset, d / 2], end: [-w / 2 + perfilVigaW / 2, hF - perfilVigaH / 2 + beamOffset, 0] });
      instances.push({ start: [-w / 2 + perfilVigaW / 2, hF - perfilVigaH / 2 + beamOffset, 0], end: [-w / 2 + perfilVigaW / 2, hT - perfilVigaH / 2 + beamOffset, -d / 2] });
      instances.push({ start: [w / 2 - perfilVigaW / 2, hT - perfilVigaH / 2 + beamOffset, d / 2], end: [w / 2 - perfilVigaW / 2, hF - perfilVigaH / 2 + beamOffset, 0] });
      instances.push({ start: [w / 2 - perfilVigaW / 2, hF - perfilVigaH / 2 + beamOffset, 0], end: [w / 2 - perfilVigaW / 2, hT - perfilVigaH / 2 + beamOffset, -d / 2] });
    } else {
      instances.push({ start: [-w / 2 + perfilVigaW / 2, hF - perfilVigaH / 2 + beamOffset, d / 2], end: [-w / 2 + perfilVigaW / 2, hT - perfilVigaH / 2 + beamOffset, -d / 2] });
      instances.push({ start: [w / 2 - perfilVigaW / 2, hF - perfilVigaH / 2 + beamOffset, d / 2], end: [w / 2 - perfilVigaW / 2, hT - perfilVigaH / 2 + beamOffset, -d / 2] });
    }
    return instances;
  }, [w, d, hF, hT, perfilVigaH, perfilVigaW, tipoTelhado, beamOffset]);

  const tercasInstances = useMemo(() => {
    const instances: PecaInstance[] = [];
    for (let i = 0; i < qtdTerças; i++) {
      const z = qtdTerças > 1 ? (d / 2 - (d / (qtdTerças - 1)) * i) : 0;
      let yBase;
      let upVector: [number, number, number];

      if (tipoTelhado === 'invertido') {
        const progress = Math.abs(z) / (d / 2);
        yBase = hF + (hT - hF) * progress;
        upVector = [0, d / 2, (z > 0 ? -1 : 1) * (hT - hF)];
      } else {
        const progress = i / (qtdTerças - 1);
        yBase = hF + (hT - hF) * progress;
        upVector = [0, d, -(hT - hF)];
      }
      
      const yCenter = yBase + perfilTercaH / 2 + tercaOffset;
      
      // The start and end should be along the width (w), not the depth (z)
      // We need to pass the actual dimensions of the profile to the instance
      instances.push({ 
        start: [-w / 2, yCenter, z], 
        end: [w / 2, yCenter, z], 
        up: upVector 
      });
    }
    return instances;
  }, [qtdTerças, d, w, hF, hT, tipoTelhado, perfilTercaH, tercaOffset]);

  return (
    <group>
      {/* Pilares Instanciados */}
      <InstancedPecas 
        perfil={perfilColunaConvertido} 
        instances={colunasInstances} 
        acabamentoMetal={acabamentoMetal} 
        colorOverride={colorColuna}
      />

      {/* Vigas Perimetrais Instanciadas */}
      <InstancedPecas 
        perfil={perfilVigaConvertido} 
        instances={vigasInstances} 
        acabamentoMetal={acabamentoMetal} 
        colorOverride={colorViga}
      />

      {/* Terças Instanciadas */}
      <InstancedPecas 
        perfil={perfilTercaConvertido} 
        instances={tercasInstances} 
        acabamentoMetal={acabamentoMetal} 
        colorOverride={colorTerca}
      />

      {/* Sapatas de Fixação */}
      {fixacao === 'sapata_parafuso' && (
        <group>
          {(() => {
            const positions: [number, number, number][] = [
              [-w / 2 + perfilColunaW / 2, 0, d / 2 - perfilColunaW / 2],
              [w / 2 - perfilColunaW / 2, 0, d / 2 - perfilColunaW / 2],
              [-w / 2 + perfilColunaW / 2, 0, -d / 2 + perfilColunaW / 2],
              [w / 2 - perfilColunaW / 2, 0, -d / 2 + perfilColunaW / 2],
            ];
            
            if (qtdColunasExtras > 0) {
              let remaining = qtdColunasExtras;
              if (largura >= profundidade) {
                const numFrente = Math.ceil(remaining / 2);
                const numTras = remaining - numFrente;
                for (let i = 0; i < numFrente; i++) {
                  const x = numFrente === 1 ? 0 : (-w / 2 + (w / (numFrente + 1)) * (i + 1));
                  positions.push([x, 0, d / 2 - perfilColunaW / 2]);
                }
                for (let i = 0; i < numTras; i++) {
                  const x = numTras === 1 ? 0 : (-w / 2 + (w / (numTras + 1)) * (i + 1));
                  positions.push([x, 0, -d / 2 + perfilColunaW / 2]);
                }
              } else {
                const numEsq = Math.ceil(remaining / 2);
                const numDir = remaining - numEsq;
                for (let i = 0; i < numEsq; i++) {
                  const z = numEsq === 1 ? 0 : (d / 2 - (d / (numEsq + 1)) * (i + 1));
                  positions.push([-w / 2 + perfilColunaW / 2, 0, z]);
                }
                for (let i = 0; i < numDir; i++) {
                  const z = numDir === 1 ? 0 : (d / 2 - (d / (numDir + 1)) * (i + 1));
                  positions.push([w / 2 - perfilColunaW / 2, 0, z]);
                }
              }
            }

            return positions.map((pos, idx) => (
              <mesh key={idx} position={[pos[0], 0.005, pos[2]]}>
                <boxGeometry args={[perfilColunaW * 2.5, 0.01, perfilColunaW * 2.5]} />
                <meshStandardMaterial color={colorFechamento || "#64748b"} metalness={0.8} roughness={0.2} />
              </mesh>
            ));
          })()}
        </group>
      )}

      {/* Teto / Cobertura */}
      {materialCobertura !== 'vazio' && (
        <group position={[0, roofOffset, 0]}>
          {materialCobertura === 'telha' ? (
            (() => {
              const telha = telhasDB.find(t => t.id === telhaSelecionadaId) || telhasDB[0];
              const larguraUtil = telha.larguraUtil / 1000;
              const larguraTotalTelha = telha.larguraTotal / 1000;
              
              const numTelhas = Math.ceil(w / larguraUtil);
              
              const diferenca = hT - hF;
              const comprimentoReal = tipoTelhado === 'invertido' 
                ? Math.sqrt((d / 2) ** 2 + diferenca ** 2)
                : Math.sqrt(d ** 2 + diferenca ** 2);
              
              const anguloInclinacao = tipoTelhado === 'invertido'
                ? Math.atan(diferenca / (d / 2))
                : Math.atan(diferenca / d);
              
              // Center the tiling
              const larguraTotalCoberta = (numTelhas - 1) * larguraUtil + larguraTotalTelha;
              const offsetX = -larguraTotalCoberta / 2;

              if (tipoTelhado === 'invertido') {
                return (
                  <group position={[offsetX, 0, 0]}>
                    {/* Front half */}
                    <group 
                      position={[0, hT + perfilTercaH + 0.01, d / 2]}
                      rotation={[-anguloInclinacao, 0, 0]}
                    >
                      {Array.from({ length: numTelhas }).map((_, i) => (
                        <group key={`f-${i}`} position={[i * larguraUtil, 0, 0]}>
                          <TelhaGalvanizada 
                            largura={larguraTotalTelha} 
                            comprimento={comprimentoReal + 0.05} 
                            tipo={telha.tipo}
                            cor={telha.tipo === 'sanduiche' ? "#e2e8f0" : "#94a3b8"}
                          />
                        </group>
                      ))}
                    </group>
                    {/* Back half */}
                    <group 
                      position={[0, hT + perfilTercaH + 0.01, -d / 2]}
                      rotation={[anguloInclinacao, 0, 0]}
                    >
                      {Array.from({ length: numTelhas }).map((_, i) => (
                        <group key={`b-${i}`} position={[i * larguraUtil, 0, 0]}>
                          <TelhaGalvanizada 
                            largura={larguraTotalTelha} 
                            comprimento={comprimentoReal + 0.05} 
                            tipo={telha.tipo}
                            cor={telha.tipo === 'sanduiche' ? "#e2e8f0" : "#94a3b8"}
                          />
                        </group>
                      ))}
                    </group>
                  </group>
                );
              }

              return (
                <group 
                  position={[offsetX, hT + perfilTercaH + 0.01, -d / 2]}
                  rotation={[anguloInclinacao, 0, 0]}
                >
                  {Array.from({ length: numTelhas }).map((_, i) => (
                    <group key={i} position={[i * larguraUtil, 0, 0]}>
                      <TelhaGalvanizada 
                        largura={larguraTotalTelha} 
                        comprimento={comprimentoReal + 0.05} 
                        tipo={telha.tipo}
                        cor={telha.tipo === 'sanduiche' ? "#e2e8f0" : "#94a3b8"}
                      />
                    </group>
                  ))}
                </group>
              );
            })()
          ) : (
            <group>
              {tipoTelhado === 'invertido' ? (
                <>
                  <mesh 
                    rotation={[-Math.atan((hT - hF) / (d / 2)), 0, 0]} 
                    position={[0, (hF + hT) / 2 + perfilTercaH + 0.01, d / 4]}
                  >
                    <boxGeometry args={[w + 0.1, 0.02, Math.sqrt((d / 2) ** 2 + (hT - hF) ** 2) + 0.1]} />
                    {materialCobertura === 'vidro' && (
                      <meshPhysicalMaterial color="#a5f3fc" transmission={0.95} opacity={0.4} transparent roughness={0.1} thickness={0.05} />
                    )}
                    {materialCobertura === 'policarbonato' && (
                      <meshPhysicalMaterial color="#f8fafc" transmission={0.7} opacity={0.8} transparent roughness={0.4} thickness={0.02} />
                    )}
                  </mesh>
                  <mesh 
                    rotation={[Math.atan((hT - hF) / (d / 2)), 0, 0]} 
                    position={[0, (hF + hT) / 2 + perfilTercaH + 0.01, -d / 4]}
                  >
                    <boxGeometry args={[w + 0.1, 0.02, Math.sqrt((d / 2) ** 2 + (hT - hF) ** 2) + 0.1]} />
                    {materialCobertura === 'vidro' && (
                      <meshPhysicalMaterial color="#a5f3fc" transmission={0.95} opacity={0.4} transparent roughness={0.1} thickness={0.05} />
                    )}
                    {materialCobertura === 'policarbonato' && (
                      <meshPhysicalMaterial color="#f8fafc" transmission={0.7} opacity={0.8} transparent roughness={0.4} thickness={0.02} />
                    )}
                  </mesh>
                </>
              ) : (
                <mesh 
                  rotation={[Math.atan((hT - hF) / d), 0, 0]} 
                  position={[0, (hF + hT) / 2 + perfilTercaH + 0.01, 0]}
                >
                  <boxGeometry args={[w + 0.1, 0.02, Math.sqrt(d ** 2 + (hT - hF) ** 2) + 0.1]} />
                  {materialCobertura === 'vidro' && (
                    <meshPhysicalMaterial color="#a5f3fc" transmission={0.95} opacity={0.4} transparent roughness={0.1} thickness={0.05} />
                  )}
                  {materialCobertura === 'policarbonato' && (
                    <meshPhysicalMaterial color="#f8fafc" transmission={0.7} opacity={0.8} transparent roughness={0.4} thickness={0.02} />
                  )}
                </mesh>
              )}
            </group>
          )}
        </group>
      )}

      {/* Cotas */}
      {mostrarCotas && (
        <group>
          {/* Largura */}
          <Cota3D 
            pontoInicio={[-w / 2, 0, d / 2 + 0.2]} 
            pontoFim={[w / 2, 0, d / 2 + 0.2]} 
            valor={largura} 
            label="Largura"
          />
          {/* Profundidade */}
          <Cota3D 
            pontoInicio={[w / 2 + 0.2, 0, d / 2]} 
            pontoFim={[w / 2 + 0.2, 0, -d / 2]} 
            valor={profundidade} 
            label="Profundidade"
          />
          {/* Altura Frontal */}
          <Cota3D 
            pontoInicio={[-w / 2 - 0.2, 0, d / 2]} 
            pontoFim={[-w / 2 - 0.2, hF, d / 2]} 
            valor={alturaFrontal} 
            label="H Frontal"
          />
          {/* Altura Traseira */}
          <Cota3D 
            pontoInicio={[-w / 2 - 0.2, 0, -d / 2]} 
            pontoFim={[-w / 2 - 0.2, hT, -d / 2]} 
            valor={Math.round(hT * 1000)} 
            label="H Traseira"
          />
        </group>
      )}
    </group>
  );
};
