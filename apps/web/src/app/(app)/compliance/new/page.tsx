'use client';

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
