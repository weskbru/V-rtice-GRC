'use client';

/**
 * PharosGRC — Administration, users register empty states, brought into the
 * shared register family (CLAUDE.md §18.12): mirrors `RiskRegisterEmpty`'s
 * own two-state distinction — "no user exists yet" is never collapsed into
 * "no user matches these filters", the same discipline that state's own
 * doc comment explains in full.
 *
 * `admin.users.empty` was an orphan before this change (grep confirms
 * nothing referenced it): the previous view rendered `DataTable`'s own
 * generic empty row instead of a caller-supplied `emptyContent`, unlike
 * every other register in the product.
 *
 * Unlike `RiskRegisterEmpty`, the create action here is not a `<Link>` to a
 * `/new` route — this screen has no detail route at all, every user action
 * is a dialog — so it calls back into `UserAdminView`'s own
 * `setCreateOpen(true)`.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Button } from '@/components/ui/button';
import { admin } from '@/lib/messages/admin';

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
