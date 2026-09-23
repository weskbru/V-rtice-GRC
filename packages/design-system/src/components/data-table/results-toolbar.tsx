'use client';

import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface ResultsToolbarProps {
  count: string;
  isLoading?: boolean;
  loadingLabel?: string;
  children?: ReactNode;
  className?: string;
}

export function ResultsToolbar({
  count,
  isLoading = false,
  loadingLabel,
  children,
  className,
}: ResultsToolbarProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3', className)}>
      <p className="min-w-0 text-sm font-medium text-foreground" role="status">
        {isLoading ? loadingLabel : count}
      </p>

      {children ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
