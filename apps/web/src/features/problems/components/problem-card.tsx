'use client';

/**
 * PharosGRC — problem register card view, one problem (CLAUDE.md §18,
 * §18.12). Mirrors `AuditEngagementCard`'s shape — whole-card stretched
 * link to `/problems/{id}`, code repeated as its own independent link —
 * since this register offers no quick-view side panel either.
 *
 * Card anatomy follows the family: código → título → badges → three
 * metadata fields (Unidade, Responsável, Identificado em — the same three
 * `problem-register-columns.tsx` already shows, minus `updatedAt`, which
 * moves to the footer) → "Atualizado em". No description row:
 * `ProblemSummary` carries none (mirrors `problems.register.card`'s own
 * doc comment and the Audit Engagements catalog's identical precedent) —
 * never invented here.
 */
import { StatusBadge } from '@pharos/design-system/components';
import { Building2, CalendarClock, User } from 'lucide-react';

import { formatDateOnly, formatTimestampDate } from '../date';
import {
  problemSeverityBadgeVariant,
  problemSeverityIcon,
  problemStatusBadgeVariant,
  problemStatusIcon,
} from '../status';

import type { ProblemSummary } from '../types';

import { Link } from '@/components/navigation/link';
import cardStyles from '@/components/register/register-card.module.css';
import { problems } from '@/lib/messages/problems';
import { cn } from '@/lib/utils';

export interface ProblemCardProps {
  problem: ProblemSummary;
}

export function ProblemCard({ problem }: ProblemCardProps): React.JSX.Element {
  const card = problems.register.card;

  return (
    <article
      data-tone={problemSeverityBadgeVariant(problem.severity)}
      className={cn(
        cardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 has-[:focus-visible]:border-ring/60',
      )}
    >
      <Link
        href={`/problems/${problem.id}`}
        className="relative z-10 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {problem.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/problems/${problem.id}`}
          aria-label={card.openLabel(problem.code, problem.title)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {problem.title}
          </span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={problemSeverityBadgeVariant(problem.severity)}
          label={problems.severityLabels[problem.severity]}
          icon={problemSeverityIcon(problem.severity)}
        />
        <StatusBadge
          variant={problemStatusBadgeVariant(problem.status)}
          label={problems.statusLabels[problem.status]}
          icon={problemStatusIcon(problem.status)}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <Building2 aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.orgUnitLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{problem.orgUnit.name}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <User aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.ownerLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{problem.owner.fullName}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <CalendarClock aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.identifiedOnLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{formatDateOnly(problem.identifiedOn)}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          {/* `updatedAt` is absent from `ProblemSummary`'s generated `required` array even though the server always sets it — see `problem-detail-view.tsx`'s identical comment. */}
          {card.updatedAt(formatTimestampDate(problem.updatedAt!))}
        </p>
      </div>
    </article>
  );
}
