'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { resolveDialogRestoreTarget } from '../lib/use-restore-focus';
import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

export type DetailPanelMode = 'inline' | 'overlay';

type DetailPanelCloseProps =
  | {
      onClose: () => void;
      closeLabel: string;
    }
  | { onClose?: undefined; closeLabel?: undefined };

export type DetailPanelProps = DetailPanelCloseProps & {
  ariaLabel: string;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  mode?: DetailPanelMode;
  className?: string;
};

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
  }, [isInline]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
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
          ? 'max-h-[calc(100vh-6rem)] rounded-lg border border-border bg-card'
          : 'h-full bg-transparent',
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
