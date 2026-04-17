'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, Html, OrbitControls, Sparkles, Stars } from '@react-three/drei';
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import Building from './Building';
import KudosParticles from './KudosParticles';
import type { BuildingProps, Theme } from '@/lib/types';
import { getCosmetic } from '@/lib/cosmetics';
import CanvasErrorBoundary from './CanvasErrorBoundary';

export interface Hero3DEquippedCosmetics {
  antenna?: string;
  flag?: string;
  windows?: string;
  aura?: string;
}

interface Hero3DProps {
  building: BuildingProps;
  theme: Theme;
  /** Square pixel size. Default 480. */
  size?: number;
  /** Equipped cosmetic ids — rendered as 3D previews over the building. */
  cosmetics?: Hero3DEquippedCosmetics;
  /** Whether to render sparkle particles around the hero. */
  showParticles?: boolean;
  /** When set, an overlay CLAP ✨ button is rendered. Called on click. */
  onKudos?: () => void;
  /** Kudos count to render inside the CLAP button. */
  kudosCount?: number;
  /** Allows the parent to force-disable the CLAP button. */
  clapDisabled?: boolean;
  /** Reason shown as tooltip when disabled. */
  clapDisabledReason?: string;
  /** Force the canvas background color, overriding the theme's default. */
  backgroundOverride?: string;
  /** Renders the building as static (no idle spin). */
  rotating?: boolean;
}

/**
 * Isolated hero canvas used on the profile and compare pages.
 *
 * Scene contents
 * --------------
 *  - Fogged themed background
 *  - Soft ground plane + fade-out grid (drei <Grid>)
 *  - Distant starfield (drei <Stars>) for depth
 *  - Single rotating <Building> (from components/Building)
 *  - Cosmetic overlays: antenna (tiny cone/tower), flag (plane), aura
 *    (pulsing torus at the base), windows (extra additive plane)
 *  - <Sparkles> ambient glimmer when showParticles
 *  - KudosParticles emitted on clap
 *  - <OrbitControls enableZoom enablePan={false}/>
 *  - Overlay <Html> CLAP ✨ button (only when onKudos provided)
 *
 * DPR clamped to [1, 1.5]; the scene is small enough to not need more.
 */
