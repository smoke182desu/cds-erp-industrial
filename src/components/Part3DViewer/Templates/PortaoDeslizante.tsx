import React from 'react';
import * as THREE from 'three';
import { QuadroNode } from '../QuadroNode';
import { PecaParametrica } from '../PecaParametrica';
import { PerfilData } from '../../../data/perfisDB';
import { AcabamentoMetalKey } from '../../../data/materiaisDB';
import { Cota3D } from '../Cota3D';

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
  anguloAbertura: number; // Usaremos como fator de deslizamento (0 a 1)
  acabamentoMetal?: AcabamentoMetalKey;
  mostrarCotas?: boolean;
}

export const PortaoDeslizante: React.FC<PortaoDeslizanteProps> = ({
  largura,
  altura,
  perfilData,
  perfilTrilhoData,
  perfilGuiaData,
  perfilBatenteData,
  perfilColunaPortaoData,
  incluirPortaoPedestre = false,
  quantidadeGrades,
  tipoMontagem,
  anguloAbertura,
  acabamentoMetal = 'preto_fosco',
  mostrarCotas = false
}) => {
  const perfilSize = perfilData.tipoShape === 'redondo_oco' 
    ? (perfilData.diametro || 50) 
    : (perfilData.tipoShape === 'cantoneira' ? (perfilData.abas || 25) : (perfilData.largura || 50));

  // Folha do portão deslizante
  const larguraFolha = largura;
  const alturaFolha = altura - perfilSize; // Desconta o trilho/guia

  // Deslizamento horizontal: anguloAbertura (0 a PI/2) mapeado para (0 a largura)
  // Como o slider vai de 0 a 90, anguloAbertura vai de 0 a 1.57.
  // Vamos normalizar para 0 a 1.
  const fatorDeslizamento = anguloAbertura / (Math.PI / 2);
  const deslocamentoX = fatorDeslizamento * (largura / 1000);

  const w = largura / 1000;
  const h = altura / 1000;
  const trilhoW = (largura * 2) / 1000;

  return (
    <group>
      {/* Trilho Inferior */}
      {perfilTrilhoData && (
        <group position={[w / 2, -h / 2, 0]}>
          <PecaParametrica
            pontoInicio={[-trilhoW / 2, 0, 0]}
            pontoFim={[trilhoW / 2, 0, 0]}
            perfil={perfilTrilhoData}
            acabamentoMetal={acabamentoMetal}
            tipoCorte="reto"
          />
        </group>
      )}

      {/* Guia Superior */}
      {perfilGuiaData && (
        <group position={[w / 2, h / 2, 0]}>
          <PecaParametrica
            pontoInicio={[-trilhoW / 2, 0, 0]}
            pontoFim={[trilhoW / 2, 0, 0]}
            perfil={perfilGuiaData}
            acabamentoMetal={acabamentoMetal}
            tipoCorte="reto"
          />
        </group>
      )}

      {/* Coluna Batente (Fechamento) */}
      {perfilBatenteData && (
        <group position={[-w / 2, 0, 0]}>
          <PecaParametrica
            pontoInicio={[0, -h / 2, 0]}
            pontoFim={[0, h / 2, 0]}
            perfil={perfilBatenteData}
            acabamentoMetal={acabamentoMetal}
            tipoCorte="reto"
          />
        </group>
      )}

      {/* Coluna Central (Apoio Guia) */}
      {perfilColunaPortaoData && (
        <group position={[w / 2, 0, -0.1]}>
          <PecaParametrica
            pontoInicio={[0, -h / 2, 0]}
            pontoFim={[0, h / 2, 0]}
            perfil={perfilColunaPortaoData}
            acabamentoMetal={acabamentoMetal}
            tipoCorte="reto"
          />
        </group>
      )}

      {/* Coluna Final (Apoio Guia Aberto) */}
      {perfilColunaPortaoData && (
        <group position={[w * 1.5, 0, -0.1]}>
          <PecaParametrica
            pontoInicio={[0, -h / 2, 0]}
            pontoFim={[0, h / 2, 0]}
            perfil={perfilColunaPortaoData}
            acabamentoMetal={acabamentoMetal}
            tipoCorte="reto"
          />
        </group>
      )}

      {/* Folha Deslizante */}
      <group position={[deslocamentoX, 0, 0.05]}>
        <QuadroNode
          largura={larguraFolha}
          altura={alturaFolha}
          perfilData={perfilData}
          quantidadeGrades={quantidadeGrades}
          tipoMontagem={tipoMontagem}
          acabamentoMetal={acabamentoMetal}
        />
        {/* Portão Pedestre Embutido */}
        {incluirPortaoPedestre && (
          <group position={[-w / 2 + 0.6, -h / 2 + 1.05, 0.02]}>
            <QuadroNode
              largura={900}
              altura={2100}
              perfilData={perfilData}
              quantidadeGrades={0}
              tipoMontagem={tipoMontagem}
              acabamentoMetal={acabamentoMetal}
            />
          </group>
        )}
      </group>

      {/* Cotas Dimensionais */}
      {mostrarCotas && (
        <>
          <Cota3D
            pontoInicio={[-w / 2, -h / 2, 0]}
            pontoFim={[w / 2, -h / 2, 0]}
            valorTexto={`${largura} mm`}
            offset={[0, -0.3, 0]}
            cor="#3b82f6"
          />
          <Cota3D
            pontoInicio={[w / 2, -h / 2, 0]}
            pontoFim={[w / 2, h / 2, 0]}
            valorTexto={`${altura} mm`}
            offset={[0.3, 0, 0]}
            cor="#3b82f6"
          />
          <Cota3D
            pontoInicio={[-w / 2, -h / 2, 0]}
            pontoFim={[w * 1.5, -h / 2, 0]}
            valorTexto={`Abertura Total: ${largura * 2} mm`}
            offset={[0, -0.6, 0]}
            cor="#10b981"
          />
        </>
      )}
    </group>
  );
};
