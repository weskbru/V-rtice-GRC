import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// `test.globals` is deliberately off (see vitest.config.ts), so Testing
// Library's automatic per-test cleanup — which only self-registers when it
// detects a global `afterEach` — never fires on its own. Registering it
// explicitly here is required, or DOM from one test in a file leaks into
// the next (e.g. `it.each` producing multiple `role="status"` matches).
afterEach(() => {
  cleanup();
});

// jsdom does not implement these; Radix UI primitives (Dialog, Select, ...)
// feature-detect them at runtime, so a minimal no-op polyfill is enough for
// component tests that only assert rendered output, not real layout/scroll.
/* eslint-disable @typescript-eslint/no-empty-function -- deliberate no-op polyfills, not a mistake */
if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverPolyfill {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    // @ts-expect-error -- test-environment polyfill, not a spec-accurate implementation
    window.ResizeObserver = ResizeObserverPolyfill;
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // jsdom has no layout engine and does not implement a working
  // `matchMedia` (the property exists but is not a callable function,
  // so calling it throws `TypeError: window.matchMedia is not a
  // function`). Default to "matches: true" — i.e. every component that
  // branches on a
  // `(min-width: ...)` query behaves as it did before that query existed
  // (desktop-shaped) unless a test deliberately overrides `matchMedia`
  // (see `components/shell/sidebar.test.tsx` for the narrow-viewport
  // override pattern).
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
/* eslint-enable @typescript-eslint/no-empty-function */
