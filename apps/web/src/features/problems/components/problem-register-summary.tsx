'use client';

import { Ban, CheckCircle2, CircleDot, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { dashboardApi } from '@/features/dashboard/api';
import { problems } from '@/lib/messages/problems';

import type { DashboardBreakdowns } from '@/features/dashboard/types';
import type { ComponentType, SVGProps } from 'react';

type ProblemsBreakdown = DashboardBreakdowns['problems'];

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

function buildCardDefinitions(data: ProblemsBreakdown | undefined): SummaryCardDefinition[] {
  const summary = problems.register.summary;

  return [
    {
      key: 'open',
      label: summary.open.label,
      hint: summary.open.hint,
      linkLabel: summary.open.linkLabel,
      href: '/problems?status=OPEN',
      icon: CircleDot,
      tone: 'neutral',
      value: data?.byStatus.OPEN,
    },
    {
      key: 'inAnalysis',
      label: summary.inAnalysis.label,
      hint: summary.inAnalysis.hint,
      linkLabel: summary.inAnalysis.linkLabel,
      href: '/problems?status=IN_ANALYSIS',
      icon: Search,
      tone: 'info',
      value: data?.byStatus.IN_ANALYSIS,
    },
    {
      key: 'resolved',
      label: summary.resolved.label,
      hint: summary.resolved.hint,
      linkLabel: summary.resolved.linkLabel,
      href: '/problems?status=RESOLVED',
      icon: CheckCircle2,
      tone: 'success',
      value: data?.byStatus.RESOLVED,
    },
    {
      key: 'closed',
      label: summary.closed.label,
      hint: summary.closed.hint,
      linkLabel: summary.closed.linkLabel,
      href: '/problems?status=CLOSED',
      icon: Ban,
      tone: 'success',
      value: data?.byStatus.CLOSED,
    },
  ];
}

export function ProblemRegisterSummary(): React.JSX.Element | null {
  const [breakdown, setBreakdown] = useState<ProblemsBreakdown | null | undefined>(undefined);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    dashboardApi
      .getSummary()
      .then((response) => {
        if (cancelled) return;
        setBreakdown(response.breakdowns?.problems ?? null);
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
    return <p className="text-sm text-muted-foreground">{problems.register.summary.error}</p>;
  }

  if (breakdown === null) {
    return null;
  }

  const isLoading = breakdown === undefined;
  const cards = buildCardDefinitions(breakdown);

  return (
    <section
      aria-label={problems.register.summary.regionLabel}
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
