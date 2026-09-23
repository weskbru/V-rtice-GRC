'use client';

import { EmptyState } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { controls } from '@/lib/messages/controls';
import { usePermissions } from '@/lib/permissions';

export interface ControlRegisterEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function ControlRegisterEmpty({
  hasActiveFilters,
  onClearFilters,
}: ControlRegisterEmptyProps): React.JSX.Element {
  const { hasPermission } = usePermissions();

  if (hasActiveFilters) {
    return (
      <EmptyState
        variant="no-results"
        title={controls.register.empty.noResults.title}
        description={controls.register.empty.noResults.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {controls.register.empty.noResults.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      variant="empty"
      title={controls.register.empty.noneYet.title}
      description={controls.register.empty.noneYet.description}
      action={
        hasPermission('control:create') ? (
          <Button asChild>
            <Link href="/controls/new">{controls.register.empty.noneYet.createAction}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
