import { cn } from '../lib/utils';

import { StatusBadge } from './status-badge';

import type { StatusEmphasis } from './status-badge';

export interface ThresholdBreachBadgeProps {
  breached: boolean;
  label: string;
  emphasis?: StatusEmphasis;
  className?: string;
}

export function ThresholdBreachBadge({
  breached,
  label,
  emphasis = 'subtle',
  className,
}: ThresholdBreachBadgeProps): React.JSX.Element {
  return (
    <StatusBadge
      variant={breached ? 'danger' : 'success'}
      label={label}
      emphasis={emphasis}
      className={cn(className)}
    />
  );
}
