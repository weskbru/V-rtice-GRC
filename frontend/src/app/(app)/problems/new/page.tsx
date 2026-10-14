'use client';

import { ProblemForm } from '@/features/problems/components/problem-form';
import { problems } from '@/lib/messages/problems';
import { PageHeader } from '@vertice/design-system/components';

export default function NewProblemPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={problems.form.createTitle} description={problems.form.createDescription} />
      <ProblemForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
