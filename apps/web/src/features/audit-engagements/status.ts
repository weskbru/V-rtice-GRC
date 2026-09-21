/**
 * PharosGRC — audit engagement lifecycle display mapping (T076, CLAUDE.md
 * §18.8).
 *
 * Maps `AuditEngagementStatus` to a `StatusBadge` variant and icon. Purely
 * presentational — the lifecycle table itself (which transitions are
 * legal, from which state, and their preconditions) is owned entirely by
 * the server and locally re-derived, read-only, by
 * `AuditEngagementLifecycleActions` from `research.md` D-3/FR-004a; nothing
 * here encodes or duplicates that rule set.
 *
 * The four states are never conveyed by colour alone (CLAUDE.md §18.8):
 * `PLANNING` and `CANCELLED` share the same `neutral` `StatusVariant`
 * (`../../lib/messages/audit-engagements.ts`'s own `statusVariant`) but
 * carry visibly different icons and, always, their distinct text label —
 * a colour-blind reader never has to rely on hue to tell an engagement
 * that hasn't started yet from one that was discarded.
 */
import { Ban, CheckCircle2, Loader2, NotebookPen } from 'lucide-react';

import { auditEngagements } from '@/lib/messages/audit-engagements';

import type { AuditEngagementStatus } from './types';
import type { StatusVariant } from '@pharos/design-system/components';
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
