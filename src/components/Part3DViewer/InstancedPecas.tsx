import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { PerfilData } from '../../data/perfisDB';
import { criarShapePerfil } from '../../utils/ShapeFactory';
import { acabamentosMetal, AcabamentoMetalKey } from '../../data/materiaisDB';

export interface PecaInstance {
  start: [number, number, number] | THREE.Vector3;
  end: [number, number, number] | THREE.Vector3;
  up?: [number, number, number] | THREE.Vector3;
  shearStart?: [number, number];
  shearEnd?: [number, number];
}

interface InstancedPecasProps {
  perfil: PerfilData;
  instances: PecaInstance[];
  acabamentoMetal?: AcabamentoMetalKey;
  colorOverride?: string;
}

export const InstancedPecas: React.FC<InstancedPecasProps> = ({
  perfil,
  instances,
  acabamentoMetal = 'preto_fosco',
  colorOverride
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const shape = useMemo(() => criarShapePerfil(perfil), [perfil]);

  const { geometry } = useMemo(() => {
    const extrudeSettings = {
      depth: 1,
      bevelEnabled: false,
      curveSegments: 4,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, -0.5);

    return { geometry: geo };
  }, [shape]);

  const materialProps = acabamentosMetal[acabamentoMetal];
  const finalColor = colorOverride || materialProps.color;

  // Separate instances into instanced (no shear) and individual (with shear)
  const { instanced, individual } = useMemo(() => {
    const inst = [];
    const ind = [];
    for (const instance of instances) {
      if (instance.shearStart || instance.shearEnd) {
        ind.push(instance);
      } else {
        inst.push(instance);
      }
    }
    return { instanced: inst, individual: ind };
  }, [instances]);

  useLayoutEffect(() => {
    if (!meshRef.current || instanced.length === 0) return;

    const dummy = new THREE.Object3D();

    instanced.forEach((instance, i) => {
      const start = Array.isArray(instance.start) ? new THREE.Vector3(...instance.start) : instance.start;
      const end = Array.isArray(instance.end) ? new THREE.Vector3(...instance.end) : instance.end;
      
      const length = start.distanceTo(end);
      if (length < 0.001) return;

      const upVec = instance.up ? (Array.isArray(instance.up) ? new THREE.Vector3(...instance.up) : instance.up.clone()) : new THREE.Vector3(0, 1, 0);
      upVec.normalize();

      const position = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

      dummy.position.copy(start);
      
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      if (Math.abs(direction.dot(upVec)) > 0.999) {
        if (Math.abs(direction.y) > 0.999) {
          dummy.up.set(1, 0, 0);
        } else {
          dummy.up.set(0, 1, 0);
        }
      } else {
        dummy.up.copy(upVec);
      }
      
      dummy.lookAt(end);
      
      // Scale X and Y by profile width/height (converted to meters), and Z by length
      // Use largura/altura for quadrado_oco, largura/abas for perfil_u_simples/enrijecido
      const scaleX = (perfil.largura || 1) / 1000;
      const scaleY = (perfil.altura || perfil.abas || 1) / 1000;
      dummy.scale.set(scaleX, scaleY, length);
      dummy.position.copy(position);
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
    meshRef.current.computeBoundingBox();
  }, [instanced, geometry]);

  // Render individual meshes for sheared instances
  const individualMeshes = useMemo(() => {
    return individual.map((instance, i) => {
      const start = Array.isArray(instance.start) ? new THREE.Vector3(...instance.start) : instance.start;
      const end = Array.isArray(instance.end) ? new THREE.Vector3(...instance.end) : instance.end;
      const upVec = instance.up ? (Array.isArray(instance.up) ? new THREE.Vector3(...instance.up) : instance.up.clone()) : new THREE.Vector3(0, 1, 0);
      upVec.normalize();

      const length = start.distanceTo(end);
      const position = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

      const dummy = new THREE.Object3D();
      dummy.position.copy(start);
      
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      if (Math.abs(direction.dot(upVec)) > 0.999) {
        if (Math.abs(direction.y) > 0.999) {
          dummy.up.set(1, 0, 0);
        } else {
          dummy.up.set(0, 1, 0);
        }
      } else {
        dummy.up.copy(upVec);
      }
      
      dummy.lookAt(end);

      // Create sheared geometry
      const extrudeSettings = { depth: 1, bevelEnabled: false, curveSegments: 4 };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.translate(0, 0, -0.5);

      const shearStart = instance.shearStart || [0, 0];
      const shearEnd = instance.shearEnd || [0, 0];

      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j);
        const y = pos.getY(j);
        let z = pos.getZ(j);
        if (z > 0) {
          z += (x * shearEnd[0] + y * shearEnd[1]) / length;
        } else {
          z += (x * shearStart[0] + y * shearStart[1]) / length;
        }
        pos.setZ(j, z);
      }
      geo.computeVertexNormals();
      const edgesGeo = new THREE.EdgesGeometry(geo);

      return (
        <group key={`ind-${i}`} position={position} quaternion={dummy.quaternion} scale={[1, 1, length]}>
          <mesh geometry={geo} castShadow receiveShadow>
            <meshStandardMaterial 
              color={finalColor} 
              roughness={materialProps.roughness} 
              metalness={materialProps.metalness} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        </group>
      );
    });
  }, [individual, shape, finalColor, materialProps]);

  return (
    <group>
      {instanced.length > 0 && (
        <instancedMesh
          ref={meshRef}
          args={[geometry, undefined as any, instanced.length]}
          geometry={geometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial 
            color={finalColor} 
            roughness={materialProps.roughness} 
            metalness={materialProps.metalness} 
            side={THREE.DoubleSide} 
            transparent={false}
            opacity={1}
            depthTest={true}
            depthWrite={true}
          />
        </instancedMesh>
      )}
      {individualMeshes}
    </group>
  );
};
