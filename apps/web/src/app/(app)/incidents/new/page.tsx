'use client';

import { PageHeader } from '@pharos/design-system/components';

import { IncidentForm } from '@/features/incidents/components/incident-form';
import { incidents } from '@/lib/messages/incidents';

export default function NewIncidentPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={incidents.form.createHeading} />
      <IncidentForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
