'use client';

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
