'use client';

/**
 * PharosGRC — Administration, the roles surface's four indicators
 * (015-roles-permissions-surface FR-001 to FR-004, T028/T029).
 *
 * Every figure comes from `GET /admin/roles/summary` — one aggregate
 * request, constant in the number of roles (NFR-006, SC-007). None is
 * recounted from the loaded page, and `usersWithRoles` in particular is not
 * derivable from it at all: summing `assignedUserCount` counts a person
 * holding two roles twice (research.md R-002).
 *
 * ## Why the first three are real `<button>`s
 *
 * FR-002 is explicit that "a `div` with `onClick` does not satisfy this
 * requirement". A native button is what brings keyboard operation, the
 * platform's `focus-visible` ring and the `aria-pressed` state for free —
 * none of which a click handler on a box has. `SummaryStatCard` contains no
 * interactive element by design (its own doc comment says so), so the
 * button is the wrapper, and the card's hover/focus treatment is written as
 * `group-*` variants that this wrapper drives.
 *
 * The pressed state is carried by THREE channels, never by colour alone
 * (NFR-004): `aria-pressed` for assistive technology, a thicker accent
 * border for shape, and the words "Filtro aplicado" appended to the card's
 * own hint for anyone reading the screen.
 *
 * The fourth indicator is deliberately inert (FR-003) — "Usuários com
 * papéis" is not a role filter, and a control that looks pressable but
 * filters nothing would be worse than a plain figure.
 *
 * A failure degrades to one quiet line (FR — edge case): the list of roles
 * underneath must never be hidden because an indicator did not load.
 */
import { SummaryStatCard } from '@pharos/design-system/components';
import { KeyRound, LockKeyhole, UserCog, Users } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';

import type { RolesSummary, RoleTypeFilter } from '../../types';
import type { ComponentType, SVGProps } from 'react';

export interface RoleAdminSummaryProps {
  summary: RolesSummary | null;
  isLoading: boolean;
  hasError: boolean;
  activeType: RoleTypeFilter;
  onSelectType: (type: RoleTypeFilter) => void;
  className?: string;
}

interface IndicatorDefinition {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly tone: 'neutral' | 'info';
  readonly value: number | undefined;
  /** The kind filter this indicator applies, or `undefined` for the inert one (FR-003). */
  readonly filter: RoleTypeFilter | undefined;
  /** Accessible purpose of the control, e.g. "Mostrar somente os papéis do sistema". Absent for the inert indicator. */
  readonly filterLabel: string | undefined;
}

function buildIndicators(summary: RolesSummary | null): readonly IndicatorDefinition[] {
  const messages = admin.roles.summary;
  return [
    {
      key: 'total',
      label: messages.total.label,
      hint: messages.total.hint,
      icon: KeyRound,
      tone: 'info',
      value: summary?.totalRoles,
      filter: 'all',
      filterLabel: messages.total.filterLabel,
    },
    {
      key: 'system',
      label: messages.system.label,
      hint: messages.system.hint,
      icon: LockKeyhole,
      tone: 'neutral',
      value: summary?.systemRoles,
      filter: 'system',
      filterLabel: messages.system.filterLabel,
    },
    {
      key: 'custom',
      label: messages.custom.label,
      hint: messages.custom.hint,
      icon: UserCog,
      tone: 'neutral',
      value: summary?.customRoles,
      filter: 'custom',
      filterLabel: messages.custom.filterLabel,
    },
    {
      key: 'usersWithRoles',
      label: messages.usersWithRoles.label,
      hint: messages.usersWithRoles.hint,
      icon: Users,
      tone: 'neutral',
      value: summary?.usersWithRoles,
      filter: undefined,
      filterLabel: undefined,
    },
  ];
}

export function RoleAdminSummary({
  summary,
  isLoading,
  hasError,
  activeType,
  onSelectType,
  className,
}: RoleAdminSummaryProps): React.JSX.Element {
  const messages = admin.roles.summary;

  if (hasError) {
    // One quiet line, never a blocking error state: the kind filter is
    // still reachable through the filter bar below, and the roles
    // themselves load from a different request entirely.
    return <p className={cn('text-sm text-muted-foreground', className)}>{messages.loadError}</p>;
  }

  return (
    <section
      aria-label={messages.regionLabel}
      // One column below `sm`, not two. Measured on the rendered screen at
      // 390 px: two columns leave the card's text 66 px, and the single word
      // "personalizados" is 81 px at this size — the label was clipped
      // mid-word, which is the same defect `b69ad48` fixed for KPI labels
      // ("a KPI label wraps instead of losing the word it needs"), reappearing
      // in a narrower column than that fix anticipated. Breaking the word
      // instead would keep the row compact by making the label unreadable.
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {buildIndicators(summary).map((indicator) => {
        const isActive = indicator.filter !== undefined && indicator.filter === activeType;
        // "Papéis" IS the current selection when no kind filter is applied,
        // and it is drawn as such — but nothing is being filtered, so it
        // must not claim otherwise. Measured on the rendered screen: the
        // first card read "Todos os papéis da plataforma · Filtro aplicado"
        // on a completely unfiltered list.
        const narrows = isActive && indicator.filter !== 'all';
        const card = (
          <SummaryStatCard
            label={indicator.label}
            value={indicator.value !== undefined ? messages.value(indicator.value) : ''}
            // The applied state is said in words as well as drawn, so it
            // survives greyscale, low vision and colour blindness alike.
            hint={narrows ? `${indicator.hint} · ${messages.activeLabel}` : indicator.hint}
            icon={indicator.icon}
            tone={indicator.tone}
            isLoading={isLoading}
            className={cn(
              'h-full',
              isActive && 'border-primary border-l-4 bg-accent/40 dark:bg-accent/20',
            )}
          />
        );

        if (indicator.filter === undefined || indicator.filterLabel === undefined) {
          return (
            <div key={indicator.key} className="h-full">
              {card}
            </div>
          );
        }

        const filter = indicator.filter;
        return (
          <button
            key={indicator.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectType(filter)}
            className="group h-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {/*
             * The control's PURPOSE, first in its accessible name, ahead of
             * the figure it shows — "Mostrar somente os papéis do sistema,
             * Papéis do sistema, 12, …". Supplied as `sr-only` content
             * rather than as `aria-label` on purpose: `aria-label` would
             * REPLACE the card's subtree in the accessible name, and a
             * screen-reader user would then hear what the button does
             * without ever hearing the number it reports.
             */}
            <span className="sr-only">{indicator.filterLabel}</span>
            {card}
          </button>
        );
      })}
    </section>
  );
}
