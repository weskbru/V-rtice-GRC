import { Button } from '@/components/ui/button';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';
import { EmptyState } from '@vertice/design-system/components';

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
