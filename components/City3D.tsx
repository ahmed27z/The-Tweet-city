'use client';

import { Canvas } from '@react-three/fiber';
import { Grid, Stars } from '@react-three/drei';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useCityStore } from '@/lib/store';
import { THEMES } from '@/lib/themes';
import { MOCK_USERS } from '@/lib/mockData';
import { layoutCity } from '@/lib/cityLayout';
import { generateBuilding } from '@/lib/buildingGenerator';
import BuildingInstanced from './BuildingInstanced';
import BuildingLabel from './BuildingLabel';
import CameraControls from './CameraControls';
import TopBar from './TopBar';
import ActivityFeed from './ActivityFeed';
import WebGLFallback from './WebGLFallback';
import CanvasErrorBoundary from './CanvasErrorBoundary';

/** Default camera pose — a bird's-eye look toward downtown. */
const CAM_DEFAULT: [number, number, number] = [0, 110, 150];
/** Where the camera looks on load / reset. Slightly above ground so the
 *  horizon sits a touch higher than middle and the skyline reads as
 *  cinematic rather than top-down. */
const CAM_TARGET: [number, number, number] = [0, 10, 0];
/** Camera origin at first mount — slightly further out and higher,
 *  so the 1.5s ease-in feels like *dropping in* to the city. */
const CAM_LANDING_START: [number, number, number] = [0, 200, 220];

/**
 * The 3D city scene. Owns the Canvas, the lighting + sky + ground, and
 * the instanced city. UI chrome (top bar, activity feed, HUD) lives as
 * sibling DOM nodes layered on top of the canvas.
 */
export default function City3D() {
  const router = useRouter();
  const themeId = useCityStore((s) => s.theme);
  const hovered = useCityStore((s) => s.hoveredUsername);
  const theme = THEMES[themeId];

  // Generate the buildings once (per theme). The mock data + layout are
  // deterministic so the city looks identical across reloads.
  const buildings = useMemo(() => {
    const positions = layoutCity(MOCK_USERS);
    return MOCK_USERS.map((u, i) => generateBuilding(u, positions[i], theme));
  }, [theme]);

  // World position used to anchor the hover label — top of the building.
  const hoverPosition = useMemo<[number, number, number] | null>(() => {
    if (!hovered) return null;
    const b = buildings.find((bb) => bb.username === hovered);
    if (!b) return null;
    return [b.position[0], b.height + 2.5, b.position[2]];
  }, [hovered, buildings]);

  // WebGL availability check — render the fallback up-front so we don't
  // even mount the Canvas (which would itself throw).
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      const ctx =
        (c.getContext('webgl2') as WebGLRenderingContext | null) ||
        (c.getContext('webgl') as WebGLRenderingContext | null);
      setWebglOk(!!ctx);
    } catch {
      setWebglOk(false);
    }
  }, []);

  // Scroll-lock the document while the city scene is mounted.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  if (webglOk === false) return <WebGLFallback />;

  return (
    <div className="fixed inset-0">
      <CanvasErrorBoundary fallback={<WebGLFallback forceVisible />}>
        <Suspense fallback={null}>
          <Canvas
            dpr={[1, 2]}
            // Wide-horizon bird's-eye frame. FOV 50 (vs. the old 60)
            // pulls the skyline wider without fish-eye on the edges.
            // `far` is 1000 so the ring of buildings + starfield all
            // stay inside the frustum.
            camera={{ position: CAM_DEFAULT, fov: 50, near: 0.5, far: 1000 }}
            gl={{ antialias: false, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              // Cap the tone-mapping exposure so window dots bloom hot
              // against the dark bodies without washing the whole
              // scene. The window material opts out of tone mapping
              // entirely.
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.0;
            }}
          >
            {/* Sky + atmosphere ----------------------------------------- */}
            <color attach="background" args={[theme.background]} />
            {/* Tighter fog: the far end hides the grid's fade-out edge
                and pulls the skyline together. 60 → 280 so mid-near
                buildings stay crisp, far ones dissolve into haze. */}
            <fog attach="fog" args={[theme.fog, 60, 280]} />

            {/* Lights — ambient stays low so body silhouettes read dark,
                the directional key gives the near-field buildings a
                cool-white highlight on one side, and the hemisphere
                fills in a faint sky tint on the shadow side. */}
            <ambientLight intensity={0.18} />
            <directionalLight
              position={[120, 260, 80]}
              intensity={0.5}
              color="#cfd8ff"
            />
            <hemisphereLight
              args={[theme.skyTop, theme.ground, 0.25]}
            />

            {/* Distant starfield */}
            <Stars
              radius={400}
              depth={120}
              count={6000}
              factor={4}
              saturation={0}
              fade
              speed={0.4}
            />

            {/* Ground plane — sits *below* the grid so the grid lines
                read as subtle tracery over a continuous dark floor
                rather than floating on empty space. */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.05, 0]}
            >
              <planeGeometry args={[1200, 1200]} />
              <meshStandardMaterial
                color={theme.ground}
                roughness={1}
                metalness={0}
              />
            </mesh>
            <Grid
              args={[1200, 1200]}
              cellSize={3.2}
              cellThickness={0.6}
              sectionSize={32}
              sectionThickness={0.8}
              cellColor={theme.gridLine}
              // Same as cellColor so we don't get neon "major" lines
              // screaming through the scene — the ref shows a unified,
              // near-invisible grid.
              sectionColor={theme.gridLine}
              fadeDistance={220}
              fadeStrength={2}
              infiniteGrid={false}
            />

            {/* The city — instanced bodies + crowns + window dots ------ */}
            <BuildingInstanced
              buildings={buildings}
              theme={theme}
              onSelect={(username) => router.push(`/u/${username}`)}
            />

            {/* Hover label sits in 3D so it tracks above the building */}
            {hoverPosition && <BuildingLabel position={hoverPosition} />}

            {/* Camera controller (no visual output) */}
            <CameraControls
              defaultPosition={CAM_DEFAULT}
              defaultTarget={CAM_TARGET}
              landingStart={CAM_LANDING_START}
              landingDuration={1.5}
            />
          </Canvas>
        </Suspense>
      </CanvasErrorBoundary>

      {/* DOM overlay — top chrome, activity feed, HUD hint */}
      <TopBar />
      <ActivityFeed />
      <div className="fixed bottom-3 left-3 z-20 text-[10px] tracking-widest text-text-muted/80 select-none pointer-events-none">
        WASD · DRAG · R RESET
      </div>
    </div>
  );
}
