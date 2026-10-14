'use client';

import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { AuditEngagementCatalogView } from '@/features/audit-engagements/components/audit-engagement-catalog-view';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';
import { LoadingState, PageHeader } from '@vertice/design-system/components';

export default function AuditEngagementsPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={auditEngagements.register.pageTitle}
        description={auditEngagements.register.pageDescription}
        actions={
          hasPermission('audit-engagement:create') ? (
            <Button asChild>
              <Link href="/audits/new">
                <Plus aria-hidden="true" className="size-4" />
                {auditEngagements.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <AuditEngagementCatalogView />
      </Suspense>
    </div>
  );
}
