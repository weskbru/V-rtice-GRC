'use client';

import { KeyRound, LockKeyhole, UserCog, Users } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';
import { SummaryStatCard } from '@vertice/design-system/components';

import type { RolesSummary, RoleTypeFilter } from '../../types';
import type { ComponentType, SVGProps } from 'react';

export interface RoleAdminSummaryProps {
  summary: RolesSummary | null;
  isLoading: boolean;
  hasError: boolean;
  activeType: RoleTypeFilter;
  onSelectType: (type: RoleTypeFilter) => void;
  className?: string;
}

interface IndicatorDefinition {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly tone: 'neutral' | 'info';
  readonly value: number | undefined;
  readonly filter: RoleTypeFilter | undefined;
  readonly filterLabel: string | undefined;
}

function buildIndicators(summary: RolesSummary | null): readonly IndicatorDefinition[] {
  const messages = admin.roles.summary;
  return [
    {
      key: 'total',
      label: messages.total.label,
      hint: messages.total.hint,
      icon: KeyRound,
      tone: 'info',
      value: summary?.totalRoles,
      filter: 'all',
      filterLabel: messages.total.filterLabel,
    },
    {
      key: 'system',
      label: messages.system.label,
      hint: messages.system.hint,
      icon: LockKeyhole,
      tone: 'neutral',
      value: summary?.systemRoles,
      filter: 'system',
      filterLabel: messages.system.filterLabel,
    },
    {
      key: 'custom',
      label: messages.custom.label,
      hint: messages.custom.hint,
      icon: UserCog,
      tone: 'neutral',
      value: summary?.customRoles,
      filter: 'custom',
      filterLabel: messages.custom.filterLabel,
    },
    {
      key: 'usersWithRoles',
      label: messages.usersWithRoles.label,
      hint: messages.usersWithRoles.hint,
      icon: Users,
      tone: 'neutral',
      value: summary?.usersWithRoles,
      filter: undefined,
      filterLabel: undefined,
    },
  ];
}

export function RoleAdminSummary({
  summary,
  isLoading,
  hasError,
  activeType,
  onSelectType,
  className,
}: RoleAdminSummaryProps): React.JSX.Element {
  const messages = admin.roles.summary;

  if (hasError) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{messages.loadError}</p>;
  }

  return (
    <section
      aria-label={messages.regionLabel}
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {buildIndicators(summary).map((indicator) => {
        const isActive = indicator.filter !== undefined && indicator.filter === activeType;
        const narrows = isActive && indicator.filter !== 'all';
        const card = (
          <SummaryStatCard
            label={indicator.label}
            value={indicator.value !== undefined ? messages.value(indicator.value) : ''}
            hint={narrows ? `${indicator.hint} · ${messages.activeLabel}` : indicator.hint}
            icon={indicator.icon}
            tone={indicator.tone}
            isLoading={isLoading}
            className={cn(
              'h-full',
              isActive && 'border-primary border-l-4 bg-accent/40 dark:bg-accent/20',
            )}
          />
        );

        if (indicator.filter === undefined || indicator.filterLabel === undefined) {
          return (
            <div key={indicator.key} className="h-full">
              {card}
            </div>
          );
        }

        const filter = indicator.filter;
        return (
          <button
            key={indicator.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectType(filter)}
            className="group h-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="sr-only">{indicator.filterLabel}</span>
            {card}
          </button>
        );
      })}
    </section>
  );
}
