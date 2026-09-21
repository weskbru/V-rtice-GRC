/**
 * PharosGRC — risk detail, the "Ciclo de vida" block within Visão geral
 * (016-risk-detail-experience §4.5/§4.6, consolidated per P1 2026-09-15).
 *
 * Composes the lifecycle spine visual (`RiskLifecycleSpineView`, built from
 * `buildRiskLifecycleSpine`) INSIDE `RiskLifecycleActions`'s own card, via
 * its `trajectory` slot — ONE card, ONE "Ciclo de vida" title, instead of a
 * separate "Trajetória do ciclo de vida" block stacked above a second card.
 *
 * This merge exists because the two used to duplicate the SAME blocked-
 * transition pendency on screen: the spine's own pill carried the full
 * precondition sentence, and `RiskLifecycleActions` showed the identical
 * sentence again under its disabled button — the opposite of information
 * density (CLAUDE.md §18.5). The trajectory (`RiskLifecycleSpineView`) now
 * renders ONLY state — never precondition text (see its own doc comment);
 * `RiskLifecycleActions` remains the ONE place that sentence appears.
 *
 * `lifecycle`/`loading`/`loadError` are handed down from `RiskDetailView`'s
 * own `useRiskLifecycle` — this component fetches nothing itself.
 */
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
