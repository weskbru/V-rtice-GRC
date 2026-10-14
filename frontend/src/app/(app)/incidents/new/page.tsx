'use client';

import { IncidentForm } from '@/features/incidents/components/incident-form';
import { incidents } from '@/lib/messages/incidents';
import { PageHeader } from '@vertice/design-system/components';

export default function NewIncidentPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={incidents.form.createHeading} />
      <IncidentForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
