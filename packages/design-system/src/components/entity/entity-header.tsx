import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface EntityHeaderProps {
  breadcrumb?: ReactNode;
  code: string;
  title: string;
  badges?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

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
