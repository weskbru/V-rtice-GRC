import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type DashboardTone =
  'teal' | 'blue' | 'red' | 'violet' | 'amber' | 'indigo' | 'orange' | 'green';

const TONE_CLASSES: Readonly<Record<DashboardTone, string>> = {
  teal: 'bg-tint-teal-bg text-tint-teal-fg',
  blue: 'bg-tint-blue-bg text-tint-blue-fg',
  red: 'bg-tint-red-bg text-tint-red-fg',
  violet: 'bg-tint-violet-bg text-tint-violet-fg',
  amber: 'bg-tint-amber-bg text-tint-amber-fg',
  indigo: 'bg-tint-indigo-bg text-tint-indigo-fg',
  orange: 'bg-tint-orange-bg text-tint-orange-fg',
  green: 'bg-tint-green-bg text-tint-green-fg',
};

const TONE_TEXT_CLASSES: Readonly<Record<DashboardTone, string>> = {
  teal: 'text-tint-teal-fg',
  blue: 'text-tint-blue-fg',
  red: 'text-tint-red-fg',
  violet: 'text-tint-violet-fg',
  amber: 'text-tint-amber-fg',
  indigo: 'text-tint-indigo-fg',
  orange: 'text-tint-orange-fg',
  green: 'text-tint-green-fg',
};

export const TONE_ACCENT_CLASSES: Readonly<Record<DashboardTone, string>> = {
  teal: 'bg-tint-teal-fg/45',
  blue: 'bg-tint-blue-fg/45',
  red: 'bg-tint-red-fg/45',
  violet: 'bg-tint-violet-fg/45',
  amber: 'bg-tint-amber-fg/45',
  indigo: 'bg-tint-indigo-fg/45',
  orange: 'bg-tint-orange-fg/45',
  green: 'bg-tint-green-fg/45',
};

export interface DashboardIconChipProps {
  icon: LucideIcon;
  tone: DashboardTone;
  idle?: boolean;
  size?: 'sm' | 'md';
  variant?: 'chip' | 'flat';
}

export function DashboardIconChip({
  icon: Icon,
  tone,
  idle = false,
  size = 'md',
  variant = 'chip',
}: DashboardIconChipProps): React.JSX.Element {
  return (
    <span
      data-tone={idle ? 'idle' : tone}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        size === 'md' ? 'size-9' : 'size-8',
        idle
          ? 'bg-muted text-muted-foreground'
          : variant === 'flat'
            ? TONE_TEXT_CLASSES[tone]
            : TONE_CLASSES[tone],
      )}
    >
      <Icon aria-hidden="true" className={size === 'md' ? 'size-[18px]' : 'size-4'} />
    </span>
  );
}
