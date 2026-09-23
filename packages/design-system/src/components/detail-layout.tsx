import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

export interface DetailLayoutProps {
  header: ReactNode;
  summary?: ReactNode;
  asideLead?: ReactNode;
  navigation: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  asideLabel?: string;
  className?: string;
}

export function DetailLayout({
  header,
  summary,
  asideLead,
  navigation,
  children,
  aside,
  asideLabel,
  className,
}: DetailLayoutProps): React.JSX.Element {
  const hasAsideColumn = Boolean(asideLead) || Boolean(aside);
  const AsideWrapper = asideLabel ? 'aside' : 'div';

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {header}
      {summary ? <div className="flex flex-col gap-4">{summary}</div> : null}

      {asideLead ? <div className="flex flex-col gap-4 xl:hidden">{asideLead}</div> : null}

      <div
        className={cn(
          'flex flex-col gap-6',
          hasAsideColumn && 'xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-6',
        )}
      >
        {hasAsideColumn ? (
          <AsideWrapper
            aria-label={asideLabel}
            className="hidden xl:order-2 xl:sticky xl:top-4 xl:flex xl:flex-col xl:gap-4"
          >
            {asideLead}
            {aside}
          </AsideWrapper>
        ) : null}
        <div className="flex min-w-0 flex-col gap-4 xl:order-1">
          {navigation}
          {children}
        </div>
      </div>

      {aside ? <div className="flex flex-col gap-4 xl:hidden">{aside}</div> : null}
    </div>
  );
}
