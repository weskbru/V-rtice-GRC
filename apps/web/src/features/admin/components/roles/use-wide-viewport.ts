'use client';

import { useSyncExternalStore } from 'react';

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

export function useWideViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
