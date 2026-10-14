'use client';

import { CheckCircle2, Layers, MinusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { reports } from '@/lib/messages/reports';
import { SummaryStatCard } from '@vertice/design-system/components';

import { reportsApi } from '../api';

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

interface SummaryCounts {
  total: number;
  active: number;
  inactive: number;
}

async function loadCounts(): Promise<SummaryCounts> {
  const [total, active] = await Promise.all([
    reportsApi.listDefinitions({ page: 1, pageSize: 1 }),
    reportsApi.listDefinitions({ page: 1, pageSize: 1, isActive: true }),
  ]);
  return {
    total: total.meta.total,
    active: active.meta.total,
    inactive: total.meta.total - active.meta.total,
  };
}

function buildCardDefinitions(data: SummaryCounts | null): SummaryCardDefinition[] {
  const summary = reports.register.summary;

  return [
    {
      key: 'total',
      label: summary.total.label,
      hint: summary.total.hint,
      linkLabel: summary.total.linkLabel,
      href: '/reports',
      icon: Layers,
      tone: 'neutral',
      value: data?.total,
    },
    {
      key: 'active',
      label: summary.active.label,
      hint: summary.active.hint,
      linkLabel: summary.active.linkLabel,
      href: '/reports?isActive=true',
      icon: CheckCircle2,
      tone: 'success',
      value: data?.active,
    },
    {
      key: 'inactive',
      label: summary.inactive.label,
      hint: summary.inactive.hint,
      linkLabel: summary.inactive.linkLabel,
      href: '/reports?isActive=false',
      icon: MinusCircle,
      tone: 'neutral',
      value: data?.inactive,
    },
  ];
}

export function ReportRegisterSummary(): React.JSX.Element {
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
    return <p className="text-sm text-muted-foreground">{reports.register.summary.error}</p>;
  }

  const isLoading = data === null;
  const cards = buildCardDefinitions(data);

  return (
    <section
      aria-label={reports.register.summary.regionLabel}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          aria-label={card.linkLabel}
          className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <SummaryStatCard
            label={card.label}
            value={card.value !== undefined ? card.value.toLocaleString('pt-BR') : ''}
            hint={card.hint}
            icon={card.icon}
            tone={card.tone}
            isLoading={isLoading}
          />
        </Link>
      ))}
    </section>
  );
}
