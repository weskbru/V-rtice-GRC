'use client';

import { Eye, FilePlus, Link2, ListChecks, Pencil } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { controlsApi } from '@/features/controls/api';
import { ControlAssessmentForm } from '@/features/controls/components/control-assessment-form';
import { ControlAssessmentHistory } from '@/features/controls/components/control-assessment-history';
import { ControlLinksSection } from '@/features/controls/components/control-links-section';
import { ControlOverview } from '@/features/controls/components/control-overview';
import { ControlContextAside } from '@/features/controls/components/detail/control-context-aside';
import { ControlEditPanel } from '@/features/controls/components/detail/control-edit-panel';
import { ControlLifecycleSection } from '@/features/controls/components/detail/control-lifecycle-section';
import { useControlLifecycle } from '@/features/controls/components/detail/use-control-lifecycle';
import {
  controlEffectivenessBadgeVariant,
  controlEffectivenessIcon,
  controlEffectivenessLabel,
  controlStatusBadgeVariant,
  controlStatusIcon,
  controlStatusLabel,
} from '@/features/controls/status';
import { EvidencePanel } from '@/features/evidence/components/evidence-panel';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';
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

import type { ControlDetail } from '@/features/controls/types';
import type { EntityTab, ErrorStateProblem } from '@vertice/design-system/components';

export interface ControlDetailViewProps {
  controlId: string;
}

export function ControlDetailView({ controlId }: ControlDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={controls.detail.loading} />}>
      <ControlDetailViewContent controlId={controlId} />
    </Suspense>
  );
}

function ControlDetailViewContent({ controlId }: ControlDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [control, setControl] = useState<ControlDetail | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [assessmentRefreshToken, setAssessmentRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await controlsApi.getControl(controlId);
        if (!cancelled) {
          setControl(result.control);
          setEtag(result.etag);
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
  }, [controlId]);

  const {
    lifecycle,
    loading: lifecycleLoading,
    loadError: lifecycleLoadError,
    reload: reloadLifecycle,
  } = useControlLifecycle(controlId, etag);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={controls.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={controls.detail.notFoundTitle}
        description={controls.detail.notFoundDescription}
      />
    );
  }

  if (!control || !etag) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('control:edit');
  const canTest = hasPermission('control:test');
  const canApprove = hasPermission('control:approve');
  const canViewEvidence = hasPermission('evidence:view');
  const canCreateEvidence = hasPermission('evidence:create');
  const canLinkEvidence = hasPermission('evidence:link');
  const canAdministerEvidence = hasPermission('evidence:administer');
  const canUploadAttachment = hasPermission('attachment:create');
  const canWithdrawAttachment = hasPermission('attachment:delete');
  const canLinkRelationships = canEdit && control.status !== 'RETIRED';

  async function reloadControl(): Promise<void> {
    try {
      const result = await controlsApi.getControl(controlId);
      setControl(result.control);
      setEtag(result.etag);
    } catch {}
  }

  function handleLifecycleChanged(): void {
    void reloadControl();
    void reloadLifecycle();
  }

  const tabs: EntityTab[] = [
    {
      id: 'overview',
      label: controls.detail.sections.overview,
      icon: Eye,
      content: (
        <div className="flex flex-col gap-6">
          <ControlOverview control={control} />
          <ControlLifecycleSection
            control={control}
            etag={etag}
            lifecycle={lifecycle}
            loading={lifecycleLoading}
            loadError={lifecycleLoadError}
            onChanged={handleLifecycleChanged}
          />
        </div>
      ),
    },
    {
      id: 'assessments',
      label: controls.detail.sections.assessments,
      icon: ListChecks,
      content: (
        <div className="flex flex-col gap-6">
          {canTest ? (
            <ControlAssessmentForm
              controlId={control.id}
              controlIsActive={control.status === 'ACTIVE'}
              onAssessed={() => {
                void reloadControl();
                setAssessmentRefreshToken((token) => token + 1);
              }}
            />
          ) : null}
          <ControlAssessmentHistory
            controlId={control.id}
            controlOwnerId={control.owner?.id ?? null}
            currentUserId={user.id}
            canTest={canTest}
            canApprove={canApprove}
            refreshToken={assessmentRefreshToken}
          />
        </div>
      ),
    },
    {
      id: 'relationships',
      label: controls.detail.sections.relationships,
      icon: Link2,
      content: (
        <ControlLinksSection controlId={control.id} canLinkRelationships={canLinkRelationships} />
      ),
    },
    {
      id: 'evidence',
      label: controls.detail.sections.evidence,
      icon: FilePlus,
      content: (
        <EvidencePanel
          subjectType="CONTROL"
          subjectId={control.id}
          orgUnitId={control.orgUnit?.id ?? ''}
          defaultOwnerUserId={user.id}
          canCreate={canCreateEvidence}
          canLink={canLinkEvidence}
          canAdminister={canAdministerEvidence}
          canUploadAttachment={canUploadAttachment}
          canWithdrawAttachment={canWithdrawAttachment}
        />
      ),
      visible: canViewEvidence,
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.visible !== false);
  const activeSectionId = visibleTabs.some((tab) => tab.id === sectionParam)
    ? sectionParam!
    : visibleTabs[0]!.id;

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/controls" className="hover:underline">
                  {controls.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{control.code}</span>
              </>
            }
            code={control.code}
            title={control.name}
            badges={
              <>
                <StatusBadge
                  variant={controlStatusBadgeVariant(control.status)}
                  label={controlStatusLabel(control.status)}
                  icon={controlStatusIcon(control.status)}
                />
                <StatusBadge
                  variant={controlEffectivenessBadgeVariant(control.effectiveness)}
                  label={controlEffectivenessLabel(control.effectiveness)}
                  icon={controlEffectivenessIcon(control.effectiveness)}
                />
              </>
            }
            metadata={
              <>
                <span>
                  {control.owner
                    ? controls.detail.metadata.owner(control.owner.fullName)
                    : controls.detail.metadata.noOwner}
                </span>
                <span>
                  {control.orgUnit
                    ? controls.detail.metadata.orgUnit(control.orgUnit.name)
                    : controls.detail.metadata.noOrgUnit}
                </span>
                <span>
                  {controls.detail.metadata.createdAt(
                    new Date(control.createdAt).toLocaleDateString('pt-BR'),
                  )}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {controls.detail.editAction}
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
        aside={
          <ControlContextAside
            control={control}
            activeSectionId={activeSectionId}
            canTest={canTest}
            canLinkRelationships={canLinkRelationships}
            canCreateEvidence={canCreateEvidence}
            canViewEvidence={canViewEvidence}
          />
        }
        asideLabel={controls.detail.asideLabel}
      />

      {editing ? (
        <ControlEditPanel
          control={control}
          etag={etag}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(result) => {
            setControl(result.control);
            setEtag(result.etag);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
