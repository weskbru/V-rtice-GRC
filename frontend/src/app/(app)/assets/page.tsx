'use client';

import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { AssetCatalogView } from '@/features/assets/components/asset-catalog-view';
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';
import { LoadingState, PageHeader } from '@vertice/design-system/components';

export default function AssetsPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={assets.register.pageTitle}
        description={assets.register.pageDescription}
        actions={
          hasPermission('asset:create') ? (
            <Button asChild>
              <Link href="/assets/new">
                <Plus aria-hidden="true" className="size-4" />
                {assets.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <AssetCatalogView />
      </Suspense>
    </div>
  );
}
