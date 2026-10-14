'use client';

import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { ProblemCatalogView } from '@/features/problems/components/problem-catalog-view';
import { common } from '@/lib/messages/common';
import { problems } from '@/lib/messages/problems';
import { usePermissions } from '@/lib/permissions';
import { LoadingState, PageHeader } from '@vertice/design-system/components';

export default function ProblemsPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={problems.register.pageTitle}
        description={problems.register.pageDescription}
        actions={
          hasPermission('problem:create') ? (
            <Button asChild>
              <Link href="/problems/new">
                <Plus aria-hidden="true" className="size-4" />
                {problems.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <ProblemCatalogView />
      </Suspense>
    </div>
  );
}
