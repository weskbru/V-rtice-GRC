'use client';

/**
 * PharosGRC — the "Planos de Ação" row-actions menu (lifecycle
 * transitions), shared by the table column (`my-actions-columns.tsx`) and
 * the card view (`action-card.tsx`) — ONE component, not two independent
 * copies of the same permission-gated menu (the coordinator's explicit
 * instruction for this task, the same discipline `origin.ts`'s own header
 * documents for origin routing).
 *
 * Every transition offered here is advisory only (FR-042) — the server
 * re-validates the full legality table and every permission/scope check
 * independently on submit (`status.ts`'s own header).
 */
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { actions } from '@/lib/messages/actions';

import { availableTransitions } from '../status';

import type { Action, ActionStatus } from '../types';

export interface ActionRowMenuProps {
  action: Action;
  /** Called for every transition EXCEPT reopen (`to: 'OPEN'`), which requires a reason and is routed through `onReopenRequest` instead. */
  onTransition: (action: Action, to: ActionStatus) => void;
  onReopenRequest: (action: Action) => void;
  className?: string;
}

/** `null` when this action's status offers no legal transition (a terminal status, e.g. `CANCELLED`) — callers render nothing rather than a menu with no items. Permission gating (`action:edit`) is the CALLER's responsibility: `MyActionsView`/`ActionCard` render this component at all only when `canEdit` is true. */
export function ActionRowMenu({
  action,
  onTransition,
  onReopenRequest,
  className,
}: ActionRowMenuProps): React.JSX.Element | null {
  const options = availableTransitions(action.status);
  if (options.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={actions.myActions.card.rowActionsLabel}
          className={className}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.to}
            onSelect={() => {
              if (option.requiresReason) {
                onReopenRequest(action);
              } else {
                onTransition(action, option.to);
              }
            }}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
