'use client';

/**
 * PharosGRC — "Planos de Ação" register compact summary row (CLAUDE.md
 * §18.5, §19.7), mirroring `risk-register-summary.tsx`'s own shape and
 * reasoning.
 *
 * Every figure comes from ONE call, `dashboardApi.getSummary()`
 * (`GET /dashboard/summary`), reading its `breakdowns.actions` block —
 * never a second count computed on this screen, and never N requests of
 * `pageSize: 1` (CLAUDE.md §19.7, coordinator's explicit instruction for
 * this task). That block is ABSENT when the caller lacks `action:view` (the
 * server's own permission gate) — this component then renders no strip at
 * all, never a row of zeros.
 *
 * `breakdowns.actions` counts the caller's WHOLE organizational scope,
 * deliberately unaffected by "somente minhas ações" (this register's own
 * default filter) — exactly like `risks.register.summary`'s four cards are
 * unaffected by the register's own applied filters. Every card's link
 * therefore sets `onlyMine=false` explicitly: without it, a caller who
 * clicks "12 abertas" would land on a list still narrowed to their own
 * work, which could show fewer than 12 rows and read as a broken count.
 *
 * `dueSoon` has no matching filter on `GET /actions` at all (`ListActions
 * Query` carries no "due soon" parameter) — its link opens the unfiltered
 * register (still `onlyMine=false`), mirroring the platform dashboard's own
 * identical precedent for the same figure (`app/(app)/dashboard/page.tsx`,
 * `dashboard.attention.dueSoonActions`).
 *
 * A failure here degrades to one quiet message in place of the row — it
 * must never hide or block the register underneath it.
 */
import { CalendarClock, CheckCircle2, CircleDot, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DashboardBreakdowns } from '@/features/dashboard/types';
import type { ComponentType, SVGProps } from 'react';

import { RegisterSummaryCard } from '@/components/register/register-summary-card';
import { dashboardApi } from '@/features/dashboard/api';
import { actions } from '@/lib/messages/actions';

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

type ActionsBreakdown = DashboardBreakdowns['actions'];

function buildCardDefinitions(data: ActionsBreakdown | undefined): SummaryCardDefinition[] {
  const summary = actions.myActions.summary;

  return [
    {
      key: 'open',
      label: summary.open.label,
      hint: summary.open.hint,
      linkLabel: summary.open.linkLabel,
      href: '/actions?status=OPEN&onlyMine=false',
      icon: CircleDot,
      tone: 'neutral',
      value: data?.byStatus.OPEN,
    },
    {
      key: 'inProgress',
      label: summary.inProgress.label,
      hint: summary.inProgress.hint,
      linkLabel: summary.inProgress.linkLabel,
      href: '/actions?status=IN_PROGRESS&onlyMine=false',
      icon: Loader,
      tone: 'info',
      value: data?.byStatus.IN_PROGRESS,
    },
    {
      key: 'dueSoon',
      label: summary.dueSoon.label,
      hint: data ? summary.dueSoon.hint(data.dueSoonWindowDays) : '',
      linkLabel: summary.dueSoon.linkLabel,
      href: '/actions?onlyMine=false',
      icon: CalendarClock,
      tone: 'warning',
      value: data?.dueSoon,
    },
    {
      key: 'completed',
      label: summary.completed.label,
      hint: summary.completed.hint,
      linkLabel: summary.completed.linkLabel,
      href: '/actions?status=COMPLETED&onlyMine=false',
      icon: CheckCircle2,
      tone: 'success',
      value: data?.byStatus.COMPLETED,
    },
  ];
}

export function ActionRegisterSummary(): React.JSX.Element | null {
  // `undefined` = not yet loaded; `null` = loaded, and the caller's scope
  // has no `breakdowns.actions` block (no `action:view`) — the two are
  // deliberately distinct, since the first renders a loading strip and the
  // second renders NOTHING (never a row of zeros nobody has permission to
  // have produced).
  const [breakdown, setBreakdown] = useState<ActionsBreakdown | null | undefined>(undefined);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    dashboardApi
      .getSummary()
      .then((response) => {
        if (cancelled) return;
        setBreakdown(response.breakdowns?.actions ?? null);
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
    return <p className="text-sm text-muted-foreground">{actions.myActions.summary.error}</p>;
  }

  if (breakdown === null) {
    return null;
  }

  const isLoading = breakdown === undefined;
  const cards = buildCardDefinitions(breakdown);

  return (
    <section
      aria-label={actions.myActions.summary.regionLabel}
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
