'use client';

import { Building2, ShieldCheck, User } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import registerCardStyles from '@/components/register/register-card.module.css';
import { controls } from '@/lib/messages/controls';
import { cn } from '@/lib/utils';
import { EmptyValue, StatusBadge } from '@vertice/design-system/components';

import { formatTimestampDate } from '../date';
import {
  controlEffectivenessBadgeVariant,
  controlEffectivenessIcon,
  controlEffectivenessLabel,
  controlStatusBadgeVariant,
  controlStatusIcon,
  controlStatusLabel,
} from '../status';

import type { ControlSummary } from '../types';

export interface ControlCardProps {
  control: ControlSummary;
}

export function ControlCard({ control }: ControlCardProps): React.JSX.Element {
  const cardTone =
    control.effectiveness === 'NOT_ASSESSED'
      ? controlStatusBadgeVariant(control.status)
      : controlEffectivenessBadgeVariant(control.effectiveness);

  return (
    <article
      data-tone={cardTone}
      className={cn(
        registerCardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 has-[:focus-visible]:border-ring/60',
        'border-border',
      )}
    >
      <Link
        href={`/controls/${control.id}`}
        className="relative z-10 inline-flex items-center gap-2 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ShieldCheck
          aria-hidden="true"
          className="size-4 shrink-0 text-[color:var(--register-card-accent)]"
        />
        {control.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/controls/${control.id}`}
          aria-label={controls.register.card.selectLabel(control.code, control.name)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {control.name}
          </span>
        </Link>

        {control.descriptionExcerpt ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {control.descriptionExcerpt}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={controlStatusBadgeVariant(control.status)}
          label={controlStatusLabel(control.status)}
          icon={controlStatusIcon(control.status)}
        />
        <StatusBadge
          variant={controlEffectivenessBadgeVariant(control.effectiveness)}
          label={controlEffectivenessLabel(control.effectiveness)}
          icon={controlEffectivenessIcon(control.effectiveness)}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <Building2 aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{controls.register.card.orgUnitLabel}</span>
            </dt>
            <dd className="truncate text-foreground">
              {control.orgUnit ? (
                control.orgUnit.name
              ) : (
                <EmptyValue>{controls.register.columns.notSet}</EmptyValue>
              )}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <User aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{controls.register.card.ownerLabel}</span>
            </dt>
            <dd className="truncate text-foreground">
              {control.owner ? (
                control.owner.fullName
              ) : (
                <EmptyValue>{controls.register.card.noOwner}</EmptyValue>
              )}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          {controls.register.card.updatedAt(formatTimestampDate(control.updatedAt))}
        </p>
      </div>
    </article>
  );
}
