'use client';

import { LoadingState, PageHeader } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { ProcessCatalogView } from '@/features/processes/components/process-catalog-view';
import { common } from '@/lib/messages/common';
import { processes } from '@/lib/messages/processes';
import { usePermissions } from '@/lib/permissions';

export default function ProcessesPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={processes.register.pageTitle}
        description={processes.register.pageDescription}
        actions={
          hasPermission('process:create') ? (
            <Button asChild>
              <Link href="/processes/new">
                <Plus aria-hidden="true" className="size-4" />
                {processes.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <ProcessCatalogView />
      </Suspense>
    </div>
  );
}
