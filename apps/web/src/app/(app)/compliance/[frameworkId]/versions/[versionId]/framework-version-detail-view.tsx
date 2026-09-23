'use client';

import {
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { complianceApi } from '@/features/compliance/api';
import { ComplianceSummaryCard } from '@/features/compliance/components/compliance-summary-card';
import { FrameworkVersionForm } from '@/features/compliance/components/framework-version-form';
import { MappingMigrationPanel } from '@/features/compliance/components/mapping-migration-panel';
import { PublishVersionAction } from '@/features/compliance/components/publish-version-action';
import { RequirementListSection } from '@/features/compliance/components/requirement-list-section';
import { formatTimestampDate } from '@/features/compliance/date';
import {
  frameworkVersionStatusBadgeVariant,
  frameworkVersionStatusIcon,
  frameworkVersionStatusLabel,
} from '@/features/compliance/status';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { usePermissions } from '@/lib/permissions';

import type { FrameworkVersion } from '@/features/compliance/types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface FrameworkVersionDetailViewProps {
  frameworkId: string;
  versionId: string;
}

export function FrameworkVersionDetailView({
  frameworkId,
  versionId,
}: FrameworkVersionDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [version, setVersion] = useState<FrameworkVersion | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [requirementCount, setRequirementCount] = useState<number | null>(null);
  const [summaryRefreshToken, setSummaryRefreshToken] = useState(0);
  const lastReportedTotalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await complianceApi.getFrameworkVersion(frameworkId, versionId);
        if (!cancelled) {
          setVersion(result.record);
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
  }, [frameworkId, versionId]);

  if (loading) {
    return <LoadingState variant="block" label={compliance.versionDetail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={compliance.versionDetail.notFoundTitle}
        description={compliance.versionDetail.notFoundDescription}
      />
    );
  }

  if (!version || !etag) {
    return <ErrorState problem={problem} />;
  }

  const canAdminister = hasPermission('compliance:administer');
  const isDraft = version.status === 'DRAFT';

  return (
    <div className="flex flex-col gap-6">
      <EntityHeader
        breadcrumb={
          <Link href={`/compliance/${frameworkId}`} className="hover:underline">
            {compliance.versionDetail.backToFramework(version.framework.name)}
          </Link>
        }
        code={version.framework.code}
        title={version.label}
        badges={
          <StatusBadge
            variant={frameworkVersionStatusBadgeVariant(version.status)}
            label={frameworkVersionStatusLabel(version.status)}
            icon={frameworkVersionStatusIcon(version.status)}
          />
        }
        metadata={
          <>
            <span>{compliance.versionDetail.metadata.framework(version.framework.name)}</span>
            <span>
              {compliance.versionDetail.metadata.createdAt(formatTimestampDate(version.createdAt))}
            </span>
            {version.publishedAt ? (
              <span>
                {compliance.versionDetail.metadata.publishedAt(
                  formatTimestampDate(version.publishedAt),
                )}
                {version.publishedBy
                  ? ` ${compliance.versionDetail.metadata.publishedBy(version.publishedBy.fullName)}`
                  : ''}
              </span>
            ) : null}
          </>
        }
        actions={
          canAdminister && isDraft && !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="size-4" />
              {compliance.versionDetail.editAction}
            </Button>
          ) : null
        }
      />

      {!isDraft ? (
        <p
          role="note"
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {compliance.versionDetail.notEditableAfterPublish}
        </p>
      ) : null}

      {editing ? (
        <FrameworkVersionForm
          mode="edit"
          frameworkId={frameworkId}
          frameworkName={version.framework.name}
          version={version}
          etag={etag}
          onSaved={(result) => {
            setVersion(result.version);
            setEtag(result.etag);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
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
            label: compliance.versionDetail.sections.overview,
            content: (
              <div className="flex flex-col gap-6">
                <PublishVersionAction
                  frameworkId={frameworkId}
                  version={version}
                  etag={etag}
                  requirementCount={requirementCount}
                  onPublished={(result) => {
                    setVersion(result.version);
                    setEtag(result.etag);
                  }}
                />
                <ComplianceSummaryCard
                  frameworkId={frameworkId}
                  versionId={version.id}
                  refreshToken={summaryRefreshToken}
                  onLoaded={(summary) => {
                    setRequirementCount(summary.totalRequirements);
                    lastReportedTotalRef.current = summary.totalRequirements;
                  }}
                />
              </div>
            ),
          },
          {
            id: 'requirements',
            label: compliance.versionDetail.sections.requirements,
            content: (
              <RequirementListSection
                frameworkId={frameworkId}
                versionId={version.id}
                versionIsDraft={isDraft}
                canAdminister={canAdminister}
                onTotalChange={(total) => {
                  setRequirementCount(total);
                  if (lastReportedTotalRef.current !== total) {
                    lastReportedTotalRef.current = total;
                    setSummaryRefreshToken((token) => token + 1);
                  }
                }}
              />
            ),
          },
          {
            id: 'mapping-migration',
            label: compliance.versionDetail.sections.mappingMigration,
            content: (
              <MappingMigrationPanel
                frameworkId={frameworkId}
                versionId={version.id}
                canMap={hasPermission('compliance:map')}
                onMigrated={() => setSummaryRefreshToken((token) => token + 1)}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
