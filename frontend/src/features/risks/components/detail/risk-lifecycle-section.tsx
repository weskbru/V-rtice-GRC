import { RiskLifecycleActions } from '../risk-lifecycle-actions';

import { buildRiskLifecycleSpine } from './risk-lifecycle-spine';
import { RiskLifecycleSpineView } from './risk-lifecycle-spine-view';

import type { RiskLifecycleState } from '../../types';

export interface RiskLifecycleSectionProps {
  riskId: string;
  etag: string;
  currentUserId: string;
  canApprove: boolean;
  lifecycle: RiskLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  onChanged: () => void;
}

export function RiskLifecycleSection({
  riskId,
  etag,
  currentUserId,
  canApprove,
  lifecycle,
  loading,
  loadError,
  onChanged,
}: RiskLifecycleSectionProps): React.JSX.Element {
  const trajectory =
    !loading && !loadError && lifecycle ? (
      <RiskLifecycleSpineView
        model={buildRiskLifecycleSpine(
          lifecycle.status,
          lifecycle.availableTransitions,
          lifecycle.traversedStatuses,
        )}
      />
    ) : undefined;

  return (
    <RiskLifecycleActions
      riskId={riskId}
      etag={etag}
      currentUserId={currentUserId}
      canApprove={canApprove}
      lifecycle={lifecycle}
      loading={loading}
      loadError={loadError}
      onChanged={onChanged}
      trajectory={trajectory}
    />
  );
}
