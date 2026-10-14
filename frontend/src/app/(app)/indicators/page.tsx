'use client';

import { IndicatorCatalogView } from '@/features/indicators/components/indicator-catalog-view';
import { indicators } from '@/lib/messages/indicators';
import { PageHeader } from '@vertice/design-system/components';

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
