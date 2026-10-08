import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface ReadOnlyFieldProps {
  label: string;
  value: ReactNode;
  full?: boolean;
  muted?: boolean;
  className?: string;
}

export function ReadOnlyField({
  label,
  value,
  full = false,
  muted = false,
  className,
}: ReadOnlyFieldProps): React.JSX.Element {
  return (
    <div className={cn(full ? 'sm:col-span-2' : undefined, className)}>
      <dt
        className={cn(
          'font-medium tracking-wide text-muted-foreground uppercase',
          muted ? 'text-[0.6875rem]' : 'text-xs',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'whitespace-pre-wrap text-foreground',
          muted ? 'text-sm text-foreground/80' : 'text-sm',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
