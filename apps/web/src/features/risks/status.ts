/**
 * PharosGRC — risk lifecycle status display mapping (FR-079, FR-091).
 *
 * Maps `RiskStatus` to a `StatusBadge` variant. Purely presentational — the
 * lifecycle itself (which transitions are legal, which require approval) is
 * owned entirely by the server (ADR-006, FR-080); nothing here encodes or
 * duplicates that rule set.
 */
import { risks } from '@/lib/messages/risks';

import type { RiskStatus } from './types';
import type { StatusVariant } from '@pharos/design-system/components';

const VARIANT_BY_STATUS: Record<RiskStatus, StatusVariant> = {
  DRAFT: 'neutral',
  IDENTIFIED: 'info',
  ASSESSED: 'info',
  UNDER_TREATMENT: 'warning',
  UNDER_REVIEW: 'warning',
  ACCEPTED: 'success',
  CLOSED: 'neutral',
  ARCHIVED: 'neutral',
};

export function riskStatusBadgeVariant(status: RiskStatus): StatusVariant {
  return VARIANT_BY_STATUS[status];
}

export function riskStatusLabel(status: RiskStatus): string {
  // `risks.statusLabels` is `Record<RiskStatus, string>` (F-1) — indexing by
  // a valid `RiskStatus` can never miss, so no fallback is needed here.
  return risks.statusLabels[status];
}

function isRiskStatus(value: string): value is RiskStatus {
  return Object.prototype.hasOwnProperty.call(risks.statusLabels, value);
}

/** The only two transition targets the declarative table gates behind an approval in this release (ADR-006) — `RequestApprovalRequest.toStatus` mirrors exactly this pair, never the full `RiskStatus` union. */
export function isApprovalGatedTarget(status: RiskStatus): status is 'ACCEPTED' | 'CLOSED' {
  return status === 'ACCEPTED' || status === 'CLOSED';
}

/**
 * Translates a server-supplied `Approval.requestedTransition` string (e.g.
 * `"UNDER_TREATMENT->ACCEPTED"`, risks.openapi.yaml) into pt-BR labels for
 * display — e.g. "Em tratamento → Aceito" (US6). This only relabels two
 * `RiskStatus` identifiers the server already sent; it never decides
 * whether a transition is legal or derives the pair itself (ADR-006 stays
 * the sole authority on the transition table). Falls back to the raw
 * string when either side is not a recognized status, so an unexpected
 * shape degrades to something visible rather than a blank.
 */
export function formatLifecycleTransitionLabel(requestedTransition: string): string {
  const [from, to] = requestedTransition.split('->');
  if (from && to && isRiskStatus(from) && isRiskStatus(to)) {
    return `${riskStatusLabel(from)} → ${riskStatusLabel(to)}`;
  }
  return requestedTransition;
}
