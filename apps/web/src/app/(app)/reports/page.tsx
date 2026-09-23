'use client';

import { LoadingState, PageHeader } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { ReportCatalogView } from '@/features/reports/components/report-catalog-view';
import { common } from '@/lib/messages/common';
import { reports } from '@/lib/messages/reports';
import { usePermissions } from '@/lib/permissions';

export default function ReportsPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={reports.register.pageTitle}
        description={reports.register.pageDescription}
        actions={
          hasPermission('report:create') ? (
            <Button asChild>
              <Link href="/reports/new">
                <Plus aria-hidden="true" className="size-4" />
                {reports.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <ReportCatalogView />
      </Suspense>
    </div>
  );
}
