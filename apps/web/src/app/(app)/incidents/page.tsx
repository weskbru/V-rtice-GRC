'use client';

import { LoadingState, PageHeader } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { IncidentCatalogView } from '@/features/incidents/components/incident-catalog-view';
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';
import { usePermissions } from '@/lib/permissions';

export default function IncidentsPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={incidents.register.pageTitle}
        description={incidents.register.pageDescription}
        actions={
          hasPermission('incident:create') ? (
            <Button asChild>
              <Link href="/incidents/new">
                <Plus aria-hidden="true" className="size-4" />
                {incidents.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <IncidentCatalogView />
      </Suspense>
    </div>
  );
}
