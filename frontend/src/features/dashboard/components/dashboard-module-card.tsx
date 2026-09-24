import { ArrowRight } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { DashboardIconChip, TONE_ACCENT_CLASSES } from './dashboard-icon-chip';

import type { DashboardTone } from './dashboard-icon-chip';
import type { LucideIcon } from 'lucide-react';

export type DashboardMetricTone = 'danger' | 'warning' | 'success' | 'info';

export interface DashboardModuleMetric {
  label: string;
  value: number | undefined;
  tone?: DashboardMetricTone;
  unit?: 'count' | 'percent';
}

export interface DashboardModuleCardProps {
  title: string;
  icon: LucideIcon;
  tone: DashboardTone;
  metrics: readonly DashboardModuleMetric[];
  link: { path: string; label: string };
}

const METRIC_TONE_CLASS: Readonly<Record<DashboardMetricTone, string>> = {
  danger: 'text-status-danger-fg',
  warning: 'text-status-warning-fg',
  success: 'text-status-success-fg',
  info: 'text-status-info-fg',
};

function formatMetric(metric: DashboardModuleMetric): string {
  if (metric.value === undefined) {
    return '—';
  }
  return metric.unit === 'percent'
    ? `${metric.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    : metric.value.toLocaleString('pt-BR');
}

export function DashboardModuleCard({
  title,
  icon,
  tone,
  metrics,
  link,
}: DashboardModuleCardProps): React.JSX.Element {
  return (
    <Card className="relative h-full gap-0 overflow-hidden py-0">
      <CardContent className="flex h-full flex-col gap-1.5 p-2">
        <div className="flex items-center gap-2.5">
          <DashboardIconChip icon={icon} tone={tone} size="sm" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>

        <dl className="flex flex-wrap items-start gap-x-4 gap-y-1.5 pr-6">
          {metrics.map((metric) => {
            const toned =
              metric.tone !== undefined && metric.value !== undefined && metric.value > 0;
            return (
              <div key={metric.label} className="flex min-w-min flex-1 flex-col-reverse gap-0.5">
                <dt className="text-xs leading-tight text-muted-foreground">{metric.label}</dt>
                <dd
                  className={cn(
                    'text-xl font-semibold',
                    toned && metric.tone ? METRIC_TONE_CLASS[metric.tone] : 'text-foreground',
                  )}
                >
                  {formatMetric(metric)}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>

      <Link
        href={link.path}
        aria-label={link.label}
        className="group absolute right-2 bottom-2 inline-flex size-6 items-center justify-center rounded-sm text-primary-on-surface hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </Link>

      <div aria-hidden="true" className={cn('h-0.5 w-full shrink-0', TONE_ACCENT_CLASSES[tone])} />
    </Card>
  );
}
