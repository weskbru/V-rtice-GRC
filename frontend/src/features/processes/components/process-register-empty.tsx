'use client';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { processes } from '@/lib/messages/processes';
import { usePermissions } from '@/lib/permissions';
import { EmptyState } from '@vertice/design-system/components';

export interface ProcessRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function ProcessRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: ProcessRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const empty = processes.register.empty;

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
        hasPermission('process:create') ? (
          <Button asChild>
            <Link href="/processes/new">{empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
