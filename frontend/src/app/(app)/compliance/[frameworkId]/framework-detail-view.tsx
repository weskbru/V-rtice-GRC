'use client';

import { Eye, Layers, Pencil } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { complianceApi } from '@/features/compliance/api';
import { FrameworkEditPanel } from '@/features/compliance/components/detail/framework-edit-panel';
import { FrameworkOverview } from '@/features/compliance/components/framework-overview';
import { FrameworkVersionListSection } from '@/features/compliance/components/framework-version-list-section';
import { formatTimestampDate } from '@/features/compliance/date';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { usePermissions } from '@/lib/permissions';
import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
} from '@vertice/design-system/components';

import type { Framework } from '@/features/compliance/types';
import type { EntityTab, ErrorStateProblem } from '@vertice/design-system/components';

export interface FrameworkDetailViewProps {
  frameworkId: string;
}

export function FrameworkDetailView({ frameworkId }: FrameworkDetailViewProps): React.JSX.Element {
  return (
    <Suspense
      fallback={<LoadingState variant="block" label={compliance.frameworkDetail.loading} />}
    >
      <FrameworkDetailViewContent frameworkId={frameworkId} />
    </Suspense>
  );
}

function FrameworkDetailViewContent({ frameworkId }: FrameworkDetailViewProps): React.JSX.Element {
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

  const { sectionParam, setSection } = useDetailSection();

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
  const tabs: EntityTab[] = [
    {
      id: 'overview',
      label: compliance.frameworkDetail.sections.overview,
      icon: Eye,
      content: <FrameworkOverview framework={framework} />,
    },
    {
      id: 'versions',
      label: compliance.frameworkDetail.sections.versions,
      icon: Layers,
      content: <FrameworkVersionListSection frameworkId={framework.id} />,
    },
  ];

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/compliance" className="hover:underline">
                  {compliance.frameworkDetail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{framework.code}</span>
              </>
            }
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
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {compliance.frameworkDetail.editAction}
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
      />

      {editing ? (
        <FrameworkEditPanel
          framework={framework}
          etag={etag}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(result) => {
            setFramework(result.framework);
            setEtag(result.etag);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
