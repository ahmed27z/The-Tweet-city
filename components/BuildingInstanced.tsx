'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BuildingProps, Theme } from '@/lib/types';
import { useCityStore } from '@/lib/store';
import { CITY_BOUNDS } from '@/lib/cityLayout';

interface BuildingInstancedProps {
  buildings: BuildingProps[];
  theme: Theme;
  /** Called when a building is clicked. */
  onSelect?: (username: string) => void;
}

/**
 * High-throughput renderer for the entire city. Splits the buildings
 * into three LOD buckets (near / mid / far) and renders each bucket as
 * a single THREE.InstancedMesh. Per-instance events come back through
 * R3F's `event.instanceId`, which we map back to the bucket's owner
 * indices.
 *
 * Why InstancedMesh?
 * ------------------
 * 50 buildings would still be fine as separate meshes, but the design
 * doc plans for hundreds-of-thousands later. Building this with the
 * right primitive now means the next task can swap mock data for the
 * real API and the city scales without architectural changes.
 *
 * LOD strategy
 * ------------
 *   < 80 units  → near : detailed body + window-glow planes + crown
 *   < 200 units → mid  : body only with flat emissive tint
 *   else       → far  : tiny 1-unit-wide flat-shaded body
 *   > CITY_BOUNDS+50  → hidden entirely (set scale to 0)
 *
 * Buckets are recomputed every 10 frames so we don't pay distance
 * checks every tick. Window-glow animation runs at ≤30 Hz across only
 * the near bucket.
 */
