'use client';

import { useEffect, useRef, useState } from 'react';

export interface DelayedVisibilityOptions {
  delayMs?: number;
  minVisibleMs?: number;
}

export const LOADER_DELAY_MS = 200;
export const LOADER_MIN_VISIBLE_MS = 400;

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