export default function Hero3D({
  building,
  theme,
  size = 480,
  cosmetics,
  showParticles = true,
  onKudos,
  kudosCount,
  clapDisabled = false,
  clapDisabledReason,
  backgroundOverride,
  rotating = true,
}: Hero3DProps) {
  const [clapTrigger, setClapTrigger] = useState(0);

  const handleClap = () => {
    if (clapDisabled) return;
    setClapTrigger((t) => t + 1);
    onKudos?.();
  };

  // Respect reduced-motion for the idle spin
  const motionOk =
    typeof window === 'undefined' ||
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Frame the camera so the building fills the view regardless of its
  // size. For narrow-skyscraper aesthetics we bias toward a slightly
  // further back + lower camera so the verticality reads, rather than
  // flattening a tall account into a fat block.
  const frame = Math.max(building.height, building.width * 2);
  // Distance tuned so a median account reads as a tall sliver and
  // scholars of tweet volume (elonmusk, mrbeast, …) still fit head-to-
  // toe at fov=45 with a little margin for the crown.
  const camDist = Math.max(8, frame * 1.5);
  const camPos: [number, number, number] = [
    camDist * 0.55,
    Math.max(building.height * 0.45, 6),
    camDist,
  ];
  // Push fog PAST the building so the subject stays crisp; only the
  // distant starfield + ground edge fade into haze.
  const fogNear = camDist * 1.8;
  const fogFar = camDist * 6;

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
    >
      <CanvasErrorBoundary
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-black/60 border-[2px] border-text-muted/30 text-text-muted text-[10px] uppercase tracking-widest">
            3D preview unavailable
          </div>
        }
      >
        <Suspense fallback={null}>
          <Canvas
            dpr={[1, 1.5]}
            gl={{ antialias: false, powerPreference: 'high-performance' }}
            camera={{
              position: camPos,
              fov: 45,
              near: 0.1,
              far: Math.max(400, frame * 8),
            }}
            onCreated={({ gl, camera }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.0;
              camera.lookAt(0, building.height / 2, 0);
            }}
            style={{ width: size, height: size, background: backgroundOverride ?? theme.background }}
          >
            {/* ─── Sky + atmosphere ─────────────────────────────────────── */}
            <color attach="background" args={[backgroundOverride ?? theme.background]} />
            <fog attach="fog" args={[theme.fog, fogNear, fogFar]} />

            {/* ─── Lights ───────────────────────────────────────────────── */}
            {/* Keep ambient low so the dark body stays dark; a single
                cool-white key gives it a silhouette gradient, and a
                faint accent fill keeps the shadow side from going pure
                black. The emissive window dots carry most of the
                visual weight. */}
            <ambientLight intensity={0.35} />
            <directionalLight
              position={[frame * 0.8, frame * 1.6, frame * 0.6]}
              intensity={0.9}
              color="#cfd8ff"
            />
            <directionalLight
              position={[-frame, frame * 0.8, -frame]}
              intensity={0.25}
              color={theme.buildingAccent}
            />

            {/* ─── Distant starfield ────────────────────────────────────── */}
            <Stars
              radius={Math.max(80, frame * 6)}
              depth={Math.max(40, frame * 3)}
              count={500}
              factor={2.5}
              saturation={0}
              fade
              speed={0.4}
            />

            {/* ─── Ground plane + unified dark grid ─────────────────────── */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.05, 0]}
            >
              <planeGeometry args={[Math.max(200, frame * 10), Math.max(200, frame * 10)]} />
              <meshStandardMaterial
                color={theme.ground}
                roughness={1}
                metalness={0}
              />
            </mesh>
            <Grid
              args={[Math.max(120, frame * 6), Math.max(120, frame * 6)]}
              cellSize={Math.max(2, frame / 12)}
              cellThickness={0.6}
              sectionSize={Math.max(10, frame / 2)}
              sectionThickness={0.8}
              cellColor={theme.gridLine}
              // Unified — no neon section lines. Matches the main
              // city's grid language so the hero feels like "one
              // pulled-out block" of the wider metropolis.
              sectionColor={theme.gridLine}
              fadeDistance={Math.max(60, frame * 3.5)}
              fadeStrength={1}
              infiniteGrid={false}
            />

            {/* ─── Hero building (centered at origin) ───────────────────── */}
            <Building
              building={{ ...building, position: [0, 0, 0] }}
              theme={theme}
              rotating={rotating && motionOk}
            />

            {/* ─── Cosmetic overlays ────────────────────────────────────── */}
            <CosmeticOverlays building={building} cosmetics={cosmetics} />

            {/* ─── Ambient sparkles ─────────────────────────────────────── */}
            {showParticles && motionOk && (
              <Sparkles
                count={24}
                scale={[building.width * 3, building.height * 1.6, building.width * 3]}
                size={2}
                speed={0.3}
                color={theme.windowGlow}
                position={[0, building.height / 2, 0]}
              />
            )}

            {/* ─── Clap burst particles (trigger-driven) ────────────────── */}
            <KudosParticles
              count={10}
              trigger={clapTrigger}
              origin={[0, building.height * 0.6, 0]}
              color={theme.windowGlow}
              life={1.3}
            />

            {/* ─── OrbitControls (no pan, wheel zoom allowed) ───────────── */}
            <OrbitControls
              makeDefault
              enableZoom
              enablePan={false}
              enableDamping
              dampingFactor={0.08}
              minDistance={Math.max(3, frame * 0.25)}
              maxDistance={frame * 3}
              target={[0, building.height / 2, 0]}
            />

            {/* ─── Overlay CLAP button ──────────────────────────────────── */}
            {onKudos && (
              <Html
                position={[0, -0.2, building.width * 1.3]}
                center
                zIndexRange={[20, 0]}
                style={{ pointerEvents: 'auto' }}
              >
                <ClapButton
                  count={kudosCount ?? 0}
                  onClap={handleClap}
                  disabled={clapDisabled}
                  disabledReason={clapDisabledReason}
                />
              </Html>
            )}
          </Canvas>
        </Suspense>
      </CanvasErrorBoundary>
    </div>
  );
}

