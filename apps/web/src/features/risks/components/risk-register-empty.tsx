'use client';

/**
 * PharosGRC — risk register empty states (T113, US3 AS7).
 *
 * Two genuinely different situations, each with its own message and its
 * own correct next action — never collapsed into one generic "no risks"
 * screen (SC-013 forbids inventing a state that hides the distinction):
 *
 *   - `hasActiveFilters: false` — the caller's organizational scope
 *     contains no risk at all yet. The action is to create the first one
 *     (gated by `risk:create`, advisory-only per `usePermissions`).
 *   - `hasActiveFilters: true` — risks exist, but the current filters/search
 *     exclude every one of them. The action is to clear the filters, not to
 *     create a risk that may already exist outside the current filter.
 *
 * `RiskRegisterView` decides which one applies from the request it actually
 * made (US3 AS7: "the client distinguishes the two from the request it
 * made") — see its own doc comment.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { risks } from '@/lib/messages/risks';
import { usePermissions } from '@/lib/permissions';

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
