import React from 'react';
import * as THREE from 'three';
import { QuadroNode } from '../QuadroNode';
import { PerfilData } from '../../../data/perfisDB';
import { AcabamentoMetalKey } from '../../../data/materiaisDB';
import { Cota3D } from '../Cota3D';

interface PortaoBasculanteProps {
  largura: number;
  altura: number;
  perfilData: PerfilData;
  quantidadeGrades: number;
  tipoMontagem: 'reto' | 'meia-esquadria';
  anguloAbertura: number; // em radianos
  acabamentoMetal?: AcabamentoMetalKey;
  mostrarCotas?: boolean;
}

export const PortaoBasculante: React.FC<PortaoBasculanteProps> = ({
  largura,
  altura,
  perfilData,
  quantidadeGrades,
  tipoMontagem,
  anguloAbertura,
  acabamentoMetal = 'preto_fosco',
  mostrarCotas = false
}) => {
  const perfilSize = perfilData.tipoShape === 'redondo_oco' 
    ? (perfilData.diametro || 50) 
    : (perfilData.tipoShape === 'cantoneira' ? (perfilData.abas || 25) : (perfilData.largura || 50));

  // O Batente é o quadro externo, fixo.
  // A Folha é o quadro interno, móvel.
  // As dimensões passadas para QuadroNode são as distâncias entre os centros dos perfis.
  // Para que a largura total externa do Batente seja `largura`, passamos `largura - perfilSize`.
  const larguraBatente = largura - perfilSize;
  const alturaBatente = altura - perfilSize;

  // A folga total entre o Batente e a Folha (ex: 20mm = 10mm de cada lado)
  const folga = 20; 
  
  // A largura interna livre do Batente é `largura - 2 * perfilSize`.
  // A largura externa da Folha deve ser `largura interna do Batente - folga`.
  const larguraFolhaOuter = largura - 2 * perfilSize - folga;
  const alturaFolhaOuter = altura - 2 * perfilSize - folga;

  // Para o QuadroNode da Folha, passamos a dimensão centro-a-centro:
  const larguraFolha = larguraFolhaOuter - perfilSize;
  const alturaFolha = alturaFolhaOuter - perfilSize;

  // O pivot de rotação de um portão basculante geralmente fica um pouco abaixo do topo.
  // Vamos colocar a 200mm do topo da Folha.
  const pivotY = (alturaFolha / 2 - 200) / 1000;

  const w = largura / 1000;
  const h = altura / 1000;

  return (
    <group>
      {/* Batente (Fixo) */}
      <QuadroNode
        largura={larguraBatente}
        altura={alturaBatente}
        perfilData={perfilData}
        quantidadeGrades={0} // Batente não tem grades
        tipoMontagem={tipoMontagem}
        acabamentoMetal={acabamentoMetal}
      />

      {/* Folha (Móvel) */}
      <group position={[0, pivotY, 0]} rotation={[anguloAbertura, 0, 0]}>
        <group position={[0, -pivotY, 0]}>
          <QuadroNode
            largura={larguraFolha}
            altura={alturaFolha}
            perfilData={perfilData}
            quantidadeGrades={quantidadeGrades}
            tipoMontagem={tipoMontagem}
            acabamentoMetal={acabamentoMetal}
          />
        </group>
      </group>

      {/* Cotas Dimensionais */}
      {mostrarCotas && (
        <>
          {/* Cota de Largura (Base) */}
          <Cota3D
            pontoInicio={[-w / 2, -h / 2, 0]}
            pontoFim={[w / 2, -h / 2, 0]}
            valorTexto={`${largura} mm`}
            offset={[0, -0.3, 0]} // Empurra 30cm para baixo
            cor="#3b82f6" // Azul Tailwind
          />
          
          {/* Cota de Altura (Lateral) */}
          <Cota3D
            pontoInicio={[w / 2, -h / 2, 0]}
            pontoFim={[w / 2, h / 2, 0]}
            valorTexto={`${altura} mm`}
            offset={[0.3, 0, 0]} // Empurra 30cm para a direita
            cor="#3b82f6"
          />
        </>
      )}
    </group>
  );
};
