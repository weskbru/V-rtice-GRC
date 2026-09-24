'use client';

import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Eye, History, Link2, Pencil, Wrench } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import {
  firstVisibleSectionOf,
  resolveActiveDetailSection,
  visibleSections,
} from '@/components/detail/detail-navigation';
import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { EvidencePanel } from '@/features/evidence/components/evidence-panel';
import { incidentsApi } from '@/features/incidents/api';
import { IncidentContextAside } from '@/features/incidents/components/detail/incident-context-aside';
import { IncidentEditPanel } from '@/features/incidents/components/detail/incident-edit-panel';
import { IncidentLifecycleSection } from '@/features/incidents/components/detail/incident-lifecycle-section';
import { IncidentAttachmentsSection } from '@/features/incidents/components/incident-attachments-section';
import { IncidentCommentsSection } from '@/features/incidents/components/incident-comments-section';
import { IncidentCorrectiveActions } from '@/features/incidents/components/incident-corrective-actions';
import { IncidentOverview } from '@/features/incidents/components/incident-overview';
import { IncidentProblemLinksSection } from '@/features/incidents/components/incident-problem-links-section';
import {
  IncidentAssetRelationshipsSection,
  IncidentProcessRelationshipsSection,
  IncidentRiskRelationshipsSection,
} from '@/features/incidents/components/incident-relationships-section';
import { formatDateOnly } from '@/features/incidents/date';
import {
  incidentSeverityBadgeVariant,
  incidentSeverityLabel,
  incidentStatusBadgeVariant,
  incidentStatusLabel,
} from '@/features/incidents/status';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';
import { usePermissions } from '@/lib/permissions';

import type { DetailGroup } from '@/components/detail/detail-navigation';
import type { IncidentDetail } from '@/features/incidents/types';
import type { EntityTab, ErrorStateProblem } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

export interface IncidentDetailViewProps {
  incidentId: string;
}

const GROUP_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: Eye,
  response: Wrench,
  relationships: Link2,
  register: History,
};

export function IncidentDetailView({ incidentId }: IncidentDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={incidents.detail.loading} />}>
      <IncidentDetailViewContent incidentId={incidentId} />
    </Suspense>
  );
}

