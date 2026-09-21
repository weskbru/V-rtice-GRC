/**
 * Compact attention metric. Icon, left edge and faint wash share the same
 * contextual family; the visible title and context describe the condition.
 * Zero/undefined remain neutral; undefined renders as no data, never as zero.
 * Text, destinations, figure size, wrapping and touch targets remain unchanged.
 */
import { ArrowRight } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Card, CardContent } from '@/components/ui/card';
import { dashboard } from '@/lib/messages/dashboard';
import { cn } from '@/lib/utils';

import { DashboardIconChip } from './dashboard-icon-chip';
import styles from './dashboard-surfaces.module.css';

import type { DashboardTone } from './dashboard-icon-chip';
import type { LucideIcon } from 'lucide-react';

export interface DashboardStatCardProps {
  title: string;
  icon: LucideIcon;
  /** Contextual family shared by icon, wash and left edge — the only colour prop this card has. */
  contextTone: DashboardTone;
  /** `undefined` means the source reported no data — rendered distinctly from `0`. */
  value: number | undefined;
  /** Short line under the number that says what it counts. May wrap to two lines. */
  contextLabel: string;
  link?: { path: string; label: string };
}

/** The left accent stripe's border colour — full class strings spelled out, never interpolated. */
const TONE_STRIPE_CLASSES: Readonly<Record<DashboardTone, string>> = {
  teal: 'border-l-tint-teal-fg',
  blue: 'border-l-tint-blue-fg',
  red: 'border-l-tint-red-fg',
  violet: 'border-l-tint-violet-fg',
  amber: 'border-l-tint-amber-fg',
  indigo: 'border-l-tint-indigo-fg',
  orange: 'border-l-tint-orange-fg',
  green: 'border-l-tint-green-fg',
};

export function DashboardStatCard({
  title,
  icon,
  contextTone,
  value,
  contextLabel,
  link,
}: DashboardStatCardProps): React.JSX.Element {
  const idle = value === undefined || value === 0;

  return (
    <Card
      className={cn(
        'h-full flex-row items-stretch gap-0 overflow-hidden py-0',
        styles.stat,
        !idle && 'border-l-4',
        !idle && TONE_STRIPE_CLASSES[contextTone],
      )}
      data-attention={idle ? 'idle' : 'active'}
      data-context={idle ? undefined : contextTone}
    >
      <CardContent className="flex flex-1 flex-col gap-0.5 p-1.5 pb-1">
        <div className="flex items-center gap-1.5">
          <DashboardIconChip icon={icon} tone={contextTone} idle={idle} size="sm" />
          <h3 className="text-sm leading-tight font-medium text-foreground">{title}</h3>
        </div>

        <div className="flex flex-col gap-0">
          {value === undefined ? (
            <>
              <p className="text-3xl font-semibold text-muted-foreground">—</p>
              <p className="text-xs leading-tight text-muted-foreground">
                {dashboard.states.noData}
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-semibold text-foreground">
                {value.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">{contextLabel}</p>
            </>
          )}
        </div>

        {link ? (
          <Link
            href={link.path}
            className="group mt-auto inline-flex w-fit min-h-6 items-center gap-1 rounded-sm text-xs font-medium text-primary-on-surface hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {link.label}
            <ArrowRight
              aria-hidden="true"
              className="size-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
