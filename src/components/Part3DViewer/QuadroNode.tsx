import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PecaParametrica } from './PecaParametrica';
import { PerfilData } from '../../data/perfisDB';
import { AcabamentoMetalKey } from '../../data/materiaisDB';
import { Cota3D } from './Cota3D';

interface QuadroNodeProps {
  largura: number;
  altura: number;
  perfilData: PerfilData;
  quantidadeGrades: number;
  tipoMontagem: 'reto' | 'meia-esquadria';
  acabamentoMetal?: AcabamentoMetalKey;
  mostrarCotas?: boolean;
}

export const QuadroNode: React.FC<QuadroNodeProps> = ({
  largura,
  altura,
  perfilData,
  quantidadeGrades,
  tipoMontagem,
  acabamentoMetal = 'preto_fosco',
  mostrarCotas = false
}) => {
  const w = largura / 1000;
  const h = altura / 1000;
  
  // Determina a dimensão do perfil no plano do quadro (altura do perfil)
  const p = (perfilData.tipoShape === 'redondo_oco' 
    ? (perfilData.diametro || 50) 
    : (perfilData.tipoShape === 'cantoneira' ? (perfilData.abas || 25) : (perfilData.altura || perfilData.largura || 50))) / 1000;

  // Precisamos converter as dimensões do perfil de mm para metros para a PecaParametrica
  const perfilConvertido: PerfilData = {
    ...perfilData,
    largura: perfilData.largura ? perfilData.largura / 1000 : undefined,
    altura: perfilData.altura ? perfilData.altura / 1000 : undefined,
    diametro: perfilData.diametro ? perfilData.diametro / 1000 : undefined,
    abas: perfilData.abas ? perfilData.abas / 1000 : undefined,
    enrijecedor: perfilData.enrijecedor ? perfilData.enrijecedor / 1000 : undefined,
    espessura: (perfilData.espessura || 1.2) / 1000,
  };

  const pecas = useMemo(() => {
    const items = [];
    
    // Nós principais (Centros das quinas)
    const A = new THREE.Vector3(-w / 2, h / 2, 0);
    const B = new THREE.Vector3(w / 2, h / 2, 0);
    const C = new THREE.Vector3(w / 2, -h / 2, 0);
    const D = new THREE.Vector3(-w / 2, -h / 2, 0);

    if (tipoMontagem === 'meia-esquadria') {
      items.push({ id: 'top', start: A, end: B, up: [0, 1, 0], tipoCorte: 'meia-esquadria' });
      items.push({ id: 'right', start: B, end: C, up: [1, 0, 0], tipoCorte: 'meia-esquadria' });
      items.push({ id: 'bottom', start: C, end: D, up: [0, -1, 0], tipoCorte: 'meia-esquadria' });
      items.push({ id: 'left', start: D, end: A, up: [-1, 0, 0], tipoCorte: 'meia-esquadria' });
    } else {
      // Reto: Topo e Base passam direto, Laterais são imprensadas
      const B_sub = new THREE.Vector3(w / 2, h / 2 - p / 2, 0);
      const C_sub = new THREE.Vector3(w / 2, -h / 2 + p / 2, 0);
      const D_sub = new THREE.Vector3(-w / 2, -h / 2 + p / 2, 0);
      const A_sub = new THREE.Vector3(-w / 2, h / 2 - p / 2, 0);

      items.push({ id: 'top', start: A, end: B, up: [0, 1, 0], tipoCorte: 'reto' });
      items.push({ id: 'right', start: B_sub, end: C_sub, up: [1, 0, 0], tipoCorte: 'reto' });
      items.push({ id: 'bottom', start: C, end: D, up: [0, -1, 0], tipoCorte: 'reto' });
      items.push({ id: 'left', start: D_sub, end: A_sub, up: [-1, 0, 0], tipoCorte: 'reto' });
    }

    // Grades internas
    if (quantidadeGrades > 0) {
      const innerW = w - p;
      const step = innerW / (quantidadeGrades + 1);
      
      for (let i = 1; i <= quantidadeGrades; i++) {
        const x = (-w / 2 + p / 2) + i * step;
        const start = new THREE.Vector3(x, h / 2 - p / 2, 0);
        const end = new THREE.Vector3(x, -h / 2 + p / 2, 0);
        items.push({ id: `grade-${i}`, start, end, up: [1, 0, 0], tipoCorte: 'reto' });
      }
    }

    return items;
  }, [w, h, p, tipoMontagem, quantidadeGrades]);

  return (
    <group>
      {pecas.map((peca) => (
        <PecaParametrica
          key={peca.id}
          pontoInicio={peca.start}
          pontoFim={peca.end}
          perfil={perfilConvertido}
          tipoCorte={peca.tipoCorte as 'reto' | 'meia-esquadria'}
          up={peca.up as [number, number, number]}
          acabamentoMetal={acabamentoMetal}
        />
      ))}

      {/* Cotas Dimensionais */}
      {mostrarCotas && (
        <>
          {/* Cota de Largura Externa (Azul) */}
          <Cota3D
            pontoInicio={[-w / 2, -h / 2, 0]}
            pontoFim={[w / 2, -h / 2, 0]}
            valorTexto={`${largura} mm`}
            offset={[0, -0.45, 0]}
            cor="#3b82f6" // Azul
          />
          {/* Cota de Largura Interna (Vermelha) */}
          <Cota3D
            pontoInicio={[-w / 2 + (perfilData.espessura * 2) / 1000, -h / 2 + p, 0]}
            pontoFim={[w / 2 - (perfilData.espessura * 2) / 1000, -h / 2 + p, 0]}
            valorTexto={`Int: ${largura - (perfilData.espessura * 2)} mm`}
            offset={[0, -0.2, 0]}
            cor="#ef4444" // Vermelho
          />
          
          {/* Cota de Altura Externa (Azul) */}
          <Cota3D
            pontoInicio={[w / 2, -h / 2, 0]}
            pontoFim={[w / 2, h / 2, 0]}
            valorTexto={`${altura} mm`}
            offset={[0.45, 0, 0]}
            cor="#3b82f6" // Azul
          />
          {/* Cota de Altura Interna (Vermelha) */}
          <Cota3D
            pontoInicio={[w / 2 - p, -h / 2 + (perfilData.espessura * 2) / 1000, 0]}
            pontoFim={[w / 2 - p, h / 2 - (perfilData.espessura * 2) / 1000, 0]}
            valorTexto={`Int: ${altura - (perfilData.espessura * 2)} mm`}
            offset={[0.2, 0, 0]}
            cor="#ef4444" // Vermelho
          />
        </>
      )}
    </group>
  );
};
