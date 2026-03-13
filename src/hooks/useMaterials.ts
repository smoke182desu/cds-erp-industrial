import * as THREE from 'three';
import { useMemo } from 'react';
import { AcabamentoMetalKey, MaterialDegrauKey, acabamentosMetal, materiaisDegrau } from '../data/materiaisDB';

export const useMaterials = () => {
  const getMetalMaterial = (acabamento: AcabamentoMetalKey) => {
    const matData = acabamentosMetal[acabamento] || acabamentosMetal['zincado'];
    return new THREE.MeshStandardMaterial({
      color: matData.color,
      metalness: matData.metalness,
      roughness: matData.roughness,
    });
  };

  const getDegrauMaterial = (material: MaterialDegrauKey) => {
    const matData = materiaisDegrau[material] || materiaisDegrau['madeira_clara'];
    return new THREE.MeshStandardMaterial({
      color: matData.color,
      metalness: matData.metalness,
      roughness: matData.roughness,
    });
  };

  return { getMetalMaterial, getDegrauMaterial };
};
