'use client';

import { useRef } from 'react';

import type { RefObject } from 'react';

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
  FocusRestoreAnchor: typeof FocusRestoreAnchor;
  restoreTargetRef: RefObject<HTMLElement | null>;
  handleCloseAutoFocus: (event: Event) => void;
}

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
