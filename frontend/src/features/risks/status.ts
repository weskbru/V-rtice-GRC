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
  return risks.statusLabels[status];
}

function isRiskStatus(value: string): value is RiskStatus {
  return Object.prototype.hasOwnProperty.call(risks.statusLabels, value);
}

export function isApprovalGatedTarget(status: RiskStatus): status is 'ACCEPTED' | 'CLOSED' {
  return status === 'ACCEPTED' || status === 'CLOSED';
}

export function formatLifecycleTransitionLabel(requestedTransition: string): string {
  const [from, to] = requestedTransition.split('->');
  if (from && to && isRiskStatus(from) && isRiskStatus(to)) {
    return `${riskStatusLabel(from)} → ${riskStatusLabel(to)}`;
  }
  return requestedTransition;
}
