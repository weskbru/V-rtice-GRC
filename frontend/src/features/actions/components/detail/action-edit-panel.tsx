'use client';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { actions } from '@/lib/messages/actions';
import { DetailPanel } from '@vertice/design-system/components';

import { ActionEditForm } from '../action-edit-form';

import type { Action } from '../../types';

export interface ActionEditPanelProps {
  action: Action;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Action) => void;
}

export function ActionEditPanel({
  action,
  onOpenChange,
  onSaved,
}: ActionEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{actions.detail.form.editHeading}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={actions.detail.form.editHeading}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">
                {actions.detail.form.editHeading}
              </h2>
              <p className="text-sm text-muted-foreground">{actions.detail.form.editDescription}</p>
            </>
          }
        >
          <ActionEditForm action={action} onSaved={onSaved} onCancel={() => onOpenChange(false)} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
