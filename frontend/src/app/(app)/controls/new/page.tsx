'use client';

import { PageHeader } from '@pharos/design-system/components';

import { ControlForm } from '@/features/controls/components/control-form';
import { controls } from '@/lib/messages/controls';

export default function NewControlPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={controls.form.createTitle} description={controls.form.createDescription} />
      <ControlForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
