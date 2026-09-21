import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Page or section title. Rendered as an <h1> — every screen has exactly one. */
  title: string;
  /** Short supporting copy under the title. */
  description?: string;
  /** Breadcrumb or back-navigation, rendered above the title. */
  breadcrumb?: ReactNode;
  /** Primary/secondary action buttons (owned by the caller — PageHeader renders no buttons of its own). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Platform-wide page/section heading (FR-045: consistent patterns across
 * every module). Every screen composes it the same way: optional
 * breadcrumb, a single <h1>, optional description, and a right-aligned
 * action slot — so a new GRC module needs no new header pattern (SC-011).
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={cn('flex flex-col gap-3 border-b border-border pb-4', className)}>
      {breadcrumb ? <div className="text-sm text-muted-foreground">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
