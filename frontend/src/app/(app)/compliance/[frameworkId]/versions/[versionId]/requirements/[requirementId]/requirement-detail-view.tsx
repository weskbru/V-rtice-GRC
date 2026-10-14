'use client';

import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { complianceApi } from '@/features/compliance/api';
import { RequirementApplicabilitySection } from '@/features/compliance/components/requirement-applicability-section';
import { RequirementControlsSection } from '@/features/compliance/components/requirement-controls-section';
import { RequirementInlineForm } from '@/features/compliance/components/requirement-inline-form';
import { formatTimestampDate } from '@/features/compliance/date';
import {
  complianceStateBadgeVariant,
  complianceStateDescription,
  complianceStateIcon,
  complianceStateLabel,
} from '@/features/compliance/status';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { usePermissions } from '@/lib/permissions';
import {
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@vertice/design-system/components';

import type { Requirement } from '@/features/compliance/types';
import type { ErrorStateProblem } from '@vertice/design-system/components';

export interface RequirementDetailViewProps {
  frameworkId: string;
  versionId: string;
  requirementId: string;
}

export function RequirementDetailView({
  frameworkId,
  versionId,
  requirementId,
}: RequirementDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await complianceApi.getRequirement(requirementId);
        if (!cancelled) {
          if (result.record.frameworkVersion.id !== versionId) {
            setNotFound(true);
          } else {
            setRequirement(result.record);
            setEtag(result.etag);
          }
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
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requirementId, versionId, reloadToken]);

  if (loading) {
    return <LoadingState variant="block" label={compliance.requirementDetail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={compliance.requirementDetail.notFoundTitle}
        description={compliance.requirementDetail.notFoundDescription}
      />
    );
  }

  if (!requirement || !etag) {
    return <ErrorState problem={problem} />;
  }

  const canAdminister = hasPermission('compliance:administer');
  const canMap = hasPermission('compliance:map');
  const isDraft = requirement.frameworkVersion.status === 'DRAFT';

  function reload(): void {
    setReloadToken((token) => token + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <EntityHeader
        breadcrumb={
          <Link
            href={`/compliance/${frameworkId}/versions/${versionId}`}
            className="hover:underline"
          >
            {compliance.requirementDetail.backToVersion(requirement.frameworkVersion.label)}
          </Link>
        }
        code={requirement.externalRef}
        title={requirement.title}
        badges={
          <StatusBadge
            variant={complianceStateBadgeVariant(requirement.complianceState)}
            label={complianceStateLabel(requirement.complianceState)}
            icon={complianceStateIcon(requirement.complianceState)}
          />
        }
        metadata={
          <>
            <span>
              {compliance.requirementDetail.metadata.version(requirement.frameworkVersion.label)}
            </span>
            <span>
              {compliance.requirementDetail.metadata.createdAt(
                formatTimestampDate(requirement.createdAt),
              )}
            </span>
            <span>
              {compliance.requirementDetail.metadata.updatedAt(
                formatTimestampDate(requirement.updatedAt),
              )}
            </span>
          </>
        }
        actions={
          canAdminister && isDraft && !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="size-4" />
              {compliance.requirementDetail.editAction}
            </Button>
          ) : null
        }
      />

      <p className="text-sm text-muted-foreground">
        {complianceStateDescription(requirement.complianceState)}
      </p>

      {!isDraft ? (
        <p
          role="note"
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {compliance.requirements.notDraftNotice}
        </p>
      ) : null}

      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={{
          scrollBack: common.entityTabs.scrollBack,
          scrollForward: common.entityTabs.scrollForward,
        }}
        tabs={[
          {
            id: 'overview',
            label: compliance.requirementDetail.sections.overview,
            content: editing ? (
              <RequirementInlineForm
                mode="edit"
                frameworkId={frameworkId}
                versionId={versionId}
                requirement={requirement}
                etag={etag}
                onSaved={(result) => {
                  setRequirement(result.requirement);
                  setEtag(result.etag);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {compliance.requirementDetail.overview.descriptionTitle}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {requirement.description}
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: 'control-mapping',
            label: compliance.requirementDetail.sections.controlMapping,
            content: (
              <RequirementControlsSection
                requirementId={requirement.id}
                canLink={canMap}
                onChanged={reload}
              />
            ),
          },
          {
            id: 'applicability',
            label: compliance.requirementDetail.sections.applicability,
            content: (
              <RequirementApplicabilitySection
                requirementId={requirement.id}
                canAdminister={canAdminister}
                onChanged={reload}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
