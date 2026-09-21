import { z } from 'zod';

import { incidents } from '../messages/incidents';

/**
 * Client-side shape/presence validation for `IncidentForm` (008-incidents-
 * problems, US1), mirroring `lib/validation/findings.ts`'s own shape —
 * `z.string().min(1, ...)` for every required select/text field, the server
 * as the sole authority on anything beyond presence (org unit scope,
 * referenced records, etc.) per `CreateIncidentRequest`/
 * `UpdateIncidentRequest` in `contracts/incidents.openapi.yaml`.
 *
 * `ownerUserId` carries NO presence rule — the contract's own
 * `CreateIncidentRequest.ownerUserId` is optional and "defaults to the
 * caller when omitted" — an empty selection is a valid, meaningful value
 * here, never a validation error.
 */
export const incidentFormSchema = z.object({
  title: z
    .string()
    .min(1, incidents.form.validation.title.required)
    .max(300, incidents.form.validation.title.tooLong),
  description: z.string().min(1, incidents.form.validation.description.required),
  severity: z.string().min(1, incidents.form.validation.severity.required),
  orgUnitId: z.string().min(1, incidents.form.validation.orgUnit.required),
  ownerUserId: z.string(),
  reportedOn: z.string().min(1, incidents.form.validation.reportedOn.required),
});

export type IncidentFormValues = z.infer<typeof incidentFormSchema>;
