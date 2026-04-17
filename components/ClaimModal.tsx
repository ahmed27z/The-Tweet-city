'use client';

import { clsx } from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import PixelButton from './PixelButton';
import { useCityStore } from '@/lib/store';
import { useSocialStore } from '@/lib/social';
import { findUser } from '@/lib/mockData';

type Step = 'intro' | 'handle' | 'success';

/**
 * Mock Twitter-OAuth-style claim flow.
 *
 * Three screens:
 *  1. intro   — explainer + "CONTINUE WITH @X"
 *  2. handle  — enter/confirm handle, validated against mock data
 *  3. success — claimed, offers a 500 ✨ welcome bonus (idempotent)
 *
 * Fully self-contained: reads its open state from the city store, so
 * any button anywhere in the app can flip `claimModalOpen` and get the
 * same UX.
 *
 * Bonus idempotency
 * -----------------
 * The 500 ✨ bonus is credited via `grantWelcomeBonus(handle)` on the
 * store, which flips `welcomeBonusGranted[handle]` atomically. Once
 * set, any subsequent re-open of the modal for that handle renders
 * `ALREADY CLAIMED · +500 ✨` instead of the credit CTA — so closing
 * the modal before clicking the CTA doesn't lose the bonus, but
 * re-opening doesn't double-credit either.
 */
export default function ClaimModal() {
  const router = useRouter();
  const open = useCityStore((s) => s.claimModalOpen);
  const seed = useCityStore((s) => s.claimModalSeed);
  const setOpen = useCityStore((s) => s.setClaimModalOpen);
  const setSeed = useCityStore((s) => s.setClaimModalSeed);

  const claim = useSocialStore((s) => s.claim);
  const grantWelcomeBonus = useSocialStore((s) => s.grantWelcomeBonus);
  const claimed = useSocialStore((s) => s.claimed);
  const welcomeBonusGranted = useSocialStore((s) => s.welcomeBonusGranted);

  const [step, setStep] = useState<Step>('intro');
  const [handle, setHandle] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  // Reset step/input whenever the modal (re)opens. We only depend on
  // `open` so claim-state changes during the flow don't snap us back
  // to step 1.
  useEffect(() => {
    if (open) {
      setStep('intro');
      setHandle(seed ?? claimed?.username ?? '');
      setWarn(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onClose = () => {
    setOpen(false);
    setSeed(null);
    setToast(null);
  };

  const submitHandle = () => {
    const cleaned = handle.replace(/^@/, '').toLowerCase().trim();
    if (!cleaned) {
      setWarn('Enter a handle to continue.');
      return;
    }
    const resolved = findUser(cleaned);
    if (!resolved) {
      // Pretend-mode: we'd hit the real API in prod. Don't block the user.
      setWarn('Not in this mock city, but we\'ll pretend you own it. 🌃');
    }
    claim(cleaned);
    setStep('success');
  };

  // Pre-computed claimed handle (either just-set or already existing) so
  // the success step always has something to show even before the
  // store-update re-renders.
  const claimedHandle =
    claimed?.username ?? handle.replace(/^@/, '').toLowerCase().trim();

  const alreadyGotBonus =
    !!claimedHandle && welcomeBonusGranted[claimedHandle] === true;

  const grantBonus = () => {
    // Atomic check-and-credit. If another copy of this flow already
    // credited (or a stray click fired twice), `grantWelcomeBonus`
    // returns false and we just toast the existing state.
    const credited = grantWelcomeBonus(claimedHandle);
    showToast(
      credited
        ? 'WELCOME BONUS · +500 ✨'
        : 'ALREADY CLAIMED · +500 ✨',
    );
    // Close & navigate to the claimed building after a beat so the
    // toast is visible to the user.
    window.setTimeout(() => {
      onClose();
      if (claimed?.username) router.push(`/u/${claimed.username}`);
      else if (handle)
        router.push(
          `/u/${handle.replace(/^@/, '').toLowerCase().trim()}`,
        );
    }, 700);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const title = useMemo(() => {
    switch (step) {
      case 'intro':
        return 'Claim your building';
      case 'handle':
        return 'Connect with @X';
      case 'success':
        return 'You own a building in TweetCity';
    }
  }, [step]);

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
        {step === 'intro' && (
          <div className="space-y-4 text-xs text-text-primary leading-relaxed">
            <p>
              Every handle becomes a skyscraper. Claim yours to earn{' '}
              <span className="text-accent-cyan">✨ kudos</span>, customize your
              roof with antennas, flags &amp; auras, and invite friends.
            </p>
            <ul className="list-disc list-inside text-text-muted">
              <li>Starting balance: 50 ✨</li>
              <li>First claim ever: +500 ✨ welcome bonus</li>
              <li>Daily free drop: +5 ✨ on first kudos of the day</li>
            </ul>
            <PixelButton
              variant="glow"
              onClick={() => setStep('handle')}
              className="w-full"
            >
              Continue with @X
            </PixelButton>
          </div>
        )}

        {step === 'handle' && (
          <div className="space-y-3">
            <label
              htmlFor="claim-handle"
              className="block text-[10px] uppercase tracking-widest text-text-muted"
            >
              Your Twitter handle
            </label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2 border-[2px] border-r-0 border-accent-cyan bg-black text-accent-cyan text-xs">
                @
              </span>
              <input
                id="claim-handle"
                type="text"
                autoFocus
                value={handle}
                onChange={(e) => {
                  setWarn(null);
                  setHandle(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitHandle();
                }}
                placeholder="yourhandle"
                className={clsx(
                  'flex-1 px-3 py-2 bg-bg-secondary border-[2px] border-accent-cyan',
                  'text-xs text-text-primary placeholder:text-text-muted/50 outline-none',
                  'focus:shadow-[0_0_6px_#00d4ff]',
                )}
              />
            </div>
            {warn && (
              <div className="text-[10px] text-accent-amber">
                {warn}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <PixelButton
                variant="ghost"
                onClick={() => setStep('intro')}
              >
                Back
              </PixelButton>
              <PixelButton
                variant="glow"
                onClick={submitHandle}
                className="flex-1"
              >
                Continue
              </PixelButton>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 text-xs text-text-primary leading-relaxed">
            <p>
              🏗 <span className="text-accent-cyan">@{claimedHandle}</span>{' '}
              is now under your flag. Your building glows a little brighter
              for the next 24 hours.
            </p>
            <div className="border-[2px] border-accent-cyan/40 bg-bg-secondary p-3 text-[11px]">
              <div className="uppercase tracking-widest text-[10px] text-text-muted mb-1">
                Welcome bonus
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>+500 ✨ kudos</span>
                {alreadyGotBonus ? (
                  <span
                    aria-label="Welcome bonus already claimed"
                    className={clsx(
                      'px-3 py-2 text-[10px] uppercase tracking-widest',
                      'border-[2px] border-text-muted/40',
                      'text-text-muted cursor-not-allowed select-none',
                    )}
                  >
                    Already claimed · +500 ✨
                  </span>
                ) : (
                  <PixelButton
                    variant="glow"
                    size="sm"
                    onClick={grantBonus}
                  >
                    Give yourself 500 ✨
                  </PixelButton>
                )}
              </div>
            </div>
            <PixelButton variant="ghost" onClick={onClose} className="w-full">
              {alreadyGotBonus ? 'Close' : 'Skip'}
            </PixelButton>
          </div>
        )}
      </Modal>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-accent-cyan text-black text-xs tracking-widest uppercase shadow-[4px_4px_0_0_#000] pointer-events-none"
        >
          {toast}
        </div>
      )}
    </>
  );
}
