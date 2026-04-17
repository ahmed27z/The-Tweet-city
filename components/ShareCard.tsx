'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import PixelButton from './PixelButton';
import FormattedNumber from './FormattedNumber';
import { formatJoinDate } from '@/lib/format';
import type { BuildingProps, Theme, TwitterStats } from '@/lib/types';

interface ShareCardProps {
  open: boolean;
  onClose: () => void;
  stats: TwitterStats;
  building: BuildingProps;
  theme: Theme;
}

/**
 * Off-screen 1080×1350 card rendered as a hidden DOM node while the
 * modal is open. Clicking DOWNLOAD PNG rasterises that node with
 * html2canvas and triggers an anchor download.
 *
 * We use `html2canvas` dynamically so the bundle only pulls it in
 * when the user actually opens this modal.
 *
 * Building visual
 * ---------------
 * The card embeds a static **SVG silhouette** of the building rather
 * than a live WebGL canvas. `html2canvas` can't sample WebGL backing
 * buffers, and the `preserveDrawingBuffer + gl.toDataURL` workaround
 * is flaky across drivers. The SVG path — a colored rectangle with
 * pixel windows and an optional gold crown — matches the pixel art
 * aesthetic and survives any 2D rasterizer.
 */
export default function ShareCard({
  open,
  onClose,
  stats,
  building,
  theme,
}: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute the share URL from the runtime origin so the modal reflects
  // where it's actually deployed. SSR-safe via the window guard — the
  // modal is client-only but cheap to harden against a hypothetical
  // static-generation pass.
  const [origin, setOrigin] = useState<string>('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);
  const shareUrl = origin
    ? `${origin}/u/${stats.username}`
    : `/u/${stats.username}`;

  // Reset copied/error state when the modal reopens
  useEffect(() => {
    if (open) {
      setCopied(false);
      setError(null);
    }
  }, [open]);

  const download = async () => {
    if (!cardRef.current) return;
    setWorking(true);
    setError(null);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: theme.background,
        useCORS: true,
        logging: false,
        scale: 1,
      });

      const link = document.createElement('a');
      link.download = `${stats.username}-tweetcity.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      setError('PNG export failed — try again');
    } finally {
      setWorking(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share your building"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Preview area — the user sees a scaled-down rendering of the
            real 1080×1350 card so they know what they'll get. */}
        <div className="overflow-hidden border-[2px] border-text-muted/40 bg-black flex justify-center p-2">
          <div
            style={{
              transform: 'scale(0.32)',
              transformOrigin: 'top center',
              width: 1080,
              height: 1350,
              marginBottom: -918, // 1350 * (1 - 0.32)
            }}
          >
            <div
              ref={cardRef}
              style={{
                width: 1080,
                height: 1350,
                background: theme.background,
                color: '#e6edf3',
                fontFamily: 'var(--font-silkscreen), monospace',
                padding: 64,
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  letterSpacing: '0.35em',
                  color: theme.buildingAccent,
                  textTransform: 'uppercase',
                }}
              >
                Tweet City
              </div>
              <div
                style={{
                  fontSize: 110,
                  lineHeight: 1,
                  color: theme.windowGlow,
                }}
              >
                @{stats.username}
              </div>
              <div style={{ fontSize: 30, color: '#8b949e' }}>
                {stats.displayName}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: 10,
                }}
              >
                <BuildingSvg
                  building={building}
                  theme={theme}
                  size={480}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 20,
                  marginTop: 30,
                }}
              >
                <CardStat
                  label="Followers"
                  value={stats.followers}
                  theme={theme}
                />
                <CardStat
                  label="Tweets"
                  value={stats.tweetCount}
                  theme={theme}
                />
                <CardStat label="Likes" value={stats.totalLikes} theme={theme} />
                <CardStat
                  label="Following"
                  value={stats.following}
                  theme={theme}
                />
                <CardStat
                  label="Tweets 7d"
                  value={stats.tweetsLast7Days}
                  theme={theme}
                />
                <div
                  style={{
                    border: `2px solid ${theme.gridLine}`,
                    padding: 18,
                  }}
                >
                  <div style={{ fontSize: 16, color: '#8b949e' }}>
                    Joined
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      color: theme.buildingAccent,
                      marginTop: 6,
                    }}
                  >
                    {formatJoinDate(stats.joinDate)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 22,
                  color: '#8b949e',
                }}
              >
                <span>Visit {shareUrl}</span>
                <span style={{ color: theme.windowGlow }}>✨</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="text-[11px] uppercase tracking-widest text-accent-amber"
          >
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <PixelButton
            variant="glow"
            onClick={download}
            disabled={working}
            className="flex-1"
          >
            {working ? 'Rendering…' : 'Download PNG'}
          </PixelButton>
          <PixelButton onClick={copy} className="flex-1">
            {copied ? 'Copied ✓' : 'Copy link'}
          </PixelButton>
        </div>
      </div>
    </Modal>
  );
}

function CardStat({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: Theme;
}) {
  return (
    <div
      style={{
        border: `2px solid ${theme.gridLine}`,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 16, color: '#8b949e' }}>{label}</div>
      <div
        style={{
          fontSize: 44,
          color: theme.buildingAccent,
          marginTop: 6,
        }}
      >
        <FormattedNumber value={value} />
      </div>
    </div>
  );
}

/**
 * Static SVG silhouette of the building. Deterministic from the same
 * BuildingProps the live 3D scene consumes, so the share card's
 * visual reads as "the same building" even though it's 2D.
 *
 * The card's html2canvas rasterizer can sample SVG without any of the
 * WebGL context gymnastics the live canvas would need.
 */
function BuildingSvg({
  building,
  theme,
  size,
}: {
  building: BuildingProps;
  theme: Theme;
  size: number;
}) {
  // Derive silhouette proportions from the same `height` / `width`
  // metrics the 3D generator produces. Tall narrow towers stay tall
  // and narrow in SVG.
  const aspect = Math.max(0.35, Math.min(1.6, building.width / Math.max(1, building.height)));
  const maxH = size * 0.8;
  const maxW = size * 0.7;
  const h = Math.min(maxH, size * 0.25 + building.height * 10);
  const w = Math.min(maxW, h * aspect);
  const cx = size / 2;
  const baseY = size * 0.9; // ground line inside the svg viewbox
  const x = cx - w / 2;
  const y = baseY - h;

  // Windows: a grid of tiny lit squares, density tied to `floors`.
  const floors = Math.max(1, Math.min(20, building.floors));
  const cols = Math.max(2, Math.min(8, Math.round(w / 18)));
  const cellW = w / (cols + 1);
  const cellH = h / (floors + 1);
  const windowSize = Math.max(3, Math.min(cellW, cellH) * 0.45);
  const windows: Array<{ wx: number; wy: number }> = [];
  for (let f = 1; f <= floors; f += 1) {
    for (let c = 1; c <= cols; c += 1) {
      windows.push({
        wx: x + c * cellW - windowSize / 2,
        wy: y + f * cellH - windowSize / 2,
      });
    }
  }

  // Window glow alpha comes from the same 0..1 `windowGlow` metric.
  const glowAlpha = 0.4 + Math.min(1, building.windowGlow) * 0.6;

  // Crown: a yellow triangle capping the roof when verified.
  const crownHeight = building.hasGoldCrown ? Math.min(w * 0.6, size * 0.12) : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`Pixel silhouette of @${building.username}'s building`}
      style={{ display: 'block' }}
    >
      {/* Ground line */}
      <line
        x1={size * 0.05}
        x2={size * 0.95}
        y1={baseY + 2}
        y2={baseY + 2}
        stroke={theme.gridLine}
        strokeWidth={2}
      />

      {/* Building body */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={building.color}
        stroke={theme.buildingAccent}
        strokeWidth={2}
        shapeRendering="crispEdges"
      />

      {/* Crown triangle (verified-only) */}
      {building.hasGoldCrown && (
        <polygon
          points={`${x + w / 2},${y - crownHeight} ${x + w * 0.1},${y} ${x + w * 0.9},${y}`}
          fill={theme.crown}
          stroke={theme.crown}
          strokeWidth={2}
          shapeRendering="crispEdges"
        />
      )}

      {/* Window grid */}
      {windows.map((win, i) => (
        <rect
          key={i}
          x={win.wx}
          y={win.wy}
          width={windowSize}
          height={windowSize}
          fill={theme.windowGlow}
          opacity={glowAlpha}
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  );
}
