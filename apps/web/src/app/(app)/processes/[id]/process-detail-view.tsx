'use client';

/**
 * PharosGRC — process detail screen (T047, US1, FR-008), mirroring
 * `ControlDetailView`'s/`AuditEngagementDetailView`'s structure exactly
 * (CLAUDE.md §18.12): `EntityHeader` + `EntityTabs`, a 404 rendered
 * identically whether the process does not exist or lies outside the
 * caller's organizational scope (non-disclosure, `features/processes/api.ts`'s
 * own doc comment).
 *
 * No `ETag`/conflict handling anywhere here — `processes` carries no `version`
 * column (`features/processes/types.ts`'s own header comment).
 */
import {
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { processesApi } from '@/features/processes/api';
import { ProcessForm } from '@/features/processes/components/process-form';
import { ProcessLifecycleActions } from '@/features/processes/components/process-lifecycle-actions';
import {
  ProcessLinkedControlsSection,
  ProcessLinkedIncidentsSection,
  ProcessLinkedRisksSection,
} from '@/features/processes/components/process-linked-entities-section';
import { ProcessOverview } from '@/features/processes/components/process-overview';
import { formatTimestampDate } from '@/features/processes/date';
import { processSituationLabel, processSituationVariant } from '@/features/processes/situation';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { processes } from '@/lib/messages/processes';
import { usePermissions } from '@/lib/permissions';

import type { ProcessDetail } from '@/features/processes/types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface ProcessDetailViewProps {
  processId: string;
}

export function ProcessDetailView({ processId }: ProcessDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await processesApi.getProcess(processId);
        if (!cancelled) {
          setProcess(result);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else if (error instanceof ApiError) {
          setProblem({
            title: error.problem.title,
            detail: error.problem.detail,
            correlationId: error.problem.correlationId,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [processId]);

  if (loading) {
    return <LoadingState variant="block" label={processes.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={processes.detail.notFoundTitle}
        description={processes.detail.notFoundDescription}
      />
    );
  }

  if (!process) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('process:edit');
  const canAdminister = hasPermission('process:administer');

  return (
    <div className="flex flex-col gap-6">
      <EntityHeader
        code={process.code}
        title={process.name}
        badges={
          <StatusBadge
            variant={processSituationVariant(process.isActive)}
            label={processSituationLabel(process.isActive)}
          />
        }
        metadata={
          <>
            <span>
              {process.orgUnit
                ? processes.detail.metadata.orgUnit(process.orgUnit.name)
                : processes.detail.metadata.noOrgUnit}
            </span>
            <span>
              {processes.detail.metadata.createdAt(formatTimestampDate(process.createdAt))}
            </span>
            <span>
              {processes.detail.metadata.updatedAt(formatTimestampDate(process.updatedAt))}
            </span>
          </>
        }
        actions={
          canEdit && !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="size-4" />
              {processes.detail.editAction}
            </Button>
          ) : null
        }
      />

      <ProcessLifecycleActions
        process={process}
        canAdminister={canAdminister}
        onChanged={(updated) => setProcess(updated)}
      />

      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={{
          scrollBack: common.entityTabs.scrollBack,
          scrollForward: common.entityTabs.scrollForward,
        }}
        tabs={[
          {
            id: 'overview',
            label: processes.detail.sections.overview,
            content: editing ? (
              <ProcessForm
                mode="edit"
                process={process}
                onSaved={(updated) => {
                  setProcess(updated);
                  setEditing(false);
                }}
              />
            ) : (
              <ProcessOverview process={process} />
            ),
          },
          {
            id: 'risks',
            label: processes.detail.sections.risks,
            content: <ProcessLinkedRisksSection risks={process.risks} />,
          },
          {
            id: 'controls',
            label: processes.detail.sections.controls,
            content: <ProcessLinkedControlsSection controls={process.controls} />,
          },
          {
            id: 'incidents',
            label: processes.detail.sections.incidents,
            content: <ProcessLinkedIncidentsSection processId={process.id} />,
          },
        ]}
      />
    </div>
  );
}
