'use client';

import { Component, type ReactNode } from 'react';
import WebGLFallback from './WebGLFallback';

/**
 * Error boundary for anything that mounts a <Canvas> (R3F) tree. A
 * runtime error inside Three.js (shader compile failure, NaN geometry,
 * etc.) would otherwise blow up the whole page — we swap it for the
 * forced WebGL fallback instead so the user at least sees a retry CTA.
 */
export default class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(err: unknown): void {
    // eslint-disable-next-line no-console
    console.error('[TweetCity] canvas error', err);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <WebGLFallback forceVisible />;
    }
    return this.props.children;
  }
}
