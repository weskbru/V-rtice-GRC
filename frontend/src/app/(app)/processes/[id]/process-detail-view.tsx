'use client';

import { Eye, Pencil, ShieldAlert, ShieldCheck, Siren } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { processesApi } from '@/features/processes/api';
import { ProcessContextAside } from '@/features/processes/components/detail/process-context-aside';
import { ProcessEditPanel } from '@/features/processes/components/detail/process-edit-panel';
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
import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@vertice/design-system/components';

import type { ProcessDetail } from '@/features/processes/types';
import type { EntityTab, ErrorStateProblem } from '@vertice/design-system/components';

export interface ProcessDetailViewProps {
  processId: string;
}

export function ProcessDetailView({ processId }: ProcessDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={processes.detail.loading} />}>
      <ProcessDetailViewContent processId={processId} />
    </Suspense>
  );
}

function ProcessDetailViewContent({ processId }: ProcessDetailViewProps): React.JSX.Element {
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

  const { sectionParam, setSection } = useDetailSection();

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

  const tabs: EntityTab[] = [
    {
      id: 'overview',
      label: processes.detail.sections.overview,
      icon: Eye,
      content: (
        <div className="flex flex-col gap-4">
          <ProcessOverview process={process} />
          <ProcessLifecycleActions
            process={process}
            canAdminister={canAdminister}
            onChanged={(updated) => setProcess(updated)}
          />
        </div>
      ),
    },
    {
      id: 'risks',
      label: processes.detail.sections.risks,
      icon: ShieldAlert,
      content: <ProcessLinkedRisksSection risks={process.risks} />,
    },
    {
      id: 'controls',
      label: processes.detail.sections.controls,
      icon: ShieldCheck,
      content: <ProcessLinkedControlsSection controls={process.controls} />,
    },
    {
      id: 'incidents',
      label: processes.detail.sections.incidents,
      icon: Siren,
      content: <ProcessLinkedIncidentsSection processId={process.id} />,
    },
  ];

  const activeSectionId = tabs.some((tab) => tab.id === sectionParam) ? sectionParam! : tabs[0]!.id;

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/processes" className="hover:underline">
                  {processes.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{process.code}</span>
              </>
            }
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
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {processes.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={common.entityTabs.sectionsAriaLabel}
            scrollLabels={{
              scrollBack: common.entityTabs.scrollBack,
              scrollForward: common.entityTabs.scrollForward,
            }}
            value={sectionParam ?? ''}
            onValueChange={setSection}
            tabs={tabs}
            size="compact"
          />
        }
        aside={<ProcessContextAside process={process} activeSectionId={activeSectionId} />}
        asideLabel={processes.detail.asideLabel}
      />

      {editing ? (
        <ProcessEditPanel
          process={process}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setProcess(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
