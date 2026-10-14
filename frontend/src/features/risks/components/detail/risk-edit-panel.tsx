'use client';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { risks } from '@/lib/messages/risks';
import { DetailPanel } from '@vertice/design-system/components';

import { RiskForm } from '../risk-form';

import type { RiskDetail } from '../../types';

export interface RiskEditPanelProps {
  risk: RiskDetail;
  etag: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: { risk: RiskDetail; etag: string }) => void;
}

export function RiskEditPanel({
  risk,
  etag,
  onOpenChange,
  onSaved,
}: RiskEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{risks.form.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={risks.form.editTitle}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">{risks.form.editTitle}</h2>
              <p className="text-sm text-muted-foreground">{risks.form.editDescription}</p>
            </>
          }
        >
          <RiskForm mode="edit" risk={risk} etag={etag} onSaved={onSaved} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
