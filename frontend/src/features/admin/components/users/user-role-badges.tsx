'use client';

import { useLayoutEffect, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { admin } from '@/lib/messages/admin';
import { roleDisplayName } from '@/lib/role-display-name';
import { EmptyValue } from '@vertice/design-system/components';

import type { AdminRoleRef } from '../../types';

const ROLE_BADGE_CLASS =
  'inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground';
const OVERFLOW_BADGE_CLASS =
  'inline-flex shrink-0 items-center rounded-md border border-transparent bg-muted px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const CHAR_WIDTH_PX = 7;
const BADGE_CHROME_PX = 14;
const GAP_PX = 4;

function estimateBadgeWidth(label: string): number {
  return Math.ceil(label.length * CHAR_WIDTH_PX) + BADGE_CHROME_PX;
}

function computeFitCount(labels: readonly string[], maxWidthPx: number): number {
  if (labels.length === 0) return 0;

  let used = 0;
  let count = 0;
  for (let i = 0; i < labels.length; i++) {
    const isLast = i === labels.length - 1;
    const remainingAfterThis = labels.length - (i + 1);
    const overflowReserve =
      !isLast && remainingAfterThis > 0 ? estimateBadgeWidth(`+${remainingAfterThis}`) + GAP_PX : 0;
    const thisBadge = estimateBadgeWidth(labels[i]!) + (i > 0 ? GAP_PX : 0);

    if (count === 0 || used + thisBadge + overflowReserve <= maxWidthPx) {
      used += thisBadge;
      count++;
    } else {
      break;
    }
  }
  return count;
}

export interface UserRoleBadgesProps {
  roles: readonly AdminRoleRef[];
  widthBudget: number | 'measure';
}

export function UserRoleBadges({ roles, widthBudget }: UserRoleBadgesProps): React.JSX.Element {
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const isMeasureMode = widthBudget === 'measure';

  useLayoutEffect(() => {
    if (!isMeasureMode || !containerNode) return undefined;
    const measure = (): void => setMeasuredWidth(containerNode.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [isMeasureMode, containerNode]);

  if (roles.length === 0) {
    return <EmptyValue>{admin.users.table.noRoles}</EmptyValue>;
  }

  const labels = roles.map((role) => roleDisplayName(role.name));
  const effectiveWidth = isMeasureMode ? measuredWidth : widthBudget;
  const visibleCount = computeFitCount(labels, effectiveWidth);
  const preview = roles.slice(0, visibleCount);
  const hidden = roles.slice(visibleCount);
  const messages = admin.users.rolesOverflow;

  return (
    <div ref={setContainerNode} className="flex w-full flex-nowrap items-center gap-1">
      {preview.map((role) => (
        <span key={role.id} className={ROLE_BADGE_CLASS}>
          {roleDisplayName(role.name)}
        </span>
      ))}
      {hidden.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={messages.moreAriaLabel(
                hidden.length,
                hidden.map((role) => roleDisplayName(role.name)).join(', '),
              )}
              className={OVERFLOW_BADGE_CLASS}
            >
              {messages.moreLabel(hidden.length)}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            role="group"
            aria-label={messages.popoverRegionLabel}
            className="w-auto max-w-64 p-2"
          >
            <ul className="flex flex-col gap-1">
              {hidden.map((role) => (
                <li key={role.id}>
                  <span className={ROLE_BADGE_CLASS}>{roleDisplayName(role.name)}</span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
