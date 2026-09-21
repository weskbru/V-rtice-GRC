'use client';

/**
 * PharosGRC — new problem route (008-incidents-problems, US2). `ProblemForm`
 * navigates to `/problems/{id}` on a successful create — this route stays
 * a thin composition of the page chrome and the reusable form.
 */
import { PageHeader } from '@pharos/design-system/components';

import { ProblemForm } from '@/features/problems/components/problem-form';
import { problems } from '@/lib/messages/problems';

export default function NewProblemPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={problems.form.createTitle} description={problems.form.createDescription} />
      <ProblemForm mode="create" onSaved={() => undefined} />
    </div>
  );
}
