/**
 * PharosGRC — empty-filtered-result state for the redesigned `/indicators`
 * first screen (indicators-round, S1 ownership, coordinator PLAN.md §2
 * step 6).
 *
 * Only ever rendered when the search/domain filter excludes all 11 catalog
 * items — never when the catalog itself is empty (the closed 11-key catalog
 * is never empty, `s1-backend-domain.md` Q9), so this is always the
 * `'no-results'` variant of the platform-wide `EmptyState` (FR-045), never
 * the generic `'empty'` one.
 */
import { EmptyState } from '@pharos/design-system/components';

import { Button } from '@/components/ui/button';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';

export interface IndicatorOverviewEmptyProps {
  readonly onClearFilters: () => void;
}

export function IndicatorOverviewEmpty({
  onClearFilters,
}: IndicatorOverviewEmptyProps): React.JSX.Element {
  const states = indicators.overview.states;
  return (
    <EmptyState
      variant="no-results"
      title={states.emptyFilteredTitle}
      description={states.emptyFilteredDescription}
      action={
        <Button variant="outline" onClick={onClearFilters}>
          {common.actions.clearFilters}
        </Button>
      }
    />
  );
}
