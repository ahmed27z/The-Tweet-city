'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface KudosParticlesProps {
  /** How many sparkles per burst. */
  count?: number;
  /**
   * Monotonic counter. Every time this increments (i.e. changes to a
   * new value), a fresh batch of particles is emitted. A 0 on mount
   * means "no initial burst".
   */
  trigger: number;
  /** World-space spawn origin. */
  origin?: [number, number, number];
  /** Color of the sparkles (hex). */
  color?: string;
  /** Particle lifetime in seconds. */
  life?: number;
}

/**
 * Emissive-plane particle burst rendered with a single instancedMesh.
 *
 * We keep an internal fixed-size pool (`count` particles) and on each
 * `trigger` change we "respawn" the pool with fresh randomized
 * velocities + age=0. Every frame the pool is advanced: age++, scale
 * eased, opacity tweened toward 0. When every particle is "dead"
 * (age >= life) the instanced mesh quietly renders at y=-10000 (off
 * stage) so it costs nothing until the next burst.
 *
 * No DOM particles — this is pure Three.js. Plays nicely with the
 * reduced-motion preference: when set, we drop both count and speed.
 */
export default function KudosParticles({
  count = 10,
  trigger,
  origin = [0, 0, 0],
  color = '#00d4ff',
  life = 1.2,
}: KudosParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const ages = useRef<Float32Array>(new Float32Array(count).fill(life + 1));
  const velocities = useRef<Float32Array>(new Float32Array(count * 3));
  const offsets = useRef<Float32Array>(new Float32Array(count * 3));

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const material = useMemo(() => {
    const c = new THREE.Color(color);
    return new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, [color]);

  // Respect reduced-motion — cut the pool in half when set, and
  // drastically slow down the upward drift.
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Dispose the material we created when the component unmounts.
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  // On a trigger change, respawn the pool with fresh randomised drifts.
  useEffect(() => {
    if (trigger === 0) return;
    for (let i = 0; i < count; i += 1) {
      // Radial scatter around origin in XZ plane + upward Y bias
      const theta = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.6;
      offsets.current[i * 3 + 0] = Math.cos(theta) * radius;
      offsets.current[i * 3 + 1] = Math.random() * 0.4;
      offsets.current[i * 3 + 2] = Math.sin(theta) * radius;

      const speed = reducedMotion ? 0.6 : 1.5 + Math.random();
      velocities.current[i * 3 + 0] = Math.cos(theta) * 0.2 * (Math.random() - 0.5);
      velocities.current[i * 3 + 1] = speed;
      velocities.current[i * 3 + 2] = Math.sin(theta) * 0.2 * (Math.random() - 0.5);

      ages.current[i] = 0;
    }
  }, [trigger, count, reducedMotion]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let alive = 0;
    let maxOpacity = 0;

    for (let i = 0; i < count; i += 1) {
      const age = ages.current[i] + delta;
      ages.current[i] = age;

      if (age > life) {
        // Park dead particle off-stage
        dummy.position.set(0, -10000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      alive += 1;
      const t = age / life;
      // ease-out cubic for the upward drift
      const eased = 1 - Math.pow(1 - t, 3);
      const px = origin[0] + offsets.current[i * 3 + 0] + velocities.current[i * 3 + 0] * age;
      const py = origin[1] + offsets.current[i * 3 + 1] + velocities.current[i * 3 + 1] * eased * 2;
      const pz = origin[2] + offsets.current[i * 3 + 2] + velocities.current[i * 3 + 2] * age;

      const scale = 0.3 + (1 - t) * 0.4; // shrink over life
      const opacity = (1 - t) * (1 - t);
      maxOpacity = Math.max(maxOpacity, opacity);

      dummy.position.set(px, py, pz);
      dummy.scale.set(scale, scale, scale);
      // Billboard-ish: face upward and spin slightly for shimmer
      dummy.rotation.set(0, age * 2, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    // One shared material opacity — all sparkles fade together.
    material.opacity = maxOpacity;
    mesh.visible = alive > 0;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      material={material}
      // Start hidden — no burst until the parent flips `trigger`.
      visible={false}
    >
      <planeGeometry args={[0.6, 0.6]} />
    </instancedMesh>
  );
}
