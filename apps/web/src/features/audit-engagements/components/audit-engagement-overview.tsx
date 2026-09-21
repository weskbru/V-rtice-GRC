'use client';

/**
 * PharosGRC — audit engagement detail, overview tab (T076).
 *
 * Read-only presentation of the engagement's descriptive and lifecycle
 * facts — `ReadOnlyField` throughout (CLAUDE.md §18: "Read-only values
 * must not look editable"). Editing happens through `AuditEngagementForm`
 * in `mode="edit"`, swapped in by the detail view, never inline here — and
 * only while `status === 'PLANNING'` (research.md D-3/D-13). A `COMPLETED`
 * or `CANCELLED` engagement renders through this exact same component,
 * never a degraded or opaque view (FR-004) — every fact stays fully
 * legible regardless of status.
 */
import { ReadOnlyField } from '@pharos/design-system/components';

import { auditEngagements } from '@/lib/messages/audit-engagements';

import { formatDateOnly, formatTimestampDate } from '../date';

import type { AuditEngagement } from '../types';

export interface AuditEngagementOverviewProps {
  engagement: AuditEngagement;
}

export function AuditEngagementOverview({
  engagement,
}: AuditEngagementOverviewProps): React.JSX.Element {
  const overview = auditEngagements.detail.overview;

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ReadOnlyField full label={overview.objectiveLabel} value={engagement.objective} />
      <ReadOnlyField
        label={overview.periodLabel}
        value={auditEngagements.register.card.periodLabel(
          formatDateOnly(engagement.periodStart),
          formatDateOnly(engagement.periodEnd),
        )}
      />
      <ReadOnlyField label={overview.orgUnitLabel} value={engagement.orgUnit.name} />
      <ReadOnlyField label={overview.leadAuditorLabel} value={engagement.leadAuditor.fullName} />
      <ReadOnlyField
        label={overview.statusLabel}
        value={auditEngagements.statusLabels[engagement.status]}
      />
      <ReadOnlyField
        label={overview.createdAtLabel}
        value={formatTimestampDate(engagement.createdAt)}
      />
      <ReadOnlyField
        label={overview.updatedAtLabel}
        value={formatTimestampDate(engagement.updatedAt)}
      />
      {engagement.status === 'CANCELLED' && engagement.cancellationJustification ? (
        <ReadOnlyField
          full
          label={overview.cancellationJustificationLabel}
          value={engagement.cancellationJustification}
        />
      ) : null}
    </dl>
  );
}
