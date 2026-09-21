import { useEffect } from 'react';

import type { RefObject } from 'react';

/**
 * Closes an open disclosure panel (`MultiSelectFilter`, `ColumnVisibilityMenu`)
 * on an outside click or `Escape`. Shared instead of duplicated so both
 * components close identically.
 *
 * Deliberately implemented with a real, always-a-`<button>` trigger and a
 * manually-controlled panel rather than the native `<details>/<summary>`
 * disclosure element: `<summary>` has no reliable, cross-browser accessible
 * role (Playwright's `getByRole('button', ...)` cannot be trusted to find
 * it consistently across the Chromium/Firefox/WebKit projects this
 * platform's E2E suite runs against — `playwright.config.ts`), which this
 * platform's E2E suite would otherwise depend on. A real `<button>` with
 * `aria-haspopup`/`aria-expanded`/`aria-controls` has no such ambiguity.
 */
export function useDisclosureClose(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // `containerRef` is a ref object (stable identity) and `onClose` is a
    // trivial `() => setOpen(false)` recreated every render but always
    // calling the same stable `setOpen` — depending only on `open` avoids
    // tearing the listeners down and back up on every parent re-render
    // while the panel is open.
  }, [open]);
}
