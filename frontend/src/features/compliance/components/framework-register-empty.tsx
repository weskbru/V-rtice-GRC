'use client';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { compliance } from '@/lib/messages/compliance';
import { usePermissions } from '@/lib/permissions';
import { EmptyState } from '@vertice/design-system/components';

export interface FrameworkRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function FrameworkRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: FrameworkRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();

  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        title={compliance.register.empty.noResults.title}
        description={compliance.register.empty.noResults.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {compliance.register.empty.noResults.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      variant="empty"
      title={compliance.register.empty.noneYet.title}
      description={compliance.register.empty.noneYet.description}
      action={
        hasPermission('compliance:administer') ? (
          <Button asChild>
            <Link href="/compliance/new">{compliance.register.empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
