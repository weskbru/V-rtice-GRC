'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { resolveDialogRestoreTarget } from '../lib/use-restore-focus';
import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

/**
 * How the panel is being presented. The panel itself is the SAME structure
 * in both — fixed header, scrolling body, fixed footer — because the two
 * modes differ only in who owns the surface it is painted on:
 *
 * - `'inline'` — the panel is a cell of the caller's own grid, beside the
 *   list it details (`xl` and wider). Nothing is modal: the list stays
 *   visible and operable, there is no overlay and no focus trap, so the
 *   panel carries its own border/background, its own `Escape` handling and
 *   its own focus restoration (see below).
 * - `'overlay'` — the panel fills a modal container the CALLER provides
 *   (this platform's `Sheet`, below `xl`). That container already owns the
 *   backdrop, the focus trap, `Escape`, and — since `sheet.tsx`'s D-15
 *   focus fix — restoring focus to whatever opened it. So in this mode the
 *   panel deliberately does NOT re-implement any of that: it only stretches
 *   to the height it is given and drops its own border, which would
 *   otherwise draw a second frame inside the sheet's.
 *
 * This package must not depend on `apps/web`, so `DetailPanel` never
 * imports `Sheet` and never decides which mode applies — the caller reads
 * its own breakpoint and composes.
 */
export type DetailPanelMode = 'inline' | 'overlay';

/**
 * Close affordance, as a pair or not at all — never a labelled button with
 * no handler, and never a handler with a nameless icon button. D-10: this
 * package carries no user-facing strings, so `closeLabel` has no default
 * and must come from the caller's own pt-BR catalogue whenever the button
 * is rendered at all.
 *
 * Omit both in `'overlay'` mode, where the sheet renders its own close
 * control and a second one inside the header would be a duplicate.
 */
type DetailPanelCloseProps =
  | {
      /** Invoked by the header's close button and by `Escape` in `'inline'` mode. */
      onClose: () => void;
      /** Accessible name of the close button, e.g. "Fechar painel". */
      closeLabel: string;
    }
  | { onClose?: undefined; closeLabel?: undefined };

export type DetailPanelProps = DetailPanelCloseProps & {
  /**
   * Accessible name for the panel region, e.g. "Detalhe do papel".
   * Required, never defaulted inside the component (D-10) — the region is
   * announced by name, and an unnamed complementary landmark is worse than
   * none.
   */
  ariaLabel: string;
  /**
   * Content of the fixed header: title, badges, counts. Stays put while the
   * body scrolls, so what the reader is looking at never loses its subject.
   */
  header: ReactNode;
  /** The scrolling body. This is the only part of the panel that scrolls. */
  children: ReactNode;
  /**
   * Fixed footer — primary action(s). Omitted entirely when absent, so a
   * read-only panel has no empty bar at its foot.
   */
  footer?: ReactNode;
  mode?: DetailPanelMode;
  className?: string;
};

/**
 * Structural shell for a detail panel presented beside — or over — the list
 * it details (015 D-04). It is a CASING, not a screen: it holds no domain
 * knowledge, no tabs, no fields and no strings. Every module that needs
 * "open the selected record without leaving the list" composes its own
 * content into this one structure, so the header/body/footer behaviour
 * (and the focus contract below) cannot drift between modules.
 *
 * ## Why the header and footer are fixed
 *
 * A role with the full permission catalogue, a risk with twelve sections —
 * the body genuinely overflows. When the whole panel scrolls instead, the
 * record's identity scrolls away with it and the primary action can end up
 * unreachable below the fold. `min-h-0` on the body is what actually makes
 * this work inside a flex column: without it, a flex item refuses to shrink
 * below its content's height and the container, not the body, is what
 * grows.
 *
 * ## Focus, in `'inline'` mode only
 *
 * A non-modal panel has no Radix underneath it, so nothing would otherwise
 * move focus into it when it opens or give focus back when it closes —
 * focus would simply stay on the card that was activated (leaving keyboard
 * users to tab through the whole list to reach what they just opened) and,
 * on close, fall to `<body>` exactly as `dialog.tsx`/`sheet.tsx` used to
 * (D-15, WCAG SC 2.4.3). So this mode captures what had focus on mount,
 * moves focus to the panel region, and hands it back on unmount when that
 * element is still in the document. The capture is resolved through
 * `resolveDialogRestoreTarget`, the same helper the dialog primitives use —
 * one mechanism for the platform, not a second one written here.
 *
 * In `'overlay'` mode all of that belongs to the modal container and is
 * deliberately skipped: doing it twice is how focus ends up fighting
 * itself.
 */
export function DetailPanel({
  ariaLabel,
  header,
  children,
  footer,
  mode = 'inline',
  onClose,
  closeLabel,
  className,
}: DetailPanelProps): React.JSX.Element {
  const regionRef = useRef<HTMLElement | null>(null);
  const isInline = mode === 'inline';

  useEffect(() => {
    if (!isInline) return;

    const restoreTarget = resolveDialogRestoreTarget(document.activeElement);
    regionRef.current?.focus();

    return () => {
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
    };
    // Mount/unmount only (`isInline` aside, which genuinely changes what
    // this effect does). The caller keys this component by the selected
    // record's id — the pattern `RiskQuickView` already established — so
    // "mount" and "a different record was selected" are the same event, and
    // depending on the record here would re-run the capture against focus
    // that is by then already inside the panel.
  }, [isInline]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    // Only in inline mode: the modal container owns Escape in overlay mode,
    // and handling it here as well would close the panel AND the sheet on a
    // single keypress.
    if (isInline && event.key === 'Escape' && onClose) {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <aside
      ref={regionRef}
      aria-label={ariaLabel}
      tabIndex={isInline ? -1 : undefined}
      onKeyDown={handleKeyDown}
      data-slot="detail-panel"
      data-mode={mode}
      className={cn(
        'flex min-h-0 w-full flex-col text-card-foreground outline-none',
        isInline
          ? // Height is content-driven, never `h-full`: the panel is a grid
            // cell beside the list, and stretching it to the grid's height
            // would defeat any `sticky` positioning the caller applies (a
            // box already as tall as its scroll container has nothing to
            // stick to). The border is the panel's own — a `bg-card`
            // surface with no edge reads as an unbounded region against the
            // page background.
            'max-h-[calc(100vh-6rem)] rounded-lg border border-border bg-card'
          : // The sheet already provides surface, edge and height.
            'h-full bg-transparent',
        className,
      )}
    >
      <div
        data-slot="detail-panel-header"
        className={cn(
          'flex shrink-0 items-start justify-between gap-3 border-b border-border p-4',
          !isInline && 'pr-12',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">{header}</div>
        {onClose && closeLabel ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            data-slot="detail-panel-close"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <div data-slot="detail-panel-body" className="min-h-0 flex-1 overflow-y-auto p-4">
        {children}
      </div>

      {footer ? (
        <div
          data-slot="detail-panel-footer"
          className="flex shrink-0 flex-col gap-2 border-t border-border p-4 sm:flex-row sm:justify-end"
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
