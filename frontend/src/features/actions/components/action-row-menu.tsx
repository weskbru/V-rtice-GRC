'use client';

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
  onTransition: (action: Action, to: ActionStatus) => void;
  onReopenRequest: (action: Action) => void;
  className?: string;
}

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
