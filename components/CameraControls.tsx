'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface CameraControlsProps {
  defaultPosition?: [number, number, number];
}

/**
 * Free-flight camera controller used by the City3D scene.
 *
 * Inputs
 * ------
 *   W / A / S / D · Arrow keys      → translate forward / left / back / right
 *                                     relative to the camera's yaw
 *   Q / E · Space / Shift           → translate up / down
 *   Mouse drag (LMB held)            → yaw + pitch (pitch clamped to ±85°)
 *   Mouse wheel                      → adjust move speed (clamped 5..80)
 *   R                                → snap back to defaultPosition + look at origin
 *
 * Notes
 * -----
 *   - Uses THREE.Euler with order 'YXZ' so yaw never flips pitch.
 *   - Velocity is exponentially damped per frame for a smooth feel.
 *   - This component intentionally renders nothing; the HUD is drawn
 *     in the parent (Canvas siblings), so the controls stay pure logic.
 */
export default function CameraControls({
  defaultPosition = [0, 45, 60],
}: CameraControlsProps) {
  const { camera, gl } = useThree();

  // Mutable refs so React doesn't re-render on every keystroke
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const yawPitch = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const targetVel = useRef(new THREE.Vector3());
  const vel = useRef(new THREE.Vector3());
  const speed = useRef(20);

  // Initialise pose on mount + handle reset (R)
  useEffect(() => {
    const reset = () => {
      camera.position.set(...defaultPosition);
      camera.lookAt(0, 0, 0);
      yawPitch.current.setFromQuaternion(camera.quaternion, 'YXZ');
      vel.current.set(0, 0, 0);
    };
    reset();

    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'KeyR') reset();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [camera, defaultPosition]);

  // Mouse drag (yaw/pitch) + wheel (speed)
  useEffect(() => {
    const dom = gl.domElement;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      dom.setPointerCapture?.(e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      dragging.current = false;
      dom.releasePointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      const sens = 0.0035;
      yawPitch.current.y -= dx * sens;
      yawPitch.current.x -= dy * sens;
      // Clamp pitch to ±85°
      const max = THREE.MathUtils.degToRad(85);
      yawPitch.current.x = Math.max(-max, Math.min(max, yawPitch.current.x));
      camera.quaternion.setFromEuler(yawPitch.current);
    };
    const onWheel = (e: WheelEvent) => {
      // Shift speed by -/+ on wheel; keep it within sensible bounds.
      speed.current = Math.max(
        5,
        Math.min(80, speed.current - Math.sign(e.deltaY) * 2),
      );
    };

    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [camera, gl]);

  // Reusable scratch vectors (allocate once, reuse per frame)
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, delta) => {
    // Build a target velocity from the WASD/arrow/QE/Space-Shift state.
    targetVel.current.set(0, 0, 0);

    const k = keys.current;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const u = (k.KeyE || k.Space ? 1 : 0) - (k.KeyQ || k.ShiftLeft || k.ShiftRight ? 1 : 0);

    // Forward = camera-look direction projected to y=0 plane (so W moves
    // the camera horizontally, never burying us underground).
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, up).normalize();

    targetVel.current
      .addScaledVector(fwd, f * speed.current)
      .addScaledVector(right, r * speed.current)
      .addScaledVector(up, u * speed.current);

    // Critically-damped lerp toward the target velocity (factor = damping*dt)
    const damping = 12;
    vel.current.lerp(targetVel.current, Math.min(1, damping * delta));

    camera.position.addScaledVector(vel.current, delta);
  });

  return null;
}
