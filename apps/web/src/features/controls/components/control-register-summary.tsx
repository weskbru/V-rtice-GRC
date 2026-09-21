'use client';

/**
 * PharosGRC — control catalog compact summary row (CLAUDE.md §18.5, §19.7),
 * mirroring `risk-register-summary.tsx`'s own shape and reasoning.
 *
 * Unlike the risk register, there is no `GET /dashboard` aggregate for
 * Controls yet (this phase does not add one) — so each figure is read from
 * `meta.total` of the SAME `GET /controls` catalog query the register
 * itself uses (`controlsApi.listCatalog`, `pageSize: 1`), filtered exactly
 * the way the card's own link filters the register. This keeps ONE
 * calculator for "how many controls match X" (the server's own filtered
 * count, CLAUDE.md §19.7) — never a client-side recount of rows, and never
 * a duplicated filter expression that could drift from the register's.
 *
 * A failure degrades to one quiet message in place of the row — it must
 * never hide or block the catalog underneath it.
 */
import { CheckCircle2, Clock, Layers, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { controlsApi } from '../api';

import type { ComponentType, SVGProps } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { controls } from '@/lib/messages/controls';

export interface ControlRegisterSummaryProps {
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
  ineffective: number;
  expired: number;
}

async function loadCounts(): Promise<SummaryCounts> {
  const [total, active, ineffective, expired] = await Promise.all([
    controlsApi.listCatalog({ page: 1, pageSize: 1 }),
    controlsApi.listCatalog({ page: 1, pageSize: 1, status: ['ACTIVE'] }),
    controlsApi.listCatalog({ page: 1, pageSize: 1, effectiveness: ['INEFFECTIVE'] }),
    controlsApi.listCatalog({ page: 1, pageSize: 1, effectiveness: ['EXPIRED'] }),
  ]);
  return {
    total: total.meta.total,
    active: active.meta.total,
    ineffective: ineffective.meta.total,
    expired: expired.meta.total,
  };
}

function buildCardDefinitions(data: SummaryCounts | null): SummaryCardDefinition[] {
  const summary = controls.register.summary;

  return [
    {
      key: 'total',
      label: summary.total.label,
      hint: summary.total.hint,
      linkLabel: summary.total.linkLabel,
      href: '/controls',
      icon: Layers,
      tone: 'neutral',
      value: data?.total,
    },
    {
      key: 'active',
      label: summary.active.label,
      hint: summary.active.hint,
      linkLabel: summary.active.linkLabel,
      href: '/controls?status=ACTIVE',
      icon: CheckCircle2,
      tone: 'success',
      value: data?.active,
    },
    {
      key: 'ineffective',
      label: summary.ineffective.label,
      hint: summary.ineffective.hint,
      linkLabel: summary.ineffective.linkLabel,
      href: '/controls?effectiveness=INEFFECTIVE',
      icon: XCircle,
      tone: 'danger',
      value: data?.ineffective,
    },
    {
      key: 'expired',
      label: summary.expired.label,
      hint: summary.expired.hint,
      linkLabel: summary.expired.linkLabel,
      href: '/controls?effectiveness=EXPIRED',
      icon: Clock,
      tone: 'warning',
      value: data?.expired,
    },
  ];
}

export function ControlRegisterSummary({
  className,
}: ControlRegisterSummaryProps): React.JSX.Element {
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
    return <p className="text-sm text-muted-foreground">{controls.register.summary.error}</p>;
  }

  const isLoading = data === null;
  const cards = buildCardDefinitions(data);

  return (
    <section
      aria-label={controls.register.summary.regionLabel}
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
