import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PerfilData } from '../../data/perfisDB';
import { criarShapePerfil } from '../../utils/ShapeFactory';
import { acabamentosMetal, AcabamentoMetalKey } from '../../data/materiaisDB';

interface PecaParametricaProps {
  pontoInicio: [number, number, number] | THREE.Vector3;
  pontoFim: [number, number, number] | THREE.Vector3;
  perfil: PerfilData;
  tipoCorte: 'reto' | 'meia-esquadria';
  up?: [number, number, number] | THREE.Vector3;
  acabamentoMetal?: AcabamentoMetalKey;
  materialProps?: { color: string; metalness: number; roughness: number };
  colorOverride?: string;
}

export const PecaParametrica: React.FC<PecaParametricaProps> = ({
  pontoInicio,
  pontoFim,
  perfil,
  tipoCorte,
  up = [0, 1, 0],
  acabamentoMetal = 'preto_fosco',
  materialProps,
  colorOverride
}) => {
  const { position, quaternion, length } = useMemo(() => {
    const start = Array.isArray(pontoInicio) ? new THREE.Vector3(...pontoInicio) : pontoInicio;
    const end = Array.isArray(pontoFim) ? new THREE.Vector3(...pontoFim) : pontoFim;
    const upVec = Array.isArray(up) ? new THREE.Vector3(...up) : up;

    const length = start.distanceTo(end);
    if (length === 0 || isNaN(length)) {
      return { position: start, quaternion: new THREE.Quaternion(), length: 0 };
    }

    const position = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const obj = new THREE.Object3D();
    obj.position.copy(start);
    
    // Fix singularity when lookAt direction is parallel to up vector
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    if (Math.abs(direction.dot(upVec)) > 0.999) {
      // If direction is parallel to Y, use X as up. Otherwise use Y as up.
      if (Math.abs(direction.y) > 0.999) {
        obj.up.set(1, 0, 0);
      } else {
        obj.up.set(0, 1, 0);
      }
    } else {
      obj.up.copy(upVec);
    }
    
    obj.lookAt(end);

    return { position, quaternion: obj.quaternion.clone(), length };
  }, [
    Array.isArray(pontoInicio) ? pontoInicio.join(',') : `${pontoInicio.x},${pontoInicio.y},${pontoInicio.z}`,
    Array.isArray(pontoFim) ? pontoFim.join(',') : `${pontoFim.x},${pontoFim.y},${pontoFim.z}`,
    Array.isArray(up) ? up.join(',') : `${up.x},${up.y},${up.z}`
  ]);

  if (length === 0) return null;

  const geometry = useMemo(() => {
    const shape = criarShapePerfil(perfil);
    const extrudeSettings = {
      depth: length,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
      curveSegments: 12, // Suavidade para perfis redondos
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Centraliza a geometria no eixo Z (ExtrudeGeometry vai de 0 a length)
    geo.translate(0, 0, -length / 2);

    if (tipoCorte === 'meia-esquadria') {
      const positionAttribute = geo.attributes.position;
      const vertex = new THREE.Vector3();

      for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        
        // Aplica o corte de 45 graus baseado no eixo Y
        if (vertex.z > 0) {
          vertex.z += vertex.y;
        } else {
          vertex.z -= vertex.y;
        }
        
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      
      geo.computeVertexNormals();
    }

    return geo;
  }, [length, perfil.id, tipoCorte]);

  const matProps = materialProps || acabamentosMetal[acabamentoMetal];
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial 
          color={colorOverride || matProps.color} 
          roughness={matProps.roughness} 
          metalness={matProps.metalness} 
          side={THREE.DoubleSide} 
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#000000" linewidth={0.5} transparent opacity={0.2} />
      </lineSegments>
    </group>
  );
};
