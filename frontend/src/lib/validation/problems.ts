import { z } from 'zod';

import { problems } from '../messages/problems';

export const problemFormSchema = z.object({
  title: z.string().min(1, problems.form.validation.title.required),
  description: z.string().min(1, problems.form.validation.description.required),
  severity: z.string().min(1, problems.form.validation.severity.required),
  orgUnitId: z.string().min(1, problems.form.validation.orgUnit.required),
  ownerUserId: z.string(),
  identifiedOn: z.string().min(1, problems.form.validation.identifiedOn.required),
});

export type ProblemFormValues = z.infer<typeof problemFormSchema>;
