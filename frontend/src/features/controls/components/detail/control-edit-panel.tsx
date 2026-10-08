'use client';

import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { controls } from '@/lib/messages/controls';

import { ControlForm } from '../control-form';

import type { ControlDetail } from '../../types';

export interface ControlEditPanelProps {
  control: ControlDetail;
  etag: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: { control: ControlDetail; etag: string }) => void;
}

export function ControlEditPanel({
  control,
  etag,
  onOpenChange,
  onSaved,
}: ControlEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{controls.form.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={controls.form.editTitle}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">{controls.form.editTitle}</h2>
              <p className="text-sm text-muted-foreground">{controls.form.editDescription}</p>
            </>
          }
        >
          <ControlForm
            mode="edit"
            control={control}
            etag={etag}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
