'use client';

/**
 * PharosGRC — risk register card view, one risk (US3, CLAUDE.md §18).
 *
 * Compact operational card: code -> title -> short description -> status /
 * risk level -> quiet category/unit/owner metadata -> last update. Mirrors
 * the same source of truth `risk-register-columns.tsx` uses for status and
 * risk-level rendering (`StatusBadge`/`RiskLevelBadge`,
 * `riskStatusBadgeVariant`/`riskStatusLabel`, `formatTimestampDate`, the
 * `NotSetValue` quiet treatment) so the card and table views of the same
 * register never disagree about how a risk is described.
 *
 * The card has exactly two `<Link>`s to the same destination
 * (`/risks/{id}`), deliberately not nested inside one another:
 *   - the code, a real `<Link>` sitting above the rest of the card
 *     (`relative z-10`) with its own, narrower click target;
 *   - the title, a second `<Link>` whose `::after` pseudo-element is
 *     stretched to cover the whole card (the well-known "stretched link"
 *     pattern), so the entire card area is clickable except where the
 *     code's own `<Link>` sits above it. Both resolve to the exact same
 *     record — there is no intermediate quick-view step. This avoids
 *     interactive-in-interactive nesting, which is both invalid HTML and
 *     unpredictable for assistive technology.
 */
import { EmptyValue, RiskLevelBadge, StatusBadge } from '@pharos/design-system/components';
import { Building2, CalendarClock, FolderTree, Hourglass, ShieldAlert, User } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { risks } from '@/lib/messages/risks';
import { cn } from '@/lib/utils';

import { formatTimestampDate } from '../date';
import { riskStatusBadgeVariant, riskStatusLabel } from '../status';

import { PendingApprovalBadge } from './pending-approval-badge';
import styles from './risk-card.module.css';

import type { RiskLevelBasis, RiskSummary } from '../types';

export interface RiskCardProps {
  risk: RiskSummary;
  /** Which derived level the card shows and labels — `RESIDUAL` or `INHERENT`, never left implicit. */
  riskLevelBasis: RiskLevelBasis;
}

export function RiskCard({ risk, riskLevelBasis }: RiskCardProps): React.JSX.Element {
  const levelField = riskLevelBasis === 'INHERENT' ? 'inherentLevel' : 'residualLevel';
  const level = risk[levelField];

  return (
    <article
      data-level={level ?? 'NONE'}
      data-overdue={risk.overdueReview || risk.overdueTreatment || undefined}
      className={cn(
        styles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60',
        'has-[:focus-visible]:border-ring/60',
        'border-border',
      )}
    >
      <Link
        href={`/risks/${risk.id}`}
        className="relative z-10 inline-flex items-center gap-2 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ShieldAlert aria-hidden="true" className={cn('size-4 shrink-0', styles.codeIcon)} />
        {risk.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/risks/${risk.id}`}
          aria-label={risks.register.card.selectLabel(risk.code, risk.title)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {risk.title}
          </span>
        </Link>

        {risk.descriptionExcerpt ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {risk.descriptionExcerpt}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={riskStatusBadgeVariant(risk.status)}
          label={riskStatusLabel(risk.status)}
        />
        {level ? (
          <RiskLevelBadge
            level={level}
            basis={riskLevelBasis === 'INHERENT' ? 'inherent' : 'residual'}
            labels={risks.riskLevelBadge}
          />
        ) : (
          <EmptyValue>{risks.register.card.noLevel}</EmptyValue>
        )}
        <PendingApprovalBadge pending={risk.pendingApproval} />
        {risk.overdueReview ? (
          <StatusBadge
            variant="danger"
            label={risks.register.indicators.overdueReview}
            icon={CalendarClock}
          />
        ) : null}
        {risk.overdueTreatment ? (
          <StatusBadge
            variant="danger"
            label={risks.register.indicators.overdueTreatment}
            icon={Hourglass}
          />
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="grid grid-cols-3 gap-2 text-xs">
          {/* Label ABOVE value, not beside it (`risks-v2-post-gate` correction
              1): at 115px per column, "Categoria" beside its own value left no
              room for the value before truncating it. The icon+label pair was
              already `sr-only` here — CONVERTED to visible (text-[10px]
              uppercase, the same compact-caption scale `role-permissions-
              summary.tsx` and `org-unit-tree.tsx` already use elsewhere in the
              product), not duplicated: there is still exactly one label text
              node per field, so a screen reader announces it once. */}
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <FolderTree aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{risks.register.card.categoryLabel}</span>
            </dt>
            <dd className="truncate text-foreground">
              {risk.category ? (
                risk.category.name
              ) : (
                <EmptyValue>{risks.register.columns.notSet}</EmptyValue>
              )}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <Building2 aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{risks.register.card.orgUnitLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{risk.orgUnit.name}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <User aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{risks.register.card.ownerLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{risk.owner.fullName}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          {risks.register.card.updatedAt(formatTimestampDate(risk.updatedAt))}
        </p>
      </div>
    </article>
  );
}
