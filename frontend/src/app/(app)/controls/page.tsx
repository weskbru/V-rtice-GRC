'use client';

import { LoadingState, PageHeader } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { ControlCatalogView } from '@/features/controls/components/control-catalog-view';
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';
import { usePermissions } from '@/lib/permissions';

export default function ControlsPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={controls.register.pageTitle}
        description={controls.register.pageDescription}
        actions={
          hasPermission('control:create') ? (
            <Button asChild>
              <Link href="/controls/new">
                <Plus aria-hidden="true" className="size-4" />
                {controls.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <ControlCatalogView />
      </Suspense>
    </div>
  );
}
