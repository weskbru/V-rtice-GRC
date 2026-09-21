'use client';

/**
 * PharosGRC — new risk route (T095, FR-053 to FR-056).
 *
 * `RiskForm` itself navigates to `/risks/{id}` on a successful create — see
 * its own doc comment — so this route stays a thin composition of the page
 * chrome and the reusable form.
 */
import { PageHeader } from '@pharos/design-system/components';

import { RiskForm } from '@/features/risks/components/risk-form';
import { risks } from '@/lib/messages/risks';

export default function NewRiskPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={risks.form.createTitle} description={risks.form.createDescription} />
      <RiskForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
