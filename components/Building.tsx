'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BuildingProps, Theme } from '@/lib/types';
import { hashString } from '@/lib/buildingGenerator';
import { seededRandom } from '@/lib/mockData';

interface BuildingComponentProps {
  building: BuildingProps;
  theme: Theme;
  /** When true, the building idle-rotates around y. Used for hero cards. */
  rotating?: boolean;
}

/**
 * Standalone (non-instanced) building. This is the visually-fidelity
 * version — used for the profile/compare page hero, plus the
 * BuildingThumb canvas on explore/leaderboard. Performance-critical
 * city-wide rendering uses BuildingInstanced instead.
 *
 * Composition
 * -----------
 *   - 1 box for the body (width × height × width) — the pre-computed
 *     dark `building.color` is used verbatim; no theme re-tint.
 *   - A dense lattice of tiny emissive window-rects on every facade
 *     (6 columns × N rows). Roughly 60–80 % of slots are lit, picked
 *     from a per-username hash so a specific user's building always
 *     looks the same.
 *   - Optional gold cone "crown" on top for verified accounts.
 */
export default function Building({
  building,
  theme,
  rotating = false,
}: BuildingComponentProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Body material uses the color already computed by buildingGenerator
  // (a near-black dark tint). We keep it as a standard material so the
  // directional lighting gives it a subtle silhouette gradient.
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: building.color,
        roughness: building.weathered ? 0.95 : 0.85,
        metalness: 0.05,
      }),
    [building.color, building.weathered],
  );

  // Window material: basic + tone-mapped-off so the windows punch
  // through ACES tone mapping as bright pixels.
  const windowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.windowGlow),
      toneMapped: false,
    });
  }, [theme.windowGlow]);

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

  // Pre-compute per-window matrices.
  //
  //   - 4 facades × 6 columns × N rows (rows depends on height)
  //   - Each slot rolls a lit-probability (60–80%) from the per-
  //     username RNG; unlit slots are skipped so we don't waste GPU.
  const { windowMatrices, windowCount } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const facades = [
      { axis: 'z', sign: 1 },
      { axis: 'z', sign: -1 },
      { axis: 'x', sign: 1 },
      { axis: 'x', sign: -1 },
    ] as const;
    const windowsPerSide = 6;
    const rows = Math.max(
      1,
      Math.floor(Math.max(building.floors, building.height / 1.5)),
    );
    const visibleRows = Math.min(rows, Math.max(2, Math.floor(building.height / 0.9)));
    const rng = seededRandom(hashString(building.username) ^ 0x55aa_1234);
    // 60 – 80 % lit, skewed higher for heavy-glow users so big-impact
    // accounts positively shine.
    const litRatio = 0.6 + 0.2 * Math.max(0.05, building.windowGlow);

    const matrices: THREE.Matrix4[] = [];
    const paneW = Math.max(0.04, building.width * 0.08);
    const paneH = 0.12;

    facades.forEach((f) => {
      for (let row = 0; row < visibleRows; row += 1) {
        const rowFrac = (row + 0.5) / visibleRows;
        const y = -building.height / 2 + rowFrac * building.height;
        for (let col = 0; col < windowsPerSide; col += 1) {
          if (rng() > litRatio) continue;
          const colFrac = (col + 0.5) / windowsPerSide;
          const offset = (colFrac - 0.5) * building.width * 0.82;

          if (f.axis === 'z') {
            dummy.position.set(
              offset,
              y,
              (building.width / 2 + 0.02) * f.sign,
            );
            dummy.rotation.set(0, f.sign > 0 ? 0 : Math.PI, 0);
          } else {
            dummy.position.set(
              (building.width / 2 + 0.02) * f.sign,
              y,
              offset,
            );
            dummy.rotation.set(0, f.sign > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
          }

          // Pane scale — independent of the building width so tiny
          // accounts still show recognizably-sized windows.
          dummy.scale.set(paneW, paneH, 1);
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
        }
      }
    });

    return { windowMatrices: matrices, windowCount: matrices.length };
  }, [
    building.height,
    building.width,
    building.floors,
    building.username,
    building.windowGlow,
  ]);

  // Idle spin (only if `rotating`) and an emissive pulse for animated
  // users. We modulate the window material color (a scalar on the RGB
  // vector) so we don't need to disturb per-instance matrices.
  const pulseColor = useMemo(() => new THREE.Color(theme.windowGlow), [theme.windowGlow]);
  useFrame((state, delta) => {
    if (rotating && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
    if (building.isAnimated) {
      const t = state.clock.getElapsedTime();
      const k = 0.82 + 0.18 * (Math.sin(t * 1.8) * 0.5 + 0.5);
      windowMaterial.color.copy(pulseColor).multiplyScalar(k);
    } else {
      windowMaterial.color.copy(pulseColor);
    }
  });

  return (
    <group ref={groupRef} position={building.position}>
      {/* Body — sits with its base on the ground (y=0 at floor) */}
      <mesh
        position={[0, building.height / 2, 0]}
        material={bodyMaterial}
      >
        <boxGeometry args={[building.width, building.height, building.width]} />
      </mesh>

      {/* Window dots — instanced boxes; small enough to read as pixels. */}
      {windowCount > 0 && (
        <instancedMesh
          args={[undefined, undefined, windowCount]}
          position={[0, building.height / 2, 0]}
          material={windowMaterial}
          ref={(im) => {
            if (!im) return;
            windowMatrices.forEach((m, i) => im.setMatrixAt(i, m));
            im.instanceMatrix.needsUpdate = true;
          }}
          frustumCulled
        >
          <boxGeometry args={[1, 1, 0.02]} />
        </instancedMesh>
      )}

      {/* Gold crown — only for verified accounts */}
      {building.hasGoldCrown && (
        <mesh
          position={[0, building.height + 0.6, 0]}
          material={crownMaterial}
        >
          <coneGeometry
            args={[Math.max(0.4, building.width * 0.45), 1.2, 4]}
          />
        </mesh>
      )}
    </group>
  );
}
