'use client';

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
import { problemsApi } from '@/features/problems/api';
import { ProblemContextAside } from '@/features/problems/components/detail/problem-context-aside';
import { ProblemEditPanel } from '@/features/problems/components/detail/problem-edit-panel';
import { ProblemLifecycleSection } from '@/features/problems/components/detail/problem-lifecycle-section';
import { ProblemAttachmentsSection } from '@/features/problems/components/problem-attachments-section';
import { ProblemCommentsSection } from '@/features/problems/components/problem-comments-section';
import { ProblemCorrectiveActions } from '@/features/problems/components/problem-corrective-actions';
import { ProblemOverview } from '@/features/problems/components/problem-overview';
import {
  ProblemIncidentLinksSection,
  ProblemRiskLinksSection,
} from '@/features/problems/components/problem-relationships-section';
import { formatTimestampDate } from '@/features/problems/date';
import {
  problemSeverityBadgeVariant,
  problemSeverityLabel,
  problemStatusBadgeVariant,
  problemStatusIcon,
  problemStatusLabel,
} from '@/features/problems/status';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { problems } from '@/lib/messages/problems';
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

import type { DetailGroup } from '@/components/detail/detail-navigation';
import type { ProblemDetail } from '@/features/problems/types';
import type { EntityTab, ErrorStateProblem } from '@vertice/design-system/components';
import type { ComponentType, SVGProps } from 'react';

export interface ProblemDetailViewProps {
  problemId: string;
}

const GROUP_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: Eye,
  response: Wrench,
  relationships: Link2,
  register: History,
};

export function ProblemDetailView({ problemId }: ProblemDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={problems.detail.loading} />}>
      <ProblemDetailViewContent problemId={problemId} />
    </Suspense>
  );
}

function ProblemDetailViewContent({ problemId }: ProblemDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problemState, setProblemState] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await problemsApi.getById(problemId);
        if (!cancelled) {
          setProblem(result);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else if (error instanceof ApiError) {
          setProblemState({
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
  }, [problemId]);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={problems.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={problems.detail.notFoundTitle}
        description={problems.detail.notFoundDescription}
      />
    );
  }

  if (!problem) {
    return <ErrorState problem={problemState} />;
  }

  const canEdit = hasPermission('problem:edit');
  const canTransition = hasPermission('problem:transition');
  const canLink = hasPermission('problem:link');
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
      label: problems.detail.groups.overview,
      sections: [
        {
          id: 'overview',
          label: problems.detail.groups.overview,
          content: (
            <div className="flex flex-col gap-6">
              <ProblemOverview problem={problem} />
              <ProblemLifecycleSection
                problem={problem}
                canTransition={canTransition}
                onChanged={(updated) => setProblem(updated)}
              />
            </div>
          ),
        },
      ],
    },
    {
      id: 'response',
      label: problems.detail.groups.response,
      sections: [
        {
          id: 'corrective-actions',
          label: problems.detail.sections.correctiveActions,
          content: (
            <ProblemCorrectiveActions
              problemId={problem.id}
              canCreate={canCreateAction}
              canTransition={canTransitionAction}
            />
          ),
        },
      ],
    },
    {
      id: 'relationships',
      label: problems.detail.groups.relationships,
      sections: [
        {
          id: 'risks',
          label: problems.detail.sections.risks,
          content: <ProblemRiskLinksSection problemId={problem.id} canLinkPermission={canLink} />,
        },
        {
          id: 'incidents',
          label: problems.detail.sections.incidents,
          content: (
            <ProblemIncidentLinksSection problemId={problem.id} canLinkPermission={canLink} />
          ),
        },
      ],
    },
    {
      id: 'register',
      label: problems.detail.groups.register,
      sections: [
        {
          id: 'evidence',
          label: problems.detail.sections.evidence,
          content: (
            <EvidencePanel
              subjectType="PROBLEM"
              subjectId={problem.id}
              orgUnitId={problem.orgUnit.id}
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
          label: problems.detail.sections.attachments,
          content: (
            <ProblemAttachmentsSection
              problemId={problem.id}
              canUpload={canUploadAttachment}
              canWithdraw={canWithdrawAttachment}
            />
          ),
        },
        {
          id: 'comments',
          label: problems.detail.sections.comments,
          content: (
            <ProblemCommentsSection
              problemId={problem.id}
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
          ariaLabel={problems.detail.sectionsAriaLabel(group.label)}
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
                <Link href="/problems" className="hover:underline">
                  {problems.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{problem.code}</span>
              </>
            }
            code={problem.code}
            title={problem.title}
            badges={
              <>
                <StatusBadge
                  variant={problemSeverityBadgeVariant(problem.severity)}
                  label={problemSeverityLabel(problem.severity)}
                />
                <StatusBadge
                  variant={problemStatusBadgeVariant(problem.status)}
                  label={problemStatusLabel(problem.status)}
                  icon={problemStatusIcon(problem.status)}
                />
              </>
            }
            metadata={
              <>
                <span>{problems.detail.metadata.orgUnit(problem.orgUnit.name)}</span>
                <span>
                  {problems.detail.metadata.createdAt(formatTimestampDate(problem.createdAt!))}
                </span>
                <span>
                  {problems.detail.metadata.updatedAt(formatTimestampDate(problem.updatedAt!))}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {problems.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={problems.detail.groupsAriaLabel}
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
          <ProblemContextAside
            problem={problem}
            activeSectionId={activeSectionId}
            canLink={canLink}
            canCreateAction={canCreateAction}
            canCreateEvidence={canCreateEvidence}
            canComment={canComment}
          />
        }
        asideLabel={problems.detail.asideLabel}
      />

      {editing ? (
        <ProblemEditPanel
          problem={problem}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setProblem(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
