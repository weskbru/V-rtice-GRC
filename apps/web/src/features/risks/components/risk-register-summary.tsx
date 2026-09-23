'use client';

import { CalendarClock, Layers, OctagonAlert, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { dashboardApi } from '@/features/dashboard/api';
import { risks } from '@/lib/messages/risks';

import type { DashboardResponse } from '@/features/dashboard/types';
import type { ComponentType, SVGProps } from 'react';

export interface RiskRegisterSummaryProps {
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

function buildCardDefinitions(data: DashboardResponse | null): SummaryCardDefinition[] {
  const summary = risks.register.summary;

  return [
    {
      key: 'total',
      label: summary.total.label,
      hint: summary.total.hint,
      linkLabel: summary.total.linkLabel,
      href: '/risks',
      icon: Layers,
      tone: 'neutral',
      value: data?.risks.total,
    },
    {
      key: 'critical',
      label: summary.critical.label,
      hint: summary.critical.hint,
      linkLabel: summary.critical.linkLabel,
      href: '/risks?riskLevel=CRITICAL',
      icon: OctagonAlert,
      tone: 'danger',
      value: data?.risks.byResidualLevel.CRITICAL,
    },
    {
      key: 'underTreatment',
      label: summary.underTreatment.label,
      hint: summary.underTreatment.hint,
      linkLabel: summary.underTreatment.linkLabel,
      href: '/risks?status=UNDER_TREATMENT',
      icon: Wrench,
      tone: 'info',
      value: data?.risks.byStatus.UNDER_TREATMENT,
    },
    {
      key: 'overdueReview',
      label: summary.overdueReview.label,
      hint: summary.overdueReview.hint,
      linkLabel: summary.overdueReview.linkLabel,
      href: '/risks?overdueReview=true',
      icon: CalendarClock,
      tone: 'warning',
      value: data?.itemsRequiringReview.total,
    },
  ];
}

export function RiskRegisterSummary({ className }: RiskRegisterSummaryProps): React.JSX.Element {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    dashboardApi
      .getDashboard()
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
    return <p className="text-sm text-muted-foreground">{risks.register.summary.error}</p>;
  }

  const isLoading = data === null;
  const cards = buildCardDefinitions(data);

  return (
    <section
      aria-label={risks.register.summary.regionLabel}
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
          className={card.key === 'critical' ? className : undefined}
        />
      ))}
    </section>
  );
}
