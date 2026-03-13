import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PecaParametrica } from '../PecaParametrica';
import { PerfilData } from '../../../data/perfisDB';
import { acabamentosMetal, materiaisDegrau, AcabamentoMetalKey, MaterialDegrauKey } from '../../../data/materiaisDB';
import { Cota3D } from '../Cota3D';

interface EscadaRetaProps {
  alturaTotal: number;
  larguraDegrau: number;
  perfilData?: PerfilData;
  temGuardaCorpo?: boolean;
  ladoGuardaCorpo?: 'esquerdo' | 'direito' | 'ambos';
  acabamentoMetal?: AcabamentoMetalKey;
  materialDegrau?: MaterialDegrauKey;
  mostrarCotas?: boolean;
  colorBanzo?: string;
  colorMontante?: string;
  colorViga?: string;
}

export const EscadaReta: React.FC<EscadaRetaProps> = ({ 
  alturaTotal, 
  larguraDegrau,
  perfilData: perfilDataProp,
  temGuardaCorpo = false,
  ladoGuardaCorpo = 'ambos',
  acabamentoMetal = 'preto_fosco',
  materialDegrau = 'madeira_clara',
  mostrarCotas = false,
  colorBanzo,
  colorMontante,
  colorViga
}) => {
  // Converter para metros
  const h = alturaTotal / 1000;
  const w = larguraDegrau / 1000;

  // Perfil da Viga (Default: Viga U 6")
  const perfilViga = perfilDataProp || {
    id: 'viga_u_6_polegadas',
    nome: 'Viga U 6" (152mm)',
    tipoShape: 'perfil_u_simples',
    largura: 152.4,
    abas: 48,
    espessura: 5.1,
  } as PerfilData;

  const perfilVigaM = useMemo(() => ({
    ...perfilViga,
    largura: perfilViga.largura ? perfilViga.largura / 1000 : undefined,
    altura: perfilViga.altura ? perfilViga.altura / 1000 : undefined,
    diametro: perfilViga.diametro ? perfilViga.diametro / 1000 : undefined,
    abas: perfilViga.abas ? perfilViga.abas / 1000 : undefined,
    espessura: perfilViga.espessura / 1000,
  }), [perfilViga]);

  // Perfil do Degrau (Simulado como chapa)
  const perfilDegrauM: PerfilData = {
    id: 'degrau_chapa',
    nome: 'Degrau',
    tipoShape: 'chapa',
    largura: 280 / 1000, // pisada
    espessura: 4.75 / 1000,
  } as any;

  // Lógica de Cálculo (Engenharia)
  const espelhoMaximo = 180 / 1000;
  const numDegraus = Math.ceil(h / espelhoMaximo);
  const espelho = h / numDegraus;
  const pisada = 280 / 1000;
  const comprimentoTotal = numDegraus * pisada;

  // Vigas Laterais
  const larguraViga = (perfilViga.largura || 150) / 1000;
  const espessuraViga = (perfilViga.tipoShape === 'redondo_oco' ? (perfilViga.diametro || 50) : (perfilViga.altura || perfilViga.abas || 50)) / 1000;
  
  const centroY = h / 2;
  const centroZ = comprimentoTotal / 2;

  // Guarda-Corpo
  const alturaGuardaCorpo = 0.9;
  const perfilCorrimao: PerfilData = {
    id: 'corrimao',
    nome: 'Corrimão',
    tipoShape: 'redondo_oco',
    diametro: 42.4 / 1000,
    espessura: 2.0 / 1000,
  } as any;

  const renderGuardaCorpo = (lado: 'esquerdo' | 'direito') => {
    const posX = lado === 'esquerdo' ? -w / 2 - espessuraViga / 2 : w / 2 + espessuraViga / 2;
    const montantes = [];
    for (let i = 0; i <= numDegraus; i += 2) {
      const posZ = i * pisada;
      const posY = (posZ / comprimentoTotal) * h;
      montantes.push(
        <PecaParametrica
          key={`montante-${lado}-${i}`}
          pontoInicio={[posX, posY, posZ]}
          pontoFim={[posX, posY + alturaGuardaCorpo, posZ]}
          perfil={{ ...perfilCorrimao, diametro: 30 / 1000 }}
          tipoCorte="reto"
          acabamentoMetal={acabamentoMetal}
          colorOverride={colorMontante}
        />
      );
    }

    return (
      <group key={`guarda-corpo-${lado}`}>
        {/* Corrimão Superior */}
        <PecaParametrica
          pontoInicio={[posX, alturaGuardaCorpo, 0]}
          pontoFim={[posX, h + alturaGuardaCorpo, comprimentoTotal]}
          perfil={perfilCorrimao}
          tipoCorte="reto"
          acabamentoMetal={acabamentoMetal}
          colorOverride={colorBanzo}
        />
        {montantes}
      </group>
    );
  };

  return (
    <group position={[0, -h / 2, -comprimentoTotal / 2]}>
      {/* Degraus */}
      {Array.from({ length: numDegraus }).map((_, i) => {
        const posY = (i + 1) * espelho;
        const posZ = (i + 1) * pisada;

        return (
          <PecaParametrica
            key={`degrau-${i}`}
            pontoInicio={[-w / 2, posY - 0.005, posZ - pisada / 2]}
            pontoFim={[w / 2, posY - 0.005, posZ - pisada / 2]}
            perfil={{ ...perfilDegrauM, largura: pisada }}
            tipoCorte="reto"
            materialProps={materiaisDegrau[materialDegrau]}
            up={[0, 1, 0]}
          />
        );
      })}

      {/* Viga Esquerda */}
      <PecaParametrica
        pontoInicio={[-w / 2 - espessuraViga / 2, 0, 0]}
        pontoFim={[-w / 2 - espessuraViga / 2, h, comprimentoTotal]}
        perfil={perfilVigaM}
        tipoCorte="reto"
        acabamentoMetal={acabamentoMetal}
        up={[0, 1, 0]}
        colorOverride={colorViga}
      />

      {/* Viga Direita */}
      <PecaParametrica
        pontoInicio={[w / 2 + espessuraViga / 2, 0, 0]}
        pontoFim={[w / 2 + espessuraViga / 2, h, comprimentoTotal]}
        perfil={perfilVigaM}
        tipoCorte="reto"
        acabamentoMetal={acabamentoMetal}
        up={[0, 1, 0]}
        colorOverride={colorViga}
      />

      {/* Guarda-Corpos */}
      {temGuardaCorpo && (ladoGuardaCorpo === 'esquerdo' || ladoGuardaCorpo === 'ambos') && renderGuardaCorpo('esquerdo')}
      {temGuardaCorpo && (ladoGuardaCorpo === 'direito' || ladoGuardaCorpo === 'ambos') && renderGuardaCorpo('direito')}

      {/* Chão */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial color="#444" transparent={true} opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Plataforma */}
      <mesh position={[0, h, comprimentoTotal]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 0.5, 1]} />
        <meshBasicMaterial color="#444" transparent={true} opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Cotas Dimensionais */}
      {mostrarCotas && (
        <>
          {/* Cota de Altura Total (Pé Direito) */}
          <Cota3D
            pontoInicio={[w / 2 + 0.2, 0, comprimentoTotal]}
            pontoFim={[w / 2 + 0.2, h, comprimentoTotal]}
            valorTexto={`${alturaTotal} mm`}
            offset={[0.2, 0, 0]} // Empurra para a direita
            cor="#3b82f6"
          />
          
          {/* Cota de Comprimento Total */}
          <Cota3D
            pontoInicio={[w / 2 + 0.2, 0, 0]}
            pontoFim={[w / 2 + 0.2, 0, comprimentoTotal]}
            valorTexto={`${Math.round(comprimentoTotal * 1000)} mm`}
            offset={[0.2, 0, 0]} // Empurra para a direita
            cor="#3b82f6"
          />

          {/* Cota de Largura */}
          <Cota3D
            pontoInicio={[-w / 2, 0, 0]}
            pontoFim={[w / 2, 0, 0]}
            valorTexto={`${larguraDegrau} mm`}
            offset={[0, 0, -0.3]} // Empurra para trás
            cor="#3b82f6"
          />
        </>
      )}
    </group>
  );
};
