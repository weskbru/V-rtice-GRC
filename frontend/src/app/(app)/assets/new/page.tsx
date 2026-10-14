'use client';

import { AssetForm } from '@/features/assets/components/asset-form';
import { assets } from '@/lib/messages/assets';
import { PageHeader } from '@vertice/design-system/components';

export default function NewAssetPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={assets.form.createTitle} description={assets.form.createDescription} />
      <AssetForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
