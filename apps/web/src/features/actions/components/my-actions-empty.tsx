'use client';

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
