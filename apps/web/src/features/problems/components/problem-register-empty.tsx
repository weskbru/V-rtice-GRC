'use client';

/**
 * PharosGRC — problem register empty states, mirroring
 * `risk-register-empty.tsx`'s own two-situation discipline (CLAUDE.md
 * §18.11): "no problem exists yet" (create action) vs. "filters exclude
 * every problem" (clear-filters action) are never collapsed into one
 * generic empty screen.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { problems } from '@/lib/messages/problems';
import { usePermissions } from '@/lib/permissions';

export interface ProblemRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function ProblemRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: ProblemRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();

  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        title={problems.register.empty.noResults.title}
        description={problems.register.empty.noResults.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {problems.register.empty.noResults.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      variant="empty"
      title={problems.register.empty.noneYet.title}
      description={problems.register.empty.noneYet.description}
      action={
        hasPermission('problem:create') ? (
          <Button asChild>
            <Link href="/problems/new">{problems.register.empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
