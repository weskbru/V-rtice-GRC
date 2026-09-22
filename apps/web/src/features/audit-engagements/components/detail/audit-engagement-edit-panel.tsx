'use client';

import { DetailPanel } from '@pharos/design-system/components';

import { AuditEngagementForm } from '../audit-engagement-form';

import type { AuditEngagement } from '../../types';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { auditEngagements } from '@/lib/messages/audit-engagements';

export interface AuditEngagementEditPanelProps {
  engagement: AuditEngagement;
  etag: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: { engagement: AuditEngagement; etag: string }) => void;
}

export function AuditEngagementEditPanel({
  engagement,
  etag,
  onOpenChange,
  onSaved,
}: AuditEngagementEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{auditEngagements.form.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={auditEngagements.form.editTitle}
          header={
            <h2 className="text-base font-semibold text-foreground">
              {auditEngagements.form.editTitle}
            </h2>
          }
        >
          <AuditEngagementForm
            mode="edit"
            engagement={engagement}
            etag={etag}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
