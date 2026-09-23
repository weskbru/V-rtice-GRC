'use client';

import { CheckCircle2, Loader2, Layers, NotebookPen } from 'lucide-react';
import { useEffect, useState } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { auditEngagements } from '@/lib/messages/audit-engagements';

import { auditEngagementsApi } from '../api';

import type { ComponentType, SVGProps } from 'react';

export interface AuditEngagementRegisterSummaryProps {
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

interface SummaryCounts {
  total: number;
  planning: number;
  inProgress: number;
  completed: number;
}

async function loadCounts(): Promise<SummaryCounts> {
  const [total, planning, inProgress, completed] = await Promise.all([
    auditEngagementsApi.listEngagements({ page: 1, pageSize: 1 }),
    auditEngagementsApi.listEngagements({ page: 1, pageSize: 1, status: 'PLANNING' }),
    auditEngagementsApi.listEngagements({ page: 1, pageSize: 1, status: 'IN_PROGRESS' }),
    auditEngagementsApi.listEngagements({ page: 1, pageSize: 1, status: 'COMPLETED' }),
  ]);
  return {
    total: total.meta.total,
    planning: planning.meta.total,
    inProgress: inProgress.meta.total,
    completed: completed.meta.total,
  };
}

function buildCardDefinitions(data: SummaryCounts | null): SummaryCardDefinition[] {
  const summary = auditEngagements.register.summary;

  return [
    {
      key: 'total',
      label: summary.total.label,
      hint: summary.total.hint,
      linkLabel: summary.total.linkLabel,
      href: '/audits',
      icon: Layers,
      tone: 'neutral',
      value: data?.total,
    },
    {
      key: 'planning',
      label: summary.planning.label,
      hint: summary.planning.hint,
      linkLabel: summary.planning.linkLabel,
      href: '/audits?status=PLANNING',
      icon: NotebookPen,
      tone: 'neutral',
      value: data?.planning,
    },
    {
      key: 'inProgress',
      label: summary.inProgress.label,
      hint: summary.inProgress.hint,
      linkLabel: summary.inProgress.linkLabel,
      href: '/audits?status=IN_PROGRESS',
      icon: Loader2,
      tone: 'info',
      value: data?.inProgress,
    },
    {
      key: 'completed',
      label: summary.completed.label,
      hint: summary.completed.hint,
      linkLabel: summary.completed.linkLabel,
      href: '/audits?status=COMPLETED',
      icon: CheckCircle2,
      tone: 'success',
      value: data?.completed,
    },
  ];
}

export function AuditEngagementRegisterSummary({
  className,
}: AuditEngagementRegisterSummaryProps): React.JSX.Element {
  const [data, setData] = useState<SummaryCounts | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadCounts()
      .then((counts) => {
        if (cancelled) return;
        setData(counts);
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
    return (
      <p className="text-sm text-muted-foreground">{auditEngagements.register.summary.error}</p>
    );
  }

  const isLoading = data === null;
  const cards = buildCardDefinitions(data);

  return (
    <section
      aria-label={auditEngagements.register.summary.regionLabel}
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
          isLoading={isLoading}
        />
      ))}
    </section>
  );
}
