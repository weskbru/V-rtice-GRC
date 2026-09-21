'use client';

/**
 * PharosGRC — new incident route (008-incidents-problems, US1).
 * `IncidentForm` navigates to `/incidents/{id}` on a successful create —
 * this route stays a thin composition of the page chrome and the reusable
 * form, mirroring `(app)/assets/new/page.tsx`.
 */
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
