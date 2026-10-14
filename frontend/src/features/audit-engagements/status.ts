import { Ban, CheckCircle2, Loader2, NotebookPen } from 'lucide-react';

import { auditEngagements } from '@/lib/messages/audit-engagements';

import type { AuditEngagementStatus } from './types';
import type { StatusVariant } from '@vertice/design-system/components';
import type { ComponentType, SVGProps } from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const STATUS_ICON: Record<AuditEngagementStatus, Icon> = {
  PLANNING: NotebookPen,
  IN_PROGRESS: Loader2,
  COMPLETED: CheckCircle2,
  CANCELLED: Ban,
};

export function engagementStatusBadgeVariant(status: AuditEngagementStatus): StatusVariant {
  return auditEngagements.statusVariant[status];
}

export function engagementStatusIcon(status: AuditEngagementStatus): Icon {
  return STATUS_ICON[status];
}

export function engagementStatusLabel(status: AuditEngagementStatus): string {
  return auditEngagements.statusLabels[status];
}
