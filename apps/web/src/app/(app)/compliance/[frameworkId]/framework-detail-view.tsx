'use client';

/**
 * PharosGRC — framework detail screen (US1, ADR-017), mirroring
 * `control-detail-view.tsx`'s structure exactly (CLAUDE.md §18.12):
 * `EntityHeader` + `EntityTabs`, a 404 rendered identically whether the
 * framework does not exist or the caller lacks `compliance:view`.
 */
import {
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
} from '@pharos/design-system/components';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { complianceApi } from '@/features/compliance/api';
import { FrameworkForm } from '@/features/compliance/components/framework-form';
import { FrameworkVersionListSection } from '@/features/compliance/components/framework-version-list-section';
import { formatTimestampDate } from '@/features/compliance/date';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { usePermissions } from '@/lib/permissions';

import type { Framework } from '@/features/compliance/types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface FrameworkDetailViewProps {
  frameworkId: string;
}

export function FrameworkDetailView({ frameworkId }: FrameworkDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [framework, setFramework] = useState<Framework | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await complianceApi.getFramework(frameworkId);
        if (!cancelled) {
          setFramework(result.record);
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
  }, [frameworkId]);

  if (loading) {
    return <LoadingState variant="block" label={compliance.frameworkDetail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={compliance.frameworkDetail.notFoundTitle}
        description={compliance.frameworkDetail.notFoundDescription}
      />
    );
  }

  if (!framework || !etag) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('compliance:administer');

  return (
    <div className="flex flex-col gap-6">
      <EntityHeader
        code={framework.code}
        title={framework.name}
        badges={
          <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {compliance.originLabels[framework.origin]}
          </span>
        }
        metadata={
          <>
            <span>
              {compliance.frameworkDetail.metadata.createdAt(
                formatTimestampDate(framework.createdAt),
              )}
            </span>
            <span>
              {compliance.frameworkDetail.metadata.updatedAt(
                formatTimestampDate(framework.updatedAt),
              )}
            </span>
          </>
        }
        actions={
          canEdit && !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="size-4" />
              {compliance.frameworkDetail.editAction}
            </Button>
          ) : null
        }
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
            label: compliance.frameworkDetail.sections.overview,
            content: editing ? (
              <FrameworkForm
                mode="edit"
                framework={framework}
                etag={etag}
                onSaved={(result) => {
                  setFramework(result.framework);
                  setEtag(result.etag);
                  setEditing(false);
                }}
              />
            ) : (
              <p className="max-w-3xl whitespace-pre-wrap text-sm text-foreground">
                {framework.description}
              </p>
            ),
          },
          {
            id: 'versions',
            label: compliance.frameworkDetail.sections.versions,
            content: <FrameworkVersionListSection frameworkId={framework.id} />,
          },
        ]}
      />
    </div>
  );
}
