'use client';

import { CalendarClock, CheckCircle2, CircleDot, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { dashboardApi } from '@/features/dashboard/api';
import { actions } from '@/lib/messages/actions';

import type { DashboardBreakdowns } from '@/features/dashboard/types';
import type { ComponentType, SVGProps } from 'react';

interface SummaryCardDefinition {
  key: string;
  label: string;
  hint: string;
  linkLabel: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  value: number | undefined;
}

type ActionsBreakdown = DashboardBreakdowns['actions'];

function buildCardDefinitions(data: ActionsBreakdown | undefined): SummaryCardDefinition[] {
  const summary = actions.myActions.summary;

  return [
    {
      key: 'open',
      label: summary.open.label,
      hint: summary.open.hint,
      linkLabel: summary.open.linkLabel,
      href: '/actions?status=OPEN&onlyMine=false',
      icon: CircleDot,
      tone: 'neutral',
      value: data?.byStatus.OPEN,
    },
    {
      key: 'inProgress',
      label: summary.inProgress.label,
      hint: summary.inProgress.hint,
      linkLabel: summary.inProgress.linkLabel,
      href: '/actions?status=IN_PROGRESS&onlyMine=false',
      icon: Loader,
      tone: 'info',
      value: data?.byStatus.IN_PROGRESS,
    },
    {
      key: 'dueSoon',
      label: summary.dueSoon.label,
      hint: data ? summary.dueSoon.hint(data.dueSoonWindowDays) : '',
      linkLabel: summary.dueSoon.linkLabel,
      href: '/actions?onlyMine=false',
      icon: CalendarClock,
      tone: 'warning',
      value: data?.dueSoon,
    },
    {
      key: 'completed',
      label: summary.completed.label,
      hint: summary.completed.hint,
      linkLabel: summary.completed.linkLabel,
      href: '/actions?status=COMPLETED&onlyMine=false',
      icon: CheckCircle2,
      tone: 'success',
      value: data?.byStatus.COMPLETED,
    },
  ];
}

export function ActionRegisterSummary(): React.JSX.Element | null {
  const [breakdown, setBreakdown] = useState<ActionsBreakdown | null | undefined>(undefined);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    dashboardApi
      .getSummary()
      .then((response) => {
        if (cancelled) return;
        setBreakdown(response.breakdowns?.actions ?? null);
        setHasError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (hasError) {
    return <p className="text-sm text-muted-foreground">{actions.myActions.summary.error}</p>;
  }

  if (breakdown === null) {
    return null;
  }

  const isLoading = breakdown === undefined;
  const cards = buildCardDefinitions(breakdown);

  return (
    <section
      aria-label={actions.myActions.summary.regionLabel}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <RegisterSummaryCard
          key={card.key}
          href={card.href}
          linkLabel={card.linkLabel}
          label={card.label}
          value={card.value !== undefined ? card.value.toLocaleString('pt-BR') : ''}
          hint={card.hint}
          icon={card.icon}
          tone={card.tone}
          isLoading={isLoading}
        />
      ))}
    </section>
  );
}
