'use client';

/**
 * PharosGRC — process catalog card view, one process (T046, CLAUDE.md §18,
 * §18.12). Mirrors `AuditEngagementCard`: no quick-view side panel for this
 * register, so the whole card is one stretched link to `/processes/{id}`, with
 * the code repeated as its own smaller link purely so it can be opened in a
 * new tab independently.
 */
import { StatusBadge } from '@pharos/design-system/components';
import { Building2, Workflow } from 'lucide-react';

import { formatTimestampDate } from '../date';
import { processSituationLabel, processSituationVariant } from '../situation';

import type { ProcessSummary } from '../types';

import { Link } from '@/components/navigation/link';
import registerCardStyles from '@/components/register/register-card.module.css';
import { processes } from '@/lib/messages/processes';
import { cn } from '@/lib/utils';

export interface ProcessCardProps {
  process: ProcessSummary;
}

export function ProcessCard({ process }: ProcessCardProps): React.JSX.Element {
  const card = processes.register.card;

  return (
    <article
      data-tone={processSituationVariant(process.isActive)}
      className={cn(
        registerCardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 has-[:focus-visible]:border-ring/60',
      )}
    >
      <Link
        href={`/processes/${process.id}`}
        className="relative z-10 inline-flex items-center gap-2 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Workflow
          aria-hidden="true"
          className="size-4 shrink-0 text-[color:var(--register-card-accent)]"
        />
        {process.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/processes/${process.id}`}
          aria-label={card.selectLabel(process.code, process.name)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {process.name}
          </span>
        </Link>

        {process.descriptionExcerpt ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {process.descriptionExcerpt}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={processSituationVariant(process.isActive)}
          label={processSituationLabel(process.isActive)}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="flex min-w-0 flex-col gap-0.5 text-xs">
          <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <Building2 aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{card.orgUnitLabel}</span>
          </dt>
          <dd className="truncate text-foreground">
            {process.orgUnit?.name ?? processes.register.columns.notSet}
          </dd>
        </dl>

        <p className="text-xs text-muted-foreground">
          {card.updatedAt(formatTimestampDate(process.updatedAt))}
        </p>
      </div>
    </article>
  );
}
