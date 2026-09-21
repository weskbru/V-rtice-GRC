'use client';

import { useEffect, useRef, useState } from 'react';

export interface DelayedVisibilityOptions {
  /** How long `active` must stay true before anything is shown. An operation that settles sooner never flashes an indicator. */
  delayMs?: number;
  /** Once shown, the shortest time it stays up, so a result that lands just after the delay does not blink the indicator away. */
  minVisibleMs?: number;
}

/**
 * Default timing for the institutional loader (`specs/014-institutional-loader`
 * §2): below ~200 ms a response already reads as immediate, so an indicator
 * there is noise; once one does appear, keeping it ~400 ms avoids a
 * one-frame blink when the result arrives right after the delay.
 */
export const LOADER_DELAY_MS = 200;
export const LOADER_MIN_VISIBLE_MS = 400;

/**
 * Turns a raw "is something pending" flag into "should an indicator be on
 * screen": nothing for the first `delayMs`, and once visible, at least
 * `minVisibleMs` on screen. A new `active` during that minimum window keeps it
 * up rather than restarting the delay.
 */
export function useDelayedVisibility(
  active: boolean,
  {
    delayMs = LOADER_DELAY_MS,
    minVisibleMs = LOADER_MIN_VISIBLE_MS,
  }: DelayedVisibilityOptions = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      if (visible) return undefined;
      const timer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }

    if (!visible) return undefined;
    const shownFor = Date.now() - (shownAtRef.current ?? 0);
    const timer = setTimeout(
      () => {
        shownAtRef.current = null;
        setVisible(false);
      },
      Math.max(0, minVisibleMs - shownFor),
    );
    return () => clearTimeout(timer);
  }, [active, visible, delayMs, minVisibleMs]);

  return visible;
}
