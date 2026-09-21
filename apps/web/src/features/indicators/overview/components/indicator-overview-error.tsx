/**
 * PharosGRC — page-level error state for the redesigned `/indicators` first
 * screen, when `GET /dashboard/summary` itself fails (indicators-round, S1
 * ownership, coordinator PLAN.md §2 step 6).
 *
 * `useIndicatorOverview` treats a summary failure as a hard error
 * (`status: 'error'`) precisely because it is the ONLY source of current
 * values (S2's own header, `overview/use-indicator-overview.ts`) — there is
 * nothing honest to render in its place, never a page of elevens zeros.
 * Reuses the platform-wide `ErrorState` (FR-045) rather than a bespoke
 * error block.
 */
import { ErrorState } from '@pharos/design-system/components';

import { Button } from '@/components/ui/button';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';

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
