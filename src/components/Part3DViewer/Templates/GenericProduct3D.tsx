import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Cota3D } from '../Cota3D';

interface GenericProduct3DProps {
  tipoProduto: string;
  largura: number;
  altura: number;
  profundidade: number;
  color?: string;
  mostrarCotas?: boolean;
}

export const GenericProduct3D: React.FC<GenericProduct3DProps> = ({
  tipoProduto,
  largura: larguraMM,
  altura: alturaMM,
  profundidade: profundidadeMM,
  color = '#64748b',
  mostrarCotas = false
}) => {
  const largura = larguraMM / 1000;
  const altura = alturaMM / 1000;
  const profundidade = profundidadeMM / 1000;

  const material = useMemo(() => new THREE.MeshStandardMaterial({ 
    color,
    roughness: 0.7,
    metalness: 0.3,
  }), [color]);

  const transparentMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color,
    roughness: 0.7,
    metalness: 0.3,
    transparent: true,
    opacity: 0.3
  }), [color]);

  const renderModel = () => {
    switch (tipoProduto) {
      case 'mezanino_industrial':
        return (
          <group>
            {/* Piso */}
            <mesh position={[0, altura, 0]} material={material}>
              <boxGeometry args={[largura, 0.01, profundidade]} />
            </mesh>
            {/* Vigas Principais */}
            <mesh position={[0, altura - 0.025, -profundidade/2 + 0.025]} material={material}>
              <boxGeometry args={[largura, 0.05, 0.05]} />
            </mesh>
            <mesh position={[0, altura - 0.025, profundidade/2 - 0.025]} material={material}>
              <boxGeometry args={[largura, 0.05, 0.05]} />
            </mesh>
            {/* Colunas */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.05), altura/2, z * (profundidade/2 - 0.05)]} material={material}>
                <boxGeometry args={[0.1, altura, 0.1]} />
              </mesh>
            ))}
            {/* Guarda-corpo simples */}
            <mesh position={[0, altura + 0.5, profundidade/2]} material={transparentMaterial}>
              <boxGeometry args={[largura, 1.0, 0.01]} />
            </mesh>
          </group>
        );
      case 'guarda_corpo':
      case 'grade_protecao':
      case 'grade_contencao':
        return (
          <group>
            {/* Montantes verticais */}
            {Array.from({ length: Math.ceil(largura / 1.0) + 1 }).map((_, i) => (
              <mesh key={i} position={[-largura/2 + i * (largura / Math.ceil(largura / 1.0)), altura/2, 0]} material={material}>
                <boxGeometry args={[0.04, altura, 0.04]} />
              </mesh>
            ))}
            {/* Travessas horizontais */}
            <mesh position={[0, altura, 0]} rotation={[0, 0, Math.PI/2]} material={material}>
              <cylinderGeometry args={[0.025, 0.025, largura]} />
            </mesh>
            <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI/2]} material={material}>
              <cylinderGeometry args={[0.02, 0.02, largura]} />
            </mesh>
            {/* Barras verticais internas */}
            {Array.from({ length: Math.ceil(largura / 0.15) }).map((_, i) => (
              <mesh key={i} position={[-largura/2 + i * (largura / Math.ceil(largura / 0.15)), altura/2, 0]} material={material}>
                <boxGeometry args={[0.015, altura - 0.1, 0.015]} />
              </mesh>
            ))}
          </group>
        );
      case 'container_almoxarifado':
      case 'guarita_metalica':
      case 'modulo_escritorio':
        return (
          <group>
            {/* Estrutura principal */}
            <mesh position={[0, altura/2, 0]} material={material}>
              <boxGeometry args={[largura, altura, profundidade]} />
            </mesh>
            {/* Porta */}
            <mesh position={[largura/4, altura/2, profundidade/2 + 0.005]} material={new THREE.MeshStandardMaterial({ color: '#1e293b' })}>
              <boxGeometry args={[0.8, 2.1, 0.02]} />
            </mesh>
            {/* Janela */}
            <mesh position={[-largura/4, altura * 0.6, profundidade/2 + 0.005]} material={new THREE.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: 0.5 })}>
              <boxGeometry args={[1.2, 1.0, 0.01]} />
            </mesh>
            {/* Teto */}
            <mesh position={[0, altura + 0.025, 0]} material={material}>
              <boxGeometry args={[largura + 0.1, 0.05, profundidade + 0.1]} />
            </mesh>
          </group>
        );
      case 'carrinho_plataforma':
        return (
          <group>
            {/* Base */}
            <mesh position={[0, 0.15, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            {/* Alça */}
            <mesh position={[0, altura/2 + 0.15, -profundidade/2 + 0.025]} material={material}>
              <boxGeometry args={[largura, altura, 0.05]} />
            </mesh>
            {/* Rodas */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.1), 0.075, z * (profundidade/2 - 0.1)]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#000' })}>
                <cylinderGeometry args={[0.075, 0.075, 0.05]} />
              </mesh>
            ))}
          </group>
        );
      case 'gaiola_roll':
        return (
          <group>
            {/* Base */}
            <mesh position={[0, 0.15, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            {/* Paredes laterais (grade) */}
            <mesh position={[-largura/2 + 0.025, altura/2 + 0.15, 0]} material={transparentMaterial}>
              <boxGeometry args={[0.05, altura, profundidade]} />
            </mesh>
            <mesh position={[largura/2 - 0.025, altura/2 + 0.15, 0]} material={transparentMaterial}>
              <boxGeometry args={[0.05, altura, profundidade]} />
            </mesh>
            <mesh position={[0, altura/2 + 0.15, -profundidade/2 + 0.025]} material={transparentMaterial}>
              <boxGeometry args={[largura, altura, 0.05]} />
            </mesh>
            {/* Rodas */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.1), 0.075, z * (profundidade/2 - 0.1)]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#000' })}>
                <cylinderGeometry args={[0.075, 0.075, 0.05]} />
              </mesh>
            ))}
          </group>
        );
      case 'carrinho_cilindros':
        return (
          <group>
            {/* Base inclinada */}
            <mesh position={[0, 0.1, 0]} rotation={[0.2, 0, 0]} material={material}>
              <boxGeometry args={[largura, 0.04, profundidade]} />
            </mesh>
            {/* Encosto */}
            <mesh position={[0, altura/2 + 0.1, -profundidade/2 + 0.02]} material={material}>
              <boxGeometry args={[largura, altura, 0.04]} />
            </mesh>
            {/* Rodas grandes */}
            <mesh position={[-largura/2 - 0.025, 0.15, -profundidade/2 + 0.1]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#000' })}>
              <cylinderGeometry args={[0.15, 0.15, 0.05]} />
            </mesh>
            <mesh position={[largura/2 + 0.025, 0.15, -profundidade/2 + 0.1]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#000' })}>
              <cylinderGeometry args={[0.15, 0.15, 0.05]} />
            </mesh>
          </group>
        );
      case 'abrigo_onibus':
        return (
          <group>
            {/* Parede traseira */}
            <mesh position={[0, altura/2, -profundidade/2 + 0.05]} material={material}>
              <boxGeometry args={[largura, altura, 0.1]} />
            </mesh>
            {/* Teto inclinado */}
            <mesh position={[0, altura, 0]} rotation={[0.1, 0, 0]} material={material}>
              <boxGeometry args={[largura + 0.4, 0.1, profundidade + 0.4]} />
            </mesh>
            {/* Bancos */}
            <mesh position={[0, 0.45, -profundidade/2 + 0.3]} material={new THREE.MeshStandardMaterial({ color: '#1e293b' })}>
              <boxGeometry args={[largura * 0.8, 0.05, 0.4]} />
            </mesh>
            {/* Colunas frontais */}
            <mesh position={[-largura/2 + 0.05, altura/2, profundidade/2 - 0.05]} material={material}>
              <boxGeometry args={[0.1, altura, 0.1]} />
            </mesh>
            <mesh position={[largura/2 - 0.05, altura/2, profundidade/2 - 0.05]} material={material}>
              <boxGeometry args={[0.1, altura, 0.1]} />
            </mesh>
          </group>
        );
      case 'bicicletario':
        return (
          <group>
            <mesh position={[0, 0.025, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            {Array.from({ length: Math.ceil(largura / 0.4) }).map((_, i) => (
              <mesh key={i} position={[-largura/2 + (i+0.5) * (largura / Math.ceil(largura / 0.4)), altura/2 + 0.025, 0]} material={material}>
                <torusGeometry args={[altura/2, 0.02, 16, 100, Math.PI]} />
              </mesh>
            ))}
          </group>
        );
      case 'lixeira_ecologica':
      case 'lixeira_estacionaria':
      case 'lixeira_calcada':
        return (
          <group>
            {/* Suporte */}
            <mesh position={[0, altura/2, 0]} material={material}>
              <cylinderGeometry args={[0.02, 0.02, altura]} />
            </mesh>
            {/* Cesto */}
            <mesh position={[0, altura * 0.7, 0]} material={material}>
              <cylinderGeometry args={[largura/2, largura/2 * 0.8, altura/2]} />
            </mesh>
            {/* Tampa */}
            <mesh position={[0, altura * 0.95, 0]} material={material}>
              <cylinderGeometry args={[largura/2 + 0.02, largura/2 + 0.02, 0.02]} />
            </mesh>
          </group>
        );
      case 'conjunto_traves':
        return (
          <group>
            <mesh position={[-largura/2, altura/2, 0]} material={material}>
              <cylinderGeometry args={[0.05, 0.05, altura]} />
            </mesh>
            <mesh position={[largura/2, altura/2, 0]} material={material}>
              <cylinderGeometry args={[0.05, 0.05, altura]} />
            </mesh>
            <mesh position={[0, altura, 0]} rotation={[0, 0, Math.PI/2]} material={material}>
              <cylinderGeometry args={[0.05, 0.05, largura]} />
            </mesh>
            {/* Rede (simulada) */}
            <mesh position={[0, altura/2, -profundidade/2]} material={transparentMaterial}>
              <boxGeometry args={[largura, altura, 0.01]} />
            </mesh>
          </group>
        );
      case 'beliche_militar':
        return (
          <group>
            {/* Camas */}
            <mesh position={[0, 0.4, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            <mesh position={[0, altura - 0.4, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            {/* Colunas */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.025), altura/2, z * (profundidade/2 - 0.025)]} material={material}>
                <boxGeometry args={[0.05, altura, 0.05]} />
              </mesh>
            ))}
            {/* Escada lateral */}
            <mesh position={[largura/2, altura/2, 0]} material={material}>
              <boxGeometry args={[0.02, altura, 0.1]} />
            </mesh>
          </group>
        );
      case 'armario_vestiario':
        return (
          <group>
            <mesh position={[0, altura/2, 0]} material={material}>
              <boxGeometry args={[largura, altura, profundidade]} />
            </mesh>
            {/* Portas */}
            {Array.from({ length: 2 }).map((_, i) => (
              <mesh key={i} position={[(-largura/4) + (i * largura/2), altura/2, profundidade/2 + 0.005]} material={material}>
                <boxGeometry args={[largura/2 - 0.01, altura - 0.02, 0.01]} />
              </mesh>
            ))}
          </group>
        );
      case 'banco_vestiario':
        return (
          <group>
            {/* Assento */}
            <mesh position={[0, 0.45, 0]} material={material}>
              <boxGeometry args={[largura, 0.04, profundidade]} />
            </mesh>
            {/* Encosto */}
            <mesh position={[0, 0.9, -profundidade/2 + 0.02]} material={material}>
              <boxGeometry args={[largura, 0.3, 0.04]} />
            </mesh>
            {/* Pés */}
            <mesh position={[-largura/2 + 0.1, 0.225, 0]} material={material}>
              <boxGeometry args={[0.05, 0.45, profundidade - 0.1]} />
            </mesh>
            <mesh position={[largura/2 - 0.1, 0.225, 0]} material={material}>
              <boxGeometry args={[0.05, 0.45, profundidade - 0.1]} />
            </mesh>
          </group>
        );
      case 'mesa_refeitorio':
        return (
          <group>
            {/* Tampo */}
            <mesh position={[0, 0.75, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            {/* Bancos acoplados */}
            <mesh position={[0, 0.45, -profundidade/2 - 0.3]} material={material}>
              <boxGeometry args={[largura, 0.04, 0.3]} />
            </mesh>
            <mesh position={[0, 0.45, profundidade/2 + 0.3]} material={material}>
              <boxGeometry args={[largura, 0.04, 0.3]} />
            </mesh>
            {/* Estrutura de ligação */}
            <mesh position={[0, 0.45, 0]} material={material}>
              <boxGeometry args={[0.05, 0.05, profundidade + 0.6]} />
            </mesh>
            {/* Pés */}
            <mesh position={[-largura/2 + 0.2, 0.375, 0]} material={material}>
              <boxGeometry args={[0.05, 0.75, 0.05]} />
            </mesh>
            <mesh position={[largura/2 - 0.2, 0.375, 0]} material={material}>
              <boxGeometry args={[0.05, 0.75, 0.05]} />
            </mesh>
          </group>
        );
      case 'mesa_treinamento':
      case 'mesa_centro':
        return (
          <group>
            <mesh position={[0, altura, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.1), altura/2, z * (profundidade/2 - 0.1)]} material={material}>
                <cylinderGeometry args={[0.025, 0.025, altura]} />
              </mesh>
            ))}
          </group>
        );
      case 'escada_plataforma':
        return (
          <group>
            {/* Plataforma superior */}
            <mesh position={[0, altura, -profundidade/4]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade/2]} />
            </mesh>
            {/* Degraus */}
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh key={i} position={[0, (i+1)*altura/6, i*profundidade/10]} material={material}>
                <boxGeometry args={[largura, 0.03, 0.25]} />
              </mesh>
            ))}
            {/* Rodas */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.05), 0.05, z * (profundidade/2 - 0.05)]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#000' })}>
                <cylinderGeometry args={[0.05, 0.05, 0.04]} />
              </mesh>
            ))}
          </group>
        );
      case 'tampa_casa_maquina':
      case 'tampa_oculta':
      case 'tampa_alcapao':
      case 'grelha_ralo':
        return (
          <group>
            <mesh position={[0, 0.025, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            {/* Detalhe de grelha */}
            {tipoProduto === 'grelha_ralo' && Array.from({ length: 10 }).map((_, i) => (
              <mesh key={i} position={[-largura/2 + (i+0.5)*largura/10, 0.055, 0]} material={new THREE.MeshStandardMaterial({ color: '#1e293b' })}>
                <boxGeometry args={[0.01, 0.01, profundidade - 0.02]} />
              </mesh>
            ))}
          </group>
        );
      case 'prateleiras':
        return (
          <group>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh key={i} position={[0, (i+1)*altura/5, 0]} material={material}>
                <boxGeometry args={[largura, 0.02, profundidade]} />
              </mesh>
            ))}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.025), altura/2, z * (profundidade/2 - 0.025)]} material={material}>
                <boxGeometry args={[0.05, altura, 0.05]} />
              </mesh>
            ))}
          </group>
        );
      case 'suporte_mao_francesa':
      case 'mao_francesa_invertida':
        return (
          <group>
            <mesh position={[0, altura/2, -profundidade/2 + 0.025]} material={material}>
              <boxGeometry args={[largura, altura, 0.05]} />
            </mesh>
            <mesh position={[0, altura - 0.025, 0]} material={material}>
              <boxGeometry args={[largura, 0.05, profundidade]} />
            </mesh>
            <mesh position={[0, altura/2, 0]} rotation={[Math.atan2(altura, profundidade), 0, 0]} material={material}>
              <boxGeometry args={[largura/2, 0.04, Math.sqrt(altura*altura + profundidade*profundidade)]} />
            </mesh>
          </group>
        );
      case 'churrasqueira':
        return (
          <group>
            {/* Base */}
            <mesh position={[0, altura/4, 0]} material={material}>
              <boxGeometry args={[largura, altura/2, profundidade]} />
            </mesh>
            {/* Coifa */}
            <mesh position={[0, altura*0.7, 0]} material={material}>
              <mesh rotation={[0, Math.PI/4, 0]}>
                <cylinderGeometry args={[largura/4, largura/2, altura/2, 4]} />
              </mesh>
            </mesh>
            {/* Chaminé */}
            <mesh position={[0, altura*1.1, 0]} material={material}>
              <cylinderGeometry args={[largura/6, largura/6, altura/2]} />
            </mesh>
          </group>
        );
      case 'lareira':
        return (
          <group>
            {/* Corpo cônico */}
            <mesh position={[0, altura/2, 0]} material={material}>
              <cylinderGeometry args={[largura/8, largura/2, altura, 32]} />
            </mesh>
            {/* Chaminé */}
            <mesh position={[0, altura, 0]} material={material}>
              <cylinderGeometry args={[largura/8, largura/8, altura]} />
            </mesh>
          </group>
        );
      case 'vaso_metalico':
        return (
          <mesh position={[0, altura/2, 0]} material={material}>
            <cylinderGeometry args={[largura/2, largura/3, altura, 32]} />
          </mesh>
        );
      case 'lateral_carretinha':
      case 'para_lama':
      case 'para_choque':
        return (
          <group>
            <mesh position={[0, altura/2, 0]} material={material}>
              <boxGeometry args={[largura, altura, 0.05]} />
            </mesh>
            {tipoProduto === 'para_lama' && (
              <mesh position={[0, altura, 0]} material={material}>
                <boxGeometry args={[largura, 0.05, profundidade]} />
              </mesh>
            )}
          </group>
        );
      case 'portao_pivotante':
        return (
          <group>
            <mesh position={[-largura/4 - 0.01, altura/2, 0]} rotation={[0, 0.5, 0]} material={material}>
              <boxGeometry args={[largura/2 - 0.02, altura, 0.04]} />
            </mesh>
            <mesh position={[largura/4 + 0.01, altura/2, 0]} rotation={[0, -0.5, 0]} material={material}>
              <boxGeometry args={[largura/2 - 0.02, altura, 0.04]} />
            </mesh>
          </group>
        );
      case 'pergelado_metalico':
      case 'pergolado_metalico':
        return (
          <group>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
              <mesh key={i} position={[x * (largura/2 - 0.1), altura/2, z * (profundidade/2 - 0.1)]} material={material}>
                <boxGeometry args={[0.15, altura, 0.15]} />
              </mesh>
            ))}
            {/* Vigas principais */}
            <mesh position={[0, altura, -profundidade/2 + 0.1]} material={material}>
              <boxGeometry args={[largura, 0.2, 0.1]} />
            </mesh>
            <mesh position={[0, altura, profundidade/2 - 0.1]} material={material}>
              <boxGeometry args={[largura, 0.2, 0.1]} />
            </mesh>
            {/* Ripas superiores */}
            {Array.from({ length: 12 }).map((_, i) => (
              <mesh key={i} position={[-largura/2 + (i+0.5)*largura/12, altura + 0.1, 0]} material={material}>
                <boxGeometry args={[0.04, 0.1, profundidade]} />
              </mesh>
            ))}
          </group>
        );
      default:
        return (
          <mesh position={[0, altura/2, 0]} material={material}>
            <boxGeometry args={[largura, altura, profundidade]} />
            <Html position={[0, 0, profundidade/2 + 0.01]} center distanceFactor={10}>
              <div className="bg-white/80 px-2 py-1 rounded text-xs text-slate-900 font-bold whitespace-nowrap">
                {tipoProduto.replace(/_/g, ' ').toUpperCase()}
              </div>
            </Html>
          </mesh>
        );
    }
  };

  return (
    <group>
      {renderModel()}
      
      {/* --- COTAS DIMENSIONAIS --- */}
      {mostrarCotas && (
        <>
          {/* Altura Total */}
          <Cota3D
            pontoInicio={[largura/2 + 0.1, 0, profundidade/2]}
            pontoFim={[largura/2 + 0.1, altura, profundidade/2]}
            valorTexto={`${alturaMM.toFixed(0)} mm`}
            offset={[0.1, 0, 0]}
            cor="#3b82f6"
          />
          {/* Largura Total */}
          <Cota3D
            pontoInicio={[-largura/2, altura + 0.1, profundidade/2]}
            pontoFim={[largura/2, altura + 0.1, profundidade/2]}
            valorTexto={`${larguraMM.toFixed(0)} mm`}
            offset={[0, 0.1, 0]}
            cor="#3b82f6"
          />
          {/* Profundidade Total */}
          <Cota3D
            pontoInicio={[-largura/2 - 0.1, altura/2, -profundidade/2]}
            pontoFim={[-largura/2 - 0.1, altura/2, profundidade/2]}
            valorTexto={`${profundidadeMM.toFixed(0)} mm`}
            offset={[-0.1, 0, 0]}
            cor="#3b82f6"
          />
        </>
      )}
    </group>
  );
};
