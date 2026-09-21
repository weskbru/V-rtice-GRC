'use client';

/**
 * PharosGRC — asset catalog empty states (T046), mirroring
 * `ControlRegisterEmpty`/`AuditEngagementRegisterEmpty` exactly (CLAUDE.md
 * §18.12) — two genuinely different situations, never collapsed into one
 * generic message.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { assets } from '@/lib/messages/assets';
import { usePermissions } from '@/lib/permissions';

export interface AssetRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function AssetRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: AssetRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const empty = assets.register.empty;

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
        hasPermission('asset:create') ? (
          <Button asChild>
            <Link href="/assets/new">{empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
