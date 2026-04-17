'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BuildingProps, Theme } from '@/lib/types';
import { useCityStore } from '@/lib/store';
import { CITY_BOUNDS } from '@/lib/cityLayout';
import { hashString } from '@/lib/buildingGenerator';
import { seededRandom } from '@/lib/mockData';

interface BuildingInstancedProps {
  buildings: BuildingProps[];
  theme: Theme;
  /** Called when a building is clicked. */
  onSelect?: (username: string) => void;
}

/**
 * High-throughput renderer for the entire city. Splits the buildings
 * into three LOD buckets (near / mid / far) for bodies, plus two
 * InstancedMeshes for the signature window-dot glitter (split into
 * a static bucket and a pulsing bucket so only animated users pay the
 * cost of per-frame color updates).
 *
 * Why this shape?
 * ---------------
 * 2000 buildings and ~100k individual windows is beyond what
 * one-mesh-per-building can handle. Every primitive here is an
 * `InstancedMesh` so the scene draws in < 10 draw calls regardless of
 * how full the city gets.
 *
 * LOD strategy (body meshes)
 * --------------------------
 *   < 80 units  → near : interactive, flat-emissive body with a gentle
 *                         accent tint baked into the material
 *   < 200 units → mid  : non-interactive body with the same material
 *                         family, slightly pushed toward the accent
 *   else        → far  : flat body, unlit windows
 *   dist > CITY_BOUNDS+50 → hidden (scale 0)
 *
 * Buckets are recomputed every 10 frames so we don't pay distance
 * checks every tick. **Windows are placed once at mount** — because
 * the buildings don't move, there's no reason to rewrite the
 * per-instance matrices every frame.
 *
 * Pulsing
 * -------
 * Animated users (high tweetsLast7Days) get their windows in the
 * `winPulseRef` mesh, whose material color is modulated once per frame
 * by a shared sine. Non-animated windows go in `winStaticRef` and
 * stay put — zero per-frame cost.
 */
