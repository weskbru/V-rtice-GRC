'use client';

import { ProcessForm } from '@/features/processes/components/process-form';
import { processes } from '@/lib/messages/processes';
import { PageHeader } from '@vertice/design-system/components';

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
