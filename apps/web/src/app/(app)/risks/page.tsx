'use client';

/**
 * PharosGRC — risk register route (T110, US3, FR-086 to FR-092).
 *
 * `RiskRegisterView` reads `useSearchParams()` (via `useRegisterState`,
 * T112) — Next.js requires that behind a `<Suspense>` boundary so the
 * initial render can be produced without blocking on the client-only
 * search-params read. `LoadingState`'s `variant="table"` fallback keeps the
 * pre-hydration flash looking like the table it is about to become, rather
 * than a generic spinner.
 */
import { LoadingState, PageHeader } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { RiskRegisterArtwork } from '@/features/risks/components/risk-register-artwork';
import { RiskRegisterView } from '@/features/risks/components/risk-register-view';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import { usePermissions } from '@/lib/permissions';

export default function RisksPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();

  return (
    <div className="relative isolate flex min-w-0 flex-col gap-4">
      <RiskRegisterArtwork />
      <PageHeader
        className="justify-center border-0 py-5 sm:min-h-28 sm:py-6 [&_h1]:text-3xl [&_h1]:tracking-tight"
        title={risks.register.pageTitle}
        description={risks.register.pageDescription}
        actions={
          hasPermission('risk:create') ? (
            <Button asChild>
              <Link href="/risks/new">
                <Plus aria-hidden="true" className="size-4" />
                {risks.register.createAction}
              </Link>
            </Button>
          ) : null
        }
      />

      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <RiskRegisterView />
      </Suspense>
    </div>
  );
}
