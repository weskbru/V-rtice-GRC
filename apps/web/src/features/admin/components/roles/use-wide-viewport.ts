'use client';

/**
 * PharosGRC — Administration, "is there room for a non-modal panel beside
 * the list?" (015-roles-permissions-surface FR-010).
 *
 * The roles surface presents the SAME detail panel two ways: at `xl` and
 * wider it is a cell of the page's own grid, with the list still visible
 * and operable next to it; below that it is an overlay (`Sheet`) with a
 * focus trap and `Escape`. `DetailPanel` deliberately does not decide which
 * — it cannot, since `packages/design-system` must not know about this
 * app's `Sheet` — so the choice is made here, once, and the two callers of
 * it stay in step.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, mirroring
 * `components/shell/sidebar.tsx`'s own breakpoint read: `matchMedia` is an
 * external, mutable, browser-only source of truth, and this is React's own
 * primitive for exactly that. `getServerSnapshot` supplies the first-paint
 * value (the server has no viewport), and React reconciles it with the real
 * measurement after mount through an ordinary re-render — never a hydration
 * mismatch.
 *
 * The server snapshot is `true` (wide) on purpose: the panel is only ever
 * rendered in response to a click, i.e. long after hydration, so no first
 * paint ever shows the wrong one; and a test environment without a real
 * layout engine (jsdom, whose `matchMedia` stub answers `matches: true`)
 * then exercises the inline mode, which is the one with behaviour of its
 * own to cover.
 */
import { useSyncExternalStore } from 'react';

/** Tailwind's `xl`, the breakpoint `spec.md` FR-010 names. */
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

/** `true` when the viewport is `xl` or wider, i.e. when the detail panel may sit beside the list instead of over it. */
export function useWideViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
