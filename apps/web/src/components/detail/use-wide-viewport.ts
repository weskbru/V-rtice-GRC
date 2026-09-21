'use client';

/**
 * PharosGRC — shared detail-screen "is the viewport wide enough to render a
 * contextual aside as plain stacked sections instead of a collapsed
 * accordion?" originally built for risk detail
 * (016-risk-detail-experience §4.1).
 *
 * ## Promotion (018-incident-detail-experience)
 *
 * Moved here, verbatim in behaviour, from
 * `features/risks/components/detail/use-wide-viewport.ts`. The promotion is
 * earned, not speculative (CLAUDE.md §19.10): Incidents' own detail screen
 * (018-incident-detail-experience) is the second real consumer of this
 * exact `DetailLayout`-aside breakpoint mechanism. Consumer today:
 * `apps/web/src/features/risks/components/detail/risk-context-aside.tsx`,
 * plus the incident detail view being built in this same round.
 *
 * Deliberately NOT touched by this promotion:
 * `features/admin/components/roles/use-wide-viewport.ts`. It reads the same
 * breakpoint for an unrelated screen (the roles list/detail split,
 * 015-roles-permissions-surface FR-010) that was never asked to move in
 * this round, and CLAUDE.md §19.4's "reuse before creating" cuts both ways
 * — rewiring a working, unrelated screen onto shared infrastructure it
 * never asked for is exactly the kind of generalization this phase was told
 * not to do. It stays exactly as it is, a small deliberate duplicate.
 */
import { useSyncExternalStore } from 'react';

/** Tailwind's `xl` — the breakpoint at which `DetailLayout`'s aside sits beside the main column instead of above it. */
const WIDE_VIEWPORT_QUERY = '(min-width: 1280px)';

function subscribe(onStoreChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(WIDE_VIEWPORT_QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(WIDE_VIEWPORT_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return true;
}

/** `true` when the viewport is `xl` or wider. */
export function useWideViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
