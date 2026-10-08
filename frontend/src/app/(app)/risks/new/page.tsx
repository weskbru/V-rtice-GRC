'use client';

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
