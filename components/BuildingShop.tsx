'use client';

import { clsx } from 'clsx';
import { useMemo, useState } from 'react';
import Modal from './Modal';
import PixelButton from './PixelButton';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CosmeticCategory,
  cosmeticsByCategory,
} from '@/lib/cosmetics';
import { useSocialStore } from '@/lib/social';
import FormattedNumber from './FormattedNumber';

interface BuildingShopProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Cosmetic item picker. Four tabs (antenna / flag / windows / aura).
 *
 * Each tab renders every cosmetic in that category:
 *   - preview swatch
 *   - label + price
 *   - BUY button when not yet owned (disabled if balance insufficient)
 *   - EQUIP / EQUIPPED when owned
 *
 * Current balance is shown in the modal header. Balance updates
 * reactively as the user shops.
 */
export default function BuildingShop({ open, onClose }: BuildingShopProps) {
  const [tab, setTab] = useState<CosmeticCategory>('antenna');
  const catalog = useMemo(() => cosmeticsByCategory(), []);
  const claimed = useSocialStore((s) => s.claimed);
  const buy = useSocialStore((s) => s.buyCosmetic);
  const equip = useSocialStore((s) => s.equip);

  if (!claimed) return null;

  return (
    <Modal open={open} onClose={onClose} title="Building Shop" maxWidth="max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-xs">
        <div className="text-text-muted uppercase tracking-widest text-[10px]">
          Balance
        </div>
        <div className="text-accent-cyan text-sm">
          <FormattedNumber value={claimed.kudosBalance} /> <span aria-hidden>✨</span>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Cosmetic categories"
        className="flex gap-1 border-b border-text-muted/30 mb-4"
      >
        {CATEGORY_ORDER.map((cat) => {
          const active = cat === tab;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`shop-panel-${cat}`}
              id={`shop-tab-${cat}`}
              onClick={() => setTab(cat)}
              className={clsx(
                'px-3 py-1.5 text-[10px] uppercase tracking-widest border-[2px] border-b-0',
                '-mb-px transition-colors',
                active
                  ? 'border-accent-cyan text-accent-cyan bg-bg-secondary'
                  : 'border-transparent text-text-muted hover:text-text-primary',
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      <div
        id={`shop-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`shop-tab-${tab}`}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        {catalog[tab].map((c) => {
          const owned = claimed.ownedCosmetics.includes(c.id);
          const equipped = claimed.equipped[c.category] === c.id;
          const affordable = claimed.kudosBalance >= c.price;
          return (
            <div
              key={c.id}
              className="border-[2px] border-text-muted/40 bg-bg-secondary p-3 flex flex-col gap-2"
            >
              <div
                className="w-full aspect-square border-[2px] border-text-muted/40 flex items-center justify-center"
                aria-label={`Preview swatch for ${c.label}`}
                style={{
                  background: `radial-gradient(circle at 50% 60%, ${c.preview} 0%, #000 85%)`,
                }}
              />
              <div>
                <div className="text-[11px] text-text-primary uppercase tracking-wider truncate">
                  {c.label}
                </div>
                <div className="text-[10px] text-text-muted leading-snug">
                  {c.description}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2">
                <div className="text-[10px] text-text-muted">
                  {c.price} <span aria-hidden>✨</span>
                </div>
                {owned ? (
                  <PixelButton
                    size="sm"
                    variant={equipped ? 'glow' : 'default'}
                    onClick={() => equip(c.id)}
                    disabled={equipped}
                  >
                    {equipped ? 'Equipped' : 'Equip'}
                  </PixelButton>
                ) : (
                  <PixelButton
                    size="sm"
                    variant="default"
                    disabled={!affordable}
                    onClick={() => buy(c.id)}
                  >
                    {affordable ? 'Buy' : 'Low ✨'}
                  </PixelButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
