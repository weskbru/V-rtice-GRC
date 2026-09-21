'use client';

/**
 * PharosGRC — "Minhas ações" empty states (T056, US2). Mirrors
 * `RiskRegisterEmpty`'s own two-variant reasoning (SC-013): "no action
 * exists yet" vs. "actions exist but the current filters exclude all of
 * them" are genuinely different situations, each with its own message and
 * correct next action.
 *
 * No "create" action here (unlike `RiskRegisterEmpty`) — R-009: an Action
 * is always created from the domain screen it arises from, never from this
 * screen directly.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Button } from '@/components/ui/button';
import { actions } from '@/lib/messages/actions';

export interface MyActionsEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function MyActionsEmpty({
  hasActiveFilters,
  onClearFilters,
}: MyActionsEmptyProps): React.JSX.Element {
  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        title={actions.myActions.empty.noResults.title}
        description={actions.myActions.empty.noResults.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {actions.myActions.empty.noResults.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      variant="empty"
      title={actions.myActions.empty.noneYet.title}
      description={actions.myActions.empty.noneYet.description}
    />
  );
}
