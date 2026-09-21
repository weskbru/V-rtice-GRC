'use client';

/**
 * PharosGRC — risk register compact summary row (CLAUDE.md §18.5, §19.7).
 *
 * Four small indicators shown above the register's toolbar: total risks,
 * critical residual risks, risks under treatment and risks with an overdue
 * review. This is a summary, not a second dashboard — it fetches its own
 * data from the SAME `GET /dashboard` used by the GRC dashboard page
 * (`@/features/dashboard/api`), never a bespoke count of its own.
 *
 * ## Why `GET /dashboard` and not four counting requests (CLAUDE.md §19.7)
 *
 * `GET /dashboard` resolves the caller's organizational scope through the
 * exact same `ScopeResolverService.resolveScope` that `GET /risks` (the
 * register itself) uses, and computes each figure with the same rule as the
 * register filter the card links to — `itemsRequiringReview.total` is
 * literally `next_review_on IS NOT NULL AND next_review_on < today`, the
 * identical condition to the register's own `overdueReview` filter fragment.
 * That parity is what makes the number on a card and the list it links into
 * incapable of disagreeing. Computing a second, independent count here
 * — even one that looks equivalent — would be exactly the duplicated
 * derived-state rule CLAUDE.md §19.7 forbids: derived state has ONE
 * calculator, and for these four figures that calculator is the dashboard's
 * `GetDashboardUseCase`, not this component.
 *
 * The "Riscos críticos" card links to `/risks?riskLevel=CRITICAL` with no
 * explicit `riskLevelBasis` — the register's own default basis is
 * `RESIDUAL` (`useRegisterState`'s `DEFAULT_BASIS`), which matches
 * `risks.byResidualLevel` exactly, so an unset basis param already opens the
 * same figure this card shows.
 *
 * A failure here degrades to one quiet message (`summary.error`) in place of
 * the whole row — it must never hide or block the register underneath it,
 * which works independently of this summary.
 */
import { CalendarClock, Layers, OctagonAlert, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DashboardResponse } from '@/features/dashboard/types';
import type { ComponentType, SVGProps } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { dashboardApi } from '@/features/dashboard/api';
import { risks } from '@/lib/messages/risks';

export interface RiskRegisterSummaryProps {
  /** Applied to the "Riscos críticos" link so the register it opens matches the residual figure the card shows. */
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