export default function BuildingInstanced({
  buildings,
  theme,
  onSelect,
}: BuildingInstancedProps) {
  const setHovered = useCityStore((s) => s.setHovered);

  // Refs — one InstancedMesh per LOD body + crowns + two window banks
  const nearRef = useRef<THREE.InstancedMesh>(null);
  const midRef = useRef<THREE.InstancedMesh>(null);
  const farRef = useRef<THREE.InstancedMesh>(null);
  const winStaticRef = useRef<THREE.InstancedMesh>(null);
  const winPulseRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);

  // Reusable scratch — allocated once
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  /**
   * Per-instance index → owning building index (so clicks resolve to
   * a username). Updated in step with LOD assignment below.
   */
  const indexMap = useRef<{
    near: number[];
    mid: number[];
    far: number[];
  }>({ near: [], mid: [], far: [] });

  // Theme-derived colors (parsed once per theme change)
  const baseColor = useMemo(() => new THREE.Color(theme.buildingBase), [theme.buildingBase]);
  const accentColor = useMemo(() => new THREE.Color(theme.buildingAccent), [theme.buildingAccent]);
  const glowColor = useMemo(() => new THREE.Color(theme.windowGlow), [theme.windowGlow]);
  const crownColor = useMemo(() => new THREE.Color(theme.crown), [theme.crown]);

  // Materials — one per bucket. Bodies use MeshStandardMaterial so the
  // directional/ambient lighting picks up a subtle silhouette gradient;
  // windows use MeshBasicMaterial with `toneMapped: false` so they read
  // as bright glittery pixels against the dark bodies.
  const nearMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.9,
        metalness: 0.05,
      }),
    [],
  );
  const midMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.95,
        metalness: 0.02,
      }),
    [],
  );
  const farMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
      }),
    [],
  );
  const windowStaticMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: glowColor.clone(),
        toneMapped: false,
      }),
    [glowColor],
  );
  const windowPulseMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: glowColor.clone(),
        toneMapped: false,
      }),
    [glowColor],
  );
  const crownMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: crownColor,
        emissive: crownColor,
        emissiveIntensity: 0.7,
        metalness: 0.7,
        roughness: 0.25,
      }),
    [crownColor],
  );

  // ---- Window matrix pre-computation (mount-time, not per-frame) --------
  //
  // Every window across the entire city is placed once. The geometry
  // doesn't change as the camera moves, so there's no reason to rewrite
  // instance matrices each tick. We split into two banks so animated
  // users can pulse without touching the static majority.
  const windowBanks = useMemo(() => {
    const staticMatrices: THREE.Matrix4[] = [];
    const pulseMatrices: THREE.Matrix4[] = [];
    const d = new THREE.Object3D();

    for (let bi = 0; bi < buildings.length; bi += 1) {
      const b = buildings[bi];

      // How many row bands fit on the building?
      const maxRowsByHeight = Math.max(1, Math.floor(b.height / 1.6));
      const rowsDesired = Math.min(b.floors, maxRowsByHeight);
      const FACADES = 4;
      const COLS = 3;
      const maxRowsByBudget = Math.floor(120 / (FACADES * COLS));
      const rows = Math.min(rowsDesired, maxRowsByBudget);
      if (rows <= 0) continue;

      const litRatio = 0.3 + 0.5 * b.windowGlow;
      const rng = seededRandom(hashString(b.username) ^ 0x7afe_10c5);

      const yBase = b.position[1];
      const yTop = yBase + b.height;
      const rowHeight = (yTop - yBase) / rows;

      for (let row = 0; row < rows; row += 1) {
        const y = yBase + rowHeight * (row + 0.5);

        for (let f = 0; f < FACADES; f += 1) {
          // Per-facade axis/sign:
          //   0 → +Z face,   1 → -Z face,   2 → +X face,   3 → -X face
          for (let c = 0; c < COLS; c += 1) {
            const colFrac = (c + 0.5) / COLS;
            // Jitter is small — just enough to break the perfect grid.
            const jCol = (rng() - 0.5) * 0.25;
            const jRow = (rng() - 0.5) * 0.35;
            // Each slot rolls its own lit probability. Unlit slots are
            // simply not emitted — saves instance count.
            const lit = rng() < litRatio;
            if (!lit) continue;

            const colOffset = (colFrac - 0.5 + jCol * 0.15) * (b.width * 0.8);
            const wy = y + jRow * rowHeight * 0.2;
            const surfaceOffset = b.width / 2 + 0.035;

            let wx = b.position[0];
            let wz = b.position[2];
            if (f === 0) {
              wx += colOffset;
              wz += surfaceOffset;
            } else if (f === 1) {
              wx -= colOffset;
              wz -= surfaceOffset;
            } else if (f === 2) {
              wx += surfaceOffset;
              wz += colOffset;
            } else {
              wx -= surfaceOffset;
              wz -= colOffset;
            }

            d.position.set(wx, wy, wz);
            d.rotation.set(0, 0, 0);
            d.scale.set(1, 1, 1);
            d.updateMatrix();
            (b.isAnimated ? pulseMatrices : staticMatrices).push(
              d.matrix.clone(),
            );
          }
        }
      }
    }

    return { staticMatrices, pulseMatrices };
  }, [buildings]);

  // Write the window matrices into the InstancedMeshes once the refs
  // are bound + also re-run when the bank content changes (theme swap
  // doesn't regenerate windows; building changes do).
  useEffect(() => {
    const sm = winStaticRef.current;
    if (sm) {
      const n = windowBanks.staticMatrices.length;
      for (let i = 0; i < n; i += 1) {
        sm.setMatrixAt(i, windowBanks.staticMatrices[i]);
      }
      sm.count = n;
      sm.instanceMatrix.needsUpdate = true;
      sm.frustumCulled = true;
      // Bounding sphere captures the whole city so three doesn't
      // prematurely cull instances when the camera pans.
      sm.computeBoundingSphere();
    }

    const pm = winPulseRef.current;
    if (pm) {
      const n = windowBanks.pulseMatrices.length;
      for (let i = 0; i < n; i += 1) {
        pm.setMatrixAt(i, windowBanks.pulseMatrices[i]);
      }
      pm.count = n;
      pm.instanceMatrix.needsUpdate = true;
      pm.frustumCulled = true;
      pm.computeBoundingSphere();
    }
  }, [windowBanks]);

  /**
   * Assign every building to a bucket based on distance to the camera,
   * then write a transformation matrix and per-instance color into each
   * body InstancedMesh. Runs every 10 frames.
   *
   * Windows are pre-placed (see `windowBanks`) and don't need this pass.
   */
  const reassignBuckets = (camPos: THREE.Vector3) => {
    const near: number[] = [];
    const mid: number[] = [];
    const far: number[] = [];
    const HIDE = CITY_BOUNDS + 50;

    // Bucket by ground-plane distance (XZ only) so a bird's-eye
    // camera 110 units up still treats the whole visible cluster as
    // "near" for interactive purposes. This matters for hover +
    // click on the homepage: the user looks *down* at the city, and
    // every building directly below is a click target even though
    // euclidean distance puts them "far". True far-distance culling
    // is still done via the full 3D distance below.
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const dx = b.position[0] - camPos.x;
      const dz = b.position[2] - camPos.z;
      const dy = b.position[1] - camPos.y;
      const distGround = Math.sqrt(dx * dx + dz * dz);
      const dist3 = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist3 > HIDE) continue;
      if (distGround < 120) near.push(i);
      else if (distGround < 220) mid.push(i);
      else far.push(i);
    }

    indexMap.current = { near, mid, far };

    // ---- NEAR bucket (interactive) --------------------------------------
    const nm = nearRef.current;
    if (nm) {
      near.forEach((bi, slot) => {
        const b = buildings[bi];
        dummy.position.set(b.position[0], b.height / 2, b.position[2]);
        dummy.scale.set(b.width, b.height, b.width);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        nm.setMatrixAt(slot, dummy.matrix);
        nm.setColorAt(slot, tmpColor.set(b.color));
      });
      for (let s = near.length; s < nm.count; s += 1) {
        dummy.position.set(0, -10000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        nm.setMatrixAt(s, dummy.matrix);
      }
      nm.instanceMatrix.needsUpdate = true;
      if (nm.instanceColor) nm.instanceColor.needsUpdate = true;
    }

    // ---- MID bucket -----------------------------------------------------
    const mm = midRef.current;
    if (mm) {
      mid.forEach((bi, slot) => {
        const b = buildings[bi];
        dummy.position.set(b.position[0], b.height / 2, b.position[2]);
        dummy.scale.set(b.width, b.height, b.width);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mm.setMatrixAt(slot, dummy.matrix);
        // A subtle pull toward the accent keeps the mid field coherent.
        tmpColor.set(b.color).lerp(accentColor, 0.15);
        mm.setColorAt(slot, tmpColor);
      });
      for (let s = mid.length; s < mm.count; s += 1) {
        dummy.position.set(0, -10000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mm.setMatrixAt(s, dummy.matrix);
      }
      mm.instanceMatrix.needsUpdate = true;
      if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
    }

    // ---- FAR bucket -----------------------------------------------------
    const fm = farRef.current;
    if (fm) {
      far.forEach((bi, slot) => {
        const b = buildings[bi];
        // Far LOD: keep full width so silhouettes still read against
        // the horizon (the old trick of shrinking far buildings makes
        // the rim of the city look sparse).
        dummy.position.set(b.position[0], b.height / 2, b.position[2]);
        dummy.scale.set(b.width, b.height, b.width);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        fm.setMatrixAt(slot, dummy.matrix);
        tmpColor.set(b.color).lerp(baseColor, 0.3);
        fm.setColorAt(slot, tmpColor);
      });
      for (let s = far.length; s < fm.count; s += 1) {
        dummy.position.set(0, -10000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        fm.setMatrixAt(s, dummy.matrix);
      }
      fm.instanceMatrix.needsUpdate = true;
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    }

    // ---- Gold crowns (verified only) ------------------------------------
    // Drawn for every verified building regardless of LOD — it's a
    // status signal, we want it visible from any altitude.
    const cm = crownRef.current;
    if (cm) {
      let used = 0;
      for (let i = 0; i < buildings.length; i += 1) {
        const b = buildings[i];
        if (!b.hasGoldCrown) continue;
        dummy.position.set(b.position[0], b.height + 0.6, b.position[2]);
        dummy.scale.set(
          Math.max(0.4, b.width * 0.45),
          1.2,
          Math.max(0.4, b.width * 0.45),
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        if (used < cm.count) {
          cm.setMatrixAt(used, dummy.matrix);
          used += 1;
        }
      }
      for (let s = used; s < cm.count; s += 1) {
        dummy.position.set(0, -10000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        cm.setMatrixAt(s, dummy.matrix);
      }
      cm.instanceMatrix.needsUpdate = true;
    }
  };

  // ---- Frame loop --------------------------------------------------------
  const frameCount = useRef(0);

  useFrame((state) => {
    frameCount.current += 1;
    if (frameCount.current % 10 === 0) {
      reassignBuckets(state.camera.position);
    }

    // Pulse the animated-windows material color. Non-animated windows
    // don't get a useFrame write — the static bank is untouched.
    const t = state.clock.getElapsedTime();
    const pulse = 0.82 + 0.18 * (Math.sin(t * 1.6) * 0.5 + 0.5);
    windowPulseMat.color.copy(glowColor).multiplyScalar(pulse);
    // Keep the static material locked at full brightness so the sea of
    // quiet windows doesn't dim with the pulse.
    windowStaticMat.color.copy(glowColor);
  });

  // Initial bucket population + window writes so first frame already
  // has the scene populated.
  useEffect(() => {
    reassignBuckets(new THREE.Vector3(0, 110, 150));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, theme]);

  // ---- Pointer events (near bucket only) --------------------------------
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const id = e.instanceId;
    if (id == null) return;
    const bi = indexMap.current.near[id];
    if (bi == null) return;
    setHovered(buildings[bi].username);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    setHovered(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (
      (e as unknown as { delta?: number }).delta &&
      (e as unknown as { delta: number }).delta > 5
    ) {
      return;
    }
    const id = e.instanceId;
    if (id == null) return;
    const bi = indexMap.current.near[id];
    if (bi == null) return;
    document.body.style.cursor = '';
    setHovered(null);
    onSelect?.(buildings[bi].username);
  };

  // Allocate the instanced meshes. Body buckets: one slot per building
  // (worst case everyone lands in the same bucket). Crown bucket: one
  // slot per verified user. Window banks: the exact length we
  // pre-computed.
  const maxBodies = buildings.length;
  const maxCrowns = buildings.filter((b) => b.hasGoldCrown).length;
  const maxStaticWin = Math.max(1, windowBanks.staticMatrices.length);
  const maxPulseWin = Math.max(1, windowBanks.pulseMatrices.length);

  return (
    <group>
      {/* Near LOD body — interactive */}
      <instancedMesh
        ref={nearRef}
        args={[undefined, undefined, maxBodies]}
        material={nearMat}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
        frustumCulled
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Mid LOD body */}
      <instancedMesh
        ref={midRef}
        args={[undefined, undefined, maxBodies]}
        material={midMat}
        frustumCulled
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Far LOD body */}
      <instancedMesh
        ref={farRef}
        args={[undefined, undefined, maxBodies]}
        material={farMat}
        frustumCulled
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Window dots — static bank (non-animated users) */}
      <instancedMesh
        ref={winStaticRef}
        args={[undefined, undefined, maxStaticWin]}
        material={windowStaticMat}
        frustumCulled
      >
        <boxGeometry args={[0.12, 0.12, 0.12]} />
      </instancedMesh>

      {/* Window dots — pulsing bank (animated users) */}
      <instancedMesh
        ref={winPulseRef}
        args={[undefined, undefined, maxPulseWin]}
        material={windowPulseMat}
        frustumCulled
      >
        <boxGeometry args={[0.12, 0.12, 0.12]} />
      </instancedMesh>

      {/* Gold crowns (verified) */}
      <instancedMesh
        ref={crownRef}
        args={[undefined, undefined, Math.max(1, maxCrowns)]}
        material={crownMat}
        frustumCulled
      >
        <coneGeometry args={[1, 1, 4]} />
      </instancedMesh>
    </group>
  );
}
