'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface CameraControlsProps {
  defaultPosition?: [number, number, number];
  /** Where the camera looks on reset / landing. */
  defaultTarget?: [number, number, number];
  /** If set, the first ~1.5s plays a gentle ease from `landingStart`
   *  down to `defaultPosition`. Used on the homepage to sell the
   *  "dropping into the city" feel. */
  landingStart?: [number, number, number];
  /** Landing duration in seconds. */
  landingDuration?: number;
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
 *   Mouse wheel                      → adjust move speed (clamped 5..120)
 *   R                                → snap back to defaultPosition + look at target
 *
 * Notes
 * -----
 *   - Uses THREE.Euler with order 'YXZ' so yaw never flips pitch.
 *   - Velocity is exponentially damped per frame for a smooth feel.
 *   - The optional landing animation plays once on mount and cannot be
 *     re-triggered (we intentionally *don't* run it when `R` is
 *     pressed — reset should be instant).
 */
export default function CameraControls({
  defaultPosition = [0, 110, 150],
  defaultTarget = [0, 10, 0],
  landingStart,
  landingDuration = 1.5,
}: CameraControlsProps) {
  const { camera, gl } = useThree();

  // Mutable refs so React doesn't re-render on every keystroke
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const yawPitch = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const targetVel = useRef(new THREE.Vector3());
  const vel = useRef(new THREE.Vector3());
  const speed = useRef(28);

  // Landing state (used only when `landingStart` is provided).
  const hasLanded = useRef(false);
  const landingElapsed = useRef(0);
  const landingFrom = useMemo(
    () =>
      new THREE.Vector3(
        ...(landingStart ?? defaultPosition),
      ),
    [landingStart, defaultPosition],
  );
  const landingTo = useMemo(
    () => new THREE.Vector3(...defaultPosition),
    [defaultPosition],
  );

  // Initialise pose on mount + handle reset (R)
  useEffect(() => {
    const snapTo = (pos: [number, number, number]) => {
      camera.position.set(...pos);
      camera.lookAt(...defaultTarget);
      yawPitch.current.setFromQuaternion(camera.quaternion, 'YXZ');
      vel.current.set(0, 0, 0);
    };
    // Open on the landing start (if any) so the ease reads correctly.
    snapTo(landingStart ?? defaultPosition);
    // If no landing animation is requested, mark as landed immediately.
    hasLanded.current = !landingStart;

    const reset = () => {
      // R is an instant snap — no landing animation. Also cancel any
      // in-flight landing so the user can bail out of it.
      hasLanded.current = true;
      landingElapsed.current = landingDuration;
      snapTo(defaultPosition);
    };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, defaultPosition, defaultTarget, landingStart, landingDuration]);

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
      const max = THREE.MathUtils.degToRad(85);
      yawPitch.current.x = Math.max(-max, Math.min(max, yawPitch.current.x));
      camera.quaternion.setFromEuler(yawPitch.current);
      // User input cancels the landing ease (they want control NOW).
      hasLanded.current = true;
    };
    const onWheel = (e: WheelEvent) => {
      speed.current = Math.max(
        5,
        Math.min(120, speed.current - Math.sign(e.deltaY) * 2),
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
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    // ---- Landing ease ---------------------------------------------------
    // Interpolate from landingFrom → landingTo over `landingDuration`s
    // with an ease-out-cubic curve. Re-points `lookAt` at the target
    // every frame so the camera decelerates smoothly into framing.
    if (!hasLanded.current) {
      landingElapsed.current += delta;
      const raw = Math.min(1, landingElapsed.current / landingDuration);
      const e = 1 - Math.pow(1 - raw, 3); // ease-out cubic
      tmpPos.lerpVectors(landingFrom, landingTo, e);
      camera.position.copy(tmpPos);
      camera.lookAt(...defaultTarget);
      yawPitch.current.setFromQuaternion(camera.quaternion, 'YXZ');
      // Disable WASD input during the landing so users don't fight it.
      if (raw >= 1) hasLanded.current = true;
      return;
    }

    // Build a target velocity from the WASD/arrow/QE/Space-Shift state.
    targetVel.current.set(0, 0, 0);

    const k = keys.current;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const u = (k.KeyE || k.Space ? 1 : 0) - (k.KeyQ || k.ShiftLeft || k.ShiftRight ? 1 : 0);

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, up).normalize();

    targetVel.current
      .addScaledVector(fwd, f * speed.current)
      .addScaledVector(right, r * speed.current)
      .addScaledVector(up, u * speed.current);

    // Critically-damped lerp toward the target velocity. Reduced damping
    // (8 vs. previous 12) lets WASD input feel glide-y in the much
    // larger city footprint.
    const damping = 8;
    vel.current.lerp(targetVel.current, Math.min(1, damping * delta));

    camera.position.addScaledVector(vel.current, delta);
  });

  return null;
}
