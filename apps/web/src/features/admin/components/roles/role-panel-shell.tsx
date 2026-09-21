'use client';

/**
 * PharosGRC — Administration, the two presentations every roles panel has
 * (015-roles-permissions-surface FR-010; extracted in Fase 1 de "Novo
 * papel", when a second panel started needing exactly the same pair).
 *
 * `DetailPanel` (design system, 015 D-04) owns the structure — fixed
 * header, scrolling body, fixed footer — and deliberately does NOT choose
 * between the two modes: `packages/design-system` must not know this app's
 * `Sheet`. The choice is made here, once, from `useWideViewport`:
 *
 * - `xl` and wider — non-modal, a cell of the page grid beside the list,
 *   which stays visible and operable (FR-010). The panel owns its own
 *   `Escape` and focus restoration, because nothing modal is underneath it.
 * - below `xl` — an overlay `Sheet`, which owns the backdrop, the focus
 *   trap, `Escape` and (since 015's D-15 fix) returning focus to whatever
 *   opened it.
 *
 * ## The height the inline panel is actually given
 *
 * `DetailPanel`'s own inline cap is `calc(100vh - 6rem)`, which assumes the
 * page scrolls. In this shell it does not: `html`/`body` are
 * `overflow: hidden` and `<main>` is the only scrolling region, sitting
 * under a 3.5rem header (`app-shell.tsx`, `globals.css`). Stuck at
 * `top-4` inside that region, the height genuinely available is
 * `100svh - 3.5rem - 1rem`; the cap below keeps the fixed footer inside the
 * visible area instead of just below it, and uses `svh` so a mobile
 * browser's collapsing toolbar cannot make `vh` lie.
 *
 * This component holds no strings of its own: every label arrives by prop
 * from `lib/messages/admin.ts` (CLAUDE.md §11.1).
 */
import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

import { useWideViewport } from './use-wide-viewport';

import type { ReactNode } from 'react';

export interface RolePanelShellProps {
  /** Accessible name of the panel region, in both presentations. */
  ariaLabel: string;
  /** Accessible name of the overlay dialog. Visually hidden: the panel's own header already names what is inside. */
  overlayTitle: string;
  /** Accessible name of the inline close button. The overlay renders its own close control instead. */
  closeLabel: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

export function RolePanelShell({
  ariaLabel,
  overlayTitle,
  closeLabel,
  header,
  footer,
  children,
  onClose,
}: RolePanelShellProps): React.JSX.Element {
  const isWide = useWideViewport();

  // Two explicit branches rather than a spread: `DetailPanel`'s close
  // affordance is a PAIR in a union of prop types (handler and label
  // together, or neither), and TypeScript cannot narrow a union through a
  // conditional spread. Writing both out keeps the pair checked.
  const panel = isWide ? (
    <DetailPanel
      mode="inline"
      ariaLabel={ariaLabel}
      header={header}
      footer={footer}
      onClose={onClose}
      closeLabel={closeLabel}
      // Measured, not guessed: the shell's header is `h-14` (3.5rem) and the
      // content column's own bottom padding is `py-6` (1.5rem), so the tallest
      // a panel stuck inside `<main>` can be without its fixed footer sliding
      // under the fold at the very bottom of the scroll is exactly
      // `100svh - 5rem`. `svh`, not `vh`, so a mobile browser's collapsing
      // toolbar cannot make the unit lie.
      className="xl:sticky xl:top-4 xl:max-h-[calc(100svh-5rem)]"
    >
      {children}
    </DetailPanel>
  ) : (
    // No close pair in overlay mode: the sheet renders its own close
    // control, and a second one in the header would be a duplicate.
    <DetailPanel mode="overlay" ariaLabel={ariaLabel} header={header} footer={footer}>
      {children}
    </DetailPanel>
  );

  if (isWide) return panel;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        // The panel's own header names the region; a second visible title
        // would repeat it. Radix still requires a `Title` for the dialog's
        // accessible name, so it is present and `sr-only`, and
        // `aria-describedby` is explicitly cleared rather than left dangling
        // at a description this sheet does not render.
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetTitle className="sr-only">{overlayTitle}</SheetTitle>
        {panel}
      </SheetContent>
    </Sheet>
  );
}
