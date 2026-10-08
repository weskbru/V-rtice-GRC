'use client';

import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { problems } from '@/lib/messages/problems';

import { ProblemForm } from '../problem-form';

import type { ProblemDetail } from '../../types';

export interface ProblemEditPanelProps {
  problem: ProblemDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: ProblemDetail) => void;
}

export function ProblemEditPanel({
  problem,
  onOpenChange,
  onSaved,
}: ProblemEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{problems.form.editHeading}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={problems.form.editHeading}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">
                {problems.form.editHeading}
              </h2>
              <p className="text-sm text-muted-foreground">{problems.form.editDescription}</p>
            </>
          }
        >
          <ProblemForm mode="edit" problem={problem} onSaved={onSaved} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
