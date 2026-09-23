'use client';

import { CheckCircle2, Layers, MinusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { assets } from '@/lib/messages/assets';

import { assetsApi } from '../api';

import type { ComponentType, SVGProps } from 'react';

export interface AssetRegisterSummaryProps {
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
  active: number;
  inactive: number;
}

async function loadCounts(): Promise<SummaryCounts> {
  const [total, active, inactive] = await Promise.all([
    assetsApi.listCatalog({ page: 1, pageSize: 1 }),
    assetsApi.listCatalog({ page: 1, pageSize: 1, isActive: true }),
    assetsApi.listCatalog({ page: 1, pageSize: 1, isActive: false }),
  ]);
  return {
    total: total.meta.total,
    active: active.meta.total,
    inactive: inactive.meta.total,
  };
}

function buildCardDefinitions(data: SummaryCounts | null): SummaryCardDefinition[] {
  const summary = assets.register.summary;

  return [
    {
      key: 'total',
      label: summary.total.label,
      hint: summary.total.hint,
      linkLabel: summary.total.linkLabel,
      href: '/assets',
      icon: Layers,
      tone: 'neutral',
      value: data?.total,
    },
    {
      key: 'active',
      label: summary.active.label,
      hint: summary.active.hint,
      linkLabel: summary.active.linkLabel,
      href: '/assets?isActive=true',
      icon: CheckCircle2,
      tone: 'success',
      value: data?.active,
    },
    {
      key: 'inactive',
      label: summary.inactive.label,
      hint: summary.inactive.hint,
      linkLabel: summary.inactive.linkLabel,
      href: '/assets?isActive=false',
      icon: MinusCircle,
      tone: 'neutral',
      value: data?.inactive,
    },
  ];
}

export function AssetRegisterSummary({ className }: AssetRegisterSummaryProps): React.JSX.Element {
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
    return <p className="text-sm text-muted-foreground">{assets.register.summary.error}</p>;
  }

  const isLoading = data === null;
  const cards = buildCardDefinitions(data);

  return (
    <section
      aria-label={assets.register.summary.regionLabel}
      className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${className ?? ''}`}
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
