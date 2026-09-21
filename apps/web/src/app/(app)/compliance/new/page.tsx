'use client';

/**
 * PharosGRC — new framework route (US1). `FrameworkForm` navigates to
 * `/compliance/{id}` on a successful create — this route stays a thin
 * composition of the page chrome and the reusable form.
 */
import { PageHeader } from '@pharos/design-system/components';

import { FrameworkForm } from '@/features/compliance/components/framework-form';
import { compliance } from '@/lib/messages/compliance';

export default function NewFrameworkPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={compliance.frameworkForm.createTitle}
        description={compliance.frameworkForm.createDescription}
      />
      <FrameworkForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
