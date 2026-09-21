import { z } from 'zod';

import { problems } from '../messages/problems';

/**
 * Client-side shape/presence validation for `ProblemForm` (008-incidents-
 * problems, US2), mirroring `contracts/problems.openapi.yaml`'s
 * `CreateProblemRequest`/`UpdateProblemRequest` on shape only — full
 * business validation (target org unit inside the caller's authorized
 * scope) happens exclusively on the server and arrives as 422 field
 * errors, the same discipline `lib/validation/asset.ts`/
 * `lib/validation/findings.ts` already establish.
 *
 * `status`/`code`/`rootCause` are deliberately absent — `UpdateProblemRequest`
 * never accepts them (the contract's own description); the transition
 * endpoint is the only writer of the lifecycle fields.
 */
export const problemFormSchema = z.object({
  title: z.string().min(1, problems.form.validation.title.required),
  description: z.string().min(1, problems.form.validation.description.required),
  severity: z.string().min(1, problems.form.validation.severity.required),
  orgUnitId: z.string().min(1, problems.form.validation.orgUnit.required),
  ownerUserId: z.string(),
  identifiedOn: z.string().min(1, problems.form.validation.identifiedOn.required),
});

export type ProblemFormValues = z.infer<typeof problemFormSchema>;
