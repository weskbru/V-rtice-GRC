'use client';

import { EmptyValue, StatusBadge } from '@pharos/design-system/components';
import { Building2, CalendarClock, User } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import cardStyles from '@/components/register/register-card.module.css';
import { incidents } from '@/lib/messages/incidents';
import { cn } from '@/lib/utils';

import { formatDateOnly, formatTimestampDate } from '../date';
import { incidentSeverityBadgeVariant, incidentStatusBadgeVariant } from '../status';

import type { IncidentSummary } from '../types';

export interface IncidentCardProps {
  incident: IncidentSummary;
}

export function IncidentCard({ incident }: IncidentCardProps): React.JSX.Element {
  const card = incidents.register.card;

  return (
    <article
      data-tone={incidentSeverityBadgeVariant(incident.severity)}
      className={cn(
        cardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 has-[:focus-visible]:border-ring/60',
      )}
    >
      <Link
        href={`/incidents/${incident.id}`}
        className="relative z-10 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {incident.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/incidents/${incident.id}`}
          aria-label={card.selectLabel(incident.code, incident.title)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {incident.title}
          </span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={incidentSeverityBadgeVariant(incident.severity)}
          label={incidents.severityLabels[incident.severity]}
        />
        <StatusBadge
          variant={incidentStatusBadgeVariant(incident.status)}
          label={incidents.statusLabels[incident.status]}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <Building2 aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.orgUnitLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{incident.orgUnit.name}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <User aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.ownerLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{incident.owner.fullName}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <CalendarClock aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.reportedOnLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{formatDateOnly(incident.reportedOn)}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          {incident.updatedAt ? (
            card.updatedAt(formatTimestampDate(incident.updatedAt))
          ) : (
            <EmptyValue>{card.updatedAtUnknown}</EmptyValue>
          )}
        </p>
      </div>
    </article>
  );
}
