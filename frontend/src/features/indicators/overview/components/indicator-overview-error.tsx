import { Button } from '@/components/ui/button';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';
import { ErrorState } from '@vertice/design-system/components';

export interface IndicatorOverviewErrorProps {
  readonly onRetry: () => void;
}

export function IndicatorOverviewError({
  onRetry,
}: IndicatorOverviewErrorProps): React.JSX.Element {
  const states = indicators.overview.states;
  return (
    <ErrorState
      title={states.summaryErrorTitle}
      message={states.summaryErrorMessage}
      action={
        <Button variant="outline" onClick={onRetry}>
          {common.actions.retry}
        </Button>
      }
    />
  );
}
