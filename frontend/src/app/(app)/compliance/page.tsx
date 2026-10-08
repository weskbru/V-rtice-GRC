'use client';

import { LoadingState, PageHeader } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { FrameworkListView } from '@/features/compliance/components/framework-list-view';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { usePermissions } from '@/lib/permissions';

export default function CompliancePage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={compliance.register.pageTitle}
        description={compliance.register.pageDescription}
        actions={
          hasPermission('compliance:administer') ? (
            <Button asChild>
              <Link href="/compliance/new">
                <Plus aria-hidden="true" className="size-4" />
                {compliance.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <FrameworkListView />
      </Suspense>
    </div>
  );
}
