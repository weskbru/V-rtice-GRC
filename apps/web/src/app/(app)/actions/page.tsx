'use client';

/**
 * PharosGRC — "Minhas ações" route (T056/T057, 002-shared-grc-foundation,
 * US2, R-009). The one new sidebar entry this whole phase adds
 * (`navigation-registry.ts`'s own entry).
 *
 * `'use client'` here for the SAME reason `risks/page.tsx` carries it:
 * `@pharos/design-system/components`'s barrel re-exports both server-safe
 * and client-only modules (e.g. `data-table/use-disclosure-close.ts`, a
 * plain hook file with no `'use client'` of its own — it relies on being
 * reached only through an already-client module graph). Importing
 * `PageHeader` from a SERVER Component pulls the whole barrel into the
 * server graph and fails the build ("You're importing a component that
 * needs `useEffect`...") — confirmed by reproducing it against the running
 * dev server before adding this directive. Every other route in this app
 * that renders a `@pharos/design-system/components` import is `'use
 * client'` for the identical reason.
 *
 * `MyActionsView` now reads `useSearchParams()` (via
 * `useActionsRegisterState`, brought into the shared register family —
 * CLAUDE.md §18.12), which Next.js requires behind a `<Suspense>` boundary,
 * mirroring `risks/page.tsx`/`(app)/controls/page.tsx`.
 */
import { LoadingState, PageHeader } from '@pharos/design-system/components';
import { Suspense } from 'react';

import { MyActionsView } from '@/features/actions/components/my-actions-view';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';

export default function ActionsPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={actions.myActions.pageTitle}
        description={actions.myActions.pageDescription}
      />
      <Suspense
        fallback={<LoadingState variant="table" rows={10} label={common.dataTable.loading} />}
      >
        <MyActionsView />
      </Suspense>
    </div>
  );
}
