'use client';

import { Canvas } from '@react-three/fiber';
import { Grid, Stars } from '@react-three/drei';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
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

  if (webglOk === false) return <WebGLFallback />;

  return (
    <div className="fixed inset-0">
      <CanvasErrorBoundary fallback={<WebGLFallback forceVisible />}>
        <Suspense fallback={null}>
          <Canvas
            shadows
            dpr={[1, 2]}
            // Wide draw distance so a tall skyscraper across the city
            // never pops out at the edge of the frustum.
            camera={{ position: [0, 45, 60], fov: 60, near: 0.1, far: 600 }}
            gl={{ antialias: false, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              // Keep colors true to the theme palette
              gl.outputColorSpace = THREE.SRGBColorSpace;
            }}
          >
            {/* Sky + atmosphere ----------------------------------------- */}
            <color attach="background" args={[theme.background]} />
            <fog attach="fog" args={[theme.fog, 80, 400]} />

            {/* Lights — soft ambient + key directional with shadow casting */}
            <ambientLight intensity={0.25} />
            <directionalLight
              position={[100, 200, 100]}
              intensity={0.8}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-near={1}
              shadow-camera-far={500}
              shadow-camera-left={-200}
              shadow-camera-right={200}
              shadow-camera-top={200}
              shadow-camera-bottom={-200}
            />

            {/* Distant starfield — drei wraps a buffer-geometry Points cloud */}
            <Stars
              radius={250}
              depth={100}
              count={3000}
              factor={4}
              saturation={0}
              fade
              speed={0.5}
            />

            {/* Ground plane (theme-tinted) + grid overlay --------------- */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              position={[0, 0, 0]}
            >
              <planeGeometry args={[800, 800]} />
              <meshStandardMaterial
                color={theme.ground}
                roughness={0.95}
                metalness={0}
              />
            </mesh>
            <Grid
              args={[600, 600]}
              cellSize={2}
              cellThickness={0.6}
              sectionSize={10}
              sectionThickness={1.2}
              cellColor={theme.gridLine}
              sectionColor={theme.buildingAccent}
              fadeDistance={300}
              fadeStrength={1}
              infiniteGrid={false}
              position={[0, 0.01, 0]}
            />

            {/* The city — instanced bodies + crowns + window planes ---- */}
            <BuildingInstanced
              buildings={buildings}
              theme={theme}
              onSelect={(username) => router.push(`/u/${username}`)}
            />

            {/* Hover label sits in 3D so it tracks above the building */}
            {hoverPosition && <BuildingLabel position={hoverPosition} />}

            {/* Camera controller (no visual output) */}
            <CameraControls defaultPosition={[0, 45, 60]} />
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
