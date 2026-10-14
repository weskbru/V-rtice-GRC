'use client';

import { Suspense } from 'react';

import { MyActionsView } from '@/features/actions/components/my-actions-view';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';
import { LoadingState, PageHeader } from '@vertice/design-system/components';

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
