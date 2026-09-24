'use client';

import { EmptyState, ErrorState, LoadingState, PageHeader } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { complianceApi } from '@/features/compliance/api';
import { FrameworkVersionForm } from '@/features/compliance/components/framework-version-form';
import { ApiError } from '@/lib/api-client';
import { compliance } from '@/lib/messages/compliance';

import type { Framework } from '@/features/compliance/types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface NewFrameworkVersionViewProps {
  frameworkId: string;
}

export function NewFrameworkVersionView({
  frameworkId,
}: NewFrameworkVersionViewProps): React.JSX.Element {
  const [framework, setFramework] = useState<Framework | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    complianceApi
      .getFramework(frameworkId)
      .then((result) => {
        if (!cancelled) setFramework(result.record);
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

  if (!framework) {
    return <ErrorState problem={problem} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={compliance.versionForm.createTitle} />
      <FrameworkVersionForm
        mode="create"
        frameworkId={framework.id}
        frameworkName={framework.name}
        onSaved={() => undefined}
      />
    </div>
  );
}
