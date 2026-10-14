'use client';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { risks } from '@/lib/messages/risks';
import { usePermissions } from '@/lib/permissions';
import { EmptyState } from '@vertice/design-system/components';

export interface RiskRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function RiskRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: RiskRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();

  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        title={risks.register.empty.noResults.title}
        description={risks.register.empty.noResults.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {risks.register.empty.noResults.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      variant="empty"
      title={risks.register.empty.noneYet.title}
      description={risks.register.empty.noneYet.description}
      action={
        hasPermission('risk:create') ? (
          <Button asChild>
            <Link href="/risks/new">{risks.register.empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
