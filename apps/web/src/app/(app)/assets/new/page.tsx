'use client';

/**
 * PharosGRC — new asset route (T048). `AssetForm` navigates to
 * `/assets/{id}` on a successful create — this route stays a thin
 * composition of the page chrome and the reusable form.
 */
import { PageHeader } from '@pharos/design-system/components';

import { AssetForm } from '@/features/assets/components/asset-form';
import { assets } from '@/lib/messages/assets';

export default function NewAssetPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={assets.form.createTitle} description={assets.form.createDescription} />
      <AssetForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
