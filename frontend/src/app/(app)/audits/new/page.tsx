'use client';

import { AuditEngagementForm } from '@/features/audit-engagements/components/audit-engagement-form';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { PageHeader } from '@vertice/design-system/components';

export default function NewAuditEngagementPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={auditEngagements.form.createTitle}
        description={auditEngagements.form.createDescription}
      />
      <AuditEngagementForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
