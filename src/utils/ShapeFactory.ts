import * as THREE from 'three';
import { PerfilData } from '../data/perfisDB';

export function criarShapePerfil(perfil: PerfilData): THREE.Shape {
  const shape = new THREE.Shape();

  if (perfil.tipoShape === 'quadrado_oco') {
    const l = perfil.largura || 0.05;
    const a = perfil.altura || 0.05;
    const e = perfil.espessura || 0.002;

    // Desenha o quadrado externo centrado na origem
    const halfL = l / 2;
    const halfA = a / 2;
    shape.moveTo(-halfL, -halfA);
    shape.lineTo(halfL, -halfA);
    shape.lineTo(halfL, halfA);
    shape.lineTo(-halfL, halfA);
    shape.lineTo(-halfL, -halfA);

    // Desenha o quadrado interno (furo)
    const hole = new THREE.Path();
    const inHalfL = halfL - e;
    const inHalfA = halfA - e;
    hole.moveTo(-inHalfL, -inHalfA);
    hole.lineTo(-inHalfL, inHalfA);
    hole.lineTo(inHalfL, inHalfA);
    hole.lineTo(inHalfL, -inHalfA);
    hole.lineTo(-inHalfL, -inHalfA);

    shape.holes.push(hole);
  } else if (perfil.tipoShape === 'redondo_oco') {
    const d = perfil.diametro || 0.0508;
    const e = perfil.espessura || 0.002;
    const radius = d / 2;

    // Círculo externo
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);

    // Círculo interno (furo)
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius - e, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  } else if (perfil.tipoShape === 'perfil_u_simples') {
    const h = perfil.largura || 0.075; // Web height
    const b = perfil.abas || 0.040;    // Flange width
    const e = perfil.espessura || 0.002;

    const halfH = h / 2;
    const halfB = b / 2;

    // Draw C shape (web on the left, flanges pointing right)
    // Start at top right
    shape.moveTo(halfB, halfH);
    // Top flange top edge
    shape.lineTo(-halfB, halfH);
    // Web left edge
    shape.lineTo(-halfB, -halfH);
    // Bottom flange bottom edge
    shape.lineTo(halfB, -halfH);
    // Bottom flange right edge
    shape.lineTo(halfB, -halfH + e);
    // Bottom flange inner edge
    shape.lineTo(-halfB + e, -halfH + e);
    // Web inner edge
    shape.lineTo(-halfB + e, halfH - e);
    // Top flange inner edge
    shape.lineTo(halfB, halfH - e);
    // Top flange right edge
    shape.lineTo(halfB, halfH);
  } else if (perfil.tipoShape === 'perfil_u_enrijecido') {
    const h = perfil.largura || 0.100; // Web height
    const b = perfil.abas || 0.040;     // Flange width
    const enr = perfil.enrijecedor || 0.015; // Stiffener
    const e = perfil.espessura || 0.002;

    const halfH = h / 2;
    const halfB = b / 2;

    // Draw C shape with stiffeners (web on the left, flanges pointing right)
    // Start at top right stiffener bottom
    shape.moveTo(halfB, halfH - enr);
    // Top stiffener right edge
    shape.lineTo(halfB, halfH);
    // Top flange top edge
    shape.lineTo(-halfB, halfH);
    // Web left edge
    shape.lineTo(-halfB, -halfH);
    // Bottom flange bottom edge
    shape.lineTo(halfB, -halfH);
    // Bottom stiffener right edge
    shape.lineTo(halfB, -halfH + enr);
    // Bottom stiffener inner edge
    shape.lineTo(halfB - e, -halfH + enr);
    // Bottom stiffener top edge
    shape.lineTo(halfB - e, -halfH + e);
    // Bottom flange inner edge
    shape.lineTo(-halfB + e, -halfH + e);
    // Web inner edge
    shape.lineTo(-halfB + e, halfH - e);
    // Top flange inner edge
    shape.lineTo(halfB - e, halfH - e);
    // Top stiffener bottom edge
    shape.lineTo(halfB - e, halfH - enr);
    // Close
    shape.lineTo(halfB, halfH - enr);
  } else if (perfil.tipoShape === 'cantoneira') {
    const abas = perfil.abas || 0.025;
    const e = perfil.espessura || 0.002;

    const halfA = abas / 2;

    // Draw L shape (vertical leg on left, horizontal leg on bottom)
    // Start at top left
    shape.moveTo(-halfA, halfA);
    // Top left inner
    shape.lineTo(-halfA + e, halfA);
    // Inner corner
    shape.lineTo(-halfA + e, -halfA + e);
    // Bottom right inner
    shape.lineTo(halfA, -halfA + e);
    // Bottom right outer
    shape.lineTo(halfA, -halfA);
    // Bottom left outer
    shape.lineTo(-halfA, -halfA);
    // Close
    shape.lineTo(-halfA, halfA);
  } else if (perfil.tipoShape === 'viga_i') {
    const l = perfil.largura || 0.068;
    const a = perfil.altura || 0.1016;
    const e = perfil.espessura || 0.002;

    const halfL = l / 2;
    const halfA = a / 2;

    shape.moveTo(-halfL, halfA);
    shape.lineTo(halfL, halfA);
    shape.lineTo(halfL, halfA - e);
    shape.lineTo(e / 2, halfA - e);
    shape.lineTo(e / 2, -halfA + e);
    shape.lineTo(halfL, -halfA + e);
    shape.lineTo(halfL, -halfA);
    shape.lineTo(-halfL, -halfA);
    shape.lineTo(-halfL, -halfA + e);
    shape.lineTo(-e / 2, -halfA + e);
    shape.lineTo(-e / 2, halfA - e);
    shape.lineTo(-halfL, halfA - e);
    shape.lineTo(-halfL, halfA);
  } else if (perfil.tipoShape === 'barra_chata' || perfil.tipoShape === 'chapa') {
    const l = perfil.largura || 0.050;
    const e = perfil.espessura || 0.002;

    const halfL = l / 2;
    const halfE = e / 2;

    shape.moveTo(-halfL, -halfE);
    shape.lineTo(halfL, -halfE);
    shape.lineTo(halfL, halfE);
    shape.lineTo(-halfL, halfE);
    shape.lineTo(-halfL, -halfE);
  }

  return shape;
}
