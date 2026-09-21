/**
 * PharosGRC — pending-approval indicator (T162, US6, FR-029c).
 *
 * A single component, reused verbatim on the risk register (T111's status
 * column, `risk-register-columns.tsx`) and on the risk detail header
 * (`risk-detail-view.tsx`) — both surfaces read the exact same
 * `pendingApproval: boolean` flag (`RiskSummary`, which `RiskDetail`
 * extends), so there is exactly one place that decides what "an approval is
 * pending" looks like, never two independently maintained renderings that
 * could drift apart.
 *
 * Renders nothing when no approval is pending — this is an indicator, not a
 * placeholder; an absent condition has no visual representation (SC-013).
 * Uses `StatusBadge`, which already pairs an icon, a color and a text label
 * (FR-091, SC-012) — this component adds no logic of its own beyond
 * "pending or not", never re-deriving what "pending" means (that is the
 * server's `Approval` record, ADR-006).
 */
import { StatusBadge } from '@pharos/design-system/components';

import { risks } from '@/lib/messages/risks';

export interface PendingApprovalBadgeProps {
  /** Whether an approval is currently awaiting decision on this risk (`RiskSummary.pendingApproval`/`RiskDetail.pendingApproval`). */
  pending: boolean;
}

export function PendingApprovalBadge({
  pending,
}: PendingApprovalBadgeProps): React.JSX.Element | null {
  if (!pending) {
    return null;
  }

  return <StatusBadge variant="info" label={risks.lifecycle.pendingApprovalBadge.label} />;
}