function IncidentDetailViewContent({ incidentId }: IncidentDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await incidentsApi.getById(incidentId);
        if (!cancelled) {
          setIncident(result);
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
  }, [incidentId]);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={incidents.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={incidents.detail.notFoundTitle}
        description={incidents.detail.notFoundDescription}
      />
    );
  }

  if (!incident) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('incident:edit');
  const canTransition = hasPermission('incident:transition');
  const canLink = hasPermission('incident:link');
  const canCreateAction = canEdit && hasPermission('action:create');
  const canTransitionAction = hasPermission('action:edit');
  const canCreateEvidence = hasPermission('evidence:create');
  const canLinkEvidence = hasPermission('evidence:link');
  const canAdministerEvidence = hasPermission('evidence:administer');
  const canUploadAttachment = hasPermission('attachment:create');
  const canWithdrawAttachment = hasPermission('attachment:delete');
  const canComment = hasPermission('comment:create');
  const canWithdrawComment = hasPermission('comment:delete');

  const groups: readonly DetailGroup[] = [
    {
      id: 'overview',
      label: incidents.detail.groups.overview,
      sections: [
        {
          id: 'overview',
          label: incidents.detail.groups.overview,
          content: (
            <div className="flex flex-col gap-6">
              <IncidentOverview incident={incident} />
              <IncidentLifecycleSection
                incident={incident}
                canTransition={canTransition}
                onChanged={(updated) => setIncident(updated)}
              />
            </div>
          ),
        },
      ],
    },
    {
      id: 'response',
      label: incidents.detail.groups.response,
      sections: [
        {
          id: 'corrective-actions',
          label: incidents.detail.sections.correctiveActions,
          content: (
            <IncidentCorrectiveActions
              incidentId={incident.id}
              canCreate={canCreateAction}
              canTransition={canTransitionAction}
            />
          ),
        },
      ],
    },
    {
      id: 'relationships',
      label: incidents.detail.groups.relationships,
      sections: [
        {
          id: 'risks',
          label: incidents.detail.sections.risks,
          content: <IncidentRiskRelationshipsSection incidentId={incident.id} canLink={canLink} />,
        },
        {
          id: 'assets',
          label: incidents.detail.sections.assets,
          content: <IncidentAssetRelationshipsSection incidentId={incident.id} canLink={canLink} />,
        },
        {
          id: 'processes',
          label: incidents.detail.sections.processes,
          content: (
            <IncidentProcessRelationshipsSection incidentId={incident.id} canLink={canLink} />
          ),
        },
        {
          id: 'problems',
          label: incidents.detail.sections.problems,
          content: <IncidentProblemLinksSection incidentId={incident.id} />,
        },
      ],
    },
    {
      id: 'register',
      label: incidents.detail.groups.register,
      sections: [
        {
          id: 'evidence',
          label: incidents.detail.sections.evidence,
          content: (
            <EvidencePanel
              subjectType="INCIDENT"
              subjectId={incident.id}
              orgUnitId={incident.orgUnit.id}
              defaultOwnerUserId={user.id}
              canCreate={canCreateEvidence}
              canLink={canLinkEvidence}
              canAdminister={canAdministerEvidence}
              canUploadAttachment={canUploadAttachment}
              canWithdrawAttachment={canWithdrawAttachment}
            />
          ),
        },
        {
          id: 'attachments',
          label: incidents.detail.sections.attachments,
          content: (
            <IncidentAttachmentsSection
              incidentId={incident.id}
              canUpload={canUploadAttachment}
              canWithdraw={canWithdrawAttachment}
            />
          ),
        },
        {
          id: 'comments',
          label: incidents.detail.sections.comments,
          content: (
            <IncidentCommentsSection
              incidentId={incident.id}
              canComment={canComment}
              canWithdraw={canWithdrawComment}
            />
          ),
        },
      ],
    },
  ];

  const resolved = resolveActiveDetailSection(groups, sectionParam);
  const activeGroupId = resolved?.groupId ?? '';
  const activeSectionId = resolved?.sectionId ?? '';

  function handleGroupChange(nextGroupId: string): void {
    const firstSection = firstVisibleSectionOf(groups, nextGroupId);
    if (firstSection) {
      setSection(firstSection);
    }
  }

  const groupTabs: EntityTab[] = groups.map((group) => {
    const sectionsVisible = visibleSections(group);
    const content =
      sectionsVisible.length > 1 ? (
        <EntityTabs
          ariaLabel={incidents.detail.sectionsAriaLabel(group.label)}
          scrollLabels={{
            scrollBack: common.entityTabs.scrollBack,
            scrollForward: common.entityTabs.scrollForward,
          }}
          value={activeSectionId}
          onValueChange={setSection}
          tabs={group.sections}
          subordinate
        />
      ) : (
        (sectionsVisible[0]?.content ?? null)
      );

    return {
      id: group.id,
      label: group.label,
      icon: GROUP_ICONS[group.id],
      visible: sectionsVisible.length > 0,
      content,
    };
  });

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/incidents" className="hover:underline">
                  {incidents.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{incident.code}</span>
              </>
            }
            code={incident.code}
            title={incident.title}
            badges={
              <>
                <StatusBadge
                  variant={incidentSeverityBadgeVariant(incident.severity)}
                  label={incidentSeverityLabel(incident.severity)}
                />
                <StatusBadge
                  variant={incidentStatusBadgeVariant(incident.status)}
                  label={incidentStatusLabel(incident.status)}
                />
              </>
            }
            metadata={
              <>
                <span>{incidents.detail.metadata.orgUnit(incident.orgUnit.name)}</span>
                <span>{incidents.detail.metadata.owner(incident.owner.fullName)}</span>
                <span>
                  {incidents.detail.metadata.reportedOn(formatDateOnly(incident.reportedOn))}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {incidents.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={incidents.detail.groupsAriaLabel}
            scrollLabels={{
              scrollBack: common.entityTabs.scrollBack,
              scrollForward: common.entityTabs.scrollForward,
            }}
            value={activeGroupId}
            onValueChange={handleGroupChange}
            tabs={groupTabs}
            size="compact"
          />
        }
        aside={
          <IncidentContextAside
            incident={incident}
            activeSectionId={activeSectionId}
            canLink={canLink}
            canCreateAction={canCreateAction}
            canCreateEvidence={canCreateEvidence}
            canComment={canComment}
          />
        }
        asideLabel={incidents.detail.asideLabel}
      />

      {editing ? (
        <IncidentEditPanel
          incident={incident}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setIncident(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
