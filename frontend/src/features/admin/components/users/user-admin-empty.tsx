'use client';

import { Button } from '@/components/ui/button';
import { admin } from '@/lib/messages/admin';
import { EmptyState } from '@vertice/design-system/components';

export interface UserAdminEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  canCreateUser: boolean;
  onCreateUser: () => void;
}

export function UserAdminEmpty({
  hasActiveFilters,
  onClearFilters,
  canCreateUser,
  onCreateUser,
}: UserAdminEmptyProps): React.JSX.Element {
  const empty = admin.users.empty;

  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        title={empty.noResults.title}
        description={empty.noResults.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {empty.noResults.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      variant="empty"
      title={empty.noneYet.title}
      description={empty.noneYet.description}
      action={
        canCreateUser ? (
          <Button onClick={onCreateUser}>{empty.noneYet.createAction}</Button>
        ) : undefined
      }
    />
  );
}
