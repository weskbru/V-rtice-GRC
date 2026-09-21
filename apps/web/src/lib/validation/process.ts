import { z } from 'zod';

import { processes } from '../messages/processes';

/**
 * Client-side shape/presence validation for the process create/edit form
 * (T048). Mirrors `lib/validation/asset.ts` shape-for-shape (FR-020: the
 * two contracts are "identical in form") — see that file's own header
 * comment for the full reasoning behind `description` carrying no
 * presence rule despite the server's own `MinLength(1)`.
 */
export const processFormSchema = z.object({
  name: z
    .string()
    .min(1, processes.form.validation.name.required)
    .max(300, processes.form.validation.name.tooLong),
  description: z.string(),
  orgUnitId: z.string().min(1, processes.form.validation.orgUnit.required),
});

export type ProcessFormValues = z.infer<typeof processFormSchema>;
