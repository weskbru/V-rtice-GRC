'use client';

/**
 * PharosGRC — report catalog empty states (009-indicators-reports, T061), mirroring
 * `features/incidents/components/incident-register-empty.tsx` exactly (CLAUDE.md §18.12) — two
 * genuinely different situations ("nothing has ever been registered" vs. "the current filter
 * matches nothing"), never collapsed into one generic message.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { reports } from '@/lib/messages/reports';
import { usePermissions } from '@/lib/permissions';

export interface ReportRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function ReportRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: ReportRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();

  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        title={reports.register.noResults.title}
        description={reports.register.noResults.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {reports.register.noResults.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      variant="empty"
      title={reports.register.empty.title}
      description={reports.register.empty.description}
      action={
        hasPermission('report:create') ? (
          <Button asChild>
            <Link href="/reports/new">{reports.register.empty.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
