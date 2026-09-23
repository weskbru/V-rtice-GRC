'use client';

import { StatusBadge } from '@pharos/design-system/components';
import { AlertTriangle, Building2, CalendarClock, User } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import cardStyles from '@/components/register/register-card.module.css';
import { actions } from '@/lib/messages/actions';
import { cn } from '@/lib/utils';

import { formatDateOnly, formatTimestampDate } from '../../risks/date';
import { actionOriginHref } from '../origin';
import { actionStatusBadgeVariant, actionStatusLabel } from '../status';

import { ActionRowMenu } from './action-row-menu';

import type { Action, ActionStatus } from '../types';

export interface ActionCardProps {
  action: Action;
  canEdit: boolean;
  onTransition: (action: Action, to: ActionStatus) => void;
  onReopenRequest: (action: Action) => void;
}

export function ActionCard({
  action,
  canEdit,
  onTransition,
  onReopenRequest,
}: ActionCardProps): React.JSX.Element {
  const card = actions.myActions.card;
  const originLabel = action.originLabel ?? actions.originTypeLabels[action.originType];
  const originHref = actionOriginHref(action.originType, action.originId);

  return (
    <article
      data-tone={action.overdue ? 'danger' : actionStatusBadgeVariant(action.status)}
      className={cn(
        cardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 has-[:focus-visible]:border-ring/60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/actions/${action.id}`}
          className="relative z-10 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action.code}
        </Link>

        {canEdit ? (
          <ActionRowMenu
            action={action}
            onTransition={onTransition}
            onReopenRequest={onReopenRequest}
            className="relative z-10 -mt-1 -mr-1"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Link
          href={`/actions/${action.id}`}
          aria-label={card.openLabel(action.code, action.title)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {action.title}
          </span>
        </Link>
        {action.description ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {action.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={actionStatusBadgeVariant(action.status)}
          label={actionStatusLabel(action.status)}
        />
        {action.overdue ? (
          <StatusBadge
            variant="danger"
            label={actions.myActions.indicators.overdue}
            icon={AlertTriangle}
          />
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <Building2 aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.originLabel}</span>
            </dt>
            <dd className="truncate text-foreground">
              {originHref ? (
                <Link
                  href={originHref}
                  className="relative z-10 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {originLabel}
                </Link>
              ) : (
                originLabel
              )}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <User aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.responsibleLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{action.responsible.fullName}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <CalendarClock aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{card.dueOnLabel}</span>
            </dt>
            <dd className="truncate text-foreground">{formatDateOnly(action.dueOn)}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          {card.updatedAt(formatTimestampDate(action.updatedAt))}
        </p>
      </div>
    </article>
  );
}
