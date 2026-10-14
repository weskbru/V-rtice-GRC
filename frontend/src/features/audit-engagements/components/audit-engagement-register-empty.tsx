'use client';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { usePermissions } from '@/lib/permissions';
import { EmptyState } from '@vertice/design-system/components';

export interface AuditEngagementRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function AuditEngagementRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: AuditEngagementRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const empty = auditEngagements.register.empty;

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
        hasPermission('audit-engagement:create') ? (
          <Button asChild>
            <Link href="/audits/new">{empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
