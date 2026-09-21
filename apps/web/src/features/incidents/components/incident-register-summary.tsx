'use client';

/**
 * PharosGRC — incident register compact summary row (008-incidents-
 * problems, US1, CLAUDE.md §18.5, §19.7), joining the shared exploration
 * frame Risks/Controls/Audits/Assets/Processes already established.
 *
 * ## Why `GET /dashboard/summary`, not `GET /incidents` with `pageSize: 1`
 *
 * Coordinator decision (2026-09-14): every OTHER module's own summary reads
 * `meta.total` of its own register query, once per tile. Incidents instead
 * reads `dashboardApi.getSummary()`'s `breakdowns.incidents.byStatus` — ONE
 * request for every tile on this strip, never N requests of `pageSize: 1`,
 * never a second, independently maintained calculator (CLAUDE.md §19.7). The
 * five status counts arrive zero-filled together; the one arithmetic here —
 * "open" is `OPEN` alone, "total" sums all five — adds numbers that arrived
 * in a single response, the same discipline `features/dashboard/summary.ts`'s
 * own `sumOf`/`bucketTotal` document and this component reuses directly.
 *
 * ## Permission-gated absence, not a zero (CLAUDE.md §19.7, dashboard's own
 * "permission-aware by omission")
 *
 * `breakdowns.incidents` is present only when the caller holds the read
 * permission this block is scoped to. While the request is in flight this
 * component renders NOTHING (not a skeleton) — unlike `RiskRegisterSummary`/
 * `AssetRegisterSummary`, which show a skeleton immediately because their
 * own register endpoint requires the exact permission that got the caller
 * onto the screen in the first place. This screen's KPI source is a
 * DIFFERENT, independently-gated endpoint, so a skeleton that might vanish
 * once the block turns out absent would be a worse experience than nothing
 * appearing until the answer is known. Once the response arrives: if the
 * block is present, the strip renders with real figures; if absent, the
 * strip renders nothing at all — never a row of zeros standing in for "you
 * may not see this".
 *
 * A failed request degrades to one quiet message in place of the strip — it
 * must never hide or block the register underneath it.
 */
import { AlertCircle, CheckCircle2, Loader2, Siren } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DashboardBreakdowns, DashboardSummaryResponse } from '@/features/dashboard/types';
import type { ComponentType, SVGProps } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { dashboardApi } from '@/features/dashboard/api';
import { sumOf } from '@/features/dashboard/summary';
import { incidents } from '@/lib/messages/incidents';

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
    // Still in flight — see this component's own header comment for why no
    // skeleton is shown here, unlike the registers whose summary reads their
    // own (already-guaranteed) permission.
    return <></>;
  }

  const breakdown = data.breakdowns?.incidents;
  if (!breakdown) {
    // Permission-gated absence: no strip, never a row of zeros.
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
