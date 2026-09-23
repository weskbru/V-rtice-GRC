import { z } from 'zod';

import { processes } from '../messages/processes';

export const processFormSchema = z.object({
  name: z
    .string()
    .min(1, processes.form.validation.name.required)
    .max(300, processes.form.validation.name.tooLong),
  description: z.string(),
  orgUnitId: z.string().min(1, processes.form.validation.orgUnit.required),
});

export type ProcessFormValues = z.infer<typeof processFormSchema>;
