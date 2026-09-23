'use client';

import { StatusBadge } from '@pharos/design-system/components';
import { Building2, User } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import registerCardStyles from '@/components/register/register-card.module.css';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { cn } from '@/lib/utils';

import { formatDateOnly, formatTimestampDate } from '../date';
import { engagementStatusBadgeVariant, engagementStatusIcon } from '../status';

import type { AuditEngagement } from '../types';

export interface AuditEngagementCardProps {
  engagement: AuditEngagement;
}

export function AuditEngagementCard({ engagement }: AuditEngagementCardProps): React.JSX.Element {
  const card = auditEngagements.register.card;

  return (
    <article
      data-tone={engagementStatusBadgeVariant(engagement.status)}
      className={cn(
        registerCardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 hover:bg-accent/20',
        'has-[:focus-visible]:border-ring/60 has-[:focus-visible]:bg-accent/20',
      )}
    >
      <Link
        href={`/audits/${engagement.id}`}
        className="relative z-10 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {engagement.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/audits/${engagement.id}`}
          aria-label={card.selectLabel(engagement.code, engagement.objective)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {engagement.objective}
          </span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={engagementStatusBadgeVariant(engagement.status)}
          label={auditEngagements.statusLabels[engagement.status]}
          icon={engagementStatusIcon(engagement.status)}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <p className="text-xs text-muted-foreground">
          {card.periodLabel(
            formatDateOnly(engagement.periodStart),
            formatDateOnly(engagement.periodEnd),
          )}
        </p>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <Building2 aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.orgUnitLabel}</span>
            </dt>
            <dd className="truncate font-medium text-foreground">{engagement.orgUnit.name}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <User aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.leadAuditorLabel}</span>
            </dt>
            <dd className="truncate font-medium text-foreground">
              {engagement.leadAuditor.fullName}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          {card.updatedAt(formatTimestampDate(engagement.updatedAt))}
        </p>
      </div>
    </article>
  );
}
