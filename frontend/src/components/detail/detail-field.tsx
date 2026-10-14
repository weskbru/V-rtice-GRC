import { cn } from '@/lib/utils';
import { EmptyValue } from '@vertice/design-system/components';

import type { ComponentType, ReactNode, SVGProps } from 'react';

export interface DetailFieldProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: ReactNode | null;
  emptyLabel: string;
  muted?: boolean;
}

export function DetailField({
  icon: Icon,
  label,
  value,
  emptyLabel,
  muted = false,
}: DetailFieldProps): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt
        className={cn(
          'flex items-center gap-2.5 font-medium tracking-wide text-muted-foreground uppercase',
          muted ? 'text-[0.6875rem]' : 'text-xs',
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <Icon className="size-3.5" />
        </span>
        {label}
      </dt>
      <dd
        className={cn(
          'whitespace-pre-wrap pl-[38px]',
          muted ? 'text-sm text-foreground/80' : 'text-sm text-foreground',
        )}
      >
        {value ?? <EmptyValue>{emptyLabel}</EmptyValue>}
      </dd>
    </div>
  );
}
