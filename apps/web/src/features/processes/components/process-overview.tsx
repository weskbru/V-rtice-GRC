'use client';

/**
 * PharosGRC — process detail, overview tab (T047).
 *
 * Read-only presentation of the process's descriptive facts — `ReadOnlyField`
 * throughout (CLAUDE.md §18: "Read-only values must not look editable").
 * Editing happens through `ProcessForm` in `mode="edit"`, swapped in by the
 * detail view, never inline here.
 */
import { ReadOnlyField, StatusBadge } from '@pharos/design-system/components';

import { processes } from '@/lib/messages/processes';

import { formatTimestampDate } from '../date';
import { processSituationLabel, processSituationVariant } from '../situation';

import type { ProcessDetail } from '../types';

export interface ProcessOverviewProps {
  process: ProcessDetail;
}

export function ProcessOverview({ process }: ProcessOverviewProps): React.JSX.Element {
  const overview = processes.detail.overview;

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ReadOnlyField
        full
        label={overview.descriptionLabel}
        value={process.description ?? overview.noDescription}
      />
      <ReadOnlyField
        label={overview.situationLabel}
        value={
          <StatusBadge
            variant={processSituationVariant(process.isActive)}
            label={processSituationLabel(process.isActive)}
          />
        }
      />
      <ReadOnlyField
        label={overview.orgUnitLabel}
        value={process.orgUnit?.name ?? processes.detail.metadata.noOrgUnit}
      />
      <ReadOnlyField
        label={overview.createdAtLabel}
        value={formatTimestampDate(process.createdAt)}
      />
      <ReadOnlyField
        label={overview.updatedAtLabel}
        value={formatTimestampDate(process.updatedAt)}
      />
    </dl>
  );
}
