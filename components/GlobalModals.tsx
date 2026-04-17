'use client';

import ClaimModal from './ClaimModal';

/**
 * Tiny client wrapper so <ClaimModal> can be mounted from the
 * server-rendered root layout. Keeping the mount in one place means
 * any button across the app can flip `claimModalOpen` on
 * `useCityStore` and get the same modal.
 */
export default function GlobalModals() {
  return <ClaimModal />;
}
