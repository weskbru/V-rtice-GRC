'use client';

import { DetailPanel } from '@pharos/design-system/components';

import { FrameworkForm } from '../framework-form';

import type { Framework } from '../../types';
import type { FrameworkFormSavedResult } from '../framework-form';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { compliance } from '@/lib/messages/compliance';

export interface FrameworkEditPanelProps {
  framework: Framework;
  etag: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: FrameworkFormSavedResult) => void;
}

export function FrameworkEditPanel({
  framework,
  etag,
  onOpenChange,
  onSaved,
}: FrameworkEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{compliance.frameworkForm.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={compliance.frameworkForm.editTitle}
          header={
            <h2 className="text-base font-semibold text-foreground">
              {compliance.frameworkForm.editTitle}
            </h2>
          }
        >
          <FrameworkForm
            mode="edit"
            framework={framework}
            etag={etag}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
