'use client';

/**
 * PharosGRC — new process route (T048). `ProcessForm` navigates to
 * `/processes/{id}` on a successful create — this route stays a thin
 * composition of the page chrome and the reusable form.
 */
import { PageHeader } from '@pharos/design-system/components';

import { ProcessForm } from '@/features/processes/components/process-form';
import { processes } from '@/lib/messages/processes';

export default function NewProcessPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={processes.form.createTitle}
        description={processes.form.createDescription}
      />
      <ProcessForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
