'use client';

import { PageHeader } from '@pharos/design-system/components';

import { IndicatorCatalogView } from '@/features/indicators/components/indicator-catalog-view';
import { indicators } from '@/lib/messages/indicators';

export default function IndicatorsPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={indicators.register.pageTitle}
        description={indicators.register.pageDescription}
      />
      <IndicatorCatalogView />
    </div>
  );
}
