import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
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
  explodedFactor?: number;
  onBOMCalculated?: (bom: any[]) => void;
  perfilTravessaData?: PerfilData;
  perfilMontanteData?: PerfilData;
  perfilGradeData?: PerfilData;
}

const PART_COLORS = {
  TRAVESSA: '#3b82f6', // Azul
  MONTANTE: '#10b981', // Verde
  GRADE: '#f59e0b',    // Amarelo
};

const PART_CODES = {
  TRAVESSA: 'A',
  MONTANTE: 'B',
  GRADE: 'C',
};

const Label = ({ text, position }: { text: string, position: [number, number, number] | THREE.Vector3 }) => (
  <Html position={position} center distanceFactor={6}>
    <div className="bg-white/95 text-slate-900 px-2 py-1 rounded-sm text-[10px] font-bold border border-slate-300 whitespace-nowrap pointer-events-none uppercase tracking-widest shadow-lg backdrop-blur-md">
      {text}
    </div>
  </Html>
);

export const QuadroNode: React.FC<QuadroNodeProps> = ({
  largura,
  altura,
  perfilData,
  quantidadeGrades,
  tipoMontagem,
  acabamentoMetal = 'preto_fosco',
  mostrarCotas = false,
  explodedFactor = 0,
  onBOMCalculated,
  perfilTravessaData,
  perfilMontanteData,
  perfilGradeData
}) => {
  const w = largura / 1000;
  const h = altura / 1000;
  
  const travessaPerfil = perfilTravessaData || perfilData;
  const montantePerfil = perfilMontanteData || perfilData;
  const gradePerfil = perfilGradeData || perfilData;

  const exp = (val: number) => val * (explodedFactor || 0);

  // BOM Calculation
  React.useEffect(() => {
    if (onBOMCalculated) {
      const bom = [
        { 
          code: PART_CODES.TRAVESSA, 
          name: 'Peça A - Travessa Superior/Inferior', 
          color: PART_COLORS.TRAVESSA, 
          quantity: 2, 
          material: `${travessaPerfil.nome} (${largura}mm)` 
        },
        { 
          code: PART_CODES.MONTANTE, 
          name: 'Peça B - Montante Lateral', 
          color: PART_COLORS.MONTANTE, 
          quantity: 2, 
          material: `${montantePerfil.nome} (${altura}mm)` 
        }
      ];

      if (quantidadeGrades > 0) {
        bom.push({
          code: PART_CODES.GRADE,
          name: 'Peça C - Grades Internas',
          color: PART_COLORS.GRADE,
          quantity: quantidadeGrades,
          material: `${gradePerfil.nome} (${altura - (gradePerfil.espessura * 2)}mm)`
        });
      }

      onBOMCalculated(bom);
    }
  }, [largura, altura, travessaPerfil, montantePerfil, gradePerfil, quantidadeGrades, onBOMCalculated]);

  // Determina a dimensão do perfil no plano do quadro (altura do perfil)
  const getP = (pData: PerfilData) => (pData.tipoShape === 'redondo_oco' 
    ? (pData.diametro || 50) 
    : (pData.tipoShape === 'cantoneira' ? (pData.abas || 25) : (pData.altura || pData.largura || 50))) / 1000;

  const pTravessa = getP(travessaPerfil);
  const pMontante = getP(montantePerfil);

  // Precisamos converter as dimensões do perfil de mm para metros para a PecaParametrica
  const convertPerfil = (pData: PerfilData): PerfilData => ({
    ...pData,
    largura: pData.largura ? pData.largura / 1000 : undefined,
    altura: pData.altura ? pData.altura / 1000 : undefined,
    diametro: pData.diametro ? pData.diametro / 1000 : undefined,
    abas: pData.abas ? pData.abas / 1000 : undefined,
    enrijecedor: pData.enrijecedor ? pData.enrijecedor / 1000 : undefined,
    espessura: (pData.espessura || 1.2) / 1000,
  });

  const travessaConvertida = convertPerfil(travessaPerfil);
  const montanteConvertida = convertPerfil(montantePerfil);
  const gradeConvertida = convertPerfil(gradePerfil);

  const pecas = useMemo(() => {
    const items = [];
    
    // Nós principais (Centros das quinas)
    const A = new THREE.Vector3(-w / 2, h / 2, 0);
    const B = new THREE.Vector3(w / 2, h / 2, 0);
    const C = new THREE.Vector3(w / 2, -h / 2, 0);
    const D = new THREE.Vector3(-w / 2, -h / 2, 0);

    if (tipoMontagem === 'meia-esquadria') {
      items.push({ id: 'top', start: A, end: B, up: [0, 1, 0], tipoCorte: 'meia-esquadria', label: 'Travessa Superior', offset: [0, 0.3, 0], color: PART_COLORS.TRAVESSA, perfil: travessaConvertida });
      items.push({ id: 'right', start: B, end: C, up: [1, 0, 0], tipoCorte: 'meia-esquadria', label: 'Montante Dir.', offset: [0.3, 0, 0], color: PART_COLORS.MONTANTE, perfil: montanteConvertida });
      items.push({ id: 'bottom', start: C, end: D, up: [0, -1, 0], tipoCorte: 'meia-esquadria', label: 'Travessa Inferior', offset: [0, -0.3, 0], color: PART_COLORS.TRAVESSA, perfil: travessaConvertida });
      items.push({ id: 'left', start: D, end: A, up: [-1, 0, 0], tipoCorte: 'meia-esquadria', label: 'Montante Esq.', offset: [-0.3, 0, 0], color: PART_COLORS.MONTANTE, perfil: montanteConvertida });
    } else {
      // Reto: Topo e Base passam direto, Laterais são imprensadas
      const B_sub = new THREE.Vector3(w / 2, h / 2 - pTravessa / 2, 0);
      const C_sub = new THREE.Vector3(w / 2, -h / 2 + pTravessa / 2, 0);
      const D_sub = new THREE.Vector3(-w / 2, -h / 2 + pTravessa / 2, 0);
      const A_sub = new THREE.Vector3(-w / 2, h / 2 - pTravessa / 2, 0);

      items.push({ id: 'top', start: A, end: B, up: [0, 1, 0], tipoCorte: 'reto', label: 'Travessa Superior', offset: [0, 0.3, 0], color: PART_COLORS.TRAVESSA, perfil: travessaConvertida });
      items.push({ id: 'right', start: B_sub, end: C_sub, up: [1, 0, 0], tipoCorte: 'reto', label: 'Montante Dir.', offset: [0.3, 0, 0], color: PART_COLORS.MONTANTE, perfil: montanteConvertida });
      items.push({ id: 'bottom', start: C, end: D, up: [0, -1, 0], tipoCorte: 'reto', label: 'Travessa Inferior', offset: [0, -0.3, 0], color: PART_COLORS.TRAVESSA, perfil: travessaConvertida });
      items.push({ id: 'left', start: D_sub, end: A_sub, up: [-1, 0, 0], tipoCorte: 'reto', label: 'Montante Esq.', offset: [-0.3, 0, 0], color: PART_COLORS.MONTANTE, perfil: montanteConvertida });
    }

    // Grades internas
    if (quantidadeGrades > 0) {
      const innerW = w - pMontante;
      const step = innerW / (quantidadeGrades + 1);
      
      for (let i = 1; i <= quantidadeGrades; i++) {
        const x = (-w / 2 + pMontante / 2) + i * step;
        const start = new THREE.Vector3(x, h / 2 - pTravessa / 2, 0);
        const end = new THREE.Vector3(x, -h / 2 + pTravessa / 2, 0);
        items.push({ id: `grade-${i}`, start, end, up: [1, 0, 0], tipoCorte: 'reto', label: i === Math.floor(quantidadeGrades/2) + 1 ? 'Grades Internas' : undefined, offset: [0, 0, 0.2], color: PART_COLORS.GRADE, perfil: gradeConvertida });
      }
    }

    return items;
  }, [w, h, pTravessa, pMontante, tipoMontagem, quantidadeGrades, travessaConvertida, montanteConvertida, gradeConvertida]);

  return (
    <group>
      {pecas.map((peca) => (
        <group key={peca.id} position={[exp(peca.offset[0]), exp(peca.offset[1]), exp(peca.offset[2])]}>
          <PecaParametrica
            pontoInicio={peca.start}
            pontoFim={peca.end}
            perfil={peca.perfil}
            tipoCorte={peca.tipoCorte as 'reto' | 'meia-esquadria'}
            up={peca.up as [number, number, number]}
            acabamentoMetal={acabamentoMetal}
            colorOverride={peca.color}
          />
          {explodedFactor > 0.5 && peca.label && (
            <Label 
              text={peca.label} 
              position={new THREE.Vector3().addVectors(peca.start, peca.end).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.1, 0))} 
            />
          )}
        </group>
      ))}

      {/* Cotas Dimensionais */}
      {mostrarCotas && explodedFactor === 0 && (
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
            pontoInicio={[-w / 2 + (perfilData.espessura * 2) / 1000, -h / 2 + pTravessa, 0]}
            pontoFim={[w / 2 - (perfilData.espessura * 2) / 1000, -h / 2 + pTravessa, 0]}
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
            pontoInicio={[w / 2 - pMontante, -h / 2 + (perfilData.espessura * 2) / 1000, 0]}
            pontoFim={[w / 2 - pMontante, h / 2 - (perfilData.espessura * 2) / 1000, 0]}
            valorTexto={`Int: ${altura - (perfilData.espessura * 2)} mm`}
            offset={[0.2, 0, 0]}
            cor="#ef4444" // Vermelho
          />
        </>
      )}
    </group>
  );
};