export default function BuildingInstanced({
  buildings,
  theme,
  onSelect,
}: BuildingInstancedProps) {
  const setHovered = useCityStore((s) => s.setHovered);

  // Refs — one InstancedMesh per LOD body + crown
  const nearRef = useRef<THREE.InstancedMesh>(null);
  const midRef = useRef<THREE.InstancedMesh>(null);
  const farRef = useRef<THREE.InstancedMesh>(null);
  const winRef = useRef<THREE.InstancedMesh>(null); // window-glow planes (near)
  const crownRef = useRef<THREE.InstancedMesh>(null); // gold crowns (near)

  // Reusable scratch object — allocated once
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  /**
   * Per-instance index → owning building index (so we can resolve clicks
   * back to a username). Updated in step with the LOD assignment below.
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

  // Materials — one per bucket. We reuse them across rebucketings.
  const nearMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // Per-instance color overrides this base value, but we still set it
        // as a sane default so a freshly-allocated instance is visible.
        color: '#ffffff',
        roughness: 0.55,
        metalness: 0.15,
        // Subtle emissive tint based on the theme's accent so the city
        // glows even before the per-window planes light up.
        emissive: accentColor,
        emissiveIntensity: 0.05,
      }),
    [accentColor],
  );
  const midMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.8,
        metalness: 0.05,
        emissive: accentColor,
        emissiveIntensity: 0.08,
      }),
    [accentColor],
  );
  const farMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
      }),
    [],
  );
  const windowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
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

  /**
   * Assign every building to a bucket based on distance to the camera,
   * then write a transformation matrix and per-instance color into each
   * InstancedMesh.
   *
   * Called every frame inside `useFrame`, but throttled by `frameCount`
   * to once every 10 frames (≈6 Hz at 60 fps).
   */
  const reassignBuckets = (camPos: THREE.Vector3) => {
    const near: number[] = [];
    const mid: number[] = [];
    const far: number[] = [];
    const HIDE = CITY_BOUNDS + 50;

    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const dx = b.position[0] - camPos.x;
      const dy = b.position[1] - camPos.y;
      const dz = b.position[2] - camPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > HIDE) continue; // off-stage, skip
      if (dist < 80) near.push(i);
      else if (dist < 200) mid.push(i);
      else far.push(i);
    }

    indexMap.current = { near, mid, far };

    // ---- NEAR bucket -----------------------------------------------------
    const nm = nearRef.current;
    if (nm) {
      near.forEach((bi, slot) => {
        const b = buildings[bi];
        dummy.position.set(b.position[0], b.height / 2, b.position[2]);
        dummy.scale.set(b.width, b.height, b.width);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        nm.setMatrixAt(slot, dummy.matrix);
        // Per-instance color (lets each building be its own colorful tint)
        nm.setColorAt(slot, tmpColor.set(b.color));
      });
      // Hide unused slots from this bucket allocation
      for (let s = near.length; s < nm.count; s += 1) {
        dummy.position.set(0, -10000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        nm.setMatrixAt(s, dummy.matrix);
      }
      nm.instanceMatrix.needsUpdate = true;
      if (nm.instanceColor) nm.instanceColor.needsUpdate = true;
    }

    // ---- MID bucket ------------------------------------------------------
    const mm = midRef.current;
    if (mm) {
      mid.forEach((bi, slot) => {
        const b = buildings[bi];
        dummy.position.set(b.position[0], b.height / 2, b.position[2]);
        dummy.scale.set(b.width, b.height, b.width);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mm.setMatrixAt(slot, dummy.matrix);
        // Mid LOD blends each color toward the theme accent so the city
        // reads coherent at distance. (1 = pure accent, 0 = local color)
        tmpColor.set(b.color).lerp(accentColor, 0.25);
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

    // ---- FAR bucket ------------------------------------------------------
    const fm = farRef.current;
    if (fm) {
      far.forEach((bi, slot) => {
        const b = buildings[bi];
        // Far LOD: fixed thin block so silhouettes are still visible.
        const w = Math.max(0.6, b.width * 0.4);
        dummy.position.set(b.position[0], b.height / 2, b.position[2]);
        dummy.scale.set(w, b.height, w);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        fm.setMatrixAt(slot, dummy.matrix);
        tmpColor.set(b.color).lerp(baseColor, 0.5);
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

    // ---- NEAR window-glow planes ----------------------------------------
    // For each near building we render ONE plane sitting on the +Z facade.
    // It's an additive flat plane — gives the city a candle-lit feel
    // without the per-window cost. Cheap & convincing at street-level.
    const wm = winRef.current;
    if (wm) {
      near.forEach((bi, slot) => {
        const b = buildings[bi];
        dummy.position.set(
          b.position[0],
          b.height / 2,
          b.position[2] + b.width / 2 + 0.02,
        );
        dummy.scale.set(b.width * 0.85, b.height * 0.85, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        wm.setMatrixAt(slot, dummy.matrix);
      });
      for (let s = near.length; s < wm.count; s += 1) {
        dummy.position.set(0, -10000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        wm.setMatrixAt(s, dummy.matrix);
      }
      wm.instanceMatrix.needsUpdate = true;
    }

    // ---- NEAR gold crowns -----------------------------------------------
    const cm = crownRef.current;
    if (cm) {
      let used = 0;
      near.forEach((bi) => {
        const b = buildings[bi];
        if (!b.hasGoldCrown) return;
        dummy.position.set(b.position[0], b.height + 0.6, b.position[2]);
        dummy.scale.set(
          Math.max(0.4, b.width * 0.45),
          1.2,
          Math.max(0.4, b.width * 0.45),
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        cm.setMatrixAt(used, dummy.matrix);
        used += 1;
      });
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
  // We coalesce two pieces of work: bucket-reassignment (~6 Hz) and the
  // window glow pulse (≤30 Hz, near bucket only).
  const frameCount = useRef(0);
  const glowAccum = useRef(0);

  useFrame((state, delta) => {
    frameCount.current += 1;
    if (frameCount.current % 10 === 0) {
      reassignBuckets(state.camera.position);
    }

    glowAccum.current += delta;
    if (glowAccum.current > 1 / 30) {
      glowAccum.current = 0;
      // Pulse the additive plane opacity so the windows look like they
      // breathe. Animated buildings (high tweetsLast7Days) shimmer; static
      // buildings hold steady.
      const t = state.clock.getElapsedTime();
      // The shared material covers all near windows; we just modulate
      // opacity. Pulse magnitude uses the average windowGlow of the near
      // bucket so a quiet area stays quiet.
      let avg = 0;
      const near = indexMap.current.near;
      let animatedShare = 0;
      for (let i = 0; i < near.length; i += 1) {
        avg += buildings[near[i]].windowGlow;
        animatedShare += buildings[near[i]].isAnimated ? 1 : 0;
      }
      avg = near.length ? avg / near.length : 0.4;
      animatedShare = near.length ? animatedShare / near.length : 0.5;
      const pulse = 0.85 + animatedShare * 0.15 * Math.sin(t * 3);
      windowMat.opacity = Math.max(0.15, Math.min(1, 0.45 + 0.5 * avg) * pulse);
    }
  });

  // Initial bucket population so the first frame already has matrices set.
  useEffect(() => {
    // Set a synthetic camera position somewhere "near" the center so the
    // first frame shows a good mix of LODs. The real camera takes over
    // immediately on the first useFrame tick.
    reassignBuckets(new THREE.Vector3(0, 45, 60));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, theme]);

  // ---- Pointer events ----------------------------------------------------
  // R3F decorates the event with `instanceId` for InstancedMesh. We only
  // wire these on the NEAR bucket — hovering a far-away pixel is unhelpful
  // and would just add noise.
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
    // R3F decorates pointerup with `delta` = manhattan distance the
    // pointer moved since pointerdown. Anything > a few pixels is a
    // camera-rotate drag, not a deliberate click.
    if ((e as unknown as { delta?: number }).delta && (e as unknown as { delta: number }).delta > 5) return;
    const id = e.instanceId;
    if (id == null) return;
    const bi = indexMap.current.near[id];
    if (bi == null) return;
    onSelect?.(buildings[bi].username);
  };

  // Allocate the instanced meshes with the maximum possible count for
  // each bucket. In the worst case every building is in one bucket, so
  // size = buildings.length keeps us safe even if the camera flies far.
  const max = buildings.length;

  return (
    <group>
      {/* Near LOD body — interactive */}
      <instancedMesh
        ref={nearRef}
        args={[undefined, undefined, max]}
        material={nearMat}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Near LOD window-glow planes — non-interactive */}
      <instancedMesh
        ref={winRef}
        args={[undefined, undefined, max]}
        material={windowMat}
      >
        <planeGeometry args={[1, 1]} />
      </instancedMesh>

      {/* Mid LOD body */}
      <instancedMesh
        ref={midRef}
        args={[undefined, undefined, max]}
        material={midMat}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Far LOD body */}
      <instancedMesh
        ref={farRef}
        args={[undefined, undefined, max]}
        material={farMat}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Gold crowns (near + verified) */}
      <instancedMesh
        ref={crownRef}
        args={[undefined, undefined, max]}
        material={crownMat}
        castShadow
      >
        {/* Cone with 4 segments reads as a chunky pyramid */}
        <coneGeometry args={[1, 1, 4]} />
      </instancedMesh>
    </group>
  );
}
