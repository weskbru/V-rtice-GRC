import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface EntityHeaderProps {
  /** Breadcrumb or back-navigation, rendered above the code/title. */
  breadcrumb?: ReactNode;
  /** The record's stable, human-readable code (e.g. `RSK-2026-0001`) — never the internal uuid. */
  code: string;
  /** The record's title. Rendered as the page's single <h1>. */
  title: string;
  /** Status/level indicators (e.g. `StatusBadge`, `RiskLevelBadge`) shown beside the code. */
  badges?: ReactNode;
  /** Secondary identity facts — owner, organizational unit, dates — rendered as a compact inline list under the title. */
  metadata?: ReactNode;
  /** Primary/secondary action buttons (owned by the caller — lifecycle transitions, edit, etc). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Platform-wide header for a single GRC record (T094, FR-045, FR-093). Every
 * business module's detail screen — risk today, a future problem, incident
 * or control — composes its header through this one component: an optional
 * breadcrumb, the record's code and status/level badges, a single <h1>
 * title, an optional metadata line, and a right-aligned action slot. Adding
 * a module never requires a new header pattern (SC-011).
 *
 * Deliberately distinct from `PageHeader`: a GRC record additionally has a
 * stable `code` and, typically, status/severity badges next to it — folding
 * those into `PageHeader` would force every non-entity page (dashboard,
 * settings, ...) to reason about fields it doesn't have.
 */
export function EntityHeader({
  breadcrumb,
  code,
  title,
  badges,
  metadata,
  actions,
  className,
}: EntityHeaderProps): React.JSX.Element {
  return (
    <header className={cn('flex flex-col gap-3 border-b border-border pb-4', className)}>
      {breadcrumb ? <div className="text-sm text-muted-foreground">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{code}</span>
            {badges}
          </div>
          {/*
           * `line-clamp-2` below `sm`, `truncate` (single line) at `sm` and
           * wider — 016-risk-detail-experience P7/V3: the record's title is
           * the answer to "what is this", and truncating it to one line on
           * a narrow phone ("Falha no fornecedor crític…") threw away
           * identity information no other part of a narrow layout repeats.
           * `sm:truncate` keeps every OTHER module's detail screen exactly
           * as it already renders at tablet/desktop widths this component
           * has always been used at — this only changes the narrow case.
           */}
          <h1 className="line-clamp-2 text-2xl font-semibold tracking-tight text-foreground sm:truncate">
            {title}
          </h1>
          {metadata ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {metadata}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
