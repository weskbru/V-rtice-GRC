import { StatusBadge } from '@pharos/design-system/components';

import { risks } from '@/lib/messages/risks';

export interface PendingApprovalBadgeProps {
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
