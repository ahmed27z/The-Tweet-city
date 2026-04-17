'use client';

import { useEffect, useState } from 'react';
import PixelButton from './PixelButton';

interface WebGLFallbackProps {
  /**
   * Skip the WebGL capability probe and render the fallback unconditionally.
   * Used by CanvasErrorBoundary after an in-scene runtime error: at that
   * point we KNOW the user needs the fallback, regardless of what
   * `createElement('canvas')` reports.
   */
  forceVisible?: boolean;
}

/**
 * Pixel-art fallback shown when WebGL is unavailable. Detects support
 * via a throwaway canvas; the user can RETRY (page reload) once they've
 * switched browsers. We render this both as the static fallback inside
 * a Suspense/error boundary and as a pre-render block when WebGL is
 * known-missing.
 */
export default function WebGLFallback({ forceVisible = false }: WebGLFallbackProps) {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (forceVisible) return; // don't probe — we're being shown intentionally
    try {
      const c = document.createElement('canvas');
      const ctx =
        (c.getContext('webgl2') as WebGLRenderingContext | null) ||
        (c.getContext('webgl') as WebGLRenderingContext | null);
      setSupported(!!ctx);
    } catch {
      setSupported(false);
    }
  }, [forceVisible]);

  // Forced path: skip the probe and render.
  if (!forceVisible) {
    // While we don't know yet, render nothing — avoids a flash of fallback.
    if (supported === null) return null;
    if (supported) return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-primary text-center px-6">
      <div className="text-accent-cyan text-3xl md:text-5xl tracking-widest mb-3">
        TWEET CITY
      </div>
      <p className="text-text-muted max-w-md mb-6 text-xs leading-relaxed">
        {forceVisible
          ? 'The 3D scene crashed. Please reload.'
          : 'Your browser does not support WebGL.'}
        <br />
        Try Chrome, Firefox, or Edge.
      </p>
      <PixelButton variant="glow" onClick={() => location.reload()}>
        RETRY
      </PixelButton>
    </div>
  );
}
