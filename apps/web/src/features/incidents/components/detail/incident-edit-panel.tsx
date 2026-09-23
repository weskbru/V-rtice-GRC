'use client';

import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { incidents } from '@/lib/messages/incidents';

import { IncidentForm } from '../incident-form';

import type { IncidentDetail } from '../../types';

export interface IncidentEditPanelProps {
  incident: IncidentDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: IncidentDetail) => void;
}

export function IncidentEditPanel({
  incident,
  onOpenChange,
  onSaved,
}: IncidentEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{incidents.form.editHeading}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={incidents.form.editHeading}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">
                {incidents.form.editHeading}
              </h2>
              <p className="text-sm text-muted-foreground">{incidents.form.editDescription}</p>
            </>
          }
        >
          <IncidentForm mode="edit" incident={incident} onSaved={onSaved} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
