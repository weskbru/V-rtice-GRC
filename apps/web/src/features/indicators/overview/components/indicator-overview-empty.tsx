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
