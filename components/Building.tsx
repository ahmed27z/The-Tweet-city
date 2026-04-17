'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BuildingProps, Theme } from '@/lib/types';

interface BuildingComponentProps {
  building: BuildingProps;
  theme: Theme;
  /** When true, the building idle-rotates around y. Used for hero cards. */
  rotating?: boolean;
}

/**
 * Standalone (non-instanced) building. This is the visually-fidelity
 * version — used for the profile page hero in Task 2 where there is
 * exactly one building on screen at a time. Performance-critical
 * group-of-50 rendering uses BuildingInstanced instead.
 *
 * Composition
 * -----------
 *   - 1 box for the body (width × height × width)
 *   - up to 3 floors × 4 windows-per-side of tiny emissive plane sprites
 *     baked into the four facades
 *   - optional gold cone "crown" on top for verified accounts
 */
export default function Building({
  building,
  theme,
  rotating = false,
}: BuildingComponentProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Memo the materials so we don't churn the GPU on prop changes
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: building.color,
        roughness: building.weathered ? 0.9 : 0.55,
        metalness: 0.15,
      }),
    [building.color, building.weathered],
  );

  const windowMaterial = useMemo(() => {
    const c = new THREE.Color(theme.windowGlow);
    return new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 0.4 + 0.6 * Math.max(0.05, building.windowGlow),
    });
  }, [theme.windowGlow, building.windowGlow]);

  const crownMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.crown,
        emissive: new THREE.Color(theme.crown),
        emissiveIntensity: 0.6,
        metalness: 0.7,
        roughness: 0.25,
      }),
    [theme.crown],
  );

  // Pre-compute the per-window positions. We build a flat array now so
  // we can render <instancedMesh> with `count` (still cheap because a
  // single building has at most ~few hundred windows).
  const { windowMatrix, windowCount } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const facades = [
      { axis: 'z', sign: 1 }, // +Z face
      { axis: 'z', sign: -1 }, // -Z face
      { axis: 'x', sign: 1 }, // +X face
      { axis: 'x', sign: -1 }, // -X face
    ] as const;
    const windowsPerSide = 3;
    const visibleFloors = Math.min(building.floors, Math.max(2, Math.floor(building.height / 1.6)));
    const matrices: THREE.Matrix4[] = [];

    facades.forEach((f) => {
      for (let row = 0; row < visibleFloors; row += 1) {
        const y = -building.height / 2 + 1 + row * (building.height / Math.max(1, visibleFloors)) + 0.4;
        for (let col = 0; col < windowsPerSide; col += 1) {
          const t = (col + 0.5) / windowsPerSide;
          const offset = (t - 0.5) * (building.width * 0.85);

          if (f.axis === 'z') {
            dummy.position.set(offset, y, (building.width / 2 + 0.02) * f.sign);
            dummy.rotation.set(0, f.sign > 0 ? 0 : Math.PI, 0);
          } else {
            dummy.position.set((building.width / 2 + 0.02) * f.sign, y, offset);
            dummy.rotation.set(0, f.sign > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
          }

          dummy.scale.set(0.45, 0.45, 1);
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
        }
      }
    });

    return { windowMatrix: matrices, windowCount: matrices.length };
  }, [building.height, building.width, building.floors]);

  // Idle spin (only if `rotating`) and an emissive pulse for animated buildings
  useFrame((state, delta) => {
    if (rotating && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
    if (building.isAnimated) {
      const t = state.clock.getElapsedTime();
      windowMaterial.opacity =
        0.4 + 0.6 * Math.max(0.05, building.windowGlow) * (0.7 + 0.3 * Math.sin(t * 2));
    }
  });

  return (
    <group ref={groupRef} position={building.position}>
      {/* Body — sits with its base on the ground (y=0 at floor) */}
      <mesh
        position={[0, building.height / 2, 0]}
        material={bodyMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[building.width, building.height, building.width]} />
      </mesh>

      {/* Windows — instanced because there can be many per facade */}
      {windowCount > 0 && (
        <instancedMesh
          args={[undefined, undefined, windowCount]}
          position={[0, building.height / 2, 0]}
          material={windowMaterial}
          ref={(im) => {
            if (!im) return;
            windowMatrix.forEach((m, i) => im.setMatrixAt(i, m));
            im.instanceMatrix.needsUpdate = true;
          }}
        >
          <planeGeometry args={[1, 1]} />
        </instancedMesh>
      )}

      {/* Gold crown — only for verified accounts */}
      {building.hasGoldCrown && (
        <mesh
          position={[0, building.height + 0.6, 0]}
          material={crownMaterial}
          castShadow
        >
          {/* 4-segment cone reads as a chunky pyramid */}
          <coneGeometry
            args={[Math.max(0.4, building.width * 0.45), 1.2, 4]}
          />
        </mesh>
      )}
    </group>
  );
}
