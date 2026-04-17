'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import PixelButton from './PixelButton';
import BuildingThumb from './BuildingThumb';
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

  // Reset copied state when the modal reopens
  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  const shareUrl = `https://tweetcity.example/u/${stats.username}`;

  const download = async () => {
    if (!cardRef.current) return;
    setWorking(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      // html2canvas doesn't rasterize WebGL canvases — we render the
      // 3D thumb off-stage, then html2canvas captures everything else
      // and we composite the canvas contents on top manually.
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: theme.background,
        useCORS: true,
        logging: false,
        scale: 1,
      });

      const webglCanvas = cardRef.current.querySelector('canvas');
      if (webglCanvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Compute placement matching where the thumb sits in the card
          const card = cardRef.current.getBoundingClientRect();
          const thumb = (webglCanvas as HTMLCanvasElement).getBoundingClientRect();
          const x = thumb.left - card.left;
          const y = thumb.top - card.top;
          try {
            ctx.drawImage(
              webglCanvas as HTMLCanvasElement,
              x,
              y,
              thumb.width,
              thumb.height,
            );
          } catch {
            // ignore — some browsers taint-protect WebGL canvases
          }
        }
      }

      const link = document.createElement('a');
      link.download = `${stats.username}-tweetcity.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
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

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                {/* Mini 3D canvas — html2canvas can't rasterize WebGL
                    directly, so download() composites it on top after. */}
                <BuildingThumb
                  building={building}
                  theme={theme}
                  size={480}
                  eager
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
