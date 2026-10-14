'use client';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { processes } from '@/lib/messages/processes';
import { DetailPanel } from '@vertice/design-system/components';

import { ProcessForm } from '../process-form';

import type { ProcessDetail } from '../../types';

export interface ProcessEditPanelProps {
  process: ProcessDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (process: ProcessDetail) => void;
}

export function ProcessEditPanel({
  process,
  onOpenChange,
  onSaved,
}: ProcessEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{processes.form.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={processes.form.editTitle}
          header={
            <h2 className="text-base font-semibold text-foreground">{processes.form.editTitle}</h2>
          }
        >
          <ProcessForm
            mode="edit"
            process={process}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
