'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import Building from './Building';
import type { BuildingProps, Theme } from '@/lib/types';
import { useInView } from '@/lib/useInView';

interface Props {
  building: BuildingProps;
  theme: Theme;
  /** px size (square). Default 80. */
  size?: number;
  /** When true, the building slowly rotates. Used on hover. */
  rotating?: boolean;
  /** Skip the lazy-mount guard — useful when the thumb is always on-screen. */
  eager?: boolean;
  className?: string;
}

/**
 * Tiny static R3F canvas used inside leaderboard rows and explore cards.
 * Intentionally spartan: no stars, no grid, no lighting tricks — just a
 * single `<Building>` shot from a fixed angle on a transparent canvas.
 *
 * Performance
 * -----------
 *  - `frameloop="demand"` when idle — the Canvas only renders when
 *    React invalidates it (first mount + theme swap). Idle thumbs
 *    cost zero GPU frames.
 *  - `frameloop="always"` while `rotating` — spins smoothly on hover.
 *  - `useInView` defers mounting the Canvas until the row enters the
 *    viewport. Long lists (100+ rows) don't allocate 100 WebGL
 *    contexts upfront.
 *  - `dpr={1}` — at 80×80 we don't need retina sharpness.
 */
export default function BuildingThumb({
  building,
  theme,
  size = 80,
  rotating = false,
  eager = false,
  className,
}: Props) {
  const [wrapperRef, inView] = useInView<HTMLDivElement>({
    // Only mount when the thumb actually enters the viewport. The WebGL
    // context budget (~16 in Chromium) is shared across every
    // <BuildingThumb> on the page — a generous rootMargin would quickly
    // exhaust it on the explore grid. We trade a small scroll-in
    // flicker for a predictable ceiling.
    rootMargin: '0px',
    // `once=false` so scrolling past a card unmounts its Canvas and
    // returns the WebGL context to the pool. Caller can pass `eager`
    // to pin a thumb (e.g. inside a ShareCard that is always visible
    // while open).
    once: false,
    // Require most of the thumb to be visible — keeps partial
    // overscan rows using the placeholder instead of stealing a GL
    // context.
    threshold: 0.5,
  });
  const shouldMount = eager || inView;

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ width: size, height: size }}
    >
      {shouldMount ? (
        <ThumbCanvas
          building={building}
          theme={theme}
          rotating={rotating}
          size={size}
        />
      ) : (
        // Lightweight CSS-only placeholder while off-screen. Cost: zero
        // GPU. Keeps the row height stable so lazy thumbs don't jitter.
        <ThumbPlaceholder building={building} theme={theme} size={size} />
      )}
    </div>
  );
}

/**
 * Zero-cost silhouette fallback. Shows a building-shaped block in the
 * theme's deep-dark body color with a few emissive-cyan dots so the
 * row doesn't feel broken while the real canvas is out-of-view. Uses
 * CSS only — no Three.js / WebGL.
 */
function ThumbPlaceholder({
  building,
  theme,
  size,
}: {
  building: BuildingProps;
  theme: Theme;
  size: number;
}) {
  // Crude silhouette: a rectangle sized proportionally to the building's
  // height/width ratio. The tallest buildings render as tall thin bars.
  const aspect = Math.min(1, building.width / Math.max(building.height, 1));
  const barWidth = Math.max(size * 0.22, size * aspect * 0.5);
  const barHeight = Math.min(size - 10, size * 0.6 + building.height * 0.5);
  // Tiny "window pixels" sprinkled over the bar give the silhouette a
  // hint of the real rendered look.
  const rows = Math.max(3, Math.floor(barHeight / 10));
  const cols = 3;
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = ((r * 31 + c * 17 + building.username.charCodeAt(0)) % 5) < 3;
      if (!lit) continue;
      dots.push(
        <span
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            left: `${((c + 0.5) / cols) * 100}%`,
            top: `${((r + 0.5) / rows) * 100}%`,
            width: 2,
            height: 2,
            background: theme.windowGlow,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 3px ${theme.windowGlow}`,
          }}
        />,
      );
    }
  }
  return (
    <div
      aria-hidden
      className="w-full h-full flex items-end justify-center"
      style={{ background: 'transparent' }}
    >
      <div
        style={{
          width: barWidth,
          height: barHeight,
          background: building.color,
          border: `1px solid ${theme.gridLine}`,
          position: 'relative',
        }}
      >
        {dots}
      </div>
    </div>
  );
}

function ThumbCanvas({
  building,
  theme,
  rotating,
  size,
}: {
  building: BuildingProps;
  theme: Theme;
  rotating: boolean;
  size: number;
}) {
  // Center the building at origin (the shared Building component honours
  // the position prop, so we override it here). A cloned BuildingProps
  // is cheap — we only do it once per render.
  const centered = useMemo(
    () => ({ ...building, position: [0, 0, 0] as [number, number, number] }),
    [building],
  );

  // Frame the camera so the narrow tower fills the square without
  // cropping the crown or the base. The thumb looks best from a slight
  // downward angle so the window dots are visible on the front facade.
  const frame = Math.max(building.height, building.width * 2);
  const camDist = Math.max(4, frame * 1.1);

  const motionOk =
    typeof window === 'undefined' ||
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shouldRotate = rotating && motionOk;

  return (
    <Canvas
      dpr={1}
      // demand loop when idle; always when rotating so the spin animates.
      frameloop={shouldRotate ? 'always' : 'demand'}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      style={{ width: size, height: size, background: 'transparent' }}
      camera={{
        position: [camDist * 0.55, building.height * 0.55 + 2, camDist],
        fov: 32,
        near: 0.1,
        far: 200,
      }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        camera.lookAt(0, building.height / 2, 0);
      }}
    >
      <Suspense fallback={null}>
        {/* Low ambient + cool-white key → dark body with clear
            silhouette. The emissive window dots do the heavy lifting
            visually, same as the main city scene. */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[frame, frame * 1.4, frame * 0.8]}
          intensity={0.9}
          color="#cfd8ff"
        />
        <Building
          building={centered}
          theme={theme}
          rotating={shouldRotate}
        />
        {/* In demand mode we need to kick the frameloop once on mount to
            actually produce a first frame, and again if the building
            changes (theme swap, etc.). */}
        <InvalidateOnChange
          signature={`${centered.username}-${theme.id}-${centered.height.toFixed(2)}-${centered.width.toFixed(2)}`}
          active={!shouldRotate}
        />
      </Suspense>
    </Canvas>
  );
}

/**
 * Helper that calls R3F's invalidate() whenever `signature` changes.
 * Necessary for `frameloop='demand'` — without an invalidate, the
 * Canvas never renders its first frame after mount.
 */
function InvalidateOnChange({
  signature,
  active,
}: {
  signature: string;
  active: boolean;
}) {
  const { invalidate, scene } = useThree();

  useEffect(() => {
    if (!active) return;
    // Kick several invalidates in the first ~300ms so any
    // not-yet-ready material or geometry still gets captured.
    let cancelled = false;
    const handles: number[] = [];
    const schedule = (ms: number) => {
      handles.push(
        window.setTimeout(() => {
          if (cancelled) return;
          invalidate();
        }, ms),
      );
    };
    schedule(0);
    schedule(50);
    schedule(150);
    schedule(300);
    schedule(600);
    return () => {
      cancelled = true;
      handles.forEach((h) => window.clearTimeout(h));
    };
  }, [signature, active, invalidate, scene]);

  return null;
}

