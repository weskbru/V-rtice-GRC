'use client';

import { useRef } from 'react';

import type { RefObject } from 'react';

/**
 * Given the DOM element that had focus immediately before a Radix
 * `Dialog`/`AlertDialog` content mounted, resolves the element focus should
 * return to once the dialog closes.
 *
 * Handles one indirect case: a dialog opened from a `DropdownMenuItem`'s
 * `onSelect` records the menu ITEM as the previously-focused element —
 * accurate at the instant of capture, but the item unmounts during the
 * menu's own exit animation, so by the time the caller tries to refocus it,
 * it is gone from the document and focus silently falls back to `<body>`.
 * Radix's `DropdownMenuContent` always sets `aria-labelledby={triggerId}` on
 * the menu container (confirmed in
 * `@radix-ui/react-dropdown-menu/dist/index.mjs:110`), so the menu's own
 * trigger button can be recovered from any of its items — substitute it in
 * immediately, while the menu (and its `aria-labelledby` attribute) is still
 * in the document.
 */
export function resolveDialogRestoreTarget(candidate: Element | null): HTMLElement | null {
  if (!(candidate instanceof HTMLElement)) return null;

  const menu = candidate.closest('[role="menu"]');
  if (menu) {
    const triggerId = menu.getAttribute('aria-labelledby');
    const trigger = triggerId ? document.getElementById(triggerId) : null;
    if (trigger) return trigger;
  }

  return candidate;
}

/**
 * Mounted as the first child inside a Radix `Dialog.Content`/
 * `AlertDialog.Content` (i.e. below its internal `Presence` boundary, so it
 * remounts fresh every time the dialog transitions from closed to open —
 * never reused across two separate openings). Captures
 * `document.activeElement` — resolved through `resolveDialogRestoreTarget` —
 * during React's RENDER phase, before the commit phase that follows applies
 * any native `autoFocus` on a field inside the dialog.
 *
 * This ordering matters: capturing in a Radix `onOpenAutoFocus` handler (as
 * this package used to) runs AFTER commit — by which point a field's
 * `autoFocus` has already moved focus onto itself, so the captured
 * "previous" element ends up being the dialog's own field, not the trigger
 * that opened it. Closing the dialog then tries to restore focus to an
 * element that no longer exists, and it silently falls back to `<body>`.
 * Render-phase capture, from a component distinct from any field that
 * carries `autoFocus`, always completes before ANY commit-phase work for the
 * same mount — React finishes the whole render phase (calling every
 * function component) before starting the commit phase — so it is immune to
 * that race regardless of where in the tree it sits.
 *
 * Renders nothing. Writing to a ref during render is unusual, but safe and
 * idempotent here: `capturedRef` guarantees the write happens at most once
 * per mount, and no render reads the ref back (only a later event handler
 * does), so this cannot make the component's own render impure in a way
 * that matters (React explicitly allows this "write-only, never read
 * during render" pattern for lazy one-time initialization).
 */
function FocusRestoreAnchor({
  restoreTargetRef,
}: {
  restoreTargetRef: RefObject<HTMLElement | null>;
}): null {
  const capturedRef = useRef(false);
  if (!capturedRef.current) {
    capturedRef.current = true;
    restoreTargetRef.current = resolveDialogRestoreTarget(document.activeElement);
  }
  return null;
}

export interface DialogFocusRestore {
  /** Render as the first child inside the dialog's `Content`, before any other children. */
  FocusRestoreAnchor: typeof FocusRestoreAnchor;
  /**
   * Pass as `FocusRestoreAnchor`'s `restoreTargetRef` prop. `FocusRestoreAnchor`
   * itself is a stable, module-level component reference (not recreated by
   * this hook on every call) so React only mounts/unmounts it when Radix's
   * `Presence` actually adds/removes it from the DOM — never merely because
   * the caller re-rendered while the dialog stayed open, which would
   * otherwise reset `FocusRestoreAnchor`'s own "captured once" guard and
   * overwrite the correct target with whatever currently has focus inside
   * the (already open) dialog.
   */
  restoreTargetRef: RefObject<HTMLElement | null>;
  /**
   * Pass to `Content`'s `onCloseAutoFocus`. Restores focus to the captured
   * element when it is still in the document, calling `event.preventDefault()`
   * to stop Radix's own default (focusing a registered `Dialog.Trigger` —
   * none of this platform's callers render one, see `dialog.tsx`). Falls
   * through to Radix's default otherwise (e.g. the captured element was
   * removed from the document for a reason other than the menu-item case
   * already handled above).
   */
  handleCloseAutoFocus: (event: Event) => void;
}

/**
 * Shared focus-restoration mechanism for every dialog built on Radix's
 * `Dialog`/`AlertDialog` primitives in this platform
 * (`apps/web/src/components/ui/dialog.tsx` and `ConfirmDialog`) — one
 * implementation, so both stay correct together instead of drifting.
 *
 * Usage:
 * ```tsx
 * const { FocusRestoreAnchor, handleCloseAutoFocus } = useDialogFocusRestore();
 * <DialogPrimitive.Content onCloseAutoFocus={handleCloseAutoFocus}>
 *   <FocusRestoreAnchor restoreTargetRef={restoreTargetRef} />
 *   {children}
 * </DialogPrimitive.Content>
 * ```
 */
export function useDialogFocusRestore(): DialogFocusRestore {
  const restoreTargetRef = useRef<HTMLElement | null>(null);

  function handleCloseAutoFocus(event: Event): void {
    const target = restoreTargetRef.current;
    if (target && document.contains(target) && typeof target.focus === 'function') {
      event.preventDefault();
      target.focus();
    }
  }

  return { FocusRestoreAnchor, restoreTargetRef, handleCloseAutoFocus };
}