/**
 * Cosmetic overlays rendered inside the Canvas. Each slot is rendered
 * independently — a building can have all four equipped at once.
 */
function CosmeticOverlays({
  building,
  cosmetics,
}: {
  building: BuildingProps;
  cosmetics?: Hero3DEquippedCosmetics;
}) {
  const antenna = cosmetics?.antenna ? getCosmetic(cosmetics.antenna) : undefined;
  const flag = cosmetics?.flag ? getCosmetic(cosmetics.flag) : undefined;
  const aura = cosmetics?.aura ? getCosmetic(cosmetics.aura) : undefined;
  const windows = cosmetics?.windows ? getCosmetic(cosmetics.windows) : undefined;

  return (
    <group>
      {antenna && (
        <group position={[0, building.height + 1.2, 0]}>
          {/* thin rod */}
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 1.5, 8]} />
            <meshStandardMaterial
              color={antenna.preview}
              emissive={antenna.preview}
              emissiveIntensity={0.45}
              metalness={0.7}
              roughness={0.2}
            />
          </mesh>
          {/* tip */}
          <mesh position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial
              color={antenna.preview}
              emissive={antenna.preview}
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      )}

      {flag && (
        // A flag near the top of the building — offset just past the facade.
        <group position={[building.width / 2 + 0.1, building.height * 0.85, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.8, 6]} />
            <meshStandardMaterial color="#777" />
          </mesh>
          <mesh position={[0.55, 0.4, 0]}>
            <planeGeometry args={[1, 0.6]} />
            <meshStandardMaterial
              color={flag.preview}
              emissive={flag.preview}
              emissiveIntensity={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {windows && (
        // Extra tinted plane glowing from just inside the +Z facade.
        <mesh
          position={[0, building.height / 2, building.width / 2 + 0.03]}
        >
          <planeGeometry args={[building.width * 0.85, building.height * 0.85]} />
          <meshBasicMaterial
            color={windows.preview}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {aura && (
        <PulsingAura
          color={aura.preview}
          radius={building.width * 0.9 + 0.5}
        />
      )}
    </group>
  );
}

function PulsingAura({ color, radius }: { color: string; radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const scale = 1 + Math.sin(t * 2) * 0.08;
    ref.current.scale.set(scale, 1, scale);
    material.opacity = 0.35 + 0.25 * (Math.sin(t * 2) * 0.5 + 0.5);
  });

  return (
    <mesh
      ref={ref}
      position={[0, 0.15, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <ringGeometry args={[radius * 0.75, radius, 32]} />
    </mesh>
  );
}

function ClapButton({
  count,
  onClap,
  disabled,
  disabledReason,
}: {
  count: number;
  onClap: () => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClap}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-label={disabled ? `Clap disabled: ${disabledReason}` : `Clap to give kudos, ${count} so far`}
      className={
        'select-none uppercase tracking-widest text-[11px] px-3 py-2 ' +
        'border-[2px] bg-black/80 backdrop-blur shadow-[2px_2px_0_0_#000] ' +
        (disabled
          ? 'border-text-muted/40 text-text-muted/60 cursor-not-allowed'
          : 'border-accent-cyan text-accent-cyan hover:bg-accent-cyan/10 active:translate-y-[1px]')
      }
      style={{ fontFamily: 'var(--font-silkscreen), monospace' }}
    >
      CLAP ✨ <span className="ml-2 text-text-primary">{count}</span>
    </button>
  );
}
