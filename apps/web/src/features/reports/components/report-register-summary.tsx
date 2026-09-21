'use client';

/**
 * PharosGRC — report catalog compact summary row (CLAUDE.md §18.5, §19.7), mirroring
 * `AssetRegisterSummary`'s own shape and reasoning.
 *
 * `GET /dashboard/summary` publishes no `reports` block (`features/dashboard/types.ts`'s own
 * `DashboardBreakdowns` has none) — so unlike `RiskRegisterSummary`/`ActionRegisterSummary`/
 * `ProblemRegisterSummary`, this strip cannot read one aggregate call. Each figure instead reads
 * `meta.total` of the SAME `GET /reports` catalog query the register itself uses
 * (`reportsApi.listDefinitions`, `pageSize: 1`), exactly filtered the way the card's own link
 * filters the register — one calculator, the server's own filtered count, never a client-side
 * recount of rows (CLAUDE.md §19.7).
 *
 * Only TWO requests, not `AssetRegisterSummary`'s three: "Inativos" is `total - ativos`, computed
 * here rather than fetched with a separate `isActive=false` query. That subtraction is exact —
 * `isActive` is a plain boolean column (`report-definition.entity.ts`), so there is no third state
 * a report definition can be in, unlike a multi-value status enum where a derived count could
 * silently drift from the real one. A third request would cost a round trip to confirm what the
 * first two already prove.
 *
 * Every other candidate figure failed this bar and does not ship. "Indicadores em uso" (the union
 * of `metricKeys` across every definition) would need every row fetched and aggregated client-side
 * — a second calculator, cost proportional to data, exactly what CLAUDE.md §19.7 forbids.
 * "Relatórios recentes" has no server-side recency filter or sort at all
 * (`listReportDefinitions` declares neither `sort` nor a date parameter,
 * `report-register-columns.tsx`'s own header) — there is no real query to link a card to.
 *
 * A failure degrades to one quiet message in place of the row — it must never hide or block the
 * catalog underneath it.
 */
import { SummaryStatCard } from '@pharos/design-system/components';
import { CheckCircle2, Layers, MinusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { reports } from '@/lib/messages/reports';

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
    // Exact, not estimated — see this module's own header for why a third
    // `isActive=false` request would be redundant for a boolean field.
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
