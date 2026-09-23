'use client';

import { AlertCircle, CheckCircle2, Loader2, Siren } from 'lucide-react';
import { useEffect, useState } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { dashboardApi } from '@/features/dashboard/api';
import { sumOf } from '@/features/dashboard/summary';
import { incidents } from '@/lib/messages/incidents';

import type { DashboardBreakdowns, DashboardSummaryResponse } from '@/features/dashboard/types';
import type { ComponentType, SVGProps } from 'react';

export interface IncidentRegisterSummaryProps {
  className?: string;
}

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

function buildCardDefinitions(
  breakdown: NonNullable<DashboardBreakdowns['incidents']>,
): SummaryCardDefinition[] {
  const summary = incidents.register.summary;
  const { byStatus } = breakdown;

  return [
    {
      key: 'total',
      label: summary.total.label,
      hint: summary.total.hint,
      linkLabel: summary.total.linkLabel,
      href: '/incidents',
      icon: Siren,
      tone: 'neutral',
      value: sumOf(byStatus, ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED']),
    },
    {
      key: 'open',
      label: summary.open.label,
      hint: summary.open.hint,
      linkLabel: summary.open.linkLabel,
      href: '/incidents?status=OPEN',
      icon: AlertCircle,
      tone: 'info',
      value: byStatus.OPEN,
    },
    {
      key: 'inProgress',
      label: summary.inProgress.label,
      hint: summary.inProgress.hint,
      linkLabel: summary.inProgress.linkLabel,
      href: '/incidents?status=IN_PROGRESS',
      icon: Loader2,
      tone: 'warning',
      value: byStatus.IN_PROGRESS,
    },
    {
      key: 'resolved',
      label: summary.resolved.label,
      hint: summary.resolved.hint,
      linkLabel: summary.resolved.linkLabel,
      href: '/incidents?status=RESOLVED',
      icon: CheckCircle2,
      tone: 'success',
      value: byStatus.RESOLVED,
    },
  ];
}

export function IncidentRegisterSummary({
  className,
}: IncidentRegisterSummaryProps): React.JSX.Element {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    dashboardApi
      .getSummary()
      .then((response) => {
        if (cancelled) return;
        setData(response);
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
    return <p className="text-sm text-muted-foreground">{incidents.register.summary.error}</p>;
  }

  if (data === null) {
    return <></>;
  }

  const breakdown = data.breakdowns?.incidents;
  if (!breakdown) {
    return <></>;
  }

  const cards = buildCardDefinitions(breakdown);

  return (
    <section
      aria-label={incidents.register.summary.regionLabel}
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className ?? ''}`}
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
        />
      ))}
    </section>
  );
}
