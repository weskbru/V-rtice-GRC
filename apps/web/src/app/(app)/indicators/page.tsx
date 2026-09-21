'use client';

/**
 * PharosGRC — indicator catalog route (009-indicators-reports, T060, US1).
 * No `useSearchParams()`/`Suspense` needed here (contrast `(app)/incidents/
 * page.tsx`): the catalog is the fixed, eleven-key closed registry
 * (`IndicatorCatalogView`'s own header), not a server-paginated list.
 *
 * `'use client'` matches every other register `page.tsx` in this product
 * (`(app)/assets/page.tsx`, `(app)/controls/page.tsx`, `(app)/risks/page.tsx`,
 * ...), all of which are client components for the same reason: importing
 * `@pharos/design-system/components`' barrel from a genuine Server
 * Component fails the RSC build the moment ANY component reachable through
 * that barrel (e.g. `DataTable`'s own `use-disclosure-close.ts` helper)
 * uses a hook without its own `'use client'` pragma — a real build error
 * this task's own rendered verification caught.
 */
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
