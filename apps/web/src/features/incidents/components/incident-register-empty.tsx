'use client';

/**
 * PharosGRC — incident register empty states (008-incidents-problems,
 * US1), mirroring `AssetRegisterEmpty`/`ProblemRegisterEmpty` exactly
 * (CLAUDE.md §18.12) — two genuinely different situations ("nothing has
 * ever been registered" vs. "the current filters match nothing"), never
 * collapsed into one generic message.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { incidents } from '@/lib/messages/incidents';
import { usePermissions } from '@/lib/permissions';

export interface IncidentRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function IncidentRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: IncidentRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const empty = incidents.register.empty;

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
        hasPermission('incident:create') ? (
          <Button asChild>
            <Link href="/incidents/new">{empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
