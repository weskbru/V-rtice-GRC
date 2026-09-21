'use client';

/**
 * PharosGRC — one mapping migration's full per-requirement detail (US2,
 * SC-004: "conferir o que foi transportado"). Immutable once recorded —
 * this screen is read-only, mirroring the contract's own "no update or
 * delete operation for a migration record".
 */
import { EmptyState, ErrorState, LoadingState } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { complianceApi } from '@/features/compliance/api';
import { MappingMigrationItemsTable } from '@/features/compliance/components/mapping-migration-items-table';
import { formatTimestamp } from '@/features/compliance/date';
import { ApiError } from '@/lib/api-client';
import { compliance } from '@/lib/messages/compliance';

import type { MappingMigrationDetail } from '@/features/compliance/types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface MappingMigrationDetailViewProps {
  frameworkId: string;
  versionId: string;
  migrationId: string;
}

export function MappingMigrationDetailView({
  frameworkId,
  versionId,
  migrationId,
}: MappingMigrationDetailViewProps): React.JSX.Element {
  const [migration, setMigration] = useState<MappingMigrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    complianceApi
      .getMappingMigration(frameworkId, versionId, migrationId)
      .then((result) => {
        if (!cancelled) setMigration(result);
      })
      .catch((error: unknown) => {
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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [frameworkId, versionId, migrationId]);

  if (loading) {
    return <LoadingState variant="block" label={compliance.mappingMigrationDetail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={compliance.mappingMigrationDetail.notFoundTitle}
        description={compliance.mappingMigrationDetail.notFoundDescription}
      />
    );
  }

  if (!migration) {
    return <ErrorState problem={problem} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <Link
          href={`/compliance/${frameworkId}/versions/${versionId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {compliance.mappingMigrationDetail.backToVersion(migration.targetFrameworkVersion.label)}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {compliance.mappingMigrationDetail.title(
            migration.sourceFrameworkVersion.label,
            migration.targetFrameworkVersion.label,
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {compliance.mappingMigrationDetail.metadata.executedBy(migration.executedBy.fullName)}{' '}
          {compliance.mappingMigrationDetail.metadata.executedAt(
            formatTimestamp(migration.executedAt),
          )}
        </p>
      </div>

      {migration.pendingDecisionCount > 0 ? (
        <p
          role="status"
          className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-fg"
        >
          {compliance.mappingMigration.resultPendingNotice(migration.pendingDecisionCount)}
        </p>
      ) : null}

      <MappingMigrationItemsTable items={migration.items} />
    </div>
  );
}
